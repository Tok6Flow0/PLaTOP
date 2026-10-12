import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import ts from 'typescript';

const source = await readFile(new URL('../src/scene/performanceBatching.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replace("from 'three'", `from ${JSON.stringify(import.meta.resolve('three'))}`);
const { ActorContactBatch, freezeStaticAuthoredMeshes, SceneBatches } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

function fixture(t, { prune = false, glow = false } = {}) {
  const scene = new THREE.Scene();
  const staticRoom = new THREE.Group();
  const dynamicRoom = new THREE.Group();
  const actor = new THREE.Group();
  staticRoom.position.x = 4;
  dynamicRoom.position.z = -3;
  dynamicRoom.add(actor);
  scene.add(staticRoom, dynamicRoom);
  const geometry = new THREE.BoxGeometry();
  const red = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x0000ff });
  const makePair = (parent, materials) => materials.map((material, index) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = index;
    parent.add(mesh);
    return mesh;
  });
  const fixed = makePair(staticRoom, [red, blue]);
  const moving = makePair(actor, [red.clone(), blue.clone()]);
  if (glow) {
    const material = new THREE.MeshStandardMaterial({ emissive: 0xffaa00 });
    actor.add(new THREE.Mesh(geometry, material));
    t.after(() => material.dispose());
  }
  const batches = new SceneBatches(scene, new Set([actor]), prune ? new Set([actor]) : undefined);
  batches.rebuild();
  const rendered = scene.getObjectByName('Shared character draws').children;
  const staticBatch = rendered.find(mesh => mesh.instanceMatrix.usage === THREE.StaticDrawUsage);
  const dynamicBatch = rendered.find(mesh => mesh.instanceMatrix.usage === THREE.DynamicDrawUsage);
  assert.ok(staticBatch && dynamicBatch);
  t.after(() => { batches.dispose(); geometry.dispose(); red.dispose(); blue.dispose(); moving.forEach(mesh => mesh.material.dispose()); });
  return { scene, staticRoom, dynamicRoom, actor, fixed, moving, batches, staticBatch, dynamicBatch };
}

test('unchanged static transforms and colors are not rewritten on animation frames', t => {
  const { staticRoom, batches, staticBatch, dynamicBatch } = fixture(t);
  let staticVisits = 0;
  const update = staticRoom.updateMatrixWorld;
  staticRoom.updateMatrixWorld = function (...args) { staticVisits++; return update.apply(this, args); };
  const matrixVersion = staticBatch.instanceMatrix.version;
  const staticColorVersion = staticBatch.instanceColor.version;
  const dynamicColorVersion = dynamicBatch.instanceColor.version;
  batches.sync();
  batches.sync();
  assert.equal(staticVisits, 0);
  assert.equal(staticBatch.instanceMatrix.version, matrixVersion);
  assert.equal(staticBatch.instanceColor.version, staticColorVersion);
  assert.equal(dynamicBatch.instanceColor.version, dynamicColorVersion);
});

test('animated parent transforms, individual visibility, and changed colors reach instances', t => {
  const { actor, moving, batches, dynamicBatch } = fixture(t);
  actor.position.set(2, 1, 0);
  batches.sync();
  const matrix = new THREE.Matrix4();
  dynamicBatch.getMatrixAt(0, matrix);
  const position = new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.deepEqual(position.toArray(), [2, 1, -3]);
  const colorVersion = dynamicBatch.instanceColor.version;
  moving[0].material.color.setRGB(0.2, 0.3, 0.4);
  batches.sync();
  const color = new THREE.Color();
  dynamicBatch.getColorAt(0, color);
  assert.ok(Math.abs(color.r - 0.2) < 1e-7);
  assert.ok(Math.abs(color.g - 0.3) < 1e-7 && Math.abs(color.b - 0.4) < 1e-7);
  assert.equal(dynamicBatch.instanceColor.version, colorVersion + 1);
  moving[0].visible = false;
  batches.sync();
  assert.equal(dynamicBatch.count, 1);
  dynamicBatch.getColorAt(0, color);
  assert.ok(color.equals(moving[1].material.color));
  moving[0].visible = true;
  batches.sync();
  assert.equal(dynamicBatch.count, 2);
  dynamicBatch.getMatrixAt(0, matrix);
  assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(matrix).toArray(), [2, 1, -3]);
});

