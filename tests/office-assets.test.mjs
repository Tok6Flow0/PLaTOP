import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';
import { DECOR_SHAPES, DECOR_SLOTS, DECOR_FINISHES, MAX_DECOR_PARTS, parseDecoration } from '../server/office-protocol.mjs';

const source = await readFile(new URL('../src/scene/officeAssets.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  .replace("from 'three'", `from ${JSON.stringify(import.meta.resolve('three'))}`)
  .replace("from 'three/addons/geometries/RoundedBoxGeometry.js'", `from ${JSON.stringify(import.meta.resolve('three/addons/geometries/RoundedBoxGeometry.js'))}`)
  .replace("from '../../server/office-protocol.mjs'", `from ${JSON.stringify(new URL('../server/office-protocol.mjs', import.meta.url).href)}`);
const { OfficeAssetsRenderer } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
const ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ID = '00000000-0000-4000-8000-000000000002';
const asset = (parts, id = ID) => ({ id, parts: parseDecoration({ teamId: 'merchant', slot: 'desk', parts }).parts });

function fixture(t) {
  const rooms = new Map(['merchant', 'hr'].map((teamId, index) => {
    const root = new THREE.Group();
    root.position.set(index * 7, 0, -2);
    root.updateMatrixWorld();
    const assetSlots = Object.fromEntries(DECOR_SLOTS.map(slot => [slot, { position: [0, 1, 0] }]));
    return [teamId, { root, assetSlots }];
  }));
  const renderer = new OfficeAssetsRenderer(rooms);
  t.after(() => renderer.dispose());
  const meshes = () => [...rooms.values()].flatMap(room => room.root.children.flatMap(group => group.children));
  return { rooms, renderer, meshes };
}

test('office asset sync is content-idempotent, room-parented and uses rough emissive-only low-poly meshes', t => {
  const { rooms, renderer, meshes } = fixture(t);
  const recipe = { merchant: { desk: asset([{ shape: 'box', glow: true }]) } };
  assert.equal(renderer.sync(undefined), false);
  assert.equal(renderer.sync(recipe), true);
  const first = meshes()[0];
  assert.equal(renderer.sync(structuredClone(recipe)), false);
  assert.equal(renderer.sync({ merchant: { desk: { ...recipe.merchant.desk, id: OTHER_ID } } }), false);
  assert.equal(meshes()[0], first);
  assert.equal(first.parent.parent, rooms.get('merchant').root);
  assert.equal(first.material.roughness, 0.82);
  assert.equal(first.material.metalness, 0);
  assert.equal(first.material.emissiveIntensity, 0.65);
  assert.ok(first.material.emissive.equals(first.material.color));
  assert.equal(first.castShadow, false);
  assert.equal(first.receiveShadow, true);
  first.parent.traverse(object => {
    assert.equal(object.isLight, undefined);
    assert.equal(object.matrixAutoUpdate, false);
    assert.equal(object.matrixWorldAutoUpdate, false);
  });
  assert.ok((first.geometry.index?.count ?? first.geometry.attributes.position.count) / 3 <= 512);
  assert.ok(Array.from(first.geometry.attributes.normal.array).some(value => Math.abs(value) > 0.01 && Math.abs(value) < 0.99),
    'box corners retain rounded surface normals');
});

test('geometry is shared across offices; replacement/removal releases only old materials until final disposal', t => {
  const { renderer, meshes, rooms } = fixture(t);
  renderer.sync({ merchant: { desk: asset([{ shape: 'sphere' }]) }, hr: { wall: asset([{ shape: 'sphere' }]) } });
  const [first, second] = meshes();
  assert.equal(first.geometry, second.geometry);
  let geometryDisposals = 0;
  let firstMaterialDisposals = 0;
  let secondMaterialDisposals = 0;
  first.geometry.addEventListener('dispose', () => geometryDisposals++);
  first.material.addEventListener('dispose', () => firstMaterialDisposals++);
  second.material.addEventListener('dispose', () => secondMaterialDisposals++);
  assert.equal(renderer.sync({ merchant: { desk: asset([{ shape: 'sphere', color: '#123456' }]) }, hr: { wall: asset([{ shape: 'sphere' }]) } }), true);
  assert.equal(firstMaterialDisposals, 1);
  assert.equal(secondMaterialDisposals, 0);
  assert.equal(geometryDisposals, 0);
  const replacement = meshes()[0];
  assert.equal(replacement.geometry, second.geometry);
  let replacementDisposals = 0;
  replacement.material.addEventListener('dispose', () => replacementDisposals++);
  assert.equal(renderer.sync(undefined), true);
  assert.equal(renderer.sync(undefined), false);
  assert.equal(secondMaterialDisposals, 1);
  assert.equal(replacementDisposals, 1);
  assert.equal(geometryDisposals, 0);
  assert.ok([...rooms.values()].every(room => room.root.children.length === 0));
  renderer.dispose();
  renderer.dispose();
  assert.equal(geometryDisposals, 1);
  assert.equal(renderer.sync({ merchant: { desk: asset([{ shape: 'sphere' }]) } }), false);
});

test('unit primitive bounds stay within slot limits and grounded recipes rest on their support surfaces', t => {
  const { renderer, rooms, meshes } = fixture(t);
  const parts = DECOR_SHAPES.map((shape, index) => ({ shape, size: [0.4, 0.6, 0.8], position: [0, index * 0.06, 0], rotation: [0.3, -0.2, 0.5] }));
  renderer.sync({ merchant: Object.fromEntries(DECOR_SLOTS.map(slot => [slot, asset(parts)])) });
  for (const mesh of meshes()) {
    const bounds = mesh.geometry.boundingBox;
    for (const axis of ['x', 'y', 'z']) {
      assert.ok(Math.abs(bounds.min[axis] + 0.5) < 1e-6);
      assert.ok(Math.abs(bounds.max[axis] - 0.5) < 1e-6);
    }
    assert.ok((mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 <= 512);
  }
  const scales = { desk: 0.25, shelf: 0.25, wall: 0.35, floor: 0.45, festive: 0.5 };
  for (const root of rooms.get('merchant').root.children) {
    const bounds = new THREE.Box3().setFromObject(root);
    if (['desk', 'shelf', 'floor'].includes(root.userData.decorSlot)) {
      assert.ok(Math.abs(bounds.min.y - 1) < 1e-6, 'recipe bottom aligns with anchor support height');
    } else assert.equal(root.position.y, 1, 'wall and festive recipes retain their named center');
    if (root.userData.decorSlot === 'wall') assert.ok(Math.abs(bounds.min.x) < 1e-6, 'mounting face meets the wall regardless of recipe depth');
    assert.equal(root.scale.x, scales[root.userData.decorSlot]);
    assert.ok(bounds.getSize(new THREE.Vector3()).x <= 3 * root.scale.x + 1e-6);
    assert.ok(bounds.getSize(new THREE.Vector3()).y <= 3 * root.scale.y + 1e-6);
    assert.ok(bounds.getSize(new THREE.Vector3()).z <= 3 * root.scale.z + 1e-6);
  }
});

test('finish choices produce distinct stable material response without texture loaders or extra lights', t => {
  const { renderer, meshes } = fixture(t);
  renderer.sync({ merchant: { desk: asset(DECOR_FINISHES.map(finish => ({ shape: 'capsule', finish }))) } });
  const materials = meshes().map(mesh => mesh.material);
  assert.deepEqual(materials.map(material => material.roughness), [0.82, 0.34, 0.78, 0.3, 0.97, 0.9, 0.17]);
  assert.deepEqual(materials.map(material => material.metalness), [0, 0, 0, 0.65, 0, 0, 0.08]);
  assert.ok(materials.every(material => material.map === null && material.normalMap === null));
  assert.equal(new Set(meshes().map(mesh => mesh.geometry)).size, 1);
});

test('invalid/private/unbounded display data cannot allocate resources or erase a current recipe', t => {
  const { renderer, meshes } = fixture(t);
  const recipe = { merchant: { desk: asset([{ shape: 'box' }]) } };
  renderer.sync(recipe);
  const first = meshes()[0];
  for (const invalid of [
    { merchant: { desk: { ...recipe.merchant.desk, url: 'PRIVATE_URL' } } },
    { merchant: { desk: asset([{ shape: 'box' }], 'PRIVATE_ID') } },
    { merchant: { desk: { id: ID, parts: [{ shape: 'box', size: [100, 100, 100] }] } } },
    { merchant: { desk: { id: ID, parts: Array.from({ length: MAX_DECOR_PARTS + 1 }, () => ({ shape: 'box' })) } } },
    { merchant: { PRIVATE_SLOT: recipe.merchant.desk } }, { PRIVATE_TEAM: { desk: recipe.merchant.desk } },
  ]) {
    assert.equal(renderer.sync(invalid), false);
    assert.equal(meshes()[0], first);
    assert.equal(renderer.geometries.size, 1);
  }
  recipe.merchant.desk.parts[0].size[0] = 100;
  assert.equal(first.scale.x, 0.3, 'caller mutation cannot alter constructed transforms');
  assert.equal(renderer.sync({ merchant: { desk: asset([]) } }), true);
  assert.equal(meshes().length, 0);
});

test('sculpted forms have actual open negative space and hollow vessel geometry', t => {
  const { renderer, meshes } = fixture(t);
  renderer.sync({ merchant: { desk: asset([{ shape: 'arch' }, { shape: 'vase' }]) } });
  const [arch, vase] = meshes().map(mesh => new THREE.Mesh(mesh.geometry, mesh.material));
  const ray = new THREE.Raycaster(new THREE.Vector3(0, -0.25, 2), new THREE.Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(arch).length, 0, 'the arch opening is open rather than painted onto a block');
  ray.ray.origin.set(0.4, -0.25, 2);
  assert.ok(ray.intersectObject(arch).length > 0, 'the arch legs remain solid');
  ray.ray.origin.set(0, 2, 0); ray.ray.direction.set(0, -1, 0);
  const hits = ray.intersectObject(vase);
  assert.ok(hits.length > 0 && hits[0].point.y < 0, 'the vessel mouth opens to a recessed interior floor');
  assert.ok(meshes().every(mesh => mesh.geometry.getAttribute('normal').array.every(Number.isFinite)));
});

test('the complete 24-part slot budget remains bounded with shared source geometry', t => {
  const { renderer, meshes } = fixture(t);
  const parts = Array.from({ length: MAX_DECOR_PARTS }, (_, index) => ({ shape: DECOR_SHAPES[index % DECOR_SHAPES.length] }));
  renderer.sync({ merchant: Object.fromEntries(DECOR_SLOTS.map(slot => [slot, asset(parts)])) });
  assert.equal(meshes().length, DECOR_SLOTS.length * MAX_DECOR_PARTS);
  assert.equal(new Set(meshes().map(mesh => mesh.geometry)).size, DECOR_SHAPES.length);
  assert.ok(meshes().reduce((total, mesh) => total + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0)
    <= DECOR_SLOTS.length * MAX_DECOR_PARTS * 512);
});
