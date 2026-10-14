import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';

const source = await readFile(new URL('../src/scene/frameOutput.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replaceAll(/from '([^']+)'/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
const { FrameOutput, makeOcclusionPipeline } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

function fixture(t, { workspace = true, initialReset = true, pipelineFactory } = {}) {
  const originalDocument = globalThis.document;
  const images = [];
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: image => images.push(image),
  }) }) };
  const rect = (left, top, width, height) => ({ left, top, width, height });
  const parent = { getBoundingClientRect: () => rect(10, 20, 100, 100) };
  const host = { closest: () => workspace ? parent : null, getBoundingClientRect: () => rect(10, 40, 100, 80) };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const calls = [];
  let failRender = false;
  const renderer = {
    domElement: { width: 100, height: 80 }, autoClear: true,
    info: { autoReset: initialReset, reset: () => calls.push({ kind: 'reset' }) },
    render(object, view) {
      const kind = object === scene ? 'scene' : 'fxaa';
      calls.push({ kind, object, view, autoClear: this.autoClear });
      if (kind === 'scene' && failRender) throw new Error('interrupted output');
    },
    copyFramebufferToTexture: texture => calls.push({ kind: 'copy', texture }),
  };
  const output = new FrameOutput(renderer, scene, host, pipelineFactory);
  let disposed = false;
  const dispose = () => { if (!disposed) output.dispose(); disposed = true; };
  t.after(() => { dispose(); globalThis.document = originalDocument; });
  return { output, renderer, scene, camera, calls, images, dispose, interrupt: () => { failRender = true; } };
}

test('local-clock backdrop replaces its texture once and keeps idle night dark',t=>{
  const {output,camera,scene,images}=fixture(t);
  output.render(camera,false);const prior=scene.background;let disposed=0;prior.addEventListener('dispose',()=>disposed++);
  output.setBackdrop('#203040','#102030','#142536');output.render(camera,false);
  assert.equal(disposed,1);assert.notEqual(scene.background,prior);
  const count=images.length;output.setBackdrop('#203040','#102030','#142536');output.render(camera,false);assert.equal(images.length,count);
  assert.ok(images.at(-1).data[0]<40,'cached background pixels really darken');
  output.render(camera,true);assert.equal(scene.background.getHexString(),'142536');
});

test('unsupported renderer keeps the direct opaque output without a framebuffer copy', t => {
  const { output, renderer, scene, camera, calls } = fixture(t);
  output.render(camera, false);
  assert.deepEqual(calls.map(call => call.kind), ['reset', 'scene']);
  assert.equal(calls[1].object, scene);
  assert.equal(calls[1].view, camera);
  assert.equal(calls[1].autoClear, true);
  assert.equal(renderer.autoClear, true);
  assert.equal(renderer.info.autoReset, false, 'one explicit reset tracks the complete scene');
  output.render(camera, false);
  assert.deepEqual(calls.map(call => call.kind), ['reset', 'scene', 'reset', 'scene']);
});

test('contact shading initializes once, resizes only with the backing buffer, and owns disposal', t => {
  const events = [];
  const pipeline = { resize: (w, h) => events.push(['size', w, h]), render: camera => events.push(['render', camera]), dispose: () => events.push(['dispose']) };
  const { output, renderer, camera, calls, dispose } = fixture(t, { pipelineFactory: () => { events.push(['create']); return pipeline; } });
  output.render(camera, false); output.render(camera, false);
  assert.deepEqual(events.map(event => event[0]), ['create', 'size', 'render', 'render']);
  assert.deepEqual(calls.map(call => call.kind), ['reset', 'reset'], 'one scene colour draw belongs to the depth-reusing pipeline');
  renderer.domElement.width = 160;
  output.render(camera, false);
  assert.deepEqual(events.at(-2), ['size', 160, 80]);
  output.render(camera, true);
  assert.equal(events.filter(event => event[0] === 'create').length, 1, 'window view reuses the same resources');
  dispose(); assert.equal(events.at(-1)[0], 'dispose');
});

test('contact allocation failure falls back once without changing the background or render cadence', t => {
  let attempts = 0;
  const { output, camera, calls, scene } = fixture(t, { pipelineFactory: () => { attempts++; throw Error('unavailable'); } });
  output.render(camera, false); output.render(camera, false);
  assert.equal(attempts, 1);
  assert.equal(calls.filter(call => call.kind === 'scene').length, 2);
  assert.equal(scene.background.colorSpace, THREE.SRGBColorSpace);
});

test('near surfaces select localized contact shading through the existing pipeline', t => {
  const profiles=[];
  const pipeline={resize(){},render:(_camera,close)=>profiles.push(close),dispose(){}};
  const {output,camera,dispose}=fixture(t,{pipelineFactory:()=>pipeline});
  output.render(camera,false);output.render(camera,false,true);output.render(camera,true,true);output.render(camera,false,false);
  assert.deepEqual(profiles,[false,true,true,false]);dispose();
});