test('room and decoration visibility invalidate cached static instance membership', t => {
  const { staticRoom, fixed, batches, staticBatch } = fixture(t);
  fixed[0].visible = false;
  batches.invalidateVisibility();
  batches.sync();
  assert.equal(staticBatch.count, 1);
  const color = new THREE.Color();
  staticBatch.getColorAt(0, color);
  assert.ok(color.equals(fixed[1].material.color));
  staticRoom.visible = false;
  batches.invalidateVisibility();
  batches.sync();
  assert.equal(staticBatch.count, 0);
  assert.equal(staticBatch.visible, false);
  fixed[0].visible = true;
  staticRoom.visible = true;
  batches.invalidateVisibility();
  batches.sync();
  assert.equal(staticBatch.count, 2);
  assert.equal(staticBatch.visible, true);
});

test('hidden offices skip animated subtree updates and resume with current transforms', t => {
  const { dynamicRoom, actor, batches, dynamicBatch } = fixture(t, { prune: true });
  let visits = 0;
  const update = actor.updateMatrixWorld;
  actor.updateMatrixWorld = function (...args) { visits++; return update.apply(this, args); };
  dynamicRoom.visible = false;
  actor.position.x = 9;
  batches.sync();
  assert.equal(visits, 0);
  assert.equal(dynamicBatch.count, 0);
  assert.equal(dynamicBatch.visible, false);
  dynamicRoom.visible = true;
  batches.sync();
  assert.equal(visits, 1);
  assert.equal(dynamicBatch.count, 2);
  const matrix = new THREE.Matrix4();
  dynamicBatch.getMatrixAt(0, matrix);
  assert.equal(new THREE.Vector3().setFromMatrixPosition(matrix).x, 9);
});

test('fully instanced proxy containers skip duplicate rendering but preserve animation and blinks', t => {
  const { actor, moving, batches, dynamicBatch } = fixture(t, { prune: true });
  assert.equal(actor.visible, false);
  let sourceRenderVisits = 0;
  actor.traverseVisible(() => sourceRenderVisits++);
  assert.equal(sourceRenderVisits, 0);
  assert.equal(dynamicBatch.count, 2);
  actor.position.y = 2;
  moving[0].visible = false;
  batches.sync();
  assert.equal(dynamicBatch.count, 1);
  const matrix = new THREE.Matrix4();
  dynamicBatch.getMatrixAt(0, matrix);
  assert.equal(new THREE.Vector3().setFromMatrixPosition(matrix).y, 2);
  moving[0].visible = true;
  batches.sync();
  assert.equal(dynamicBatch.count, 2);
  batches.dispose();
  assert.equal(actor.visible, true);
});

test('authored or partly instanced glow containers remain in normal rendering', t => {
  const authored = fixture(t);
  assert.equal(authored.actor.visible, true);
  const glowing = fixture(t, { prune: true, glow: true });
  assert.equal(glowing.actor.visible, true);
  assert.equal(glowing.dynamicBatch.count, 2);
});

test('scoped static pruning skips empty and represented subtrees while parent visibility stays live', t => {
  const scene = new THREE.Scene();
  const room = new THREE.Group();
  const decoration = new THREE.Group();
  const represented = new THREE.Group();
  const empty = new THREE.Group();
  const partial = new THREE.Group();
  empty.add(new THREE.Group(), new THREE.Group());
  scene.add(room);
  room.add(decoration, partial);
  decoration.add(represented, empty);
  const geometry = new THREE.BoxGeometry();
  const opaque = new THREE.MeshStandardMaterial();
  const transparent = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5 });
  const meshes = [new THREE.Mesh(geometry, opaque), new THREE.Mesh(geometry, opaque)];
  represented.add(...meshes);
  partial.add(new THREE.Mesh(geometry, transparent));
  const batches = new SceneBatches(scene, new Set(), new Set([represented, empty, partial]));
  t.after(() => { batches.dispose(); geometry.dispose(); opaque.dispose(); transparent.dispose(); });
  batches.rebuild();
  const batch = scene.getObjectByName('Shared character draws').children[0];
  assert.equal(represented.visible, false);
  assert.equal(empty.visible, false);
  assert.equal(partial.visible, true, 'unbatched renderables keep their original path');
  assert.equal(decoration.visible, true, 'mutable decoration container remains live');
  assert.equal(room.visible, true, 'mutable room container remains live');
  assert.equal(batch.count, 2);
  assert.equal(represented.parent, decoration, 'logical hierarchy remains intact');
  decoration.visible = false;
  batches.invalidateVisibility(); batches.sync();
  assert.equal(batch.count, 0);
  decoration.visible = true;
  room.visible = false;
  batches.invalidateVisibility(); batches.sync();
  assert.equal(batch.count, 0);
  room.visible = true;
  batches.invalidateVisibility(); batches.sync();
  assert.equal(batch.count, 2);
  batches.rebuild();
  assert.equal(represented.visible, false, 'rebuild prunes restored sources again');
  batches.dispose();
  assert.equal(represented.visible, true);
  assert.equal(empty.visible, true);
  assert.equal(partial.visible, true);
  assert.ok(meshes.every(mesh => mesh.layers.mask === 1));
});

