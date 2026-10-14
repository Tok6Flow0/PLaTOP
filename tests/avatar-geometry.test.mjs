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
const { refineCharacterSurface, owlFaceTint } = await load('scene/characterSurface.ts');
const { surfaceData, surfaceGeometry, refineCharacterModel, CharacterDetail, MAX_DETAILED_CHARACTERS } = await load('scene/characterDetail.ts');
const members = teams.flatMap(team => team.members);
// Authored triangle counts measured from immutable pre-surface commit 271831b.
// Refining today's mesh is not enough if a later simplification drops below
// the user's minimum relative to the original embodiments.
const baselineTriangles={
  'bridge-jarvis':7600,'bridge-scout':7676,'bridge-keeper':6143,
  'hr-compass':5232,'hr-lens':5288,'hr-relay':4984,
  'intake-jarvis':7776,'intake-beacon':8456,'intake-relay':6544,'intake-compass':7280,
  'support-beacon':4993,'reflection-lumen':2084,'reflection-echo':1990,'reflection-quill':690,
  'email-owl':8984,'email-swift':1604,
};

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
    assert.ok(fine>=baselineTriangles[character.id]*100,`${character.id} has at least 100 times its original triangle count`);
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

test('cupped feather fans are closed sheets with matching front and rear ray coverage',()=>{
  const kit=new SceneKit(),material=new THREE.MeshBasicMaterial(),ray=new THREE.Raycaster();
  for(const form of ['featherFanL','featherFanR']){
    const mesh=new THREE.Mesh(characterGeometry(kit,form),material);mesh.updateMatrixWorld(true);
    let covered=0;
    for(let x=-.22;x<=.26;x+=.009)for(let y=-.46;y<=.24;y+=.009){
      ray.set(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1));const front=ray.intersectObject(mesh,false).length>0;
      ray.set(new THREE.Vector3(x,y,-2),new THREE.Vector3(0,0,1));const rear=ray.intersectObject(mesh,false).length>0;
      assert.equal(front,rear,`${form} has no culled holes at ${x},${y}`);if(front)covered++;
    }
    assert.ok(covered>500);
  }
  material.dispose();kit.dispose();
});

test('owl toes stay squat and forward-facing rather than standing gold beans',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='email-owl'),kit);
  model.updateMatrixWorld(true);
  const toes=meshes(model).filter(mesh=>mesh.name==='toe');assert.equal(toes.length,6);
  for(const toe of toes){
    const size=new THREE.Box3().setFromObject(toe).getSize(new THREE.Vector3());
    assert.ok(size.y/size.z<.45,'the toe silhouette is longer than it is tall');
    assert.ok(toe.material.roughness>=.65,'soft ochre feet do not have polished metal highlights');
  }
  disposeObject(model);kit.dispose();
});

test('dense wing fans round their free contours without widening the motor envelope',()=>{
  const kit=new SceneKit();
  for(const form of ['featherFanL','featherFanR']){
    const coarse=characterGeometry(kit,form),data=surfaceData(coarse);
    assert.equal(data.curvature,.28);
    const dense=surfaceGeometry(refineCharacterSurface(data,'plumage'));
    coarse.computeBoundingBox();dense.computeBoundingBox();
    for(const axis of ['x','y','z']){
      assert.ok(dense.boundingBox.min[axis]>=coarse.boundingBox.min[axis]-.006,`${form} lower ${axis} contour is bounded`);
      assert.ok(dense.boundingBox.max[axis]<=coarse.boundingBox.max[axis]+.006,`${form} upper ${axis} contour is bounded`);
    }
    assert.equal(dense.index.count,coarse.attributes.position.count*100);
    dense.dispose();
  }
  assert.equal(surfaceData(characterGeometry(kit,'breastFeathers')).curvature,0,'fitted breast layers are never independently inflated');
  assert.equal(surfaceData(characterGeometry(kit,'paperEchoHead')).curvature,0,'origami folds stay authored');
  kit.dispose();
});

test('lower wing silhouettes do not expose their rounded inner supports',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='email-owl'),kit),ray=new THREE.Raycaster();
  for(const mesh of meshes(model).filter(mesh=>mesh.name==='featherCore')){
    mesh.geometry=surfaceGeometry(refineCharacterSurface(surfaceData(mesh.geometry),'feather'));
  }
  model.updateMatrixWorld(true);
  for(const name of ['wing_l','wing_r']){
    const wing=model.getObjectByName(name),box=new THREE.Box3().setFromObject(wing);
    for(const direction of [-1,1])for(let x=box.min.x+.004;x<box.max.x;x+=.008)for(let y=box.min.y+.004;y<.36;y+=.008){
      ray.set(new THREE.Vector3(x,y,direction*2),new THREE.Vector3(0,0,-direction));
      const hit=ray.intersectObject(wing,true)[0];
      assert.notEqual(hit?.object.name,'featherCore',`${name} inner support exposed at ${x},${y} from ${direction}`);
    }
  }
  disposeObject(model);kit.dispose();
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

test('dense paper normals follow displaced relief while preserving the authored plane',()=>{
  const plane=new THREE.PlaneGeometry(.8,.8).rotateY(.4),source=surfaceData(plane);
  const original=source.attributes.position.array.slice(),fine=refineCharacterSurface(source,'paper');
  const p=fine.attributes.position.array,n=fine.attributes.normal.array,uv=fine.attributes.uv.array;
  const relief=(x,y,z)=>.001*Math.sin(x*37+y*17+Math.sin(y*23))*Math.sin(y*42+z*11)+.0002*Math.sin(x*231+y*43);
  const eps=1e-5;let varying=0;
  for(let i=0;i<p.length/3;i++){
    const local=(uv[i*2]-.5)*.8,x=local*Math.cos(.4),y=(uv[i*2+1]-.5)*.8,z=-local*Math.sin(.4);
    assert.ok(Math.abs(p[i*3]-x)<1e-6&&Math.abs(p[i*3+1]-y)<1e-6);
    assert.ok(Math.abs(p[i*3+2]-z-relief(x,y,z))<1e-6);
    const dx=(relief(x+eps,y,z)-relief(x-eps,y,z))/(2*eps);
    const dy=(relief(x,y+eps,z)-relief(x,y-eps,z))/(2*eps);
    const dz=(relief(x,y,z+eps)-relief(x,y,z-eps))/(2*eps);
    const nz=Math.cos(.4)/(1+dz),expected=new THREE.Vector3(Math.sin(.4)-nz*dx,-nz*dy,nz).normalize();
    const actual=new THREE.Vector3(...n.subarray(i*3,i*3+3));
    assert.ok(actual.dot(expected)>.99999,'normal is perpendicular to the displaced surface');
    if(Math.abs(actual.y)>.01)varying++;
  }
  assert.ok(varying>30);assert.deepEqual(source.attributes.position.array,original);plane.dispose();
  const kit=new SceneKit(),material=characterMaterial(kit,'#dbc49e','paper');
  assert.equal(material.roughnessMap,material.bumpMap,'one shared cellulose texture');
  assert.equal(material.transparent,false);kit.dispose();
});

test('Wayfinder satin clay shares porous relief while leaving paper, glaze and dry clay unchanged',()=>{
  const kit=new SceneKit(),dry=characterMaterial(kit,'#e7dfcd','clay'),satin=characterMaterial(kit,'#e7dfcd','satinClay');
  assert.equal(satin.type,'MeshStandardMaterial');assert.equal(satin.transparent,false);assert.equal(satin.metalness,0);
  assert.equal(satin.bumpMap,dry.bumpMap,'the material study adds no grain texture allocation');
  assert.equal(satin.roughnessMap,satin.bumpMap);assert.equal(satin.bumpScale,dry.bumpScale);
  assert.equal(satin.roughness,.62);assert.equal(satin.envMapIntensity,.75);
  assert.equal(dry.roughness,.76);assert.equal(dry.envMapIntensity,.5);assert.equal(dry.roughnessMap,null);
  const paper=characterMaterial(kit,'#e7dfcd','paper'),glaze=characterMaterial(kit,'#e7dfcd','glaze');
  assert.equal(paper.roughness,.94);assert.equal(glaze.roughness,.40);
  const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),satin));
  const release=refineCharacterModel(root);
  assert.equal(root.children[0].material,satin,'close-up clay does not silently become clearcoated plastic');
  release();disposeObject(root);kit.dispose();
});

