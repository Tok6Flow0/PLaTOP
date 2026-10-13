import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';

const modules = new Map();
async function load(relative) {
  const file = new URL(`../src/${relative}`, import.meta.url);
  if (modules.has(file.href)) return import(modules.get(file.href));
  let js = ts.transpileModule(await readFile(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  for (const match of [...js.matchAll(/from ['"]([^'"]+)['"]/g)]) {
    const specifier = match[1]; let target;
    if (specifier.startsWith('.')) {
      const dependency = new URL(`${specifier}.ts`, file), root = new URL('../src/', import.meta.url);
      await load(dependency.pathname.slice(root.pathname.length)); target = modules.get(dependency.href);
    } else target = import.meta.resolve(specifier);
    js = js.replace(match[0], `from ${JSON.stringify(target)}`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
  modules.set(file.href, url); return import(url);
}
const { teams } = await load('teams.ts');
const { SceneKit, disposeObject } = await load('scene/primitives.ts');
const { makeProxy, animateCharacter } = await load('scene/proxies.ts');
const { characterGeometry, characterMaterial, navigatorCapePoint } = await load('scene/characterGeometry.ts');
const { refineCharacterSurface } = await load('scene/characterSurface.ts');
const { surfaceData, refineCharacterModel, CharacterDetail, MAX_DETAILED_CHARACTERS } = await load('scene/characterDetail.ts');
const members = teams.flatMap(team => team.members);

function meshes(root) {
  const result = []; root.traverse(object => { if (object.isMesh) result.push(object); }); return result;
}

test('all sixteen close-up characters contain exactly 100 times their authored triangles', () => {
  const kit = new SceneKit(), all = new THREE.Group();
  for (const character of members) {
    const model = makeProxy(character, kit); all.add(model);
    const coarse = meshes(model).reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
    const restore = refineCharacterModel(model);
    const fine = meshes(model).reduce((sum, mesh) => sum + mesh.geometry.index.count / 3, 0);
    assert.equal(fine, coarse * 100, character.id);
    for (const mesh of meshes(model)) {
      const { position, normal, uv } = mesh.geometry.attributes;
      assert.equal(normal.count, position.count);
      if (uv) assert.equal(uv.count, position.count);
      for (let i = 0; i < position.count; i += 97) {
        assert.ok(Number.isFinite(position.getX(i) + position.getY(i) + position.getZ(i)));
        assert.ok(Number.isFinite(normal.getX(i) + normal.getY(i) + normal.getZ(i)));
      }
    }
    restore();
    assert.equal(meshes(model).reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0), coarse);
  }
  disposeObject(all); kit.dispose();
});

test('dense patches improve round curvature but preserve hard folds, UVs and source arrays', () => {
  const source = new THREE.SphereGeometry(.5, 8, 6), data = surfaceData(source);
  const unchanged = data.attributes.position.array.slice();
  const fine = refineCharacterSurface(data, 'ink');
  const linear = refineCharacterSurface({ ...data, curvature: 0 }, 'ink');
  let improved = 0;
  for (let i = 0; i < fine.attributes.position.array.length; i += 3) {
    const radius = Math.hypot(...fine.attributes.position.array.subarray(i, i + 3));
    const linearRadius = Math.hypot(...linear.attributes.position.array.subarray(i, i + 3));
    if (radius > linearRadius + .00001) improved++;
    assert.ok(radius < .503, 'no inflated silhouette');
  }
  assert.ok(improved > 500, 'new vertices follow curvature, not just the old flat triangle');
  assert.deepEqual(data.attributes.position.array, unchanged, 'worker input leaves authored mesh unchanged');
  const plane = new THREE.PlaneGeometry(1, 1), flat = refineCharacterSurface(surfaceData(plane), 'ink');
  for (let i = 2; i < flat.attributes.position.array.length; i += 3) assert.equal(flat.attributes.position.array[i], 0);
  for (const v of flat.attributes.uv.array) assert.ok(v >= 0 && v <= 1);
  source.dispose(); plane.dispose();
});

test('close-up LOD is bounded, follows existing joints and releases its worker and meshes', async () => {
  const scene = new THREE.Scene(), kit = new SceneKit(), actors = members.slice(0, 4).map((character, i) => {
    const root = new THREE.Group(), model = makeProxy(character, kit); root.add(model); root.position.x = (i - 1.5) * .4; scene.add(root); return { root, model };
  });
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100); camera.position.set(0, 1, 4); camera.lookAt(0, .7, 0); camera.updateMatrixWorld(true);
  let terminated = false, wake = 0;
  const worker = { postMessage(message) { queueMicrotask(() => this.onmessage?.({ data: { id: message.id, result: refineCharacterSurface(message.source, message.finish, 1) } })); }, terminate() { terminated = true; } };
  const detail = new CharacterDetail(scene, actors, () => wake++, () => worker);
  detail.select(camera, 800);
  for (let i = 0; i < 500 && detail.pending; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(detail.count, MAX_DETAILED_CHARACTERS); assert.equal(wake, MAX_DETAILED_CHARACTERS);
  detail.select(camera, 800); scene.updateMatrixWorld(true); detail.sync();
  const source = meshes(actors[0].model)[0], duplicate = scene.getObjectByName(`${source.name}:close-surface`);
  assert.equal(source.userData.characterDetailHidden, true);
  actors[0].root.position.z = .5; scene.updateMatrixWorld(true); detail.sync();
  assert.ok(duplicate.matrixWorld.equals(source.matrixWorld), 'dense surface follows the original pose, not a second animation');
  actors[0].root.visible = false; detail.select(camera, 800);
  assert.equal(source.userData.characterDetailHidden, undefined, 'hidden actor restores authored layers');
  camera.position.z = 70; camera.updateMatrixWorld(true); detail.select(camera, 800);
  assert.equal(detail.count, 0, 'campus view retains no dense buffers');
  detail.dispose(); assert.equal(terminated, true);
  actors.forEach(actor => { assert.ok(meshes(actor.model).every(mesh => !mesh.userData.characterDetailHidden && mesh.layers.mask === 1)); });
  disposeObject(scene); kit.dispose();
});

test('worker failure leaves original characters visible and does not retry forever', async () => {
  const scene = new THREE.Scene(), kit = new SceneKit(), root = new THREE.Group(), model = makeProxy(members[0], kit); root.add(model); scene.add(root);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100); camera.position.set(0, 1, 4); camera.lookAt(0, .7, 0); camera.updateMatrixWorld(true);
  let starts = 0;
  const detail = new CharacterDetail(scene, [{ root, model }], () => {}, () => { starts++; throw Error('Worker unavailable'); });
  detail.select(camera, 800); await new Promise(resolve => setImmediate(resolve)); detail.select(camera, 800);
  assert.equal(starts, 1); assert.equal(detail.count, 0); assert.equal(detail.pending, 0);
  assert.ok(meshes(model).every(mesh => mesh.visible && mesh.layers.mask === 1));
  detail.dispose(); disposeObject(scene); kit.dispose();
});

test('sixteen sculpted avatars retain motor clearance during every moving stride and turn pose', () => {
  const kit = new SceneKit(), all = new THREE.Group(), vertex = new THREE.Vector3();
  for (const character of members) {
    const model = makeProxy(character, kit); all.add(model);
    const radius = character.kind === 'swift' ? .6 : character.kind === 'owl' ? .7 : .61;
    for (let step = 0; step < 36; step++) {
      animateCharacter(model, 'active', step / 6, 0, true, false, {
        phase: step / 36 * Math.PI * 2, speed: .85, seatLift: 0, celebration: 0, foldWings: true,
      });
      model.rotation.y = step / 36 * Math.PI * 2; model.updateMatrixWorld(true);
      for (const mesh of meshes(model)) {
        const positions = mesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
          assert.ok(Number.isFinite(vertex.x + vertex.y + vertex.z), `${character.id} has finite geometry`);
          assert.ok(Math.hypot(vertex.x, vertex.z) <= radius + 1e-7, `${character.id}/${mesh.name} radius ${Math.hypot(vertex.x, vertex.z).toFixed(4)} fits ${radius} motor disk`);
        }
      }
    }
  }
  disposeObject(all); kit.dispose();
});

test('standing feet touch the floor and keep that height when the room lifts a seated body', () => {
  const kit = new SceneKit(), all = new THREE.Group();
  for (const character of members) {
    const model = makeProxy(character, kit); all.add(model);
    const personality = model.userData.personality;
    if (!personality.feet.length) continue;
    for (const seatLift of [0, .15, .27]) {
      model.position.y = seatLift;
      animateCharacter(model, 'active', 1, 0, false, true, { phase: 0, speed: 0, seatLift, celebration: 0 });
      model.updateMatrixWorld(true);
      for (const foot of personality.feet) {
        const floor = new THREE.Box3().setFromObject(foot).min.y;
        assert.ok(Math.abs(floor) < 1e-7, `${character.id}/${foot.name} floor contact`);
      }
    }
  }
  disposeObject(all); kit.dispose();
});

test('Scout keeps a magnifier and compass, rather than the generic cream belly panel', () => {
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='bridge-scout'),kit);
  const head=model.userData.personality.head,body=model.userData.personality.body;
  assert.ok(head.children.some(mesh=>mesh.name==='ring' && mesh.scale.x>=.30));
  assert.ok(body.getObjectByName('compass-emblem'));
  assert.equal(model.getObjectByName('cream-belly-panel'),undefined);
  assert.equal(model.userData.personality.eyes.length,2);
  disposeObject(model);kit.dispose();
});