test('rebuilding and disposing preserve original picking layers and source resources', t => {
  const { scene, fixed, moving, batches } = fixture(t);
  assert.ok([...fixed, ...moving].every(mesh => mesh.layers.mask === 2));
  let sourceGeometryDisposed = false;
  fixed[0].geometry.addEventListener('dispose', () => { sourceGeometryDisposed = true; });
  batches.rebuild();
  assert.ok([...fixed, ...moving].every(mesh => mesh.layers.mask === 2));
  batches.dispose();
  assert.ok([...fixed, ...moving].every(mesh => mesh.layers.mask === 1));
  assert.equal(scene.getObjectByName('Shared character draws'), undefined);
  assert.equal(sourceGeometryDisposed, false);
});

test('authored mesh freezing leaves bound meshes live and abandons ambiguous bindings', () => {
  const root = new THREE.Group();
  const fixed = new THREE.Mesh();
  const animated = new THREE.Mesh();
  animated.name = 'movingMesh';
  root.add(fixed, animated);
  const clip = new THREE.AnimationClip('Move', 1, [new THREE.VectorKeyframeTrack('movingMesh.position', [0, 1], [0, 0, 0, 1, 0, 0])]);
  freezeStaticAuthoredMeshes(root, [clip]);
  assert.equal(fixed.matrixAutoUpdate, false);
  assert.equal(animated.matrixAutoUpdate, true);
  fixed.matrixAutoUpdate = true;
  const unresolved = new THREE.AnimationClip('Unknown', 1, [new THREE.VectorKeyframeTrack('missing.position', [0, 1], [0, 0, 0, 1, 0, 0])]);
  freezeStaticAuthoredMeshes(root, [clip, unresolved]);
  assert.equal(fixed.matrixAutoUpdate, true);
});

