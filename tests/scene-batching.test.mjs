import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import ts from 'typescript';

const source = await readFile(new URL('../src/scene/performanceBatching.ts', import.meta.url), 'utf8');
const mapArraySource = await readFile(new URL('../src/scene/staticMapArrays.ts', import.meta.url), 'utf8');
const mapArrayJavascript = ts.transpileModule(mapArraySource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replace("from 'three'", `from ${JSON.stringify(import.meta.resolve('three'))}`);
const mapArrayUrl = `data:text/javascript;base64,${Buffer.from(mapArrayJavascript).toString('base64')}`;
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replace("from 'three'", `from ${JSON.stringify(import.meta.resolve('three'))}`)
  .replace("from 'three/addons/utils/BufferGeometryUtils.js'", `from ${JSON.stringify(import.meta.resolve('three/addons/utils/BufferGeometryUtils.js'))}`);
const { ActorContactBatch, freezeStaticAuthoredMeshes, SceneBatches } = await import(`data:text/javascript;base64,${Buffer.from(javascript.replace("from './staticMapArrays'", `from ${JSON.stringify(mapArrayUrl)}`)).toString('base64')}`);
const { StaticMapArrays, staticPlaneMap } = await import(mapArrayUrl);

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
  const staticBatch = rendered.find(mesh => mesh.instanceMatrix?.usage === THREE.StaticDrawUsage);
  const dynamicBatch = rendered.find(mesh => mesh.isTransformPaletteMesh);
  assert.ok(staticBatch && dynamicBatch);
  t.after(() => { batches.dispose(); geometry.dispose(); red.dispose(); blue.dispose(); moving.forEach(mesh => mesh.material.dispose()); });
  return { scene, staticRoom, dynamicRoom, actor, fixed, moving, batches, staticBatch, dynamicBatch };
}

function canvasMap(width = 2, height = 2, values = Uint8ClampedArray.from({ length: width * height * 4 }, (_, i) => i)) {
  const canvas = { width, height, getContext: () => ({ getImageData: () => ({ data: values }) }) };
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function mappedPlane(texture, alphaTest = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.7), new THREE.MeshStandardMaterial({
    map: texture, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, alphaTest,
  }));
  mesh.receiveShadow = true;
  return mesh;
}

test('static array layers preserve every source byte and alpha while applying the original canvas row flip', () => {
  const first = canvasMap();
  const second = canvasMap(2, 2, Uint8ClampedArray.from({ length: 16 }, (_, i) => 255 - i));
  const pool = new StaticMapArrays({ maxTextureSize: 64, maxLayers: 4 });
  const array = pool.acquire([first, second]);
  assert.ok(array?.isDataArrayTexture);
  assert.deepEqual(Array.from(array.image.data), [8, 9, 10, 11, 12, 13, 14, 15, 0, 1, 2, 3, 4, 5, 6, 7,
    247, 246, 245, 244, 243, 242, 241, 240, 255, 254, 253, 252, 251, 250, 249, 248]);
  assert.equal(array.colorSpace, THREE.SRGBColorSpace);
  assert.equal(array.type, THREE.UnsignedByteType);
  assert.equal(array.format, THREE.RGBAFormat);
  assert.equal(array.minFilter, first.minFilter);
  assert.equal(array.magFilter, first.magFilter);
  assert.equal(array.anisotropy, 4);
  assert.equal(array.generateMipmaps, true);
  assert.equal(array.flipY, false);
  assert.equal(array.premultiplyAlpha, false);
  pool.dispose();
});

test('static arrays reuse unchanged canvases across rebuilds and release only owned copies', () => {
  const maps = [canvasMap(), canvasMap()];
  const pool = new StaticMapArrays({ maxTextureSize: 64, maxLayers: 4 });
  let reads = 0, originalDisposed = 0, copiesDisposed = 0;
  maps.forEach(map => {
    const getContext = map.image.getContext;
    map.image.getContext = () => { reads++; return getContext(); };
    map.addEventListener('dispose', () => originalDisposed++);
  });
  const first = pool.acquire(maps);
  first.addEventListener('dispose', () => copiesDisposed++);
  for (let i = 0; i < 4; i++) {
    pool.beginRebuild();
    assert.equal(pool.acquire(maps), first);
    pool.endRebuild();
  }
  assert.equal(reads, 2);
  maps[0].needsUpdate = true;
  pool.beginRebuild();
  const replacement = pool.acquire(maps);
  assert.notEqual(replacement, first);
  replacement.addEventListener('dispose', () => copiesDisposed++);
  pool.endRebuild();
  assert.equal(copiesDisposed, 1);
  pool.dispose(); pool.dispose();
  assert.equal(copiesDisposed, 2);
  assert.equal(originalDisposed, 0);
});