test('Keeper has separate thin covers around a recessed page block and a bound spine',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='bridge-keeper'),kit);
  const front=model.getObjectByName('front-cover'),back=model.getObjectByName('back-cover'),pages=model.getObjectByName('page-block');
  assert.ok(front&&back&&pages&&model.getObjectByName('book-spine'));
  assert.ok(front.scale.z<pages.scale.z*.15&&back.scale.z<pages.scale.z*.15,'covers are thin, not solid padded book volumes');
  assert.ok(front.position.z>pages.position.z&&back.position.z<pages.position.z,'leaves sit between the two covers');
  assert.ok(front.scale.x>pages.scale.x&&back.scale.y>pages.scale.y,'pages are recessed inside the cover edge');
  disposeObject(model);kit.dispose();
});

test('Beacon has a real face opening with an outward-facing green shell',()=>{
  const kit=new SceneKit(),geometry=characterGeometry(kit,'lanternHousing'),material=new THREE.MeshBasicMaterial();
  const shell=new THREE.Mesh(geometry,material);shell.updateMatrixWorld(true);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)).intersectObject(shell).length,0,'no green helmet behind the amber aperture');
  const cheek=new THREE.Raycaster(new THREE.Vector3(.36,0,1),new THREE.Vector3(0,0,-1)).intersectObject(shell)[0];
  assert.ok(cheek&&cheek.point.z>0&&cheek.face.normal.z>0,'front cheek is not inside out');
  const rear=new THREE.Raycaster(new THREE.Vector3(0,0,-1),new THREE.Vector3(0,0,1)).intersectObject(shell)[0];
  assert.ok(rear&&rear.point.z<0,'the rear shell stays closed');
  const bezel=new THREE.Mesh(characterGeometry(kit,'lanternBezel'),material);bezel.updateMatrixWorld(true);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)).intersectObject(bezel).length,0,'no second filled panel can depth-fight the luminous face');
  material.dispose();geometry.dispose();bezel.geometry.dispose();kit.dispose();
});

