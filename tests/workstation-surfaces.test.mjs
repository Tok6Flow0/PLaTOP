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
const primitives = await moduleUrl('../src/scene/primitives.ts');
const { SceneKit, disposeObject } = await import(primitives);
const { laptop, monitor, table, chair, plant, rug, lamp, tidyStaticMeshes } = await import(await moduleUrl('../src/scene/environmentProps.ts', { './primitives': primitives }));

function canvasDocument(t) {
  const prior = globalThis.document;
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, { get: (_, key) => String(key).startsWith('create') ? () => gradient : () => {} });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
  t.after(() => { globalThis.document = prior; });
}

test('luminous lamp haze uses bounded normal coverage and explicit room-light tracking', t => {
  canvasDocument(t);
  const kit = new SceneKit(), root = new THREE.Group();
  lamp(root, kit, 0, 0);
  const haze = [];
  root.traverse(object => { if (object.material?.userData.officeGlow) haze.push(object.material); });
  assert.equal(haze.length, 2, 'halo and floor bounce both participate in room light controls');
  for (const material of haze) {
    assert.equal(material.blending, THREE.NormalBlending);
    assert.equal(material.transparent, true); assert.equal(material.depthWrite, false);
    assert.ok(material.opacity > 0 && material.opacity <= 1);
    assert.ok(material.color.r > 1, 'luminous colour does not require additive alpha');
  }
  // The actual WebGL normal blend alpha factors ONE,ONE_MINUS_SRC_ALPHA
  // keep overlapping haze bounded on both bare background and opaque floors.
  for (const start of [0, 1]) {
    let alpha = start;
    for (const material of haze) alpha = material.opacity + alpha * (1 - material.opacity);
    assert.ok(alpha <= 1 && alpha >= start);
  }
  disposeObject(root); kit.dispose();
});

test('refined workstations stay inside their existing desk footprint and one material batch', () => {
  const kit = new SceneKit(), resources = new THREE.Group();
  for (const [kind, build, bounds, triangleBudget] of [
    ['laptop', root => laptop(root, kit, 0, 0, '#5b6257'), [-0.4151, -0.235, 0.4151, 0.3801], 1400],
    ['monitor', root => monitor(root, kit, 0, 0), [-0.4801, -0.1251, 0.6701, 0.4801], 2500],
  ]) {
    const root = new THREE.Group(), workstation = build(root);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(workstation);
    assert.ok(box.min.x >= bounds[0] && box.min.z >= bounds[1] && box.max.x <= bounds[2] && box.max.z <= bounds[3], `${kind} keeps its movement clearance`);
    let triangles = 0;
    root.traverse(object => {
      assert.equal(Boolean(object.isLight), false, 'the furnishing adds no real-time lights');
      if (!object.isMesh) return;
      triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      assert.equal(Array.isArray(object.material), false);
      assert.equal(object.material.map, null, 'detail does not allocate another texture');
      assert.equal(object.material.transparent, false);
    });
    assert.ok(triangles <= triangleBudget, `${kind} has a fixed small geometry budget`);
    tidyStaticMeshes(root);
    assert.equal(root.children.filter(object => object.isMesh).length, 1, 'all details remain one existing matte draw');
    resources.add(root, root.userData.staticSources);
  }
  disposeObject(resources); kit.dispose();
});

test('laptop content stays just above its glass plane when tilted and turned toward a worker', () => {
  const kit = new SceneKit(), root = new THREE.Group();
  const workstation = laptop(root, kit, 2, -1, '#5b6257', Math.PI);
  root.updateMatrixWorld(true);
  const display = workstation.getObjectByName('Laptop display');
  const glass = display.children.find(object => object.material.color.getHexString() === '62786f');
  glass.geometry.computeBoundingBox();
  const front = new THREE.Vector3(0, 0, glass.geometry.boundingBox.max.z).applyMatrix4(glass.matrixWorld);
  const normal = new THREE.Vector3(0, 0, 1).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(glass.matrixWorld));
  const content = display.children.filter(object => ['bed0b9', 'a0b7a6'].includes(object.material?.color.getHexString()));
  assert.equal(content.length, 3);
  for (const mesh of content) {
    const positions = mesh.geometry.getAttribute('position');
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const world = new THREE.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(mesh.matrixWorld);
      const distance = world.sub(front).dot(normal);
      assert.ok(distance > 0 && distance < 0.002, 'text stays attached to the display instead of floating past the bezel');
    }
  }
  assert.ok(normal.z < -0.98, 'the display still faces the seated worker after turning');
  disposeObject(root); kit.dispose();
});