test('approved authored models retain exact world poses through clips, crossfades and pause/resume', async () => {
  const approved = JSON.parse(await readFile(new URL('../public/assets/approved.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(await readFile(new URL('../public/assets/characters/manifest.json', import.meta.url), 'utf8'));
  let fixedMeshCount = 0;
  for (const id of approved.characterIds) {
    const bytes = await readFile(new URL(`../public${manifest.characters[id].path}`, import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const baseline = gltf.scene;
    const optimized = baseline.clone(true);
    const clips = ['Idle', 'Move', 'Work', 'Sleep'].map(name => gltf.animations.find(clip => clip.name === name));
    assert.ok(clips.every(Boolean));
    freezeStaticAuthoredMeshes(optimized, clips);
    optimized.traverse(node => { if (node.isMesh && !node.matrixAutoUpdate) fixedMeshCount++; });
    const mixers = [baseline, optimized].map(root => new THREE.AnimationMixer(root));
    const actions = mixers.map(mixer => clips.map(clip => mixer.clipAction(clip)));
    const models = [baseline, optimized];
    const poses = root => {
      root.updateMatrixWorld(true);
      const matrices = [];
      // Signed zero has the same transform after GLTFLoader/clone Euler conversion.
      root.traverse(node => matrices.push(node.matrixWorld.toArray().map(value => value === 0 ? 0 : value)));
      return matrices;
    };
    const compare = () => assert.deepEqual(poses(optimized), poses(baseline), `${id} exact authored pose`);
    for (let index = 0; index < clips.length; index++) {
      mixers.forEach(mixer => mixer.stopAllAction());
      actions.forEach(set => set[index].reset().play());
      for (let frame = 0; frame < 36; frame++) {
        models.forEach(root => { root.position.x = Math.sin(frame / 10) * 0.3; root.rotation.y = frame / 20; });
        mixers.forEach(mixer => mixer.update(clips[index].duration / 35));
        compare();
      }
      const next = (index + 1) % clips.length;
      actions.forEach(set => { set[next].reset().play(); set[index].crossFadeTo(set[next], 0.3, false); });
      for (let frame = 0; frame < 12; frame++) {
        mixers.forEach(mixer => mixer.update(1 / 30));
        compare();
      }
      const pausedPose = poses(optimized);
      mixers.forEach(mixer => { mixer.timeScale = 0; mixer.update(1); });
      compare();
      assert.deepEqual(poses(optimized), pausedPose, `${id} paused authored pose`);
      mixers.forEach(mixer => { mixer.timeScale = 1; mixer.update(1 / 30); });
      compare();
    }
    mixers.forEach(mixer => mixer.stopAllAction());
  }
  assert.ok(fixedMeshCount > 0, 'approved models have fixed mesh surfaces to cache');
});

function multiFixture(t, enabled = true) {
  const scene = new THREE.Scene();
  const room = new THREE.Group();
  const actor = new THREE.Group();
  scene.add(room);
  room.add(actor);
  const geometries = [new THREE.BoxGeometry(), new THREE.SphereGeometry(1, 8, 6)];
  const materials = [new THREE.MeshStandardMaterial({ color: '#d49145' }), new THREE.MeshStandardMaterial({ color: '#5b9c81' })];
  const sources = geometries.map((geometry, index) => {
    const mesh = new THREE.Mesh(geometry, materials[index]);
    mesh.position.x = index;
    mesh.receiveShadow = true;
    actor.add(mesh);
    return mesh;
  });
  const batches = new SceneBatches(scene, new Set([actor]), undefined, enabled);
  batches.rebuild();
  const multi = scene.getObjectByName('Shared character draws').children.find(mesh => mesh.isBatchedMesh);
  t.after(() => { batches.dispose(); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); });
  return { scene, room, actor, sources, batches, multi };
}

test('multi-draw is gated and combines compatible different geometry without changing source resources', t => {
  const unsupported = multiFixture(t, false);
  assert.equal(unsupported.multi, undefined);
  assert.ok(unsupported.sources.every(mesh => mesh.layers.mask === 1));
  const { sources, batches, multi } = multiFixture(t);
  assert.ok(multi);
  assert.equal(multi.instanceCount, 2);
  assert.equal(multi.receiveShadow, true);
  assert.equal(multi.castShadow, false);
  assert.ok(sources.every(mesh => mesh.layers.mask === 2));
  const colors = sources.map((mesh, index) => multi.getColorAt(index, new THREE.Color()));
  colors.forEach((color, index) => {
    const expected = sources[index].material.color;
    assert.ok(Math.abs(color.r - expected.r) < 1e-7 && Math.abs(color.g - expected.g) < 1e-7 && Math.abs(color.b - expected.b) < 1e-7);
  });
  const shader = { vertexShader: '#include <defaultnormal_vertex>' };
  multi.material.onBeforeCompile(shader, {});
  assert.match(shader.vertexShader, /transpose\( inverse\( mat3\( batchingMatrix \) \) \)/);
  assert.equal(sources[0].material.onBeforeCompile, THREE.Material.prototype.onBeforeCompile);
  let sourceDisposed = false;
  sources[0].geometry.addEventListener('dispose', () => { sourceDisposed = true; });
  batches.dispose();
  assert.ok(sources.every(mesh => mesh.layers.mask === 1));
  assert.equal(sourceDisposed, false);
});

test('multi-draw keeps live transforms, linear colors and per-source and office visibility', t => {
  const { actor, room, sources, batches, multi } = multiFixture(t);
  actor.position.set(2, 1, 3);
  actor.scale.set(1, 1.2, 0.8);
  sources[1].rotation.z = 0.3;
  sources[1].material.color.setRGB(0.2, 0.3, 0.4);
  sources[0].visible = false;
  batches.sync();
  assert.equal(multi.getVisibleAt(0), false);
  assert.equal(multi.getVisibleAt(1), true);
  const matrix = multi.getMatrixAt(1, new THREE.Matrix4());
  sources[1].matrixWorld.elements.forEach((expected, index) => assert.ok(Math.abs(matrix.elements[index] - expected) < 1e-6));
  const color = multi.getColorAt(1, new THREE.Color());
  assert.ok(Math.abs(color.r - 0.2) < 1e-7 && Math.abs(color.g - 0.3) < 1e-7 && Math.abs(color.b - 0.4) < 1e-7);
  room.visible = false;
  batches.sync();
  assert.equal(multi.visible, false);
  assert.equal(multi.getVisibleAt(1), false);
  sources[0].visible = true;
  room.visible = true;
  batches.sync();
  assert.equal(multi.visible, true);
  assert.equal(multi.getVisibleAt(0), true);
  assert.equal(multi.getVisibleAt(1), true);
});

test('multi-draw splits incompatible geometry schemas and excludes transparent, clipped and partial geometry', t => {
  const { sources, batches, multi, actor } = multiFixture(t);
  assert.ok(multi);
  sources[1].geometry.deleteAttribute('uv');
  batches.rebuild();
  assert.equal(actor.parent.parent.getObjectByName('Shared character draws').children.length, 0);
  assert.ok(sources.every(mesh => mesh.layers.mask === 1));
  sources[0].material.transparent = true;
  sources[1].material.clippingPlanes = [new THREE.Plane()];
  batches.rebuild();
  assert.ok(sources.every(mesh => mesh.layers.mask === 1));
  sources[0].material.transparent = false;
  sources[1].material.clippingPlanes = null;
  sources[1].geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sources[1].geometry.attributes.position.count * 2), 2));
  sources[1].geometry.setDrawRange(0, 3);
  batches.rebuild();
  assert.ok(sources.every(mesh => mesh.layers.mask === 1));
});

test('unlit opaque colors use multi-draw while emissive and transparent surfaces stay separate', t => {
  const { sources, batches, scene } = multiFixture(t);
  sources.forEach(mesh => { const old = mesh.material; mesh.material = new THREE.MeshBasicMaterial({ color: old.color }); old.dispose(); });
  t.after(() => sources.forEach(mesh => mesh.material.dispose()));
  batches.rebuild();
  assert.ok(scene.getObjectByName('Shared character draws').children.some(mesh => mesh.isBatchedMesh));
  sources[1].material.transparent = true;
  batches.rebuild();
  assert.ok(sources.every(mesh => mesh.layers.mask === 1));
});

test('opaque batches preserve distinct depth, blending, coverage and shader material states', t => {
  const { sources, batches, scene } = multiFixture(t);
  const first = sources[0].material;
  const second = sources[1].material;
  const rendered = scene.getObjectByName('Shared character draws');
  const differences = {
    depthFunc: THREE.GreaterDepth,
    visible: false,
    dithering: true,
    alphaToCoverage: true,
    forceSinglePass: true,
    precision: 'mediump',
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendEquation: THREE.SubtractEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
    blendEquationAlpha: THREE.SubtractEquation,
    blendAlpha: 0.5,
    envMapIntensity: 0.5,
  };
  for (const [property, different] of Object.entries(differences)) {
    const original = second[property];
    second[property] = different;
    assert.notEqual(first[property], second[property], `${property} fixture differs`);
    batches.rebuild();
    assert.equal(rendered.children.length, 0, `${property} is not silently merged`);
    assert.ok(sources.every(mesh => mesh.layers.mask === 1));
    second[property] = original;
    batches.rebuild();
    assert.equal(rendered.children.length, 1, `${property} matching states can share a draw`);
  }
  second.blendColor.setRGB(0.1, 0.2, 0.3);
  batches.rebuild();
  assert.equal(rendered.children.length, 0, 'blend color is preserved');
  second.blendColor.copy(first.blendColor);
  batches.rebuild();
  assert.equal(rendered.children.length, 1);
});

test('half-float attributes retain their native geometry path', t => {
  const { sources, batches, scene } = multiFixture(t);
  const geometry = sources[1].geometry;
  const uv = geometry.attributes.uv;
  geometry.setAttribute('uv', new THREE.Float16BufferAttribute(new Uint16Array(uv.array.length), uv.itemSize));
  batches.rebuild();
  assert.equal(scene.getObjectByName('Shared character draws').children.length, 0);
  assert.ok(sources.every(mesh => mesh.layers.mask === 1));
  assert.ok(geometry.attributes.uv instanceof THREE.Float16BufferAttribute);
});

test('static furnishings retain their original distinct draws and repeated-geometry instance path', t => {
  const { scene, sources, batches } = multiFixture(t);
  batches.dispose();
  const staticBatches = new SceneBatches(scene, new Set(), undefined, true);
  t.after(() => staticBatches.dispose());
  staticBatches.rebuild();
  const rendered = scene.getObjectByName('Shared character draws');
  assert.equal(rendered.children.length, 0);
  assert.ok(sources.every(mesh => mesh.layers.mask === 1));
  const repeated = sources[0].clone();
  scene.add(repeated);
  staticBatches.rebuild();
  assert.equal(rendered.children.length, 1);
  assert.equal(rendered.children[0].isInstancedMesh, true);
  assert.equal(rendered.children[0].instanceMatrix.usage, THREE.StaticDrawUsage);
  assert.equal(sources[1].layers.mask, 1);
});

test('all compatible dynamic geometries share draws while preserving former instance normal math', t => {
  const { scene, actor, sources, batches } = multiFixture(t);
  sources.forEach(source => {
    const clone = source.clone();
    clone.layers.set(0);
    actor.add(clone);
  });
  const extras = [new THREE.ConeGeometry(1, 1, 8), new THREE.CapsuleGeometry(0.2, 1, 4, 8)];
  extras.forEach(geometry => actor.add(new THREE.Mesh(geometry, sources[0].material)));
  t.after(() => extras.forEach(geometry => geometry.dispose()));
  batches.rebuild();
  const rendered = scene.getObjectByName('Shared character draws');
  assert.equal(rendered.children.length, 2);
  assert.ok(rendered.children.every(mesh => mesh.isBatchedMesh));
  const formerInstances = rendered.children.find(mesh => mesh.instanceCount === 4);
  const formerMeshes = rendered.children.find(mesh => mesh.instanceCount === 2);
  assert.ok(formerInstances && formerMeshes);
  assert.equal(formerInstances.material.onBeforeCompile, THREE.Material.prototype.onBeforeCompile);
  const shader = { vertexShader: '#include <defaultnormal_vertex>' };
  formerMeshes.material.onBeforeCompile(shader, {});
  assert.match(shader.vertexShader, /transpose\( inverse\( mat3\( batchingMatrix \) \) \)/);
  actor.position.set(1, 2, 3);
  actor.scale.set(1.1, 0.8, 1);
  sources[0].rotation.y = 0.3;
  batches.sync();
  const matrix = formerInstances.getMatrixAt(0, new THREE.Matrix4());
  sources[0].matrixWorld.elements.forEach((expected, index) => assert.ok(Math.abs(matrix.elements[index] - expected) < 1e-6));
});

function contactFixture(t, change) {
  const scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry();
  const texture = new THREE.Texture();
  const rooms = [new THREE.Group(), new THREE.Group()];
  rooms[0].position.set(3, 0, -2);
  rooms[1].position.set(-2, 0, 4);
  const sources = rooms.map((room, index) => {
    const source = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      map: texture, color: '#76664f', opacity: 0.3, transparent: true,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
    }));
    source.position.set(index * 0.25, 0.108, 0);
    source.rotation.x = -Math.PI / 2;
    source.scale.set(0.95, 0.65, 1);
    source.renderOrder = 1;
    room.add(source);
    scene.add(room);
    return source;
  });
  const other = new THREE.Mesh(geometry, sources[0].material.clone());
  other.renderOrder = 0;
  scene.add(other);
  change?.(sources);
  scene.updateMatrixWorld(true);
  const batch = new ActorContactBatch(scene, sources);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  batch.sync(camera);
  const mesh = scene.getObjectByName('Shared actor floor contacts');
  t.after(() => {
    batch.dispose(); geometry.dispose(); texture.dispose();
    sources.forEach(source => source.material.dispose()); other.material.dispose();
  });
  return { scene, rooms, sources, other, texture, batch, mesh, camera };
}