test('Beacon clasped forearms show their outward-facing surfaces in front of the belly',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='support-beacon'),kit);
  model.updateMatrixWorld(true);
  for(const sign of [-1,1]){
    const arm=model.getObjectByName(sign<0?'embracingArmL':'embracingArmR');
    const hit=new THREE.Raycaster(new THREE.Vector3(sign*.20,.30,1),new THREE.Vector3(0,0,-1)).intersectObject(arm,false)[0];
    assert.ok(hit&&hit.point.z>.24,'the visible clasp is a closed outward surface, not the inside of a swept tube');
  }
  disposeObject(model);kit.dispose();
});

test('owl plumage covers all four sides within the existing cached geometry budget',()=>{
  const kit=new SceneKit(),geometry=characterGeometry(kit,'breastFeathers'),p=geometry.attributes.position;
  const quadrants=new Set();
  for(let i=0;i<p.count;i++)assert.ok(p.getY(i)>-.40,'bottom plumage ends before the closed body pole, never projecting a negative radius');
  for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i))<.1)quadrants.add(`${Math.sign(p.getX(i))}:${Math.sign(p.getZ(i))}`);
  for(const x of [-1,1])for(const z of [-1,1])assert.ok(quadrants.has(`${x}:${z}`));
  assert.equal(characterGeometry(kit,'breastFeathers'),geometry,'the wrap is built once per scene');
  geometry.dispose();kit.dispose();
});

test('shallow owl irises follow their curved facial discs without clipping through them',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='email-owl'),kit);
  model.userData.personality.head.rotation.set(0,0,0);model.updateMatrixWorld(true);
  const point=new THREE.Vector3(),ray=new THREE.Raycaster();
  const irises=meshes(model).filter(mesh=>mesh.name==='owl-iris');assert.equal(irises.length,2);
  for(const iris of irises){
    const disc=model.getObjectByName(`owl-facial-disc:${Math.sign(iris.position.x)}`),p=iris.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      point.fromBufferAttribute(p,i).applyMatrix4(iris.matrixWorld);
      ray.set(new THREE.Vector3(point.x,point.y,2),new THREE.Vector3(0,0,-1));
      const hit=ray.intersectObject(disc,false)[0];
      assert.ok(hit&&point.z>hit.point.z+.0005,'every iris vertex clears the actual cream face, including its inward edge');
    }
  }
  disposeObject(model);kit.dispose();
});