test('close materials add bounded fibre or glaze response without mutating or disposing source textures',()=>{
  const kit=new SceneKit(),model=new THREE.Group(),originals=[];
  for(const finish of ['feather','plumage','facialFeather','cloth','glaze','lanternGlass','paper']){
    const material=characterMaterial(kit,'#345768',finish),geometry=new THREE.SphereGeometry(.1,8,6);
    const mesh=new THREE.Mesh(geometry,material);model.add(mesh);originals.push({mesh,material,geometry,finish});
  }
  let sourceDisposals=0,textureDisposals=0;
  for(const {material}of originals){material.addEventListener('dispose',()=>sourceDisposals++);material.map.addEventListener('dispose',()=>textureDisposals++);}
  const restore=refineCharacterModel(model),clones=new Map();
  for(const {mesh,material,finish}of originals){
    if(finish==='paper'){assert.equal(mesh.material,material);continue;}
    assert.ok(mesh.material.isMeshPhysicalMaterial);assert.notEqual(mesh.material,material);
    assert.equal(mesh.material.map,material.map);assert.equal(mesh.material.bumpMap,material.bumpMap);
    assert.equal(material.isMeshPhysicalMaterial,undefined);assert.equal(mesh.material.defines.PHYSICAL,'');
    assert.equal(mesh.material.transmission,0);assert.equal(mesh.material.transparent,false);
    if(finish==='glaze'||finish==='lanternGlass'){assert.equal(mesh.material.clearcoat,finish==='lanternGlass'?.16:.25);assert.equal(mesh.material.clearcoatRoughness,finish==='lanternGlass'?.18:.30);assert.equal(mesh.material.sheen,0);}
    else {assert.ok(mesh.material.sheen>0&&mesh.material.sheen<=.42);assert.equal(mesh.material.clearcoat,0);}
    const owned=mesh.material;clones.set(owned,0);owned.addEventListener('dispose',()=>clones.set(owned,clones.get(owned)+1));
  }
  restore();restore();
  assert.ok([...clones.values()].every(count=>count===1));assert.equal(sourceDisposals,0);assert.equal(textureDisposals,0);
  for(const {mesh,material,geometry}of originals){assert.equal(mesh.material,material);assert.equal(mesh.geometry,geometry);}
  disposeObject(model);kit.dispose();
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
  const ownedMaterials=new Map();
  for(const mesh of meshes(scene))if(mesh.userData.characterDetailMesh&&mesh.material.isMeshPhysicalMaterial&&!ownedMaterials.has(mesh.material)){
    const material=mesh.material;ownedMaterials.set(material,0);material.addEventListener('dispose',()=>ownedMaterials.set(material,ownedMaterials.get(material)+1));
  }
  assert.ok(ownedMaterials.size>0,'near meshes use their own bounded physical finishes');
  const source = meshes(actors[0].model)[0], duplicate = scene.getObjectByName(`${source.name}:close-surface`);
  assert.equal(source.userData.characterDetailHidden, true);
  actors[0].root.position.z = .5; scene.updateMatrixWorld(true); detail.sync();
  assert.ok(duplicate.matrixWorld.equals(source.matrixWorld), 'dense surface follows the original pose, not a second animation');
  actors[0].root.visible = false; detail.select(camera, 800);
  assert.equal(source.userData.characterDetailHidden, undefined, 'hidden actor restores authored layers');
  camera.position.z = 70; camera.updateMatrixWorld(true); detail.select(camera, 800);
  assert.equal(detail.count, 0, 'campus view retains no dense buffers');
  assert.ok([...ownedMaterials.values()].every(count=>count===1),'leaving close view releases material clones once');
  detail.dispose(); assert.equal(terminated, true);
  actors.forEach(actor => { assert.ok(meshes(actor.model).every(mesh => !mesh.userData.characterDetailHidden && mesh.layers.mask === 1)); });
  disposeObject(scene); kit.dispose();
});

test('Lumen close glass follows the existing emission state rather than inventing or freezing a glow',async()=>{
  const scene=new THREE.Scene(),kit=new SceneKit(),root=new THREE.Group(),model=makeProxy(members.find(c=>c.id==='reflection-lumen'),kit);root.add(model);scene.add(root);
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(0,1,4);camera.lookAt(0,.7,0);camera.updateMatrixWorld(true);
  const worker={postMessage(message){queueMicrotask(()=>this.onmessage?.({data:{id:message.id,result:refineCharacterSurface(message.source,message.finish,1)}}));},terminate(){}};
  const detail=new CharacterDetail(scene,[{root,model}],()=>{},()=>worker);detail.select(camera,800);
  for(let i=0;i<500&&detail.pending;i++)await new Promise(resolve=>setImmediate(resolve));
  detail.select(camera,800);scene.updateMatrixWorld(true);detail.sync();assert.equal(detail.count,1);
  const source=model.userData.personality.glow,glass=scene.getObjectByName('hexGlass:close-surface').material;
  assert.notEqual(glass,source);assert.equal(glass.transmission,0);
  animateCharacter(model,'sleeping',0,0,false,true);detail.sync();assert.equal(glass.emissiveIntensity,source.emissiveIntensity);
  const asleep=glass.emissiveIntensity;
  animateCharacter(model,'active',0,0,false,true);detail.sync();assert.equal(glass.emissiveIntensity,source.emissiveIntensity);assert.ok(glass.emissiveIntensity>asleep);
  detail.dispose();disposeObject(scene);kit.dispose();
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

test('a synchronous worker transfer failure resolves pending detail without hiding the source',async()=>{
  const scene=new THREE.Scene(),kit=new SceneKit(),root=new THREE.Group(),model=makeProxy(members[0],kit);root.add(model);scene.add(root);
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(0,1,4);camera.lookAt(0,.7,0);camera.updateMatrixWorld(true);
  let starts=0,posts=0,terminations=0;
  const detail=new CharacterDetail(scene,[{root,model}],()=>{},()=>{starts++;return {postMessage(){posts++;throw Error('Transfer rejected');},terminate(){terminations++;}};});
  detail.select(camera,800);await new Promise(resolve=>setImmediate(resolve));detail.select(camera,800);
  assert.equal(detail.count,0);assert.equal(detail.pending,0);assert.equal(starts,1);assert.equal(posts,1);assert.equal(terminations,1);
  assert.ok(meshes(model).every(mesh=>mesh.visible&&mesh.layers.mask===1&&!mesh.userData.characterDetailHidden));
  detail.dispose();assert.equal(terminations,1);disposeObject(scene);kit.dispose();
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

test('Scout magnifier has a convex optical surface enclosing the visible pupil and highlight',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='bridge-scout'),kit);
  const head=model.userData.personality.head;head.rotation.set(0,0,0);model.updateMatrixWorld(true);
  const lens=model.getObjectByName('magnifier-glass'),eye=model.userData.personality.eyes[0];
  assert.ok(lens&&lens.geometry.type==='SphereGeometry');
  assert.equal(lens.material.depthWrite,false);assert.equal(lens.castShadow,false);
  assert.equal(lens.material.opacity,.045,'optical layer preserves the dark pupil');
  assert.equal(characterMaterial(kit,'#e7f1ed','glass').opacity,.16,'the existing held magnifier keeps its finish');
  assert.equal(lens.material.transmission,undefined,'no additional scene-refraction pass');
  const bounds=new THREE.Box3().setFromObject(lens),size=bounds.getSize(new THREE.Vector3());
  assert.ok(size.z>.04&&size.z<.065,'dome has real curved depth but remains inside the magnifier frame');
  const ray=new THREE.Raycaster();let checked=0;
  for(const feature of [eye,model.userData.personality.highlights[0]]){
    const p=feature.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      if(p.getZ(i)<0)continue;
      const point=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(feature.matrixWorld);
      ray.set(new THREE.Vector3(point.x,point.y,2),new THREE.Vector3(0,0,-1));
      const glass=ray.intersectObject(lens,false)[0];
      assert.ok(glass&&glass.point.z>point.z+.005,'visible pupil and highlight do not cut through the lens');checked++;
    }
  }
  assert.ok(checked>70);
  disposeObject(model);kit.dispose();
});