test('actor contacts share only their supplied constant-colour layer and follow world transforms and visibility', t => {
  const { scene, rooms, sources, other, texture, batch, mesh, camera } = contactFixture(t);
  assert.ok(mesh?.isInstancedMesh);
  assert.equal(mesh.count, 2);
  assert.equal(mesh.renderOrder, 1, 'after room transparency and before order10 sleep labels');
  assert.equal(mesh.material.map, texture);
  assert.notEqual(mesh.material, sources[0].material, 'the batch owns its material clone');
  assert.equal(mesh.material.transparent, true);
  assert.equal(mesh.material.depthWrite, false);
  assert.equal(other.layers.mask, 1, 'campus contact and other transparency stay independent');
  assert.ok(sources.every(source => source.layers.mask === 2));
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(0, matrix);
  sources[0].matrixWorld.elements.forEach((value, index) => assert.ok(Math.abs(matrix.elements[index] - value) < 1e-6));
  sources[1].position.x += 0.4;
  scene.updateMatrixWorld(true);
  batch.sync(camera);
  mesh.getMatrixAt(1, matrix);
  sources[1].matrixWorld.elements.forEach((value, index) => assert.ok(Math.abs(matrix.elements[index] - value) < 1e-6));
  rooms[0].visible = false;
  batch.sync(camera);
  assert.equal(mesh.count, 1, 'hidden rooms do not retain floor shadows');
  mesh.getMatrixAt(0, matrix);
  sources[1].matrixWorld.elements.forEach((value, index) => assert.ok(Math.abs(matrix.elements[index] - value) < 1e-6));
  sources[1].visible = false;
  batch.sync(camera);
  assert.equal(mesh.visible, false);
  rooms[0].visible = true;
  batch.sync(camera);
  assert.equal(mesh.count, 1);
  assert.equal(mesh.visible, true);
});