test('feather barbs use bounded local UVs and one scene-owned texture for every layered surface',()=>{
  const kit=new SceneKit();
  const texture=characterMaterial(kit,'#293e54','plumage').bumpMap;
  assert.equal(texture,characterMaterial(kit,'#30465e','plumage').bumpMap);
  assert.ok(texture.isDataTexture&&texture.image.width===512&&texture.image.height===512);
  for(const form of ['breastFeathers','featherFanL','featherFanR']){
    const geometry=characterGeometry(kit,form),uv=geometry.attributes.uv;
    assert.equal(uv.count,geometry.attributes.position.count);
    for(let i=0;i<uv.count;i++){
      assert.ok(uv.getX(i)>=0&&uv.getX(i)<=1&&uv.getY(i)>=0&&uv.getY(i)<=1,'each feather owns the same small, bounded texture coordinates');
    }
    geometry.dispose();
  }
  kit.dispose();
});

test('visible breast feather planes stay outside the curved owl body',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='email-owl'),kit);
  const shell=model.getObjectByName('owlBody'),plumage=model.getObjectByName('breastFeathers');
  model.updateMatrixWorld(true);
  const positions=plumage.geometry.attributes.position,normals=plumage.geometry.attributes.normal;
  const point=new THREE.Vector3(),normal=new THREE.Vector3(),vertex=new THREE.Vector3();
  for(let i=0;i<positions.count;i+=3){
    point.set(0,0,0);normal.set(0,0,0);
    for(let j=0;j<3;j++){point.add(vertex.fromBufferAttribute(positions,i+j));normal.add(vertex.fromBufferAttribute(normals,i+j));}
    point.multiplyScalar(1/3);
    if(Math.abs(point.y)>.20)continue;
    const direction=new THREE.Vector3(point.x,0,point.z).normalize();
    if(normal.normalize().dot(direction)<.2)continue;
    const centre=new THREE.Vector3(0,point.y,0).applyMatrix4(plumage.matrixWorld);
    point.applyMatrix4(plumage.matrixWorld);
    const ray=new THREE.Raycaster(centre.clone().addScaledVector(direction,2),direction.clone().negate());
    const hit=ray.intersectObject(shell,false)[0];
    assert.ok(hit&&point.distanceTo(centre)>hit.point.distanceTo(centre)+.002,'outward-facing feather triangle clears its supporting body');
  }
  disposeObject(model);kit.dispose();
});

test('paper wings and lapels have matching creased backs and closed thin edges',()=>{
  const kit=new SceneKit();
  for(const form of ['paperOwlWingR','paperChestL','paperChestR','paperBrow']){
    const geometry=characterGeometry(kit,form),p=geometry.attributes.position,columns=new Map(),edges=new Map();
    const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(':');
    for(let i=0;i<p.count;i++){
      const xy=[p.getX(i),p.getY(i)].map(v=>Math.round(v*1e6)).join(':');
      const zs=columns.get(xy)??new Set();zs.add(Math.round(p.getZ(i)*1e6));columns.set(xy,zs);
    }
    for(const zs of columns.values()){
      assert.equal(zs.size,2,`${form} keeps both folded sheet surfaces`);
      const [a,b]=[...zs].sort((a,b)=>a-b);assert.ok(Math.abs(b-a-10000)<=1,`${form} is .010 units thick, not a solid wedge`);
    }
    for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){
      const a=key(i+j),b=key(i+(j+1)%3),edgeKey=[a,b].sort().join('/');
      const edge=edges.get(edgeKey)??{count:0,balance:0};edge.count++;edge.balance+=a<b?1:-1;edges.set(edgeKey,edge);
    }
    for(const edge of edges.values()){assert.equal(edge.count,2);assert.equal(edge.balance,0);}
    geometry.dispose();
  }
  kit.dispose();
});

test('rounded-square helmet cheeks retain a closely fitted visor and rim on the actual curved shell', () => {
  const kit = new SceneKit(), all = new THREE.Group(), vertex = new THREE.Vector3();
  for (const character of members.filter(character => ['bridge-jarvis','bridge-scout'].includes(character.id) || character.id.startsWith('intake-'))) {
    const model = makeProxy(character, kit); all.add(model); model.updateMatrixWorld(true);
    const shell = model.getObjectByName('helmet');
    for (const name of ['visor-rim', 'rounded-visor']) {
      const inset = model.getObjectByName(name), positions = inset.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(inset.matrixWorld);
        const ray = new THREE.Raycaster(vertex.clone().add(new THREE.Vector3(0, 0, 1)), new THREE.Vector3(0, 0, -1));
        const surface = ray.intersectObject(shell, false)[0];
        assert.ok(surface && vertex.z - surface.point.z >= .006 && vertex.z - surface.point.z <= .05,
          `${character.id}/${name} follows the helmet without clipping or floating`);
      }
    }
  }
  disposeObject(all); kit.dispose();
});

