import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';

async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
    .replaceAll(/from '([^']+)'/g, (_, name) => `from ${JSON.stringify(imports[name] ?? import.meta.resolve(name))}`);
  return `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`;
}
const { StaticContacts, actorContactHeight } = await import(await moduleUrl('../src/scene/staticContacts.ts'));

function canvasDocument(t) {
  const prior = globalThis.document;
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, { get: (_, key) => key === 'createRadialGradient' || key === 'createLinearGradient' ? () => gradient : () => {} });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
  t.after(() => { globalThis.document = prior; });
}

test('actor contacts clear rug pile only inside the current office footprint and stay stable while paused', () => {
  const rug = { bounds: [-2.275, -1.75, 2.275, 2.45], height: 0.13 };
  assert.equal(actorContactHeight(0.1, 0, 0, rug), 0.136);
  assert.equal(actorContactHeight(0.1, 0, -2.45, rug), 0.10800000000000001);
  assert.equal(actorContactHeight(0.1, 0, 0), 0.10800000000000001);
  const worldX = 6.15, worldZ = 4.7875;
  assert.equal(actorContactHeight(0.1, worldX - 6.15, worldZ - 4.7875, rug), 0.136, 'a visitor uses the destination room coordinates');
  assert.equal(actorContactHeight(0.1, worldX, worldZ, rug), 0.10800000000000001, 'another office footprint does not raise this contact');
  const restingHeight = actorContactHeight(0.1, 0.8, 1.1, rug);
  for (let frame = 0; frame < 30; frame++) assert.equal(actorContactHeight(0.1, 0.8, 1.1, rug), restingHeight, 'pause has no timer-dependent height drift');
});

test('one furnishing contact draw packs world transforms only on room visibility events and excludes hidden placeholders', t => {
  canvasDocument(t);
  const scene = new THREE.Scene(), first = new THREE.Group(), second = new THREE.Group();
  first.position.set(-6, 0, 4); second.position.set(6, 0, 4);
  first.userData.floorContacts = [[1, 0.106, 2, 0.5, 0.7]];
  second.userData.floorContacts = [[-1, 0.137, 0, 0.4, 0.3]];
  const hidden = new THREE.Group(); hidden.visible = false;
  hidden.userData.floorContacts = [[0, 0.1, 0, 8, 8]];
  first.add(hidden); scene.add(first, second);
  const contacts = new StaticContacts(scene, [first, second]);
  t.after(() => contacts.dispose());
  assert.equal(contacts.mesh.count, 2);
  assert.equal(contacts.mesh.geometry.index.count / 3, 2);
  assert.equal(contacts.mesh.material.opacity, 0.18);
  assert.equal(contacts.mesh.material.color.getHexString(), '76664f');
  assert.equal(contacts.mesh.material.depthWrite, false);
  assert.equal(contacts.mesh.castShadow, false);
  const matrix = new THREE.Matrix4(); contacts.mesh.getMatrixAt(0, matrix);
  const point = new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.ok(point.distanceTo(new THREE.Vector3(-5, 0.106, 6)) < 1e-6);
  const version = contacts.mesh.instanceMatrix.version;
  contacts.syncVisibility();
  assert.equal(contacts.mesh.instanceMatrix.version, version, 'no unchanged static upload');
  first.visible = false; contacts.syncVisibility();
  assert.equal(contacts.mesh.count, 1);
  contacts.mesh.getMatrixAt(0, matrix);
  assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(new THREE.Vector3(5, 0.137, 4)) < 1e-6);
  second.visible = false; contacts.syncVisibility();
  assert.equal(contacts.mesh.count, 0);
  assert.equal(contacts.mesh.visible, false);
  first.visible = true; contacts.syncVisibility();
  assert.equal(contacts.mesh.count, 1);
  assert.equal(contacts.mesh.visible, true);
});

test('contact context restoration reuploads owned data and disposal releases each resource once', t => {
  canvasDocument(t);
  const scene = new THREE.Scene(), room = new THREE.Group();
  room.userData.floorContacts = [[0, 0.106, 0, 0.5, 0.5]]; scene.add(room);
  const contacts = new StaticContacts(scene, [room]);
  const resources = [contacts.mesh, contacts.mesh.geometry, contacts.mesh.material, contacts.mesh.material.map];
  const disposals = resources.map(() => 0);
  resources.forEach((resource, index) => resource.addEventListener('dispose', () => disposals[index]++));
  const textureVersion = contacts.mesh.material.map.version, matrixVersion = contacts.mesh.instanceMatrix.version;
  contacts.restore();
  assert.equal(contacts.mesh.material.map.version, textureVersion + 1);
  assert.equal(contacts.mesh.instanceMatrix.version, matrixVersion + 1);
  contacts.dispose(); contacts.dispose(); contacts.restore(); contacts.syncVisibility();
  assert.deepEqual(disposals, [1, 1, 1, 1]);
  assert.equal(contacts.mesh.parent, null);
});

test('the complete default campus stays within one draw and 140 static contact triangles', async t => {
  canvasDocument(t);
  const primitives = await moduleUrl('../src/scene/primitives.ts');
  const environment = await moduleUrl('../src/scene/environmentProps.ts', { './primitives': primitives });
  const { SceneKit, disposeObject } = await import(primitives);
  const { makeCampus, makeRoom } = await import(await moduleUrl('../src/scene/rooms.ts', { './primitives': primitives, './environmentProps': environment }));
  const { teams } = await import(await moduleUrl('../src/teams.ts'));
  const scene = new THREE.Scene(), kit = new SceneKit();
  const roots = [makeCampus(kit), ...teams.map((team, index) => makeRoom(team, index, kit).root)];
  scene.add(...roots);
  const contacts = new StaticContacts(scene, roots);
  assert.ok(contacts.mesh.count > 50);
  assert.ok(contacts.mesh.count * 2 <= 140);
  const sourceGroups = [];
  scene.traverse(object => { if (object.userData.staticSources) sourceGroups.push(object.userData.staticSources); });
  contacts.dispose();
  const resources = new THREE.Group(); resources.add(scene, ...sourceGroups);
  disposeObject(resources); kit.dispose();
});