test('Bridge silhouettes retain a tall Jarvis torso and the smaller Scout from their portrait',()=>{
  const kit=new SceneKit(),models=['bridge-jarvis','bridge-scout'].map(id=>makeProxy(members.find(member=>member.id===id),kit));
  const [jarvis,scout]=models;models.forEach(model=>model.updateMatrixWorld(true));
  const torso=new THREE.Box3().setFromObject(jarvis.getObjectByName('merchantTorso')).getSize(new THREE.Vector3());
  const helmet=new THREE.Box3().setFromObject(jarvis.getObjectByName('helmet')).getSize(new THREE.Vector3());
  assert.ok(torso.y/helmet.y>1.6&&torso.y/helmet.y<1.9,'the body is distinctly taller than the helmet');
  const height=model=>new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
  const relativeHeight=height(scout)/height(jarvis);
  assert.ok(relativeHeight>.64&&relativeHeight<.74,`Scout stays a smaller companion, not a second leader-sized figure (${relativeHeight})`);
  const base=new THREE.Box3().setFromObject(jarvis.getObjectByName('merchantBase'));
  assert.ok(Math.abs(base.min.y)<.02,'the base retains floor contact');
  models.forEach(disposeObject);kit.dispose();
});

test('Merchant painted shells keep one shared satin grain without the close-tier clearcoat',()=>{
  const kit=new SceneKit(),grain=characterMaterial(kit,'#ffffff','satinShell').bumpMap;
  const glaze=characterMaterial(kit,'#ffffff','glaze').bumpMap;
  assert.notEqual(grain,glaze,'painted shell grain does not alter glazed details');
  assert.equal(grain.image.width,512);assert.equal(grain.image.height,512);
  const spread=texture=>{
    const p=texture.image.data;let sum=0,sum2=0;
    for(let i=0;i<p.length;i+=4){assert.ok(p[i]>=195&&p[i]<=255,'restrained mineral tones');sum+=p[i];sum2+=p[i]**2;}
    const count=p.length/4;return Math.sqrt(sum2/count-(sum/count)**2);
  };
  assert.ok(spread(grain)>spread(glaze)*1.6,'fine shell variation survives beside smoother glazed details');
  for(const id of ['bridge-jarvis','bridge-scout']){
    const model=makeProxy(members.find(c=>c.id===id),kit);
    const shell=model.getObjectByName('helmet'),material=shell.material;
    assert.equal(material.userData.characterFinish,'satinShell');
    assert.equal(material.roughness,.54);assert.equal(material.envMapIntensity,.80);
    assert.equal(material.bumpMap,grain);assert.equal(material.roughnessMap,grain);
    assert.equal(material.bumpScale,.017);assert.equal(material.transparent,false);
    const restore=refineCharacterModel(model);
    assert.equal(shell.material,material,'close detail does not put a glossy coat over the painted grain');
    assert.equal(shell.material.clearcoat,undefined);
    restore();disposeObject(model);
  }
  const keeper=makeProxy(members.find(c=>c.id==='bridge-keeper'),kit);
  assert.equal(meshes(keeper).some(mesh=>mesh.material.userData.characterFinish==='satinShell'),false,'paper identity is unaffected');
  disposeObject(keeper);kit.dispose();
});

test('Jarvis has a convex breast, tapered waist and a fitted badge within his walking envelope',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(member=>member.id==='bridge-jarvis'),kit);
  model.updateMatrixWorld(true);
  const torso=model.getObjectByName('merchantTorso'),badge=model.getObjectByName('merchant-breast-badge');
  const ray=new THREE.Raycaster();
  const height=y=>torso.localToWorld(new THREE.Vector3(0,y,0)).y;
  ray.set(new THREE.Vector3(0,height(0),3),new THREE.Vector3(0,0,-1));
  const front=ray.intersectObject(torso,false)[0];
  ray.set(new THREE.Vector3(0,height(0),-3),new THREE.Vector3(0,0,1));
  const rear=ray.intersectObject(torso,false)[0];
  assert.ok(front&&rear&&front.point.z+rear.point.z>.035,'breast has actual forward volume instead of a symmetric can');
  const halfWidth=y=>{
    ray.set(new THREE.Vector3(3,height(y),0),new THREE.Vector3(-1,0,0));
    return ray.intersectObject(torso,false)[0].point.x;
  };
  assert.ok(halfWidth(-.38)<halfWidth(.10)*.70,'lower housing visibly tapers below the shoulders');
  const centre=new THREE.Box3().setFromObject(badge).getCenter(new THREE.Vector3());
  ray.set(new THREE.Vector3(centre.x,centre.y,3),new THREE.Vector3(0,0,-1));
  const ornament=ray.intersectObject(badge,true)[0],body=ray.intersectObject(torso,false)[0];
  assert.ok(ornament&&body&&ornament.distance<body.distance,`chest emblem sits in front of the curved breast (${ornament?.distance}, ${body?.distance}; ${centre.toArray()})`);
  disposeObject(model);kit.dispose();
});

test('Jarvis chest seam remains continuous above its dense curved torso',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(member=>member.id==='bridge-jarvis'),kit);
  model.updateMatrixWorld(true);
  const seam=model.getObjectByName('merchant-chest-seam'),shell=model.getObjectByName('merchantTorso');
  const position=seam.geometry.attributes.position,centers=[];
  // Four vertices plus a duplicated UV seam make each tube ring. Inspect
  // every ring rather than only endpoints, where former clipping left dots.
  for(let ring=1;ring<position.count/5-1;ring++){
    const center=new THREE.Vector3();
    for(let side=0;side<4;side++)center.add(new THREE.Vector3().fromBufferAttribute(position,ring*5+side));
    centers.push(center.multiplyScalar(.25).applyMatrix4(seam.matrixWorld));
  }
  const restore=refineCharacterModel(model),ray=new THREE.Raycaster();let checked=0;
  for(const center of centers){
    ray.set(new THREE.Vector3(center.x,center.y,3),new THREE.Vector3(0,0,-1));
    const relief=ray.intersectObject(seam,false)[0],torso=ray.intersectObject(shell,false)[0];
    assert.ok(relief&&torso&&relief.distance<torso.distance-.0001,`visible seam at ${center.x},${center.y}`);checked++;
  }
  assert.ok(checked>50);restore();disposeObject(model);kit.dispose();
});

test('Wayfinder ivory shells stay uncoated satin while dark-backed visors remain opaque',()=>{
  const kit=new SceneKit();
  for(const member of members.filter(member=>member.id.startsWith('intake-'))){
    const model=makeProxy(member,kit);
    for(const name of ['wayfinderBody','helmet']){
      const mesh=model.getObjectByName(name);assert.ok(mesh);assert.equal(mesh.material.userData.characterFinish,'satinClay');
      assert.equal(mesh.material.roughness,.62);assert.equal(mesh.material.type,'MeshStandardMaterial');assert.equal(mesh.material.transparent,false);
    }
    const visor=model.getObjectByName('rounded-visor');
    assert.equal(visor.material.userData.characterFinish,'visorGlass');
    assert.equal(visor.material.roughness,.42);assert.equal(visor.material.envMapIntensity,.65);assert.equal(visor.material.transparent,false);
    assert.equal(visor.material.map,null);assert.equal(visor.material.bumpMap,null);
    for(const eye of model.userData.personality.eyes){
      assert.equal(eye.material.userData.characterFinish,'warmInk');
      assert.ok(eye.material.emissiveIntensity>0&&eye.material.emissiveIntensity<1);
      assert.ok(eye.material.emissive.r>eye.material.emissive.g&&eye.material.emissive.g>eye.material.emissive.b);
      assert.equal(eye.material.transparent,false);
    }
    disposeObject(model);
  }
  kit.dispose();
});