test('broader merchant shoulders intersect their visible upper arms rather than leaving detached limbs', () => {
  const kit = new SceneKit(), all = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  for (const character of members.filter(character => ['bridge-jarvis','bridge-scout'].includes(character.id))) {
    const model = makeProxy(character, kit); all.add(model); model.updateMatrixWorld(true);
    const torso = model.userData.personality.body.children.find(child=>child.isMesh);
    for (const [index, arm] of model.userData.personality.arms.entries()) {
      const upper = arm.children.find(child => child.isMesh), bounds = new THREE.Box3().setFromObject(upper);
      const centre = bounds.getCenter(new THREE.Vector3()), sign = index ? 1 : -1;
      const ray = new THREE.Raycaster(new THREE.Vector3(sign * 2, centre.y, centre.z), new THREE.Vector3(-sign, 0, 0));
      const shoulder = ray.intersectObject(torso, false)[0];
      const surface = new THREE.Mesh(upper.geometry, material);
      surface.matrixAutoUpdate = false; surface.matrix.copy(upper.matrixWorld); surface.updateMatrixWorld(true);
      const crossings = ray.intersectObject(surface, false);
      assert.ok(shoulder && crossings.length >= 2 && shoulder.distance >= crossings[0].distance &&
        shoulder.distance <= crossings[crossings.length - 1].distance,
      `${character.id}/${arm.name} joins the actual belly surface`);
    }
  }
  material.dispose(); disposeObject(all); kit.dispose();
});

test('sculpted forms share scene resources, preserve the environment finish, and allocate nothing during animation', () => {
  const kit = new SceneKit(), otherKit = new SceneKit(), all = new THREE.Group();
  const environmentInk = kit.material('#243c43'), priorRoughness = environmentInk.roughness;
  const models = members.map(character => { const model = makeProxy(character, kit); all.add(model); return model; });
  assert.equal(kit.material('#243c43').roughness, priorRoughness, 'face glaze does not change shared walls or props');
  const originalGeometry = characterGeometry(kit, 'helmet');
  assert.equal(characterGeometry(kit, 'helmet'), originalGeometry);
  assert.notEqual(characterGeometry(otherKit, 'helmet'), originalGeometry, 'independent scenes own independent GPU resources');
  const material = characterMaterial(kit, '#eee4d0', 'glaze');
  assert.equal(characterMaterial(kit, '#eee4d0', 'glaze'), material);
  const before = models.map(model => meshes(model).map(mesh => [mesh.geometry.uuid, mesh.material.uuid]));
  const objects = all.getObjectsByProperty('isObject3D', true).map(object => object.uuid);
  const gestures = ['work', 'think', 'file', 'talk', 'wait'];
  for (let frame = 0; frame < 90; frame++) models.forEach((model, index) => {
    animateCharacter(model, frame < 30 ? 'sleeping' : 'active', frame / 30, index, frame >= 60, false,
      { phase: frame / 6, speed: .85, seatLift: 0, celebration: 0, foldWings: true, gesture: gestures[frame % gestures.length] });
  });
  assert.deepEqual(models.map(model => meshes(model).map(mesh => [mesh.geometry.uuid, mesh.material.uuid])), before);
  assert.deepEqual(all.getObjectsByProperty('isObject3D', true).map(object => object.uuid), objects,
    'agent gestures mutate the existing joints without adding scene objects');
  let disposed = 0; originalGeometry.addEventListener('dispose', () => disposed++);
  disposeObject(all); assert.equal(disposed, 1, 'shared fitted form is released exactly once by the scene disposer');
  kit.dispose();
  characterGeometry(otherKit, 'helmet').dispose(); otherKit.dispose();
});

test('distant geometry is smooth and bounded, with a separate 100x close-up tier', () => {
  const kit = new SceneKit(), all = new THREE.Group();
  for (const character of members) {
    const model = makeProxy(character, kit); all.add(model);
    let triangles = 0;
    for (const mesh of meshes(model)) {
      const geometry = mesh.geometry;
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
      assert.ok(geometry.attributes.normal, `${character.id} has surface normals`);
      assert.equal(mesh.material.flatShading, false, `${character.id} avoids faceted lighting`);
    }
    assert.ok(triangles < (character.id==='email-owl'?13000:9000), `${character.id}: ${triangles} distant triangle budget`);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.y < 2, `${character.id} stays inside existing character standing heights`);
  }
  disposeObject(all); kit.dispose();
});