test('unsupported static map inputs and unavailable pixels retain ordinary rendering', () => {
  const cases = [
    mesh => { mesh.material.map.wrapS = THREE.RepeatWrapping; },
    mesh => { mesh.material.map.repeat.set(2, 1); },
    mesh => { mesh.material.map.colorSpace = THREE.LinearSRGBColorSpace; },
    mesh => { mesh.material.map.minFilter = THREE.LinearFilter; },
    mesh => { mesh.material.map.anisotropy = 1; },
    mesh => { mesh.material.map.premultiplyAlpha = true; },
    mesh => { mesh.material.map.channel = 1; },
    mesh => { mesh.material.transparent = true; },
    mesh => { mesh.material.alphaTest = 0.5; },
    mesh => { mesh.castShadow = true; },
    mesh => { mesh.geometry.attributes.position.setZ(0, 0.1); },
  ];
  for (const change of cases) {
    const mesh = mappedPlane(canvasMap()); change(mesh);
    assert.equal(staticPlaneMap(mesh), undefined);
  }
  const maps = [canvasMap(), canvasMap()];
  assert.equal(new StaticMapArrays().acquire(maps), undefined);
  assert.equal(new StaticMapArrays({ maxTextureSize: 1, maxLayers: 4 }).acquire(maps), undefined);
  assert.equal(new StaticMapArrays({ maxTextureSize: 64, maxLayers: 1 }).acquire(maps), undefined);
  const oversized = [canvasMap(), canvasMap()];
  oversized.forEach(map => {
    map.image.width = map.image.height = 2048;
    map.image.getContext = () => { throw new Error('Over-budget arrays must not read pixels.'); };
  });
  assert.equal(new StaticMapArrays({ maxTextureSize: 4096, maxLayers: 4 }).acquire(oversized), undefined);
  maps[1].image.getContext = () => ({ getImageData: () => { throw new Error('Read denied.'); } });
  const scene = new THREE.Scene();
  const meshes = maps.map(map => mappedPlane(map)); scene.add(...meshes);
  const batches = new SceneBatches(scene, new Set(), undefined, false, { maxTextureSize: 64, maxLayers: 4 });
  batches.rebuild();
  assert.equal(scene.getObjectByName('Shared character draws').children.length, 0);
  assert.ok(meshes.every(mesh => mesh.layers.mask === 1));
  batches.dispose();
});

test('mapped static palettes retain exact camera matrices, alpha tests, shadow sampling and independent office visibility', () => {
  const scene = new THREE.Scene(), rooms = [new THREE.Group(), new THREE.Group()];
  const sources = [mappedPlane(canvasMap(), 0.3), mappedPlane(canvasMap(2, 2,
    Uint8ClampedArray.from({ length: 16 }, (_, i) => 128 + i)), 0.3)];
  rooms[0].position.set(2, 0, -3); rooms[1].position.set(-2, 0, 1);
  rooms.forEach((room, i) => { room.add(sources[i]); });
  scene.add(rooms[1], rooms[0]); // Traversal order deliberately opposes material creation order.
  const batches = new SceneBatches(scene, new Set(), undefined, false, { maxTextureSize: 64, maxLayers: 4 });
  batches.rebuild();
  const mesh = scene.getObjectByName('Shared character draws').children[0];
  assert.ok(mesh.isTransformPaletteMesh && mesh.viewSpace);
  assert.equal(mesh.material.alphaTest, 0.3);
  assert.equal(mesh.material.side, THREE.DoubleSide);
  assert.equal(mesh.material.map.image.depth, 2);
  const texture = mesh.material.map;
  assert.deepEqual(Array.from(texture.image.data.subarray(0, 4)), [8, 9, 10, 11]);
  assert.deepEqual(Array.from(texture.image.data.subarray(16, 20)), [136, 137, 138, 139]);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(3, 4, 6); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  mesh.onBeforeRender(null, scene, camera);
  sources.forEach((source, index) => {
    const expected = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, source.matrixWorld);
    assert.deepEqual(Array.from(mesh.viewPalette.texture.image.data.subarray(index * 32, index * 32 + 16)), Array.from(new Float32Array(expected.elements)));
  });
  for (const [material, shadow] of [[mesh.material, false], [mesh.customDepthMaterial, true], [mesh.customDistanceMaterial, true]]) {
    const shader = { vertexShader: '#include <batching_pars_vertex>\n#include <batching_vertex>\n#include <begin_vertex>\n#include <defaultnormal_vertex>\n#include <project_vertex>',
      fragmentShader: '#include <map_pars_fragment>\n#include <map_fragment>\n#include <alphatest_fragment>', uniforms: {} };
    material.onBeforeCompile(shader, null);
    assert.match(shader.fragmentShader, /sampler2DArray map/);
    assert.match(shader.fragmentShader, /texture\( map, vec3\( vMapUv, vPlatopMapLayer \) \)/);
    assert.match(shader.fragmentShader, /#include <alphatest_fragment>/);
    assert.match(shader.vertexShader, /vPlatopMapLayer = platopPart/);
    assert.equal(shader.uniforms.platopViewTexture.value, shadow ? mesh.shadowPalette.texture : mesh.viewPalette.texture);
  }
  rooms[1].visible = false; batches.invalidateVisibility(); batches.sync();
  assert.equal(mesh.count, 1); assert.equal(mesh.getVisibleAt(1), false);
  rooms[1].visible = true; batches.invalidateVisibility(); batches.sync();
  assert.equal(mesh.count, 2); assert.equal(mesh.getVisibleAt(1), true);
  batches.rebuild();
  assert.equal(scene.getObjectByName('Shared character draws').children[0].material.map, texture);
  batches.dispose();
  assert.ok(sources.every(source => source.layers.mask === 1 && source.material.map.isCanvasTexture));
});

test('unchanged static transforms and colors are not rewritten on animation frames', t => {
  const { staticRoom, batches, staticBatch, dynamicBatch } = fixture(t);
  let staticVisits = 0;
  const update = staticRoom.updateMatrixWorld;
  staticRoom.updateMatrixWorld = function (...args) { staticVisits++; return update.apply(this, args); };
  const matrixVersion = staticBatch.instanceMatrix.version;
  const staticColorVersion = staticBatch.instanceColor.version;
  const dynamicColorVersion = dynamicBatch.colorsTexture.version;
  batches.sync();
  batches.sync();
  assert.equal(staticVisits, 0);
  assert.equal(staticBatch.instanceMatrix.version, matrixVersion);
  assert.equal(staticBatch.instanceColor.version, staticColorVersion);
  assert.equal(dynamicBatch.colorsTexture.version, dynamicColorVersion);
});