test('Wayfinder visor lips are genuinely open and preserve eye depth in both mesh tiers',()=>{
  const kit=new SceneKit(),ray=new THREE.Raycaster();
  for(const member of members.filter(member=>member.id.startsWith('intake-'))){
    const model=makeProxy(member,kit),rim=model.getObjectByName('visor-rim'),visor=model.getObjectByName('rounded-visor');
    const sourceMaterial=visor.material;
    const check=()=>{
      model.updateMatrixWorld(true);
      for(const x of [-.121,0,.121]){
        const point=visor.localToWorld(new THREE.Vector3(x,.030,2));
        ray.set(point,new THREE.Vector3(0,0,-1));
        assert.equal(ray.intersectObject(rim,false).length,0,`${member.id} rim has an open aperture`);
        assert.ok(ray.intersectObject(visor,false).length>0,`${member.id} dark glass fills its aperture`);
      }
      for(const eye of model.userData.personality.eyes){
        const box=new THREE.Box3().setFromObject(eye),point=box.getCenter(new THREE.Vector3());
        ray.set(point.clone().add(new THREE.Vector3(0,0,2)),new THREE.Vector3(0,0,-1));
        const face=ray.intersectObject(visor,false)[0];
        assert.ok(face&&box.max.z>face.point.z+.001,`${member.id} luminous eyes remain ahead of the glass`);
      }
    };
    check();const release=refineCharacterModel(model);check();
    assert.equal(visor.material.type,'MeshPhysicalMaterial');assert.equal(visor.material.clearcoat,.08);assert.equal(visor.material.clearcoatRoughness,.36);
    assert.equal(visor.material.transparent,false);assert.equal(visor.material.transmission,0);
    assert.equal(sourceMaterial.type,'MeshStandardMaterial');release();assert.equal(visor.material,sourceMaterial);
    disposeObject(model);
  }
  kit.dispose();
});

test('Swift swept wing folds retain closed front and rear coverage',()=>{
  const kit=new SceneKit(),material=new THREE.MeshBasicMaterial(),ray=new THREE.Raycaster();
  for(const form of ['swiftWingL','swiftWingR']){
    const mesh=new THREE.Mesh(characterGeometry(kit,form),material);mesh.updateMatrixWorld(true);let covered=0;
    for(let y=-.29;y<=.26;y+=.011)for(let z=-.47;z<=.075;z+=.011){
      ray.set(new THREE.Vector3(1,y,z),new THREE.Vector3(-1,0,0));const front=ray.intersectObject(mesh,false).length>0;
      ray.set(new THREE.Vector3(-1,y,z),new THREE.Vector3(1,0,0));const rear=ray.intersectObject(mesh,false).length>0;
      assert.equal(front,rear,`${form} has no culled holes at ${y},${z}`);if(front)covered++;
    }
    assert.ok(covered>700,'both swept folds retain substantial closed paper surfaces');
  }
  material.dispose();kit.dispose();
});

test('Swift has a continuous low folded breast above small grounded feet',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(member=>member.id==='email-swift'),kit);
  const body=model.getObjectByName('swiftBody');model.updateMatrixWorld(true);
  const bodyBounds=new THREE.Box3().setFromObject(body),allBounds=new THREE.Box3().setFromObject(model);
  assert.ok(bodyBounds.min.y>.035&&bodyBounds.min.y<.080,'the breast ends just above the toes, not atop long wire legs');
  assert.ok(bodyBounds.max.y>.55,'the existing crown height and cheek construction are preserved');
  assert.ok(Math.abs(allBounds.min.y)<.005,'the authored feet remain on the floor');
  const p=body.geometry.attributes.position;
  assert.ok([...Array(p.count).keys()].filter(i=>p.getY(i)<-.10).length>40,'the lower breast is a closed mesh volume, not a flat patch');
  for(const foot of model.userData.personality.feet){
    const leg=foot.getObjectByName('swift-leg');assert.ok(leg);
    const bounds=new THREE.Box3().setFromObject(leg);
    assert.ok(bounds.max.y>bodyBounds.min.y+.05&&bounds.max.y<.155,'upper legs overlap the descending breast vertically');
  }
  disposeObject(model);kit.dispose();
});

test('Swift carries diagonal cheek planes into the breast without hiding its eyes',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(member=>member.id==='email-swift'),kit);
  const body=model.getObjectByName('swiftBody'),positions=body.geometry.attributes.position;
  let cheekVertices=0,throatVertices=0;
  for(let i=0;i<positions.count;i++){
    const x=Math.abs(positions.getX(i)),y=positions.getY(i),z=positions.getZ(i);
    if(y>=.26)continue;
    assert.ok(z<=.140+.35*y+1e-6,'the front paper plane is continuous through the throat');
    assert.ok(x<=Math.max(.018,.098+.24*y-.35*Math.max(0,z))+1e-6);
    if(Math.abs(x-(.098+.24*y-.35*Math.max(0,z)))<1e-6){
      if(y>.10)cheekVertices++;else throatVertices++;
    }
  }
  assert.ok(cheekVertices>12&&throatVertices>12,'one diagonal cheek construction spans both regions');
  const restore=refineCharacterModel(model);model.updateMatrixWorld(true);
  for(const [index,eye] of model.userData.personality.eyes.entries()){
    const sign=index===0?-1:1,center=eye.getWorldPosition(new THREE.Vector3());
    const outward=new THREE.Vector3(sign,0,0).transformDirection(eye.parent.matrixWorld);
    const ray=new THREE.Raycaster(center.clone().addScaledVector(outward,1),outward.negate());
    const first=ray.intersectObjects([eye,body],false)[0];
    assert.equal(first?.object,eye,'the continuous cheek must not cover the eye');
  }
  restore();disposeObject(model);kit.dispose();
});

test('folded paper chest sheets sit in front of their closed inner body',()=>{
  const kit=new SceneKit(),ray=new THREE.Raycaster();
  for(const form of ['paperChestL','paperChestR']){
    const p=characterGeometry(kit,form).attributes.position;let ridgeTop=-Infinity,ridgeBottom=Infinity,baseWidth=0,shoulderWidth=0;
    for(let i=0;i<p.count;i++){
      if(p.getZ(i)>.242){ridgeTop=Math.max(ridgeTop,p.getY(i));ridgeBottom=Math.min(ridgeBottom,p.getY(i));}
      if(p.getY(i)<-.46)baseWidth=Math.max(baseWidth,Math.abs(p.getX(i)));
      if(p.getY(i)>.10)shoulderWidth=Math.max(shoulderWidth,Math.abs(p.getX(i)));
    }
    assert.ok(ridgeTop>-.06&&ridgeTop<0,'the crease joins the breast below the face');
    assert.ok(ridgeTop-ridgeBottom>.40,'a continuous long ridge reaches the tapered lower body');
    assert.ok(baseWidth<shoulderWidth*.6,'the sheet turns into a tapered lower body rather than a straight apron');
  }
  for(const member of members.filter(member=>['reflection-echo','reflection-quill'].includes(member.id))){
    const model=makeProxy(member,kit),body=model.userData.personality.body;
    const shell=model.getObjectByName('paperBody'),sheets=['paperChestL','paperChestR'].map(name=>model.getObjectByName(name));
    const restore=refineCharacterModel(model);model.updateMatrixWorld(true);let checked=0;
    for(let x=-.20;x<=.20;x+=.04)for(let y=-.29;y<=.06;y+=.05){
      ray.set(body.localToWorld(new THREE.Vector3(x,y,1)),new THREE.Vector3(0,0,-1).transformDirection(body.matrixWorld));
      const paper=ray.intersectObjects(sheets,false)[0],core=ray.intersectObject(shell,false)[0];
      if(paper&&core){assert.ok(paper.distance<core.distance-.001,`${member.id} inner body does not pierce the chest at ${x},${y}`);checked++;}
    }
    assert.ok(checked>40);restore();disposeObject(model);
  }
  kit.dispose();
});

test('paper owl resting wings are broad diagonal sheets that overlap the actual breast',()=>{
  const kit=new SceneKit();
  const wing=characterGeometry(kit,'paperOwlWingL');wing.computeBoundingBox();
  const size=wing.boundingBox.getSize(new THREE.Vector3());
  assert.ok(size.x/size.y>.5&&size.y<.51,'broad diagonal fold replaces a lengthened hanging tab');
  assert.ok(wing.boundingBox.max.y<.05,'the upper root tucks below the cheek instead of forming a raised collar');
  for(const id of ['reflection-echo','reflection-quill']){
    const model=makeProxy(members.find(c=>c.id===id),kit),sheet=model.getObjectByName('paperOwlWingL'),chest=model.getObjectByName('paperChestL');
    model.updateMatrixWorld(true);const paper=new THREE.Box3().setFromObject(sheet),breast=new THREE.Box3().setFromObject(chest);
    assert.ok(paper.intersectsBox(breast),'resting sheet overlaps the breast rather than sitting beside it');
    assert.ok(paper.max.y>breast.max.y-.05,'wing root joins at shoulder height');
    disposeObject(model);
  }
  kit.dispose();
});

