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
const { laptop, monitor, tidyStaticMeshes } = await import(await moduleUrl('../src/scene/environmentProps.ts', { './primitives': primitives }));

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