test('lazy GPU draw or resize failure releases shading once and latches direct output', t => {
  for (const failure of ['render', 'resize']) {
    let creates = 0, disposals = 0;
    const { output, renderer, camera, calls } = fixture(t, { pipelineFactory: () => {
      creates++;
      return { resize() { if (failure === 'resize') throw Error('GPU resize unavailable'); },
        render() { throw Error('GPU allocation unavailable'); }, dispose() { disposals++; } };
    } });
    output.render(camera, false); output.render(camera, false);
    renderer.domElement.width++;
    output.render(camera, false);
    output.dispose(); output.dispose();
    assert.equal(creates, 1); assert.equal(disposals, 1);
    assert.equal(calls.filter(call => call.kind === 'scene').length, 3);
  }
});

test('real GTAO reuses one geometry draw, caps its targets, and restores interrupted clear/background state', () => {
  for (const failAt of [0, 2, 3, 4]) {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    scene.background = new THREE.Color('#f5f3ed');
    const originalBackground = scene.background, initial = { name: 'previous' };
    let target = initial, alpha = .3, draws = 0;
    const colour = new THREE.Color('#123456'), targets = [];
    const renderer = { capabilities: { maxSamples: 2 }, getContext: () => ({}), autoClear: false,
      getRenderTarget: () => target, setRenderTarget(value) { target = value; if (value !== initial) targets.push(value); },
      getClearColor: out => out.copy(colour), getClearAlpha: () => alpha,
      setClearColor(value, opacity) { colour.set(value); if (opacity !== undefined) alpha = opacity; },
      setClearAlpha(value) { alpha = value; }, clear() {},
      render(object) {
        draws++;
        if (draws === 1) {
          assert.equal(object, scene); assert.equal(scene.background, null);
          assert.equal(alpha, 0, 'coverage excludes the backdrop, including depth-write-free walls');
          assert.equal(renderer.autoClear, true);
        } else assert.notEqual(object, scene, 'remaining work is full-screen shading, not repeated geometry');
        if (draws === failAt) throw Error('AO draw interrupted');
      },
    };
    const pipeline = makeOcclusionPipeline(renderer, scene, camera);
    pipeline.resize(4096, 2160);
    if (failAt) assert.throws(() => pipeline.render(camera), /AO draw interrupted/);
    else { pipeline.render(camera); assert.equal(draws, 4); }
    assert.equal(target, initial); assert.equal(renderer.autoClear, false);
    assert.equal(colour.getHexString(), '123456'); assert.equal(alpha, .3);
    assert.equal(scene.background, originalBackground);
    assert.equal(targets[0].width, 1600); assert.equal(targets[0].height, 844);
    assert.ok(targets.slice(1).every(value => value.width <= 800 && value.height <= 800));
    let released = 0; targets[0].addEventListener('dispose', () => released++);
    pipeline.dispose(); pipeline.dispose(); assert.equal(released, 1);
  }
});

test('cached sRGB background matches the warm ellipse including the workspace heading offset', t => {
  const { output, scene, camera, images } = fixture(t);
  output.render(camera, false);
  assert.equal(images.length, 1);
  assert.equal(scene.background.colorSpace, THREE.SRGBColorSpace);
  const image = images[0];
  assert.deepEqual([...image.data.slice(0, 4)], [245, 243, 237, 255], 'outer CSS color');
  const center = (21 * image.width + 49) * 4;
  assert.deepEqual([...image.data.slice(center, center + 4)], [251, 249, 241, 255], 'center is above canvas midpoint after heading offset');
  const background = scene.background;
  output.render(camera, false);
  output.render(camera, false);
  assert.equal(images.length, 1, 'no image generation while scene animates');
  assert.equal(scene.background, background);
});

test('view changes and resize replace owned textures and preserve the solid idle background', t => {
  const { output, renderer, scene, camera, calls, images, dispose } = fixture(t);
  output.render(camera, false);
  const background = scene.background;
  let backgroundDisposals = 0;
  background.addEventListener('dispose', () => backgroundDisposals++);
  output.render(camera, true);
  assert.equal(scene.background.getHexString(), 'c4c0aa');
  assert.equal(backgroundDisposals, 1);
  renderer.domElement.height = 60;
  output.render(camera, false);
  assert.equal(calls.filter(call => call.kind === 'copy').length, 0, 'resize still uses direct rendering');
  assert.equal(images.length, 2);
  assert.equal(images[1].height, 60);
  output.invalidateBackground();
  output.render(camera, false);
  assert.equal(images.length, 3, 'layout changes can invalidate the heading-relative background');
  dispose();
  assert.equal(scene.background, null);
  assert.equal(renderer.info.autoReset, true);
});

test('standalone hosts use the existing warm base and interrupted drawing leaves renderer state intact', t => {
  const { output, renderer, scene, camera, images, dispose, interrupt } = fixture(t, { workspace: false, initialReset: false });
  output.render(camera, false);
  assert.equal(scene.background.getHexString(), 'f5f3ed');
  assert.equal(images.length, 0);
  interrupt();
  assert.throws(() => output.render(camera, false), /interrupted output/);
  assert.equal(renderer.autoClear, true);
  dispose();
  assert.equal(renderer.info.autoReset, false);
});