test('paper owl breast fold quads remain coplanar rather than becoming small triangular patches',()=>{
  const kit=new SceneKit();
  for(const form of ['paperChestL','paperChestR']){
    const geometry=characterGeometry(kit,form),n=geometry.attributes.normal;
    // Front faces 2 and 6 each contain two triangles. Check their actual
    // shared planes; a centroid crop could silently omit one triangle.
    for(const [a,b] of [[6,9],[21,24]]){
      const first=new THREE.Vector3().fromBufferAttribute(n,a),second=new THREE.Vector3().fromBufferAttribute(n,b);
      assert.ok(first.z>.2&&first.distanceTo(second)<1e-5,'both broad halves retain shared planar normals across their internal triangulation');
    }
  }
  kit.dispose();
});

test('Scout toe caps follow the cream foot surface rather than floating as flat discs',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(member=>member.id==='bridge-scout'),kit);
  model.updateMatrixWorld(true);
  const caps=meshes(model).filter(mesh=>mesh.name==='scout-fitted-toe-cap');assert.equal(caps.length,2);
  for(const cap of caps){
    assert.equal(cap.geometry.userData.characterFitted,true);
    assert.equal(cap.material.userData.characterFinish,'clay');
    assert.ok(cap.material.roughness>=.7,'the shallow sole is matte rather than a glossy inset');
    const positions=cap.geometry.attributes.position,foot=cap.parent,point=new THREE.Vector3();
    const inverse=new THREE.Matrix4().copy(foot.matrixWorld).invert();let min=Infinity,max=-Infinity;
    for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(cap.matrixWorld).applyMatrix4(inverse);
      min=Math.min(min,point.z);max=Math.max(max,point.z);
    }
    assert.ok(max-min>.05,'the cap bends over the toe instead of retaining the flat relief depth');
    assert.ok(max<.22&&min>.04,'the fitted cap stays on the front of the cream foot');
  }
  const restore=refineCharacterModel(model),ray=new THREE.Raycaster();
  for(const cap of caps){
    const toe=cap.parent.children[0];let checked=0;
    // Query the actual dense surfaces in foot space, so the curved cream toe
    // cannot reappear as pale pinholes through its thin, matte cap.
    for(let x=-.07;x<=.07;x+=.02)for(let y=-.08;y<=.08;y+=.02){
      const origin=cap.parent.localToWorld(new THREE.Vector3(x,y,1));
      const direction=new THREE.Vector3(0,0,-1).transformDirection(cap.parent.matrixWorld);
      ray.set(origin,direction);const top=ray.intersectObject(cap,false)[0],base=ray.intersectObject(toe,false)[0];
      if(top&&base){assert.ok(top.distance<base.distance-.0001,'the dense toe stays behind its cap');checked++;}
    }
    assert.ok(checked>25);
  }
  restore();
  disposeObject(model);kit.dispose();
});

test('Keeper has separate thin covers around a recessed page block and a bound spine',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='bridge-keeper'),kit);
  const front=model.getObjectByName('front-cover'),back=model.getObjectByName('back-cover'),pages=model.getObjectByName('page-block');
  assert.ok(front&&back&&pages&&model.getObjectByName('book-spine'));
  const border=model.getObjectByName('keeper-face-border');
  assert.ok(border&&border.geometry.userData.characterFitted,'the face border follows the bowed cover, not a floating rectangle');
  assert.equal(border.material.userData.characterFinish,'paper');
  assert.equal(border.material.transparent,false);
  assert.ok(front.scale.z<pages.scale.z*.15&&back.scale.z<pages.scale.z*.15,'covers are thin, not solid padded book volumes');
  assert.ok(front.position.z>pages.position.z&&back.position.z<pages.position.z,'leaves sit between the two covers');
  assert.ok(front.scale.x>pages.scale.x&&back.scale.y>pages.scale.y,'pages are recessed inside the cover edge');
  assert.ok(pages.scale.z/front.scale.x<.45,'the recessed page block avoids a uniformly deep slab');
  assert.equal(front.geometry,characterGeometry(kit,'keeperFrontCover'));
  const cover=characterGeometry(kit,'bowedCover'),p=cover.attributes.position,layer=cover.userData.coverSkinVertices;
  assert.ok(p.getZ(0)-p.getZ(1+32*6)>.5,'the thin cover has real central bow');
  for(let i=0;i<layer;i++)assert.ok(Math.abs(p.getZ(i)-p.getZ(i+layer)-.92)<1e-6,'both cover skins preserve thickness');
  const shell=new THREE.Mesh(cover,new THREE.MeshBasicMaterial());shell.updateMatrixWorld(true);
  assert.ok(new THREE.Raycaster(new THREE.Vector3(0,0,2),new THREE.Vector3(0,0,-1)).intersectObject(shell).length,'front skin faces outward');
  assert.ok(new THREE.Raycaster(new THREE.Vector3(0,0,-2),new THREE.Vector3(0,0,1)).intersectObject(shell).length,'rear skin faces outward');
  shell.material.dispose();
  disposeObject(model);kit.dispose();
});

test('Keeper lower cover tapers around low tucked feet rather than ending above ball feet',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='bridge-keeper'),kit);
  model.updateMatrixWorld(true);
  const cover=model.getObjectByName('front-cover'),material=new THREE.MeshBasicMaterial();
  const local=new THREE.Mesh(cover.geometry,material),ray=new THREE.Raycaster();local.updateMatrixWorld();
  // Compare actual silhouette coverage, not vertex distribution: the turned
  // cover retains exact hinge corners and samples straight edges differently.
  const width=y=>{let edge=0;for(let x=0;x<.52;x+=.005){
    ray.set(new THREE.Vector3(x,y,5),new THREE.Vector3(0,0,-1));
    if(ray.intersectObject(local,false).length)edge=x;
  }return edge;};
  const lower=width(-.44),middle=width(0);
  assert.ok(lower<middle*.9,'lower corners are rounded and narrower than the broad page face');
  const coverBounds=new THREE.Box3().setFromObject(cover);
  for(const foot of model.userData.personality.feet){
    const sole=new THREE.Box3().setFromObject(foot.children[0]),size=sole.getSize(new THREE.Vector3());
    assert.ok(size.y<size.z*.5,'feet read as low slippers rather than balls');
    assert.ok(Math.abs(sole.min.y)<.012,'feet retain their floor contact');
    assert.ok(sole.max.y>coverBounds.min.y,'lower cover tucks over the upper foot');
  }
  material.dispose();disposeObject(model);kit.dispose();
});

test('Keeper turned corner replaces the upper cover and joins its curved hinge',()=>{
  const kit=new SceneKit(),material=new THREE.MeshBasicMaterial(),ray=new THREE.Raycaster();
  const front=new THREE.Mesh(characterGeometry(kit,'keeperFrontCover'),material);
  const back=new THREE.Mesh(characterGeometry(kit,'keeperCover'),material);
  front.updateMatrixWorld();back.updateMatrixWorld();
  ray.set(new THREE.Vector3(.44,.44,5),new THREE.Vector3(0,0,-1));
  assert.equal(ray.intersectObject(front,false).length,0,'the original unturned corner is really absent');
  assert.ok(ray.intersectObject(back,false).length>0,'back cover still protects the page block');
  const flap=characterGeometry(kit,'keeperTurnedCorner'),p=flap.attributes.position;
  for(const [x,y,z] of [[.238,.740,.19448],[.294,.6504,.19448+.0532*Math.cos(.42*Math.PI)**2],[.350,.5608,.19448]]){
    let nearest=Infinity;
    for(let i=0;i<p.count;i++)nearest=Math.min(nearest,Math.hypot(p.getX(i)-x,p.getY(i)-y,p.getZ(i)-z));
    assert.ok(nearest<1e-6,'the turned sheet shares its actual cover hinge');
  }
  flap.computeBoundingBox();
  assert.ok(flap.boundingBox.max.y-flap.boundingBox.min.y<.185,'the turn remains a compact corner above the expression');
  assert.ok(flap.boundingBox.max.z-flap.boundingBox.min.z<.04,'paper curls gently rather than jutting out as a rigid wedge');
  const model=makeProxy(members.find(c=>c.id==='bridge-keeper'),kit);model.updateMatrixWorld(true);
  const folded=model.getObjectByName('keeperTurnedCorner');
  for(const eye of model.userData.personality.eyes){
    const centre=new THREE.Box3().setFromObject(eye).getCenter(new THREE.Vector3());
    ray.set(new THREE.Vector3(centre.x,centre.y,3),new THREE.Vector3(0,0,-1));
    assert.equal(ray.intersectObject(folded,false).length,0,'turned paper does not cover the expression');
  }
  material.dispose();disposeObject(model);kit.dispose();
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

test('owl facial fibres share one opaque surface and radiate from each actual eye',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(member=>member.id==='email-owl'),kit);
  const maps=new Set();
  for(const sign of [-1,1]){
    const disc=model.getObjectByName(`owl-facial-disc:${sign}`),p=disc.geometry.attributes.position,uv=disc.geometry.attributes.uv;
    maps.add(disc.material.map);
    assert.equal(disc.material.transparent,false);
    for(let i=0;i<p.count;i++){
      assert.ok(Math.abs((uv.getX(i)-.5)*.365+sign*.130-p.getX(i))<1e-7);
      assert.ok(Math.abs((uv.getY(i)-.5)*.43+.002-p.getY(i))<1e-7);
    }
  }
  assert.equal(maps.size,1,'both hearts reuse one scene-owned fibre map');
  const [map]=maps;assert.equal(map.image.width,512);assert.equal(map.image.height,512);
  let low=255,high=0;
  for(let i=0;i<map.image.data.length;i+=4){low=Math.min(low,map.image.data[i]);high=Math.max(high,map.image.data[i]);}
  assert.ok(low>=185&&high<=246,'soft bundles remain cream, not dark crack marks');
  assert.ok(high-low>35,'fibre groups retain a visible tonal scale');
  disposeObject(model);kit.dispose();
});

