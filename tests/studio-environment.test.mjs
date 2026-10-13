import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';

async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText.replaceAll(/from '([^']+)'/g, (_, name) => `from ${JSON.stringify(imports[name] ?? import.meta.resolve(name))}`);
  return `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`;
}
const primitivesUrl = await moduleUrl('../src/scene/primitives.ts');
const { SceneKit, disposeObject } = await import(primitivesUrl);
const { leafGeometry, tidyStaticMeshes, beveledBlock } = await import(await moduleUrl('../src/scene/environmentProps.ts', { './primitives': primitivesUrl }));
const { StudioEnvironment, StudioRoomFinishes, roomLightingFactor } = await import(await moduleUrl('../src/scene/studioEnvironment.ts'));

test('soft studio lighting bakes once and owns only its prefiltered target', () => {
  const scene = new THREE.Scene();
  const previous = new THREE.Texture();
  scene.environment = previous;
  scene.environmentIntensity = 0.9;
  const target = new THREE.WebGLRenderTarget(16, 16);
  let baked = 0, disposed = 0;
  target.addEventListener('dispose', () => disposed++);
  const studio = new StudioEnvironment({}, scene, () => { baked++; return target; });
  assert.equal(baked, 1);
  assert.equal(scene.environment, target.texture);
  assert.equal(scene.environmentIntensity, 0.32);
  studio.dispose(); studio.dispose();
  assert.equal(disposed, 1);
  assert.equal(scene.environment, previous);
  assert.equal(scene.environmentIntensity, 0.9);
  previous.dispose();
});

test('unsupported environment allocation keeps daylight intact and respects another owner on disposal', () => {
  const scene = new THREE.Scene();
  const previous = new THREE.Texture();
  scene.environment = previous;
  const failed = new StudioEnvironment({}, scene, () => { throw new Error('allocation failed'); });
  assert.equal(scene.environment, previous);
  failed.dispose();
  const target = new THREE.WebGLRenderTarget(16, 16);
  const studio = new StudioEnvironment({}, scene, () => target);
  const next = new THREE.Texture();
  scene.environment = next;
  studio.dispose();
  assert.equal(scene.environment, next);
  previous.dispose(); next.dispose();
});

test('cupped botanical leaves have continuous normals, pointed ends and a bounded triangle budget', () => {
  for (const options of [[false, false, false], [true, false, false], [false, true, false], [false, false, true]]) {
    const geometry = leafGeometry(...options);
    assert.equal(geometry.getAttribute('position').count, 44);
    assert.equal(geometry.index.count / 3, 56);
    const positions = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    assert.ok([...normal.array].every(Number.isFinite));
    for (let index = 0; index < positions.count; index++) {
      const length = Math.hypot(normal.getX(index), normal.getY(index), normal.getZ(index));
      assert.ok(Math.abs(length - 1) < 1e-6);
    }
    const point = index => new THREE.Vector3().fromBufferAttribute(positions, index);
    for (let triangle = 0; triangle < geometry.index.count; triangle += 3) {
      const a = point(geometry.index.getX(triangle)), b = point(geometry.index.getX(triangle + 1)), c = point(geometry.index.getX(triangle + 2));
      assert.ok(new THREE.Vector3().crossVectors(b.sub(a), c.sub(a)).lengthSq() > 1e-14, 'no collapsed triangle at a pointed end');
    }
    for (let row = 0; row < 14; row++) {
      const start = 1 + row * 3;
      for (let side = 0; side < 2; side++) {
        assert.ok(point(start + side).x < point(start + side + 1).x, 'the cup does not fold over itself');
        const a = new THREE.Vector3().fromBufferAttribute(normal, start + side), b = new THREE.Vector3().fromBufferAttribute(normal, start + side + 1);
        assert.ok(a.dot(b) > 0.7, 'adjacent ribs shade as a continuous leaf');
      }
    }
    geometry.dispose();
  }
});