test('animated parent transforms, individual visibility, and changed colors reach instances', t => {
  const { actor, moving, batches, dynamicBatch } = fixture(t);
  actor.position.set(2, 1, 0);
  batches.sync();
  const matrix = new THREE.Matrix4();
  dynamicBatch.getMatrixAt(0, matrix);
  const position = new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.deepEqual(position.toArray(), [2, 1, -3]);
  const colorVersion = dynamicBatch.colorsTexture.version;
  moving[0].material.color.setRGB(0.2, 0.3, 0.4);
  batches.sync();
  const color = new THREE.Color();
  dynamicBatch.getColorAt(0, color);
  assert.ok(Math.abs(color.r - 0.2) < 1e-7);
  assert.ok(Math.abs(color.g - 0.3) < 1e-7 && Math.abs(color.b - 0.4) < 1e-7);
  assert.equal(dynamicBatch.colorsTexture.version, colorVersion + 1);
  moving[0].visible = false;
  batches.sync();
  assert.equal(dynamicBatch.count, 1);
  assert.equal(dynamicBatch.getVisibleAt(0), false);
  dynamicBatch.getColorAt(1, color);
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
  dynamicBatch.getMatrixAt(1, matrix);
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
  const multi = scene.getObjectByName('Shared character draws').children.find(mesh => mesh.isTransformPaletteMesh);
  t.after(() => { batches.dispose(); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); });
  return { scene, room, actor, sources, batches, multi };
}

test('one-draw palettes combine compatible geometry without an extension or source resource changes', t => {
  const unsupported = multiFixture(t, false);
  assert.ok(unsupported.multi?.isTransformPaletteMesh, 'one-draw palettes do not need multi-draw support');
  assert.ok(unsupported.sources.every(mesh => mesh.layers.mask === 2));
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
  const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
  multi.material.onBeforeCompile(shader, {});
  assert.match(shader.vertexShader, /transpose\( inverse\( mat3\( batchingMatrix \) \) \)/);
  assert.equal(sources[0].material.onBeforeCompile, THREE.Material.prototype.onBeforeCompile);
  let sourceDisposed = false;
  sources[0].geometry.addEventListener('dispose', () => { sourceDisposed = true; });
  batches.dispose();
  assert.ok(sources.every(mesh => mesh.layers.mask === 1));
  assert.equal(sourceDisposed, false);
});