test('activity alone stays neutral and every agent-chosen gesture has an understated pose for each character', () => {
  const kit = new SceneKit(), all = new THREE.Group();
  const pose = { phase: 0, speed: 0, seatLift: 0, celebration: 0 };
  const gestures = ['work', 'think', 'file', 'talk', 'wait'];
  const joints = p => [p.head, ...p.arms, ...p.wings].flatMap(joint => joint.rotation.toArray().slice(0, 3));
  for (const character of members) {
    const model = makeProxy(character, kit); all.add(model);
    const p = model.userData.personality;
    animateCharacter(model, 'waiting', 1.2, 0, false, false, pose);
    const neutral = joints(p);
    for (const status of ['active', 'waiting', 'unknown']) for (const time of [0, 1.2, 9.5]) {
      animateCharacter(model, status, time, 0, false, false, pose);
      assert.deepEqual(joints(p), neutral, `${character.id}/${status} does not invent work or interaction`);
    }
    const selected = [];
    for (const gesture of gestures) {
      animateCharacter(model, 'active', 1.2, 0, false, false, { ...pose, gesture });
      const expression = joints(p); selected.push(expression.join(':'));
      assert.notDeepEqual(expression, neutral, `${character.id}/${gesture} differs from no intent`);
      assert.ok(expression.every(angle => Number.isFinite(angle) && Math.abs(angle) < .7),
        `${character.id}/${gesture} keeps small finite joint angles`);
      assert.deepEqual(model.position.toArray(), [0, 0, 0], `${character.id}/${gesture} has no root motion`);
      // A genuine waiting report must not erase the agent's chosen expression.
      animateCharacter(model, 'waiting', 1.2, 0, false, false, { ...pose, gesture });
      assert.deepEqual(joints(p), expression, `${character.id}/${gesture} remains independent of activity`);
    }
    assert.equal(new Set(selected).size, gestures.length, `${character.id} has five readable choices`);
  }
  disposeObject(all); kit.dispose();
});

test('walking and explicit resting suppress stationary gestures until the character can interact', () => {
  const kit = new SceneKit(), all = new THREE.Group();
  const pose = { phase: .8, speed: .85, seatLift: 0, celebration: 0, foldWings: true };
  for (const character of members) {
    const model = makeProxy(character, kit); all.add(model);
    const p = model.userData.personality;
    const joints = () => [p.head, ...p.arms, ...p.wings].flatMap(joint => joint.rotation.toArray().slice(0, 3));
    for (const [status, moving] of [['active', true], ['sleeping', false]]) {
      animateCharacter(model, status, 1.2, 0, moving, false, pose);
      const expected = joints();
      for (const gesture of ['work', 'think', 'file', 'talk', 'wait']) {
        animateCharacter(model, status, 1.2, 0, moving, false, { ...pose, gesture });
        assert.deepEqual(joints(), expected, `${character.id}/${gesture} does not conflict with ${moving ? 'walking' : 'rest'}`);
      }
    }
  }
  disposeObject(all); kit.dispose();
});

test('continuous robed, book, and bird faces remain rigidly attached through agent gestures and walking',()=>{
  const kit=new SceneKit(),all=new THREE.Group();
  for(const member of members.filter(member=>member.id.startsWith('hr-')||['bridge-keeper','email-swift'].includes(member.id))){
    const model=makeProxy(member,kit);all.add(model);model.updateMatrixWorld(true);
    const p=model.userData.personality,face=model.getObjectByName('head');
    const relative=()=>new THREE.Matrix4().copy(p.body.matrixWorld).invert().multiply(face.matrixWorld).elements;
    const rest=relative();
    for(const gesture of ['work','think','file','talk','wait'])for(const moving of [false,true]){
      animateCharacter(model,'active',1.3,0,moving,false,{phase:1.3,speed:.7,seatLift:0,celebration:0,gesture});
      model.updateMatrixWorld(true);
      relative().forEach((v,i)=>assert.ok(Math.abs(v-rest[i])<1e-10,`${member.id}/${gesture}: face follows its shell`));
    }
  }
  disposeObject(all);kit.dispose();
});

test('the lined cape is closed and consistently wound at the collar, lapels, and hem',()=>{
  const kit=new SceneKit(),geometry=characterGeometry(kit,'cape'),edges=new Map();
  const indices=geometry.index;
  for(let i=0;i<indices.count;i+=3)for(let j=0;j<3;j++){
    const a=indices.getX(i+j),b=indices.getX(i+(j+1)%3),key=[Math.min(a,b),Math.max(a,b)].join(':');
    const edge=edges.get(key)??{count:0,balance:0};edge.count++;edge.balance+=a<b?1:-1;edges.set(key,edge);
  }
  for(const edge of edges.values()){assert.equal(edge.count,2);assert.equal(edge.balance,0);}
  geometry.dispose();kit.dispose();
});