test('different contact colours, alpha masks, ordering or depth states keep their original draws', t => {
  const changes = [
    sources => sources[1].material.color.set('#ffffff'),
    sources => { sources[1].material.map = null; },
    sources => { sources[1].material.opacity = 0.4; },
    sources => { sources[1].material.depthWrite = true; },
    sources => { sources[1].material.transparent = false; },
    sources => { sources[1].renderOrder = 0; },
    sources => sources[1].layers.set(1),
  ];
  for (const change of changes) {
    const { mesh, sources } = contactFixture(t, change);
    assert.equal(mesh, undefined);
    assert.equal(sources[0].layers.mask, 1, 'rejection never partially hides originals');
  }
});

test('contact batch disposal restores originals and disposes owned resources once', t => {
  const { sources, other, texture, batch, mesh, camera } = contactFixture(t);
  let materialDisposals = 0;
  let geometryDisposals = 0;
  let textureDisposals = 0;
  mesh.material.addEventListener('dispose', () => materialDisposals++);
  sources[0].geometry.addEventListener('dispose', () => geometryDisposals++);
  texture.addEventListener('dispose', () => textureDisposals++);
  batch.dispose();
  batch.dispose();
  batch.sync(camera);
  assert.ok(sources.every(source => source.layers.mask === 1));
  assert.equal(other.layers.mask, 1);
  assert.equal(mesh.parent, null);
  assert.equal(materialDisposals, 1);
  assert.equal(geometryDisposals, 0, 'shared source geometry is retained');
  assert.equal(textureDisposals, 0, 'shared alpha mask is retained');
});

test('contact instances preserve transparent painter order through camera turns and equal-depth overlaps', t => {
  const { scene, rooms, sources, batch, mesh, camera } = contactFixture(t);
  const matrix = new THREE.Matrix4();
  const firstPosition = () => {
    mesh.getMatrixAt(0, matrix);
    return new THREE.Vector3().setFromMatrixPosition(matrix).toArray();
  };
  assert.deepEqual(firstPosition().map(value => Math.round(value * 1000) / 1000), [3, 0.108, -2]);
  camera.position.set(0, 5, -10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  batch.sync(camera);
  assert.deepEqual(firstPosition().map(value => Math.round(value * 1000) / 1000), [-1.75, 0.108, 4]);
  rooms[1].position.copy(rooms[0].position);
  sources[1].position.copy(sources[0].position);
  sources[1].position.x += 0.25;
  scene.updateMatrixWorld(true);
  batch.sync(camera);
  assert.ok(sources[0].id < sources[1].id);
  // Equal-depth alpha-mask edges retain original creation/id order, rather than
  // whatever order the last camera turn left in the reusable instance slots.
  assert.deepEqual(firstPosition().map(value => Math.round(value * 1000) / 1000), [3, 0.108, -2]);
});