test('rounded timber furniture preserves certified desk height and chair clearance', t => {
  canvasDocument(t);
  const kit = new SceneKit(), resources = new THREE.Group();
  const desk = new THREE.Group(); table(desk, kit, 0, 0, 3.4, 1.4); desk.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(desk);
  assert.ok(bounds.min.x >= -1.7001 && bounds.max.x <= 1.7001 && bounds.min.z >= -0.7001 && bounds.max.z <= 0.7001);
  assert.ok(bounds.min.y >= 0.05 && Math.abs(bounds.max.y - 0.82) < 1e-6, 'workstation and recipe support heights stay unchanged');
  assert.equal(desk.userData.floorContacts.length, 4, 'the existing four foot contact patches remain sufficient');
  const seatRoot = new THREE.Group(), seat = chair(seatRoot, kit, 0, 0, '#8b9779'); seatRoot.updateMatrixWorld(true);
  const seatBounds = new THREE.Box3().setFromObject(seat);
  assert.ok(seatBounds.min.x >= -0.36 && seatBounds.max.x <= 0.36 && seatBounds.min.z >= -0.36 && seatBounds.max.z <= 0.36,
    'a curved back and splayed legs do not enlarge the motor blocker');
  assert.ok(seatBounds.max.y < 1.33 && seatBounds.min.y >= 0.05);
  for (const root of [desk, seatRoot]) {
    let triangles = 0;
    root.traverse(object => { if (object.isMesh) triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3; });
    assert.ok(triangles < 4000, 'each refined furnishing has a fixed small geometry budget');
    tidyStaticMeshes(root); resources.add(root, root.userData.staticSources);
  }
  disposeObject(resources); kit.dispose();
});

test('diverse connected plants keep actual vertices inside their certified floor envelopes and release owned meshes once', () => {
  const kit = new SceneKit(), resources = new THREE.Group(), owned = new Set();
  for (const [kind, bound] of [['leaf', 0.5], ['broad', 0.57], ['spear', 0.28], ['herb', 0.48], ['ivy', 0.5]]) {
    const root = new THREE.Group(); plant(root, kit, 0, 0, 1, kind === 'ivy' ? 1.48 : 0.1, '#bca581', kind);
    const group = root.children[0], canopy = group.getObjectByName('Connected botanical canopy'); root.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert(), point = new THREE.Vector3();
    let leaves = 0, triangles = 0;
    canopy.traverse(object => {
      assert.equal(Boolean(object.isSprite || object.isLight), false, 'canopies are actual mesh forms');
      if (!object.isMesh) return;
      if (object.name === 'Cupped botanical leaf') leaves++;
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).applyMatrix4(inverse);
        assert.ok(Math.hypot(point.x, point.z) <= bound + 1e-6, `${kind} cannot widen its navigation obstacle`);
      }
    });
    assert.equal(leaves, { spear:11, herb:17, broad:17, leaf:21, ivy:14 }[kind], 'each authored canopy has a fixed leaf budget');
    group.traverse(object => {
      if (!object.isMesh) return;
      triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      assert.equal(object.material.map, null, 'botanical detail is not a texture substitute');
      if (['Rounded plant pot', 'Pot rolled lip', 'Cupped botanical leaf'].includes(object.name)) owned.add(object.geometry);
    });
    assert.ok(triangles < 2600, `${kind} stays within its bounded mesh budget`);
    const pot = group.getObjectByName('Rounded plant pot'); pot.geometry.computeBoundingBox();
    assert.equal(pot.geometry.boundingBox.min.y, 0);
    assert.ok(pot.geometry.boundingBox.max.x < 0.235 && pot.geometry.boundingBox.max.y < 0.42, 'rounded pot retains its original footprint and rim height');
    tidyStaticMeshes(root); resources.add(root, root.userData.staticSources);
  }
  const released = new Map([...owned].map(geometry => [geometry, 0]));
  owned.forEach(geometry => geometry.addEventListener('dispose', () => released.set(geometry, released.get(geometry) + 1)));
  disposeObject(resources); kit.dispose();
  assert.ok([...released.values()].every(count => count === 1));
});

test('woven rugs have real rounded corners and retain pile height and bounded footprint', t => {
  canvasDocument(t);
  const kit = new SceneKit(), root = new THREE.Group(); rug(root, kit, '#8b9779', 0, 0, 4.55, 4.2); root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  assert.ok(bounds.min.x >= -2.2751 && bounds.max.x <= 2.2751 && bounds.min.z >= -2.1001 && bounds.max.z <= 2.1001);
  assert.ok(bounds.min.y >= 0.0934 && Math.abs(bounds.max.y - 0.13) < 1e-6);
  const ray = new THREE.Raycaster(new THREE.Vector3(2.24, 2, 2.06), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(root, true).length, 0, 'the pill corner is geometry rather than painted transparency');
  ray.ray.origin.set(0, 2, 0);
  assert.ok(ray.intersectObject(root, true).length > 0);
  disposeObject(root); kit.dispose();
});