test('broader owl breast groups overlap across the visible front instead of exposing body wedges',()=>{
  const kit=new SceneKit(),material=new THREE.MeshBasicMaterial(),ray=new THREE.Raycaster();
  const breast=new THREE.Mesh(characterGeometry(kit,'breastFeathers'),material),body=new THREE.Mesh(characterGeometry(kit,'owlBody'),material);
  body.scale.set(.70,.83,.55);breast.updateMatrixWorld();body.updateMatrixWorld();let covered=0,checked=0;
  for(let x=-.24;x<=.24;x+=.04)for(let y=-.27;y<=.15;y+=.06){
    ray.set(new THREE.Vector3(x,y,1.5),new THREE.Vector3(0,0,-1));
    const shell=ray.intersectObject(body,false)[0];if(!shell)continue;
    const feather=ray.intersectObject(breast,false)[0];checked++;
    if(feather&&feather.point.z>shell.point.z+.0005)covered++;
  }
  assert.ok(checked>70,'check the real front field, not a single cherry-picked point');
  assert.equal(covered,checked,'overlapping groups cover every sampled visible breast point');
  material.dispose();kit.dispose();
});

test('Dispatch envelope is a compact flat badge resting just above its feather surface',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='email-owl'),kit);
  model.updateMatrixWorld(true);
  const badge=model.getObjectByName('dispatch-envelope'),plate=badge.getObjectByName('envelope');
  const bounds=new THREE.Box3().setFromObject(badge),size=bounds.getSize(new THREE.Vector3());
  assert.ok(size.x<.16&&size.y<.12&&size.z<.014,'small, paper-flat insignia rather than thick pouch');
  const centre=new THREE.Box3().setFromObject(plate).getCenter(new THREE.Vector3());
  const ray=new THREE.Raycaster(new THREE.Vector3(centre.x,centre.y,2),new THREE.Vector3(0,0,-1));
  const feather=ray.intersectObject(model.getObjectByName('breastFeathers'),false)[0];
  assert.ok(feather,'the badge is positioned over actual plumage');
  assert.ok(bounds.min.z>feather.point.z&&bounds.min.z-feather.point.z<.035,'badge is outside the breast without floating far away');
  assert.equal(badge.children.length,5,'four separately straight fold segments');
  disposeObject(model);kit.dispose();
});

test('upper rear owl feather roots tuck beneath the actual head rather than ending on a flat shoulder edge',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='email-owl'),kit);
  model.userData.personality.head.rotation.set(0,0,0);model.updateMatrixWorld(true);
  const breast=model.getObjectByName('breastFeathers'),head=model.getObjectByName('owlHead');
  const p=breast.geometry.attributes.position,point=new THREE.Vector3(),ray=new THREE.Raycaster();let checked=0;
  for(let i=0;i<p.count;i++){
    if(p.getY(i)<.400||p.getZ(i)>=0)continue;
    point.fromBufferAttribute(p,i).applyMatrix4(breast.matrixWorld);
    ray.set(new THREE.Vector3(point.x,point.y,-2),new THREE.Vector3(0,0,1));
    const shell=ray.intersectObject(head,false)[0];
    assert.ok(shell&&shell.point.z<point.z,'the rear head silhouette conceals the feather root');checked++;
  }
  assert.ok(checked>10);
  disposeObject(model);kit.dispose();
});

test('owl eyes sit in sculpted sockets with the iris perimeter tucked beneath the mask',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='email-owl'),kit);
  model.userData.personality.head.rotation.set(0,0,0);model.updateMatrixWorld(true);
  const point=new THREE.Vector3(),ray=new THREE.Raycaster();
  const irises=meshes(model).filter(mesh=>mesh.name==='owl-iris');assert.equal(irises.length,2);
  for(const iris of irises){
    const disc=model.getObjectByName(`owl-facial-disc:${Math.sign(iris.position.x)}`),p=iris.geometry.attributes.position;
    let tucked=0,visible=0;
    for(let i=0;i<p.count;i++){
      if(p.getZ(i)<0)continue;
      point.fromBufferAttribute(p,i).applyMatrix4(iris.matrixWorld);
      ray.set(new THREE.Vector3(point.x,point.y,2),new THREE.Vector3(0,0,-1));
      const hit=ray.intersectObject(disc,false)[0];
      assert.ok(hit,'the mask remains a continuous surface behind the eye');
      if(point.z>hit.point.z+.0005)visible++;else tucked++;
    }
    assert.ok(tucked>8&&visible>8,`iris has both an exposed centre and a tucked edge (${visible}/${tucked})`);
    assert.ok(iris.geometry.type==='SphereGeometry'&&!iris.geometry.userData.characterFitted,'iris retains convex curvature instead of conforming to the bowl');
    assert.ok(iris.scale.z<.020,'thin iris no longer forms a protruding gold button');
  }
  for(const eye of model.userData.personality.eyes){
    point.copy(eye.position).applyMatrix4(eye.parent.matrixWorld);
    ray.set(new THREE.Vector3(point.x,point.y,2),new THREE.Vector3(0,0,-1));
    assert.equal(ray.intersectObject(model,true)[0]?.object,eye,'each dark pupil remains visible');
    const sign=Math.sign(eye.position.x),disc=model.getObjectByName(`owl-facial-disc:${sign}`);
    point.set(sign*.130,.165,0).applyMatrix4(eye.parent.matrixWorld);
    ray.set(new THREE.Vector3(point.x,point.y,2),new THREE.Vector3(0,0,-1));
    const brow=ray.intersectObject(disc,false)[0],bounds=new THREE.Box3().setFromObject(eye);
    assert.ok(brow&&brow.point.z>bounds.max.z+.005,'upper cream brow sits in front of the eye bulge');
  }
  disposeObject(model);kit.dispose();
});

test('owl close facial colour follows the actual recessed surface and its beak has a broad matte ridge',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='email-owl'),kit);
  const disc=model.getObjectByName('owl-facial-disc:1'),dense=refineCharacterSurface(surfaceData(disc.geometry),'facialFeather');
  const p=dense.attributes.position.array,c=dense.attributes.color.array;
  for(let i=0;i<p.length;i+=57){
    const expected=owlFaceTint(p[i],p[i+1]);
    for(let axis=0;axis<3;axis++)assert.ok(Math.abs(c[i+axis]-expected[axis])<1e-5,'dense socket tint does not interpolate coarse triangular patches');
  }
  assert.ok(owlFaceTint(.13,.06)[0]<owlFaceTint(.13,-.056)[0],'the upper socket retains a warmer sheltered edge');
  const beak=model.getObjectByName('owlBeak');
  assert.equal(beak.material.metalness,0,'beak is matte horn, not a brass pendant');
  assert.ok(beak.material.roughness>.7);
  beak.geometry.computeBoundingBox();const size=beak.geometry.boundingBox.getSize(new THREE.Vector3()).multiply(beak.scale);
  assert.ok(size.x/size.y>.5&&size.x/size.y<.68&&size.z>.045,'a compact softly tapered ridge replaces the wide pyramid');
  assert.ok(beak.geometry.attributes.position.count>200,'rounded transitions are actual authored geometry');
  disposeObject(model);kit.dispose();
});