test('room palette recolours only semantic finish vertices and resets exactly without touching another room', () => {
  const kit = new SceneKit();
  const rooms = new Map(['merchant', 'hr'].map(id => {
    const root = new THREE.Group();
    root.userData.roomPalette = { wall: '#b77d59', rug: '#b67655', furniture: '#c59e73' };
    const wall = kit.mesh(root, 'box', '#b77d59', [0, 0, 0], [1, 1, 1]);
    wall.userData.roomSurface = 'wall';
    kit.mesh(root, 'sphere', '#507140', [1, 0, 0], [1, 1, 1]);
    const furniture = kit.mesh(root, 'box', '#a77e53', [2, 0, 0], [1, 1, 1]);
    furniture.userData.roomSurface = 'furniture';
    tidyStaticMeshes(root);
    return [id, { root }];
  }));
  const finish = new StudioRoomFinishes(rooms);
  const mesh = rooms.get('merchant').root.children[0];
  const colors = mesh.geometry.getAttribute('color');
  const baseline = new Float32Array(colors.array);
  const otherBaseline = new Float32Array(rooms.get('hr').root.children[0].geometry.getAttribute('color').array);
  const mask = mesh.geometry.userData.roomSurfaceRoles;
  const firstWall = mask.findIndex(role => role === 1), firstPlant = mask.findIndex(role => role === 0);
  assert.equal(finish.sync(undefined), false);
  assert.equal(finish.sync({ merchant: { id: 'first', palette: {}, lighting: { mode: 'night' } } }), false);
  const style = { merchant: { id: 'first', palette: { wall: '#627d98', furniture: '#bc7360' }, lighting: {} } };
  assert.equal(finish.sync(style), true);
  const expected = new THREE.Color('#627d98');
  assert.ok(Math.abs(colors.getX(firstWall) - expected.r) < 1e-6);
  assert.ok(Math.abs(colors.getY(firstWall) - expected.g) < 1e-6);
  assert.ok(Math.abs(colors.getZ(firstWall) - expected.b) < 1e-6);
  assert.deepEqual([...colors.array.slice(firstPlant * 3, firstPlant * 3 + 3)], [...baseline.slice(firstPlant * 3, firstPlant * 3 + 3)]);
  assert.deepEqual(rooms.get('hr').root.children[0].geometry.getAttribute('color').array, otherBaseline);
  assert.equal(finish.sync({ merchant: { ...style.merchant, id: 'replacement-id' } }), false);
  assert.equal(finish.sync(undefined), true);
  assert.deepEqual(colors.array, baseline);
  const resources = new THREE.Group();
  for (const { root } of rooms.values()) resources.add(root, root.userData.staticSources);
  disposeObject(resources); kit.dispose();
});

test('retired static sources remain outside the scene and their unique geometry can be released once', () => {
  const root = new THREE.Group(), kit = new SceneKit();
  const unique = beveledBlock(root, kit, '#b77d59', [0, 0, 0], [1, 1, 1]);
  kit.mesh(root, 'box', '#b77d59', [1, 0, 0], [1, 1, 1]);
  let released = 0;
  unique.geometry.addEventListener('dispose', () => released++);
  tidyStaticMeshes(root);
  assert.equal(root.children.length, 1);
  assert.equal(root.userData.staticSources.children.length, 2);
  assert.equal(root.userData.staticSources.parent, null);
  const resources = new THREE.Group();
  resources.add(root, root.userData.staticSources);
  disposeObject(resources);
  assert.equal(released, 1);
  kit.dispose();
  assert.equal(released, 1);
});

test('local lamp mood respects brightness, night and explicit off', () => {
  assert.equal(roomLightingFactor(undefined), 1);
  assert.equal(roomLightingFactor({ brightness: 0 }), 0);
  assert.equal(roomLightingFactor({ mode: 'off', brightness: 1.5 }), 0);
  assert.ok(Math.abs(roomLightingFactor({ mode: 'night', brightness: 1.5 }) - 0.525) < 1e-12);
  assert.ok(Math.abs(roomLightingFactor({ mode: 'cozy', brightness: 1.2 }) - 0.9) < 1e-12);
});

test('context restoration rebakes the owned reflection once and releases both generations', () => {
  const scene = new THREE.Scene();
  let bakes = 0, disposed = 0;
  const studio = new StudioEnvironment({}, scene, () => {
    bakes++;
    const target = new THREE.WebGLRenderTarget(16, 16);
    target.addEventListener('dispose', () => disposed++);
    return target;
  });
  const first = scene.environment;
  studio.restore();
  assert.equal(bakes, 2);
  assert.equal(disposed, 1);
  assert.notEqual(scene.environment, first);
  studio.dispose();
  studio.restore();
  assert.equal(bakes, 2);
  assert.equal(disposed, 2);
});