test('the cape lining clears the real torso around the shoulders, sides, and back',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='intake-jarvis'),kit);
  const body=model.userData.personality.body,shell=body.getObjectByName('wayfinderBody');body.updateWorldMatrix(true,true);
  for(let row=0;row<=12;row++)for(let col=0;col<=24;col++){
    const t=row/12,bound=.20+1.05*Math.sin(t*Math.PI/2),angle=bound+col/24*(Math.PI*2-bound*2);
    const point=navigatorCapePoint(t,angle,.014),lining=new THREE.Vector3(...point).applyMatrix4(body.matrixWorld);
    const center=new THREE.Vector3(0,point[1],0).applyMatrix4(body.matrixWorld),outward=lining.clone().sub(center).normalize();
    const hit=new THREE.Raycaster(center.clone().addScaledVector(outward,2),outward.clone().negate()).intersectObject(shell,false)[0];
    assert.ok(hit && lining.distanceTo(center)>hit.point.distanceTo(center)+.006,'cloth remains outside the actual torso');
  }
  disposeObject(model);kit.dispose();
});

test('continuous clay surfaces keep matching normals across duplicated UV seams within their authored topology', () => {
  const kit = new SceneKit(), left = new THREE.Vector3(), right = new THREE.Vector3();
  const expectedTriangles = { torso: 768, owlBody: 384, lanternGlass: 336, lanternCap: 384, bridgeHelmet:1216,
    lanternBase: 384, limb: 224, beak: 192, helmet: 1216, owlHead: 1216, wing: 352, tuft: 168,
    spiritBody: 768, spiritFigure:2048, spiritLens:2048, spiritRelay:2048, cloak: 768, merchantTorso: 768 };
  for (const [form, count] of Object.entries(expectedTriangles)) {
    const geometry = characterGeometry(kit, form), position = geometry.attributes.position;
    const uv = geometry.attributes.uv, normal = geometry.attributes.normal;
    assert.equal(geometry.index.count / 3, count, `${form} preserves its existing topology`);
    const seam = new Map();
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(uv.getX(i)) > 1e-6 && Math.abs(uv.getX(i) - 1) > 1e-6) continue;
      const key = `${Math.round(position.getX(i) * 1e6)}:${Math.round(position.getY(i) * 1e6)}:${Math.round(position.getZ(i) * 1e6)}`;
      const opposite = seam.get(key);
      if (opposite === undefined) { seam.set(key, i); continue; }
      left.fromBufferAttribute(normal, opposite).normalize(); right.fromBufferAttribute(normal, i).normalize();
      assert.ok(left.distanceTo(right) < 1e-6, `${form} has no lighting discontinuity at its UV seam`);
    }
    geometry.dispose();
  }
  kit.dispose();
});

test('mirrored paper folds retain vertex colors at their reflected corners',()=>{
  const kit=new SceneKit(),right=characterGeometry(kit,'paperEarR'),left=characterGeometry(kit,'paperEarL');
  const rp=right.attributes.position,lp=left.attributes.position,rc=right.attributes.color,lc=left.attributes.color;
  for(let i=0;i<rp.count;i+=3)for(const[j,k]of[[0,0],[1,2],[2,1]]){
    assert.equal(lp.getX(i+j),-rp.getX(i+k));assert.equal(lp.getY(i+j),rp.getY(i+k));
    assert.equal(lc.getX(i+j),rc.getX(i+k));assert.equal(lc.getY(i+j),rc.getY(i+k));assert.equal(lc.getZ(i+j),rc.getZ(i+k));
  }
  right.dispose();left.dispose();kit.dispose();
});

test('mirroring continuous arms preserves smooth normals instead of introducing flat facets',()=>{
  const kit=new SceneKit(),right=characterGeometry(kit,'embracingArmR'),left=characterGeometry(kit,'embracingArmL');
  const rn=right.attributes.normal,ln=left.attributes.normal;
  for(let i=0;i<rn.count;i+=3)for(const[j,k]of[[0,0],[1,2],[2,1]]){
    assert.equal(ln.getX(i+j),-rn.getX(i+k));assert.equal(ln.getY(i+j),rn.getY(i+k));assert.equal(ln.getZ(i+j),rn.getZ(i+k));
  }
  right.dispose();left.dispose();kit.dispose();
});