test('the owl facial shield keeps its lower heart silhouette in front of the breast',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(c=>c.id==='email-owl'),kit);
  model.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),point=new THREE.Vector3();
  for(const sign of [-1,1]){
    const disc=model.getObjectByName(`owl-facial-disc:${sign}`),p=disc.geometry.attributes.position;
    let exactTip=false;
    for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))<1e-7&&Math.abs(p.getY(i)+.251)<1e-7)exactTip=true;
    assert.ok(exactTip,'both facial halves share the exact tapered heart endpoint');
    let tested=0;
    for(let i=0;i<p.count;i++){
      if(p.getY(i)>-.17||Math.abs(p.getX(i))>.07)continue;
      point.fromBufferAttribute(p,i).applyMatrix4(disc.matrixWorld);
      ray.set(new THREE.Vector3(point.x,point.y,2),new THREE.Vector3(0,0,-1));
      const hit=ray.intersectObject(model,true)[0];
      assert.ok(hit&&hit.point.z<=point.z+.004,'breast cannot cut a horizontal shelf across the facial shield');
      tested++;
    }
    assert.ok(tested>3,'sample the real lower shield, not only its eye centre');
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
  const coarseShell=shell.geometry;
  shell.geometry=surfaceGeometry(refineCharacterSurface(surfaceData(coarseShell),'feather'));
  model.updateMatrixWorld(true);
  const positions=plumage.geometry.attributes.position,normals=plumage.geometry.attributes.normal;
  const point=new THREE.Vector3(),normal=new THREE.Vector3(),vertex=new THREE.Vector3();
  for(let i=0;i<positions.count;i+=3){
    point.set(0,0,0);normal.set(0,0,0);
    for(let j=0;j<3;j++){point.add(vertex.fromBufferAttribute(positions,i+j));normal.add(vertex.fromBufferAttribute(normals,i+j));}
    point.multiplyScalar(1/3);
    if(point.y>.30)continue;
    const direction=new THREE.Vector3(point.x,0,point.z).normalize();
    if(normal.normalize().dot(direction)<.2)continue;
    const centre=new THREE.Vector3(0,point.y,0).applyMatrix4(plumage.matrixWorld);
    point.applyMatrix4(plumage.matrixWorld);
    const ray=new THREE.Raycaster(centre.clone().addScaledVector(direction,2),direction.clone().negate());
    const hit=ray.intersectObject(shell,false)[0];
    assert.ok(hit&&point.distanceTo(centre)>hit.point.distanceTo(centre)+.002,`outward-facing feather triangle clears its supporting body at ${point.toArray().map(v=>v.toFixed(4)).join(',')}; clearance ${hit?(point.distanceTo(centre)-hit.point.distanceTo(centre)).toFixed(5):'no body hit'}`);
  }
  shell.geometry.dispose();shell.geometry=coarseShell;
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
          `${character.id}/${name} follows the helmet without clipping or floating (gap ${surface?vertex.z-surface.point.z:'missing'})`);
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
  assert.ok(material.roughness>=.38&&material.roughness<.48,'satin ceramic retains a broad highlight, not mirror plastic or matte paper');
  assert.equal(material.envMapIntensity,1.15,'ceramic curvature receives the existing softbox without extra lights');
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

