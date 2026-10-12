import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';

const source = await readFile(new URL('../src/scene/flatMappedWalls.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replace("from 'three'", `from ${JSON.stringify(import.meta.resolve('three'))}`);
const { enableFlatMappedWallSinglePass } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

function material() {
  return new THREE.MeshStandardMaterial({ map: new THREE.Texture(), side: THREE.DoubleSide,
    transparent: true, opacity: 0.37, depthWrite: false, roughness: 0.95 });
}

test('flat mapped walls keep both sides, opacity, depth, ordering and normals with one pass', () => {
  const root = new THREE.Group();
  const mapped = material();
  const first = new THREE.Mesh(new THREE.PlaneGeometry(3.45, 0.67), mapped);
  const second = new THREE.Mesh(new THREE.PlaneGeometry(1.83, 1.11), mapped);
  first.rotation.set(0.1, Math.PI, 0.2);
  first.renderOrder = 7;
  root.add(first, second);
  root.updateMatrixWorld(true);
  const matrices = [first, second].map(mesh => mesh.matrixWorld.clone());
  const normals = [first, second].map(mesh => Array.from(mesh.geometry.attributes.normal.array));
  const version = mapped.version;
  assert.equal(enableFlatMappedWallSinglePass(root), 1);
  assert.equal(mapped.forceSinglePass, true);
  assert.equal(mapped.version, version + 1);
  assert.equal(mapped.side, THREE.DoubleSide);
  assert.equal(mapped.opacity, 0.37);
  assert.equal(mapped.depthWrite, false);
  assert.equal(mapped.depthTest, true);
  assert.equal(mapped.transparent, true);
  assert.equal(first.renderOrder, 7);
  [first, second].forEach((mesh, index) => {
    assert.ok(mesh.matrixWorld.equals(matrices[index]));
    assert.deepEqual(Array.from(mesh.geometry.attributes.normal.array), normals[index]);
  });
  assert.equal(enableFlatMappedWallSinglePass(root), 0, 'repeated setup does not invalidate the shader');
  assert.equal(mapped.version, version + 1);
});

test('a material shared by a plane and volume remains on its original two-pass path', () => {
  const root = new THREE.Group();
  const mapped = material();
  root.add(new THREE.Mesh(new THREE.PlaneGeometry(), mapped), new THREE.Mesh(new THREE.BoxGeometry(), mapped));
  assert.equal(enableFlatMappedWallSinglePass(root), 0);
  assert.equal(mapped.forceSinglePass, false);
});

test('edited planes, custom rendering and non-wall materials are excluded', () => {
  const cases = [
    mesh => { mesh.geometry = new THREE.PlaneGeometry(1, 1, 2, 2); },
    mesh => { mesh.geometry.attributes.position.setZ(0, 0.1); },
    mesh => { mesh.geometry.attributes.normal.setX(0, 0.1); },
    mesh => { mesh.geometry.setIndex([0, 2, 1, 1, 2, 0]); },
    mesh => { mesh.geometry.addGroup(0, 6, 0); },
    mesh => { mesh.material.transparent = false; },
    mesh => { mesh.material.map = null; },
    mesh => { mesh.material.side = THREE.FrontSide; },
    mesh => { mesh.material.normalMap = new THREE.Texture(); },
    mesh => { mesh.material.onBeforeCompile = () => {}; },
    mesh => { mesh.onBeforeRender = () => {}; },
    mesh => { mesh.material = [mesh.material]; },
    mesh => { mesh.morphTargetInfluences = [0.5]; },
  ];
  for (const change of cases) {
    const root = new THREE.Group();
    const mapped = material();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), mapped);
    root.add(mesh); change(mesh);
    assert.equal(enableFlatMappedWallSinglePass(root), 0);
    assert.equal(mapped.forceSinglePass, false);
  }
});
