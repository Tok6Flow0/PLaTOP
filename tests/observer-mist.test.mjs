import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';

const source = await readFile(new URL('../src/scene/observerMist.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replaceAll(/from '([^']+)'/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
const { ObserverMist, makeObserverMist, observerViewportChanged } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

function fixture(t) {
  const camera = new THREE.PerspectiveCamera(14, 1.6, .1, 180);
  camera.position.set(3.7, 16.2, 24.1);
  camera.lookAt(1.2, .7, -2.5);
  camera.setViewOffset(1000, 625, 0, 12.5, 1000, 625);
  camera.updateMatrixWorld(true);
  const orbit = { target: new THREE.Vector3(1.2, .7, -2.5), cursor: new THREE.Vector3(-.8, .7, 1.1), enabled: true };
  const bounds = new THREE.Box3(new THREE.Vector3(-12, .3, -12), new THREE.Vector3(12, 8, 12));
  const observer = new ObserverMist(camera, orbit, bounds);
  t.after(() => observer.dispose());
  return { camera, orbit, bounds, observer };
}

function cameraSnapshot(camera, orbit) {
  return { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), up: camera.up.toArray(),
    target: orbit.target.toArray(), cursor: orbit.cursor.toArray(), enabled: orbit.enabled,
    fov: camera.fov, near: camera.near, far: camera.far, zoom: camera.zoom, view: camera.view ? { ...camera.view } : null,
    projection: camera.projectionMatrix.toArray() };
}

test('explicit entry changes only the local camera and exact exit restores the orbit snapshot', t => {
  const { camera, orbit, observer } = fixture(t);
  const before = cameraSnapshot(camera, orbit);
  assert.equal(observer.active, false);
  assert.equal(observer.mist.root.visible, false);
  assert.equal(observer.enter(), true);
  assert.equal(observer.enter(), false, 'a second entry cannot overwrite the saved orbit');
  assert.equal(observer.active, true);
  assert.equal(orbit.enabled, false);
  assert.equal(camera.fov, 45);
  assert.equal(camera.near, .035);
  assert.equal(camera.view?.enabled, false);
  observer.move('forward'); observer.look(.4, -.2); observer.setMode('first-person');
  assert.equal(observer.exit(), true);
  assert.deepEqual(cameraSnapshot(camera, orbit), before);
  assert.equal(observer.exit(), false);
  assert.equal(observer.mist.root.visible, false);
});

test('first person hides the mist, third person reveals the soft mesh volume and keeps a safe camera', t => {
  const { camera, bounds, observer } = fixture(t);
  assert.equal(observer.setMode('first-person'), false);
  assert.equal(observer.enter('first-person'), true);
  assert.equal(observer.mist.root.visible, false);
  assert.equal(camera.fov, 55);
  assert.deepEqual(camera.position.toArray(), observer.position.toArray());
  assert.equal(observer.setMode('third-person'), true);
  assert.equal(observer.mist.root.visible, true);
  assert.equal(camera.fov, 45);
  assert.equal(observer.setMode('invalid'), false);
  for (let index = 0; index < 150; index++) { observer.move('down'); observer.look(.25, .25); }
  assert.ok(bounds.containsPoint(camera.position));
  assert.ok(bounds.containsPoint(observer.position));
  assert.ok(camera.position.toArray().every(Number.isFinite));
});

test('mist floats through occupied solids with only outer world bounds and no agent mutation', t => {
  const { observer, bounds } = fixture(t);
  const agent = Object.freeze({ id: 'bridge-jarvis', x: 1.2, y: 1.7, z: -2.5, mode: 'work' });
  const wall = new THREE.Box3(new THREE.Vector3(-4, .3, -5), new THREE.Vector3(4, 4, -4.5));
  const before = JSON.stringify(agent);
  observer.enter('first-person');
  observer.look(-observer.yaw, 0);
  assert.equal(observer.move('forward', 1), true);
  assert.equal(observer.move('forward', 1), true);
  assert.ok(wall.containsPoint(observer.position), 'a wall cannot block observer travel');
  for (let index = 0; index < 100; index++) observer.move('forward', 1);
  assert.equal(observer.position.z, bounds.min.z);
  assert.equal(observer.move('forward'), false, 'the outer envelope still bounds exploration');
  assert.equal(JSON.stringify(agent), before);
  assert.doesNotMatch(source, /from ['"][^'"]*(?:officeNavigation|officeAssets|agentExpression|bridge|api|teams)/);
  assert.doesNotMatch(source, /fetch\s*\(|localStorage|dispatchEvent|requestAnimationFrame|setInterval|setTimeout/);
});

test('invalid input cannot create non-finite camera coordinates, runaway pitch or unbounded steps', t => {
  const { camera, observer } = fixture(t);
  assert.equal(observer.move('forward'), false);
  observer.enter();
  const before = observer.position.toArray();
  for (const value of [NaN, Infinity, -Infinity, 0, -1]) assert.equal(observer.move('forward', value), false);
  assert.equal(observer.move('invalid'), false);
  assert.deepEqual(observer.position.toArray(), before);
  assert.equal(observer.look(NaN, .2), false);
  assert.equal(observer.look(.2, Infinity), false);
  assert.equal(observer.look(0, 0), false);
  for (let index = 0; index < 1000; index++) observer.look(1e10, 1e10);
  assert.ok(Math.abs(observer.pitch) <= Math.PI * .43);
  assert.ok(observer.yaw >= -Math.PI && observer.yaw <= Math.PI);
  assert.ok(camera.position.toArray().every(Number.isFinite));
  const from = observer.position.clone(); observer.move('up', 100000);
  assert.ok(observer.position.distanceTo(from) <= 1 + 1e-9);
  observer.resize(NaN); observer.resize(0); observer.resize(.5);
  assert.equal(camera.aspect, .5);
});

test('all shared mist resources are bounded, translucent and disposed exactly once', () => {
  const mist = makeObserverMist();
  assert.equal(mist.root.children.length, 11);
  const geometries = new Set(), materials = new Set();
  let triangles = 0;
  for (const mesh of mist.root.children) {
    assert.equal(mesh.isMesh, true);
    assert.equal(mesh.castShadow, false);
    assert.equal(mesh.receiveShadow, false);
    geometries.add(mesh.geometry); materials.add(mesh.material);
    assert.equal(mesh.material.depthWrite, false);
    assert.equal(mesh.material.transparent, true);
    assert.equal(mesh.material.blending, THREE.NormalBlending);
    assert.equal(mesh.material.toneMapped, true);
    assert.ok(mesh.material.fragmentShader.indexOf('<tonemapping_fragment>') < mesh.material.fragmentShader.indexOf('<colorspace_fragment>'));
    assert.ok(mesh.position.toArray().every(Number.isFinite));
    triangles += mesh.geometry.index.count / 3;
  }
  assert.ok(triangles < 10000);
  assert.equal(geometries.size, 1); assert.equal(materials.size, 1);
  let disposals = 0;
  for (const resource of [...geometries, ...materials]) resource.addEventListener('dispose', () => disposals++);
  mist.dispose(); mist.dispose();
  assert.equal(disposals, 2);
  assert.equal(mist.root.children.length, 0);
});

test('dispose restores an active camera, removes the local volume and prevents future entry', t => {
  const { camera, orbit, observer } = fixture(t);
  const scene = new THREE.Scene(); scene.add(observer.mist.root);
  const before = cameraSnapshot(camera, orbit);
  observer.enter(); observer.move('up'); observer.dispose(); observer.dispose();
  assert.equal(observer.active, false);
  assert.equal(observer.enter(), false);
  assert.deepEqual(cameraSnapshot(camera, orbit), before);
  assert.equal(scene.children.length, 0);
});

test('exit refits only a changed viewport, leaving same-size camera restoration exact', t => {
  assert.equal(observerViewportChanged(undefined, 1000, 625), false);
  assert.equal(observerViewportChanged({ width: 1000, height: 625 }, 1000, 625), false);
  assert.equal(observerViewportChanged({ width: 1000, height: 625 }, 390, 625), true);
  assert.equal(observerViewportChanged({ width: 1000, height: 625 }, 1000, 844), true);
  const { camera, orbit, observer } = fixture(t);
  const before = cameraSnapshot(camera, orbit);
  observer.enter(); observer.move('right'); observer.exit();
  assert.deepEqual(cameraSnapshot(camera, orbit), before);
});

test('integration is opt-in, close-zoom gated, nonmodal and exits on reset, window view, context loss and teardown', async () => {
  const scene = await readFile(new URL('../src/scene.ts', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../src/Workspace.tsx', import.meta.url), 'utf8');
  assert.match(scene, /const CAMPUS_FOV = 14;/);
  assert.match(scene, /CAMPUS_ELEVATION = THREE.MathUtils.degToRad\(34\)/);
  assert.match(scene, /zoomLevel < CLOSE_ZOOM_THRESHOLD/);
  assert.match(scene, /MAX_CAMPUS_ZOOM = 32/);
  assert.match(scene, /function resetView\(\)[\s\S]*?exitObserver\(\)/);
  assert.match(scene, /function setIdleView\(teamId: string \| null\)[\s\S]*?exitObserver\(\)/);
  assert.match(scene, /function lost\(event: Event\)[\s\S]*?exitObserver\(\)/);
  assert.match(scene, /window.removeEventListener\('keydown', observerEscape\)/);
  assert.match(scene, /observerRig\?\.dispose\(\)/);
  const exit = scene.slice(scene.indexOf('  function exitObserver(): void {'), scene.indexOf('  function setObserverMode('));
  assert.ok(exit.indexOf('observerRig?.exit()') < exit.indexOf('observerViewportChanged('), 'restore before checking the responsive refit');
  assert.match(exit, /observerViewport = undefined;/);
  assert.match(exit, /if \(needsRefit && !disposed\) resize\(\);/, 'same-size exits do not run normal camera fitting');
  const resize = scene.slice(scene.indexOf('  function resize(): void {'), scene.indexOf('  function teamAt('));
  assert.doesNotMatch(resize, /exitObserver\(/, 'responsive fitting cannot recurse into exit');
  assert.match(ui, /onClick=\{\(\) => engine.current\?\.enterObserver\(\)\}/);
  assert.doesNotMatch(ui, /<dialog|aria-modal|autoFocus/);
  for (const direction of ['forward', 'back', 'left', 'right', 'up', 'down']) assert.ok(ui.includes(`moveObserver('${direction}')`));
});
