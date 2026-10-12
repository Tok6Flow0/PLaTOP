import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';

const source = await readFile(new URL('../src/scene/frameOutput.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replaceAll(/from '([^']+)'/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
const { FrameOutput } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

function fixture(t, { workspace = true, initialReset = true } = {}) {
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
  const output = new FrameOutput(renderer, scene, host);
  let disposed = false;
  const dispose = () => { if (!disposed) output.dispose(); disposed = true; };
  t.after(() => { dispose(); globalThis.document = originalDocument; });
  return { output, renderer, scene, camera, calls, images, dispose, interrupt: () => { failRender = true; } };
}

test('opaque MSAA output draws directly once without a framebuffer copy or post-process', t => {
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