test('robot cuffs join feet to their torso and lantern warmth adds no real lights', () => {
  const kit = new SceneKit(), all = new THREE.Group();
  for (const character of members) {
    const model = makeProxy(character, kit); all.add(model); model.updateMatrixWorld(true);
    assert.equal(model.getObjectsByProperty('isLight', true).length, 0, `${character.id} adds no shadow or light passes`);
    if (character.kind === 'robot') {
      const torso = model.userData.personality.body.children.find(child => child.isMesh);
      const torsoBounds = new THREE.Box3().setFromObject(torso);
      for (const name of ['ankle_l', 'ankle_r']) {
        const cuff = model.getObjectByName(name), foot = cuff.parent.children.find(mesh => mesh.geometry === characterGeometry(kit, 'bean'));
        const cuffBounds = new THREE.Box3().setFromObject(cuff);
        assert.ok(cuffBounds.intersectsBox(torsoBounds), `${character.id}/${name} joins the torso`);
        assert.ok(cuffBounds.intersectsBox(new THREE.Box3().setFromObject(foot)), `${character.id}/${name} joins the foot`);
      }
    } else if (character.kind === 'lantern') {
      const glow = model.userData.personality.glow;
      assert.ok(glow.emissive.r > glow.emissive.g && glow.emissive.g > glow.emissive.b, 'lantern emission stays warm');
      animateCharacter(model, 'sleeping', 0, 0, false, true);
      const asleep = glow.emissiveIntensity;
      animateCharacter(model, 'active', 0, 0, false, true);
      assert.ok(glow.emissiveIntensity > asleep && glow.emissiveIntensity < 1, 'glazed amber brightens gently when awake');
    }
  }
  const helmet = characterGeometry(kit, 'helmet'); helmet.computeBoundingBox();
  assert.ok(helmet.boundingBox.min.z > -.45 && helmet.boundingBox.max.z === .5, 'helmet back is subtly flattened while the fitted face stays intact');
  disposeObject(all); kit.dispose();
});

test('avatars preserve the distinct original portrait identities and opaque lightweight surfaces', () => {
  const kit = new SceneKit(), all = new THREE.Group();
  const expected={
    'bridge-jarvis':['merchantTorso','helmet','ring'],
    'bridge-scout':['helmet','compass-emblem','ring'],
    'bridge-keeper':['book','pageCorner','seedling-book'],
    'hr-compass':['spiritFigure','compassCowl','compassNeedle','compass-emblem'],
    'hr-lens':['spiritLens','lensCowl','ring'],
    'hr-relay':['spiritRelay','relayCowl','detail'],
    'intake-jarvis':['wayfinderBody','cape','hoodTip','compass-emblem'],
    'intake-beacon':['wayfinderBody','lanternCap'],
    'intake-relay':['wayfinderBody','scroll','book'],
    'intake-compass':['wayfinderBody','tuft','circuit-bib'],
    'support-beacon':['embracingBody','lanternCap','ring'],
    'reflection-lumen':['hexGlass','hexCap','fineRing'],
    'reflection-echo':['paperBody','paperEchoHead','paperOwlWingL','paperOwlWingR','ring'],
    'reflection-quill':['paperBody','paperWing','quill-pencil'],
    'email-owl':['owlHead','owlBody','featherFanL','featherFanR','breastFeathers'],
    'email-swift':['paper-bird-expression','swiftBody','swiftWingL','swiftWingR','swiftTail'],
  };
  for (const character of members) {
    const model=makeProxy(character,kit);all.add(model);
    for(const form of expected[character.id]) assert.ok(model.getObjectByName(form),character.id+' retains '+form);
    for(const mesh of meshes(model)) {
      assert.equal(mesh.material.transparent,mesh.name==='magnifier-glass','only the tiny magnifier lens uses an alpha surface');
      assert.ok(mesh.scale.x>0&&mesh.scale.y>0&&mesh.scale.z>0,'valid surface winding');
    }
  }
  const grain=characterMaterial(kit,'#aabbcc','paper').bumpMap;
  assert.ok(grain.isDataTexture && grain.image.width===512 && grain.image.height===512);
  assert.notEqual(characterMaterial(kit,'#bbccdd','feather').bumpMap,grain,'paper fibres and feather barbs have distinct microstructure');
  assert.equal(characterMaterial(kit,'#bbccdd','paper').bumpMap,grain,'each finish shares one scene-owned texture');
  disposeObject(all);kit.dispose();
});

test('paper folds and compass relief expose their authored front planes with one-sided materials',()=>{
  const kit=new SceneKit(),material=new THREE.MeshBasicMaterial();
  for(const form of ['compassStar','paperDisc','pageFold','paperWing','capePanel']){
    const mesh=new THREE.Mesh(characterGeometry(kit,form),material);mesh.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(new THREE.Vector3(.01,.01,2),new THREE.Vector3(0,0,-1));
    const hit=ray.intersectObject(mesh)[0];
    assert.ok(hit&&hit.point.z>0,`${form} front is not culled behind its own back plane`);
  }
  material.dispose();kit.dispose();
});