test('robot cuffs join feet and only the two lanterns own bounded shadow-free warmth', () => {
  const kit = new SceneKit(), all = new THREE.Group();
  for (const character of members) {
    const model = makeProxy(character, kit); all.add(model); model.updateMatrixWorld(true);
    const lights=model.getObjectsByProperty('isLight', true);
    assert.equal(lights.length,character.kind==='lantern'?1:0,`${character.id} light budget`);
    for(const light of lights){
      assert.equal(light.castShadow,false);assert.ok(light.distance<=2.4);
      assert.equal(light.intensity,character.id==='support-beacon'?.32:2.2);
      assert.ok(light.position.z<=.24,'the local emitter stays at the glass, not at the camera');
      if(character.id==='reflection-lumen'){
        const glass=model.getObjectByName('hexGlass'),point=light.getWorldPosition(new THREE.Vector3());
        assert.ok(new THREE.Box3().setFromObject(glass).containsPoint(point),'Lumen emits from inside the amber chamber, not against the front pane');
        assert.ok(light.position.z<.08,'the front glass is not exposed to a near-zero-distance outside light');
      }
    }
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

test('Lumen maps its interior gradient to every glass pane without changing Beacon or adding transmission',()=>{
  const kit=new SceneKit(),geometry=characterGeometry(kit,'hexGlass'),uv=geometry.attributes.uv;
  for(let pane=0;pane<6;pane++){
    const values=Array.from({length:6},(_,i)=>uv.getX(pane*6+i));
    assert.ok(Math.min(...values)<1e-5&&Math.max(...values)>1-1e-5,'each pane spans the full light field');
  }
  const glass=characterMaterial(kit,'#ffe7b1','lanternGlass'),beacon=characterMaterial(kit,'#fff1cc','amber');
  assert.notEqual(glass.map,beacon.map);assert.equal(glass.map,glass.emissiveMap);
  assert.equal(glass.transparent,false);assert.equal(glass.roughness,.26);
  assert.equal(glass.map.image.width,128);assert.equal(glass.map.image.height,128);
  const data=glass.map.image.data,pixel=(x,y)=>Array.from(data.slice((y*128+x)*4,(y*128+x)*4+4));
  const centre=pixel(64,58),edge=pixel(2,58);
  assert.ok(centre[1]-edge[1]>40&&centre[1]-edge[1]<75,'the internal glow stays broad rather than a bright striped core');
  assert.ok(edge[0]-edge[1]<55,'edge falloff dims every channel instead of becoming saturated orange');
  assert.ok(centre[2]<160&&centre[0]>centre[1],'the core stays warm rather than neutral white');
  assert.equal(beacon.emissiveIntensity,.80);assert.equal(beacon.roughness,.38);
  kit.dispose();
});

test('Lumen separates aged structural brass from polished details with one shared bounded finish',()=>{
  const kit=new SceneKit(),model=makeProxy(members.find(member=>member.id==='reflection-lumen'),kit);
  const roof=model.getObjectByName('hexCap').material,base=model.getObjectByName('hexBase').material;
  const polish=characterMaterial(kit,'#b99a61','brass');
  assert.equal(roof.userData.characterFinish,'agedBrass');assert.equal(base.map,roof.map);
  assert.notEqual(roof.map,polish.map);assert.equal(roof.map,roof.bumpMap);assert.equal(roof.map,roof.roughnessMap);
  assert.ok(roof.roughness>polish.roughness&&roof.metalness>.65);
  assert.equal(roof.transparent,false);assert.equal(roof.emissive.getHex(),0);
  assert.equal(roof.map.image.width,512);assert.equal(roof.map.image.height,512);
  const values=roof.map.image.data.filter((_,i)=>i%4===0);
  assert.ok(Math.max(...values.subarray(0,64000))-Math.min(...values.subarray(0,64000))>35,'metal has varied response, not a flat uniform tint');
  let disposed=0;roof.map.addEventListener('dispose',()=>disposed++);disposeObject(model);
  assert.equal(disposed,1,'all structural metal shares one disposed texture');kit.dispose();
});

test('paper chest sheets have a shallow ordered overlap rather than coincident centre faces',()=>{
  const kit=new SceneKit(),ray=new THREE.Raycaster();
  for(const id of ['reflection-echo','reflection-quill']){
    const model=makeProxy(members.find(c=>c.id===id),kit);model.updateMatrixWorld(true);
    const over=model.getObjectByName('paperChestL'),under=model.getObjectByName('paperChestR');let checked=0;
    for(let y=-.39;y<.05;y+=.02){
      const point=over.localToWorld(new THREE.Vector3(0,y,0));
      ray.set(new THREE.Vector3(point.x,point.y,2),new THREE.Vector3(0,0,-1));
      const top=ray.intersectObject(over,false)[0],bottom=ray.intersectObject(under,false)[0];
      if(top&&bottom){const gap=top.point.z-bottom.point.z;assert.ok(gap>.003&&gap<.015,'one thin stock of paper overlaps the other without a deep air gap');checked++;}
    }
    assert.ok(checked>=15,'the ordering persists down the visible breast seam');disposeObject(model);
  }
  kit.dispose();
});

test('paper temple folds use long shared planes and rear overlaps follow the actual head',()=>{
  const kit=new SceneKit();
  for(const [form,edges] of [['paperEchoHead',9],['paperQuillHead',11]]){
    const geometry=characterGeometry(kit,form),n=geometry.attributes.normal;
    for(let edge=0;edge<edges;edge++){
      const start=n.count-(edges-2)*3-edges*12+edge*12,normal=new THREE.Vector3().fromBufferAttribute(n,start);
      for(let i=start+1;i<start+12;i++)assert.ok(normal.distanceTo(new THREE.Vector3().fromBufferAttribute(n,i))<1e-5,'four internal triangles form one long temple plane');
    }
    const rearStart=n.count-(edges-2)*3;
    for(let i=rearStart;i<n.count;i++){
      assert.ok(Math.abs(geometry.attributes.position.getZ(i)+.20)<1e-6,'rear closure is a broad planar panel, not a pinched apex');
      assert.ok(n.getZ(i)<-.99,'rear closure faces outward');
    }
  }
  const ray=new THREE.Raycaster(),point=new THREE.Vector3();
  for(const id of ['reflection-echo','reflection-quill']){
    const model=makeProxy(members.find(c=>c.id===id),kit);model.userData.personality.head.rotation.set(0,0,0);model.updateMatrixWorld(true);
    const shell=model.getObjectByName(id==='reflection-echo'?'paperEchoHead':'paperQuillHead');
    for(const name of ['paperCrownBackL','paperCrownBackR']){
      const sheet=model.getObjectByName(name),p=sheet.geometry.attributes.position;let checked=0;
      assert.equal(sheet.geometry.userData.characterFitted,true);
      for(let i=0;i<p.count;i++){
        point.fromBufferAttribute(p,i).applyMatrix4(sheet.matrixWorld);
        ray.set(new THREE.Vector3(point.x,point.y,-2),new THREE.Vector3(0,0,1));const hit=ray.intersectObject(shell,false)[0];
        if(hit){const gap=hit.point.z-point.z;assert.ok(gap>.001&&gap<.055,'rear paper follows the folded core instead of floating behind the old outline');checked++;}
      }
      assert.ok(checked>20);
    }
    disposeObject(model);
  }
  kit.dispose();
});

test('paper hood wraps have closed thin edges and preserve open facial windows',()=>{
  const kit=new SceneKit(),material=new THREE.MeshBasicMaterial(),ray=new THREE.Raycaster();
  for(const form of ['paperEchoHood','paperQuillHood']){
    const mesh=new THREE.Mesh(characterGeometry(kit,form),material);mesh.updateMatrixWorld(true);let covered=0;
    for(let x=-.50;x<=.50;x+=.02)for(let y=-.44;y<=.50;y+=.02){
      ray.set(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1));const front=ray.intersectObject(mesh,false)[0];
      ray.set(new THREE.Vector3(x,y,-2),new THREE.Vector3(0,0,1));const back=ray.intersectObject(mesh,false)[0];
      assert.equal(!!front,!!back,'both sides of the folded wrap are present');
      if(front){assert.ok(Math.abs(front.point.z-back.point.z-.010)<1e-5,'back follows the fold at paper thickness, not a flat extrusion');covered++;}
    }
    assert.ok(covered>150,'brow and cheek wrap has a substantial connected area');
    for(const x of [-.20,.20]){ray.set(new THREE.Vector3(x,.05,2),new THREE.Vector3(0,0,-1));assert.equal(ray.intersectObject(mesh,false).length,0,'eye windows remain open');}
  }
  material.dispose();kit.dispose();
});

test('paper facial panels contain two deliberate planes per cheek rather than an apex fan',()=>{
  const kit=new SceneKit(),cream=new THREE.Color('#edd6b0');
  for(const form of ['paperEchoHead','paperQuillHead']){
    const geometry=characterGeometry(kit,form),p=geometry.attributes.position,n=geometry.attributes.normal,c=geometry.attributes.color;
    const normals=[new Set(),new Set()];
    for(let i=0;i<p.count;i++)if(Math.abs(c.getX(i)-cream.r)<1e-5&&Math.abs(c.getY(i)-cream.g)<1e-5){
      normals[p.getX(i)>0?1:0].add([n.getX(i),n.getY(i),n.getZ(i)].map(v=>Math.round(v*1e4)).join(':'));
    }
    for(const side of normals)assert.equal(side.size,2,'upper panel and lower return each remain coplanar');
  }
  kit.dispose();
});

test('folded owl heads and bodies retain real side-on volume in office windows',()=>{
  const kit=new SceneKit(),all=new THREE.Group();
  for(const id of ['reflection-echo','reflection-quill']){
    const model=makeProxy(members.find(member=>member.id===id),kit);all.add(model);model.updateMatrixWorld(true);
    for(const name of ['paperBody',id==='reflection-echo'?'paperEchoHead':'paperQuillHead']){
      const size=new THREE.Box3().setFromObject(model.getObjectByName(name)).getSize(new THREE.Vector3());
      assert.ok(size.z/size.x>.30,`${id} ${name} is a folded volume, not a front-facing wafer`);
    }
  }
  disposeObject(all);kit.dispose();
});

test('paper owl breast folds do not cut a horizontal edge across the lower facial shield',()=>{
  const kit=new SceneKit(),all=new THREE.Group(),ray=new THREE.Raycaster();
  for(const id of ['reflection-echo','reflection-quill']){
    const model=makeProxy(members.find(member=>member.id===id),kit);all.add(model);model.updateMatrixWorld(true);
    const face=model.getObjectByName(id==='reflection-echo'?'paperEchoHead':'paperQuillHead');
    for(const x of [-.06,0,.06]){
      const origin=new THREE.Vector3(x,-.31,2).applyMatrix4(face.matrixWorld);
      const direction=new THREE.Vector3(0,0,-1).transformDirection(face.matrixWorld);
      ray.set(origin,direction);
      const shield=ray.intersectObject(face)[0];assert.ok(shield,`${id} lower face exists`);
      const first=ray.intersectObject(model,true)[0];
      const hood=model.getObjectByName(id==='reflection-echo'?'paperEchoHood':'paperQuillHood');
      assert.ok(first?.object===face||first?.object===hood,`${id} lower facial shield and its thin wrap remain in front of the folded breast; first hit ${first?.object.name}`);
    }
  }
  disposeObject(all);kit.dispose();
});

test('avatars preserve the distinct original portrait identities and opaque lightweight surfaces', () => {
  const kit = new SceneKit(), all = new THREE.Group();
  const expected={
    'bridge-jarvis':['merchantTorso','helmet','ring'],
    'bridge-scout':['helmet','compass-emblem','ring'],
    'bridge-keeper':['keeperTurnedCorner','front-cover','page-block','seedling-book'],
    'hr-compass':['spiritFigure','compassCowl','compassNeedle','compass-emblem'],
    'hr-lens':['spiritLens','lensCowl','ring'],
    'hr-relay':['spiritRelay','relayCowl','detail'],
    'intake-jarvis':['wayfinderBody','cape','hoodTip','compass-emblem'],
    'intake-beacon':['wayfinderBody','lanternCap'],
    'intake-relay':['wayfinderBody','scroll','book'],
    'intake-compass':['wayfinderBody','tuft','circuit-bib'],
    'support-beacon':['embracingBody','lanternCap','lanternHandle'],
    'reflection-lumen':['hexGlass','hexCap','fineRing'],
    'reflection-echo':['paperBody','paperEchoHead','paperOwlWingL','paperHoldingWing','paperCrownBackL','paperCrownBackR','ring'],
    'reflection-quill':['paperBody','paperWing','paperHoldingWing','quill-pencil'],
    'email-owl':['owlHead','owlBody','owlBeak','featherFanL','featherFanR','breastFeathers'],
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