test('transform palettes keep live transforms, linear colors and per-source and office visibility', t => {
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

test('transform palettes split incompatible geometry schemas and exclude transparent, clipped and partial geometry', t => {
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

test('unlit opaque colors use transform palettes while emissive and transparent surfaces stay separate', t => {
  const { sources, batches, scene } = multiFixture(t);
  sources.forEach(mesh => { const old = mesh.material; mesh.material = new THREE.MeshBasicMaterial({ color: old.color }); old.dispose(); });
  t.after(() => sources.forEach(mesh => mesh.material.dispose()));
  batches.rebuild();
  assert.ok(scene.getObjectByName('Shared character draws').children.some(mesh => mesh.isTransformPaletteMesh));
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

test('static ordinary furnishings share CPU-view palettes while repeated geometry retains its instance path', t => {
  const { scene, sources, batches } = multiFixture(t);
  batches.dispose();
  const staticBatches = new SceneBatches(scene, new Set(), undefined, true);
  t.after(() => staticBatches.dispose());
  staticBatches.rebuild();
  const rendered = scene.getObjectByName('Shared character draws');
  assert.equal(rendered.children.length, 1);
  assert.equal(rendered.children[0].viewSpace, true);
  assert.ok(sources.every(mesh => mesh.layers.mask === 2));
  const repeated = sources[0].clone();
  scene.add(repeated);
  staticBatches.rebuild();
  assert.equal(rendered.children.length, 1);
  assert.equal(rendered.children[0].isInstancedMesh, true);
  assert.equal(rendered.children[0].instanceMatrix.usage, THREE.StaticDrawUsage);
  assert.equal(sources[1].layers.mask, 1);
});

function staticInstanceFixture(t, ordered = false) {
  const scene = new THREE.Scene();
  const room = new THREE.Group();
  const furniture = new THREE.Group();
  room.add(furniture); scene.add(room);
  furniture.renderOrder = ordered ? 4 : 0;
  room.position.set(1.123456789, -0.238231, 4.782191);
  room.rotation.set(0.2, 0.73, -0.11);
  room.scale.set(1.4, 0.6, 0.9);
  const geometries = [new THREE.BoxGeometry(), new THREE.SphereGeometry(0.5, 8, 6)];
  const materials = geometries.map((_, index) => new THREE.MeshStandardMaterial({
    color: index ? 0xa1b2c3 : 0x846937, roughness: index ? 0.71 : 0.32, metalness: index ? 0.1 : 0.3,
  }));
  const sources = geometries.flatMap((geometry, group) => [0, 1].map(index => {
    const mesh = new THREE.Mesh(geometry, materials[group]);
    mesh.position.set(index * 0.531 + group, 0.123456789, -0.27 * group);
    mesh.rotation.set(index * 0.3, 0.2 + group * 0.4, 0.09);
    mesh.scale.set(0.72, 1.31, 0.93);
    mesh.castShadow = true; mesh.receiveShadow = true;
    furniture.add(mesh); return mesh;
  }));
  const batches = new SceneBatches(scene, new Set());
  batches.rebuild();
  const rendered = scene.getObjectByName('Shared character draws');
  t.after(() => { batches.dispose(); geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); });
  return { scene, room, sources, batches, rendered };
}

test('static instance groups combine draws with the original Float32 world and instance normal inputs', t => {
  const { sources, batches, rendered } = staticInstanceFixture(t);
  assert.equal(rendered.children.length, 1, 'two repeated geometry/material groups become one real draw');
  const mesh = rendered.children[0];
  assert.equal(mesh.normalMode, 'instance');
  assert.equal(mesh.viewSpace, false, 'former instances must not use ordinary CPU model-view normals');
  assert.equal(mesh.viewPalette, undefined);
  assert.equal(mesh.instanceCount, 4);
  const group = batches.paletteBatches[0];
  group.sources.forEach(({ mesh: source }, part) => {
    source.matrixWorld.elements.forEach((value, index) => {
      assert.equal(mesh.matricesTexture.image.data[part * 16 + index], Math.fround(value),
        'instanceMatrix and the transform texture upload identical Float32 world values');
    });
    assert.deepEqual(mesh.getColorAt(part, new THREE.Color()).toArray(), source.material.color.toArray().map(Math.fround));
  });
  const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
  mesh.material.onBeforeCompile(shader, {});
  assert.match(shader.vertexShader, /#include <defaultnormal_vertex>/, 'the original instance normalization sequence is retained');
  assert.match(shader.vertexShader, /#include <project_vertex>/, 'original modelView * Float32 world multiplication remains');
  assert.doesNotMatch(shader.vertexShader, /platopViewTexture|transpose\( inverse\(/);
  assert.ok(THREE.ShaderChunk.defaultnormal_vertex.includes('mat3 bm = mat3( batchingMatrix );'));
  assert.ok(THREE.ShaderChunk.defaultnormal_vertex.includes('mat3 im = mat3( instanceMatrix );'));
  const batchingNormal = THREE.ShaderChunk.defaultnormal_vertex.match(/mat3 bm =[\s\S]*?transformedNormal = bm \* transformedNormal;/)[0];
  const instanceNormal = THREE.ShaderChunk.defaultnormal_vertex.match(/mat3 im =[\s\S]*?transformedNormal = im \* transformedNormal;/)[0];
  assert.equal(batchingNormal.replaceAll('bm', 'im').replace('batchingMatrix', 'instanceMatrix'), instanceNormal,
    'Three uses the exact same arithmetic for the palette and former instance normals');
  for (const shadow of [mesh.customDepthMaterial, mesh.customDistanceMaterial]) {
    const shader = { vertexShader: THREE.ShaderLib.depth.vertexShader, fragmentShader: THREE.ShaderLib.depth.fragmentShader, uniforms: {} };
    shadow.onBeforeCompile(shader, {});
    assert.match(shader.vertexShader, /#include <project_vertex>/);
    assert.doesNotMatch(shader.vertexShader, /platopViewTexture/);
    assert.equal(shader.uniforms.batchingTexture.value, mesh.matricesTexture);
  }
  const version = mesh.matricesTexture.version;
  batches.sync(); batches.sync();
  assert.equal(mesh.matricesTexture.version, version, 'stationary static instances do not upload every animation frame');
  assert.ok(sources.every(source => source.layers.mask === 2));
});

test('combined static instances retain independent decoration colors, room visibility and original ownership', t => {
  const { room, sources, batches, rendered } = staticInstanceFixture(t);
  const mesh = rendered.children[0];
  const group = batches.paletteBatches[0];
  const hiddenIndex = group.sources.findIndex(source => source.mesh === sources[0]);
  sources[0].visible = false;
  sources[3].material.color.setRGB(0.22, 0.41, 0.13);
  batches.invalidateVisibility(); batches.sync();
  assert.equal(mesh.count, 3); assert.equal(mesh.getVisibleAt(hiddenIndex), false);
  group.sources.forEach(({ mesh: source }, part) => {
    if (source.visible) assert.deepEqual(mesh.getColorAt(part, new THREE.Color()).toArray(), source.material.color.toArray().map(Math.fround));
  });
  room.visible = false; batches.invalidateVisibility(); batches.sync();
  assert.equal(mesh.count, 0); assert.equal(mesh.visible, false);
  room.visible = true; sources[0].visible = true; batches.invalidateVisibility(); batches.sync();
  assert.equal(mesh.count, 4); assert.equal(mesh.visible, true);
  let sourceDisposed = 0;
  sources[0].geometry.addEventListener('dispose', () => sourceDisposed++);
  sources[0].material.addEventListener('dispose', () => sourceDisposed++);
  batches.rebuild();
  assert.equal(rendered.children.length, 1); assert.equal(rendered.children[0].count, 4);
  batches.dispose();
  assert.ok(sources.every(source => source.layers.mask === 1));
  assert.equal(sourceDisposed, 0);
});

test('ancestor group ordering retains the original draws for repeated and ordinary surfaces', t => {
  const { scene, sources, rendered } = staticInstanceFixture(t, true);
  assert.equal(rendered.children.length, 0);
  assert.ok(sources.every(source => source.layers.mask === 1));
  const room = new THREE.Group(); room.renderOrder = 7;
  const box = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(), box.material);
  room.add(box, sphere); scene.add(room);
  const batches = new SceneBatches(scene, new Set());
  t.after(() => { batches.dispose(); box.geometry.dispose(); sphere.geometry.dispose(); box.material.dispose(); });
  batches.rebuild();
  assert.equal(scene.getObjectsByProperty('name', 'Shared character draws').at(-1).children.length, 0);
  assert.equal(box.layers.mask, 1); assert.equal(sphere.layers.mask, 1);
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
  assert.ok(rendered.children.every(mesh => mesh.isTransformPaletteMesh));
  const formerInstances = rendered.children.find(mesh => mesh.instanceCount === 4);
  const formerMeshes = rendered.children.find(mesh => mesh.instanceCount === 2);
  assert.ok(formerInstances && formerMeshes);
  const instanceShader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
  formerInstances.material.onBeforeCompile(instanceShader, {});
  assert.match(instanceShader.vertexShader, /#include <defaultnormal_vertex>/, 'former instance normal math remains unchanged');
  const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
  formerMeshes.material.onBeforeCompile(shader, {});
  assert.match(shader.vertexShader, /transpose\( inverse\( mat3\( batchingMatrix \) \) \)/);
  actor.position.set(1, 2, 3);
  actor.scale.set(1.1, 0.8, 1);
  sources[0].rotation.y = 0.3;
  batches.sync();
  const matrix = formerInstances.getMatrixAt(0, new THREE.Matrix4());
  sources[0].matrixWorld.elements.forEach((expected, index) => assert.ok(Math.abs(matrix.elements[index] - expected) < 1e-6));
});

test('different PBR surface factors share a draw with exact flat per-geometry shader inputs', t => {
  const { scene, sources, batches } = multiFixture(t);
  sources[0].material.roughness = 0.32;
  sources[0].material.metalness = 0.3;
  sources[1].material.roughness = 0.9;
  sources[1].material.metalness = 0;
  batches.rebuild();
  const rendered = scene.getObjectByName('Shared character draws');
  assert.equal(rendered.children.length, 1);
  const multi = rendered.children[0];
  const factors = multi.geometry.getAttribute('platopSurface');
  assert.ok(factors instanceof THREE.BufferAttribute);
  sources.forEach((source, index) => {
    const range = multi.getGeometryRangeAt(multi.getGeometryIdAt(index));
    for (let vertex = range.vertexStart; vertex < range.vertexStart + range.vertexCount; vertex++) {
      assert.equal(factors.getX(vertex), Math.fround(source.material.roughness));
      assert.equal(factors.getY(vertex), Math.fround(source.material.metalness));
    }
    assert.equal(source.geometry.hasAttribute('platopSurface'), false, 'source geometry stays untouched');
  });
  const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
  multi.material.onBeforeCompile(shader, {});
  assert.match(shader.vertexShader, /flat varying vec2 vPlatopSurface/);
  assert.match(shader.vertexShader, /vPlatopSurface = platopSurface/);
  assert.match(shader.vertexShader, /transpose\( inverse\( mat3\( batchingMatrix \) \) \)/);
  assert.match(shader.fragmentShader, /flat varying vec2 vPlatopSurface/);
  assert.match(shader.fragmentShader, /float roughnessFactor = vPlatopSurface\.x/);
  assert.match(shader.fragmentShader, /float metalnessFactor = vPlatopSurface\.y/);
  assert.doesNotMatch(shader.fragmentShader, /float roughnessFactor = roughness;/);
  assert.equal(sources[0].material.roughness, 0.32);
  assert.equal(sources[1].material.roughness, 0.9);
});

test('shared geometry keeps separate PBR variants and rebuilds without disposing source resources', t => {
  const { scene, sources, batches } = multiFixture(t);
  sources[1].geometry = sources[0].geometry;
  sources[0].material.roughness = 0.25;
  sources[1].material.roughness = 0.85;
  let geometryDisposals = 0;
  let materialDisposals = 0;
  sources[0].geometry.addEventListener('dispose', () => geometryDisposals++);
  sources[0].material.addEventListener('dispose', () => materialDisposals++);
  batches.rebuild();
  let multi = scene.getObjectByName('Shared character draws').children[0];
  assert.notEqual(multi.getGeometryIdAt(0), multi.getGeometryIdAt(1));
  assert.equal(multi.geometry.attributes.position.count, sources[0].geometry.attributes.position.count * 2);
  sources[1].material.roughness = 0.65;
  batches.rebuild();
  multi = scene.getObjectByName('Shared character draws').children[0];
  const range = multi.getGeometryRangeAt(multi.getGeometryIdAt(1));
  assert.equal(multi.geometry.attributes.platopSurface.getX(range.vertexStart), Math.fround(0.65));
  batches.dispose();
  assert.equal(geometryDisposals, 0);
  assert.equal(materialDisposals, 0);
  assert.ok(sources.every(source => source.layers.mask === 1));
});

test('PBR surface palettes work without multi-draw and retain incompatible native shader inputs', t => {
  const { scene, sources, batches } = multiFixture(t, false);
  sources[0].material.roughness = 0.32;
  sources[1].material.roughness = 0.9;
  batches.rebuild();
  assert.equal(scene.getObjectByName('Shared character draws').children.length, 1);
  assert.ok(sources.every(source => source.layers.mask === 2));
  const enabled = multiFixture(t);
  enabled.sources[0].geometry.setAttribute('platopSurface', new THREE.Float32BufferAttribute(
    new Float32Array(enabled.sources[0].geometry.attributes.position.count * 2), 2));
  enabled.batches.rebuild();
  assert.equal(enabled.scene.getObjectByName('Shared character draws').children.length, 0);
  assert.ok(enabled.sources.every(source => source.layers.mask === 1));
});

test('a single ordinary mesh retains every original vertex, index and stable part identity', t => {
  const { sources, multi } = multiFixture(t, false);
  assert.equal(multi.isMesh, true);
  assert.equal(multi.isBatchedMesh, undefined, 'renderer submits one geometry, rather than an ANGLE multi-draw loop');
  assert.equal(multi.isInstancedMesh, undefined);
  assert.deepEqual(multi.geometry.groups, []);
  let vertexOffset = 0;
  let indexOffset = 0;
  sources.forEach((source, part) => {
    assert.notEqual(multi.geometry, source.geometry);
    assert.equal(source.geometry.hasAttribute('platopPart'), false);
    const vertexCount = source.geometry.attributes.position.count;
    for (const [name, attribute] of Object.entries(source.geometry.attributes)) {
      const merged = multi.geometry.getAttribute(name);
      for (let component = 0; component < attribute.array.length; component++) {
        assert.equal(merged.array[vertexOffset * attribute.itemSize + component], attribute.array[component], `${name} keeps source Float32 inputs`);
      }
    }
    for (let vertex = vertexOffset; vertex < vertexOffset + vertexCount; vertex++) {
      assert.equal(multi.geometry.attributes.platopPart.getX(vertex), part);
    }
    for (const index of source.geometry.index.array) assert.equal(multi.geometry.index.array[indexOffset++], index + vertexOffset);
    vertexOffset += vertexCount;
  });
  assert.equal(multi.geometry.attributes.position.count, vertexOffset);
  assert.equal(multi.geometry.index.count, indexOffset);
});

test('color and both shadow shaders share the transform and visibility palette without extension builtins', t => {
  const { multi } = multiFixture(t, false);
  for (const [material, library, colors] of [
    [multi.material, THREE.ShaderLib.standard, true],
    [multi.customDepthMaterial, THREE.ShaderLib.depth, false],
    [multi.customDistanceMaterial, THREE.ShaderLib.distanceRGBA, false],
  ]) {
    const shader = { vertexShader: library.vertexShader, fragmentShader: library.fragmentShader, uniforms: {} };
    material.onBeforeCompile(shader, {});
    assert.match(shader.vertexShader, /attribute float platopPart/);
    assert.match(shader.vertexShader, /getBatchingMatrix\( platopPart \)/);
    assert.match(shader.vertexShader, /batchingMatrix\[3\]\[3\] = 1\.0/);
    assert.match(shader.vertexShader, /if \( !platopVisible \) gl_Position = vec4\( 2\.0, 2\.0, 2\.0, 1\.0 \)/);
    assert.doesNotMatch(shader.vertexShader, /gl_DrawID|getIndirectIndex|GL_ANGLE_multi_draw/);
    assert.equal(shader.uniforms.batchingTexture.value, multi.matricesTexture);
    if (colors) {
      assert.match(shader.vertexShader, /#define USE_BATCHING_COLOR/);
      assert.doesNotMatch(shader.vertexShader, /#define USE_COLOR\b/, 'no absent vertex color attribute is enabled');
      assert.match(shader.fragmentShader, /#ifndef USE_COLOR\n#define USE_COLOR\n#endif/,
        'plain Mesh still multiplies the linear per-part color in its fragment shader');
      assert.equal(shader.uniforms.batchingColorTexture.value, multi.colorsTexture);
    } else {
      assert.doesNotMatch(shader.vertexShader, /#define USE_BATCHING_COLOR/);
      assert.equal(shader.uniforms.batchingColorTexture, undefined);
    }
  }
});

test('global palettes skip hidden office updates and reenter with current world poses, colors and part visibility', t => {
  const { scene, room, sources, batches } = multiFixture(t, false);
  const secondRoom = new THREE.Group();
  const secondActor = new THREE.Group();
  const copies = sources.map(source => {
    const copy = source.clone();
    copy.layers.set(0);
    copy.material = source.material.clone();
    return copy;
  });
  secondActor.add(...copies);
  secondRoom.add(secondActor);
  secondRoom.position.set(2, 0, -4);
  scene.add(secondRoom);
  batches.dispose();
  const shared = new SceneBatches(scene, new Set([sources[0].parent, secondActor]));
  t.after(() => { shared.dispose(); copies.forEach(copy => copy.material.dispose()); });
  shared.rebuild();
  const palettes = scene.getObjectByName('Shared character draws').children;
  assert.equal(palettes.length, 1, 'compatible surfaces share one actual draw across offices');
  const palette = palettes[0];
  const group = shared.paletteBatches[0];
  const part = source => group.sources.findIndex(entry => entry.mesh === source);
  assert.equal(palette.instanceCount, 4);
  let secondOfficeVisits = 0;
  const update = secondActor.updateMatrixWorld;
  secondActor.updateMatrixWorld = function (...args) { secondOfficeVisits++; return update.apply(this, args); };
  room.visible = false;
  copies[0].visible = false;
  shared.sync();
  assert.equal(palette.visible, true);
  assert.equal(palette.count, 1);
  assert.ok(sources.every(source => !palette.getVisibleAt(part(source))));
  assert.equal(palette.getVisibleAt(part(copies[0])), false);
  assert.equal(palette.getVisibleAt(part(copies[1])), true);
  room.visible = true;
  secondRoom.visible = false;
  secondActor.position.set(9, 3, 1);
  copies[0].material.color.setRGB(0.1, 0.2, 0.3);
  const visitsBeforeHidden = secondOfficeVisits;
  shared.sync();
  assert.equal(secondOfficeVisits, visitsBeforeHidden, 'hidden office transforms are not traversed');
  assert.equal(palette.count, 2);
  assert.ok(copies.every(source => !palette.getVisibleAt(part(source))));
  secondRoom.visible = true;
  copies[0].visible = true;
  shared.sync();
  assert.equal(secondOfficeVisits, visitsBeforeHidden + 1);
  assert.equal(palette.count, 4);
  assert.ok([...sources, ...copies].every(source => palette.getVisibleAt(part(source))));
  const matrix = palette.getMatrixAt(part(copies[0]), new THREE.Matrix4());
  assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(matrix).toArray(), [11, 3, -3]);
  assert.deepEqual(palette.getColorAt(part(copies[0]), new THREE.Color()).toArray(), [0.1, 0.2, 0.3].map(Math.fround));
  copies[1].visible = false;
  shared.sync();
  assert.equal(palette.count, 3, 'one hidden part never hides its office peers');
  assert.equal(palette.getVisibleAt(part(copies[1])), false);
  assert.equal(palette.getVisibleAt(part(copies[0])), true);
});

test('global dynamic draws retain incompatible shader and former normal paths across rooms', t => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry();
  const actors = [];
  const materials = [];
  const sources = [];
  for (let office = 0; office < 3; office++) {
    const room = new THREE.Group();
    const actor = new THREE.Group();
    room.position.set(office * 5, office, -office * 3);
    room.add(actor); scene.add(room); actors.push(actor);
    for (const type of ['standard', 'basic']) {
      const material = type === 'standard'
        ? new THREE.MeshStandardMaterial({ color: 0x758462, roughness: 0.3 + office * 0.2 })
        : new THREE.MeshBasicMaterial({ color: 0xe2cba6 });
      materials.push(material);
      const source = new THREE.Mesh(geometry, material);
      actor.add(source); sources.push(source);
    }
  }
  const batches = new SceneBatches(scene, new Set(actors));
  t.after(() => { batches.dispose(); geometry.dispose(); materials.forEach(material => material.dispose()); });
  batches.rebuild();
  const palettes = scene.getObjectByName('Shared character draws').children;
  assert.equal(palettes.length, 2, 'three offices merge by shader compatibility rather than office');
  const standard = palettes.find(mesh => mesh.material.isMeshStandardMaterial);
  const basic = palettes.find(mesh => mesh.material.isMeshBasicMaterial);
  assert.equal(standard.instanceCount, 3);
  assert.equal(basic.instanceCount, 3);
  assert.equal(standard.normalMode, 'mesh', 'distinct PBR inputs retain the former ordinary normal path');
  assert.equal(basic.normalMode, 'mesh');
  for (const { mesh, sources: parts } of batches.paletteBatches) {
    parts.forEach(({ mesh: source }, index) => {
      assert.deepEqual(mesh.getMatrixAt(index, new THREE.Matrix4()).toArray(), source.matrixWorld.toArray().map(Math.fround));
    });
  }
  assert.ok(sources.every(source => source.layers.mask === 2));
});

test('rebuild and disposal release owned palettes and shadow materials once, retaining original resources', t => {
  const { sources, batches, multi } = multiFixture(t);
  const owned = [multi.geometry, multi.material, multi.matricesTexture, multi.colorsTexture,
    multi.customDepthMaterial, multi.customDistanceMaterial];
  const disposals = owned.map(() => 0);
  owned.forEach((resource, index) => resource.addEventListener('dispose', () => disposals[index]++));
  let originalDisposals = 0;
  [...new Set(sources.flatMap(source => [source.geometry, source.material]))]
    .forEach(resource => resource.addEventListener('dispose', () => originalDisposals++));
  batches.rebuild();
  assert.deepEqual(disposals, owned.map(() => 1));
  assert.equal(multi.parent, null);
  batches.dispose();
  batches.dispose();
  assert.deepEqual(disposals, owned.map(() => 1));
  assert.equal(originalDisposals, 0);
  assert.ok(sources.every(source => source.layers.mask === 1));
});

function staticViewFixture(t) {
  const { scene, room, sources, batches } = multiFixture(t);
  batches.dispose();
  room.position.set(19.123456789, 0.731246813, -14.987654321);
  room.scale.set(1.13, 0.81, 1.7);
  room.rotation.set(0.13, 0.71, -0.03);
  sources.forEach((source, index) => {
    source.position.set(index * 1.3 + 0.123456789, 0.276543219, -0.612345678);
    source.rotation.set(0.71, index * 0.41, -0.31);
    source.scale.set(0.63, 1.41, 0.93);
    source.castShadow = true;
  });
  const staticBatches = new SceneBatches(scene, new Set());
  staticBatches.rebuild();
  const mesh = scene.getObjectByName('Shared character draws').children[0];
  assert.equal(mesh.viewSpace, true);
  const camera = new THREE.PerspectiveCamera(33, 1.4, 0.1, 200);
  camera.position.set(7.123456789, 18.731246813, 41.987654321);
  camera.lookAt(3.71, 0.84, -1.93);
  camera.updateMatrixWorld(true);
  t.after(() => staticBatches.dispose());
  return { scene, room, sources, batches: staticBatches, mesh, camera };
}

function assertCpuPalette(texture, sources, camera) {
  sources.forEach((source, index) => {
    const modelView = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, source.matrixWorld);
    const normal = new THREE.Matrix3().getNormalMatrix(modelView);
    assert.deepEqual([...texture.image.data.slice(index * 32, index * 32 + 16)], [...new Float32Array(modelView.elements)],
      'view inputs match the original renderer Float32 uniform upload exactly');
    for (let column = 0; column < 3; column++) for (let row = 0; row < 3; row++) {
      assert.equal(texture.image.data[index * 32 + 16 + column * 4 + row], Math.fround(normal.elements[column * 3 + row]),
        'normal inputs retain the CPU inverse-transpose of the double-precision model-view matrix');
    }
  });
}

test('static palettes retain exact CPU view/normal rounding and update only after camera changes', t => {
  const { scene, sources, mesh, camera } = staticViewFixture(t);
  const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
  mesh.material.onBeforeCompile(shader, {});
  const texture = shader.uniforms.platopViewTexture.value;
  mesh.onBeforeRender({}, scene, camera);
  assertCpuPalette(texture, sources, camera);
  sources.forEach((source, index) => assert.deepEqual([...mesh.matricesTexture.image.data.slice(index * 16, index * 16 + 16)],
    [...new Float32Array(source.matrixWorld.elements)], 'separate original world uniforms stay exact too'));
  const version = texture.version;
  mesh.onBeforeRender({}, scene, camera);
  mesh.onBeforeRender({}, scene, camera);
  assert.equal(texture.version, version, 'animation frames do not recompute or upload static view matrices');
  camera.position.x += 0.137;
  camera.lookAt(3.7, 1.1, -1.8);
  camera.updateMatrixWorld(true);
  mesh.onBeforeRender({}, scene, camera);
  assert.equal(texture.version, version + 1);
  assertCpuPalette(texture, sources, camera);
  camera.aspect = 2;
  camera.updateProjectionMatrix();
  mesh.onBeforeRender({}, scene, camera);
  assert.equal(texture.version, version + 1, 'projection remains the regular camera uniform');
  assert.match(shader.vertexShader, /vec3 transformedNormal = getPartNormal\( platopPart \) \* objectNormal/);
  assert.match(shader.vertexShader, /vec4 mvPosition = getPartModelView\( platopPart \) \* vec4\( transformed, 1\.0 \)/);
  assert.doesNotMatch(shader.vertexShader, /transpose\( inverse\(/, 'there is no GPU recomposition of static normals');
});

test('static shadows use their own exact shadow-camera palette without replacing the main view', t => {
  const { scene, sources, mesh, camera } = staticViewFixture(t);
  mesh.onBeforeRender({}, scene, camera);
  const colorShader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
  mesh.material.onBeforeCompile(colorShader, {});
  const mainTexture = colorShader.uniforms.platopViewTexture.value;
  const mainData = [...mainTexture.image.data];
  const shadowCamera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 100);
  shadowCamera.position.set(-11.3456, 31.8765, 4.1234);
  shadowCamera.lookAt(2.1, 0.3, -1.7);
  shadowCamera.updateMatrixWorld(true);
  mesh.onBeforeShadow({}, mesh, camera, shadowCamera);
  for (const [material, library] of [[mesh.customDepthMaterial, THREE.ShaderLib.depth], [mesh.customDistanceMaterial, THREE.ShaderLib.distanceRGBA]]) {
    const shader = { vertexShader: library.vertexShader, fragmentShader: library.fragmentShader, uniforms: {} };
    material.onBeforeCompile(shader, {});
    const shadowTexture = shader.uniforms.platopViewTexture.value;
    assert.notEqual(shadowTexture, mainTexture);
    assertCpuPalette(shadowTexture, sources, shadowCamera);
    assert.equal(shader.uniforms.batchingTexture.value, mesh.matricesTexture);
    assert.match(shader.vertexShader, /getPartModelView\( platopPart \) \* vec4\( transformed, 1\.0 \)/);
    assert.match(shader.vertexShader, /if \( !platopVisible \) gl_Position/);
  }
  assert.deepEqual([...mainTexture.image.data], mainData);
});

test('static cutaways and decorations restore exact palettes and dispose owned camera textures', t => {
  const { scene, room, sources, batches, mesh, camera } = staticViewFixture(t);
  mesh.onBeforeRender({}, scene, camera);
  sources[0].visible = false;
  batches.invalidateVisibility(); batches.sync();
  assert.equal(mesh.count, 1);
  assert.equal(mesh.getVisibleAt(0), false);
  room.visible = false;
  batches.invalidateVisibility(); batches.sync();
  assert.equal(mesh.visible, false);
  room.visible = true;
  sources[0].visible = true;
  batches.invalidateVisibility(); batches.sync();
  assert.equal(mesh.count, 2);
  mesh.onBeforeRender({}, scene, camera);
  assertCpuPalette(mesh.viewPalette.texture, sources, camera);
  const counts = [0, 0];
  [mesh.viewPalette.texture, mesh.shadowPalette.texture].forEach((texture, index) => texture.addEventListener('dispose', () => counts[index]++));
  batches.dispose(); batches.dispose();
  assert.deepEqual(counts, [1, 1]);
  assert.ok(sources.every(source => source.layers.mask === 1));
});

test('ordinary static meshes with custom draw or shadow behavior retain their original path', t => {
  const { sources, batches, scene } = multiFixture(t);
  batches.dispose();
  const staticBatches = new SceneBatches(scene, new Set());
  t.after(() => staticBatches.dispose());
  sources[0].onBeforeRender = () => {};
  staticBatches.rebuild();
  assert.equal(scene.getObjectByName('Shared character draws').children.length, 0);
  assert.ok(sources.every(source => source.layers.mask === 1));
  sources[0].onBeforeRender = THREE.Object3D.prototype.onBeforeRender;
  const custom = new THREE.MeshDepthMaterial();
  sources[1].customDepthMaterial = custom;
  t.after(() => custom.dispose());
  staticBatches.rebuild();
  assert.equal(scene.getObjectByName('Shared character draws').children.length, 0);
  assert.ok(sources.every(source => source.layers.mask === 1));
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
