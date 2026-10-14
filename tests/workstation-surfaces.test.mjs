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
const { laptop, monitor, table, chair, plant, rug, lamp, notebook, shelf, parcelStack, tidyStaticMeshes } = await import(await moduleUrl('../src/scene/environmentProps.ts', { './primitives': primitives }));

function canvasDocument(t) {
  const prior = globalThis.document;
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, { get: (_, key) => String(key).startsWith('create') ? () => gradient : () => {} });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
  t.after(() => { globalThis.document = prior; });
}

test('paper-wrapped storage is bounded static furniture with a certified walking envelope',()=>{
  const kit=new SceneKit(),root=new THREE.Group(),stack=parcelStack(root,kit,0,0);
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(stack);
  assert.ok(bounds.min.x>=-.53&&bounds.max.x<=.53&&bounds.min.z>=-.44&&bounds.max.z<=.44,
    'every carton, tape edge and label fits the actual room blocker');
  assert.ok(bounds.min.y>=.097&&bounds.max.y<.82);
  let triangles=0;
  stack.traverse(object=>{
    assert.ok(!object.isLight);
    if(!object.isMesh)return;
    triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;
    assert.equal(object.material.transparent,false);assert.equal(object.material.map,null);
  });
  assert.ok(triangles<2000,'storage does not add dense scene-wide geometry');
  tidyStaticMeshes(root);
  assert.equal(root.children.filter(object=>object.isMesh).length,1,'all cartons share a static matte draw');
  const resources=new THREE.Group();resources.add(root,root.userData.staticSources);
  disposeObject(resources);kit.dispose();
});

test('bound shelf books and archive boxes keep the original furniture envelope and static batches',()=>{
  const kit=new SceneKit(),resources=new THREE.Group();
  for(let variant=0;variant<6;variant++){
    const root=new THREE.Group();shelf(root,kit,0,0,variant,false);root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(root);
    assert.ok(bounds.min.x>=-.551&&bounds.max.x<=.551&&bounds.min.z>=-.336&&bounds.max.z<=.416);
    assert.ok(bounds.min.y>=.099&&bounds.max.y<=1.541);
    const books=[];let triangles=0;
    root.traverse(object=>{
      if(object.name==='Bound shelf book')books.push(object);
      if(object.isMesh){triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;
        assert.equal(object.material.map,null);assert.equal(object.material.transparent,false);}
    });
    assert.ok(books.length>=12);assert.ok(triangles<6500);
    for(const book of books)assert.ok(book.children.length>=9,'pages and thin covers are separate surfaces');
    tidyStaticMeshes(root);assert.ok(root.children.filter(object=>object.isMesh).length<=4);
    resources.add(root,root.userData.staticSources);
  }
  disposeObject(resources);kit.dispose();
});

test('taller shelves add real tiers without stretching books or changing floor footprints',()=>{
  const kit=new SceneKit(),resources=new THREE.Group();
  for(const tiers of [4,5])for(const cupboard of [false,true]){
    const root=new THREE.Group(),top=shelf(root,kit,0,0,2,cupboard,1,tiers);root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(root);
    assert.ok(Math.abs(bounds.min.y-.1)<1e-6&&Math.abs(bounds.max.y-top)<1e-6);
    assert.ok(bounds.min.x>=-.551&&bounds.max.x<=.551&&bounds.min.z>=-.336&&bounds.max.z<=.484);
    const books=[];let triangles=0;
    root.traverse(object=>{
      if(object.name==='Bound shelf book')books.push(object);
      if(object.isMesh)triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;
    });
    const rows=new Set(books.map(book=>Math.floor((book.position.y-.25)/.42)));
    assert.ok(books.length>=(tiers-(cupboard?3:0))*4);
    assert.ok(rows.has(tiers-1),'upper tier contains real volumes');
    for(const book of books)assert.deepEqual(book.scale.toArray(),[1,1,1]);
    assert.deepEqual(root.userData.floorContacts,[[0,.105,.04,1.15,.82]]);
    assert.ok(triangles<10500,'additional tiers remain bounded static geometry');
    tidyStaticMeshes(root);assert.ok(root.children.filter(object=>object.isMesh).length<=4);
    resources.add(root,root.userData.staticSources);
  }
  disposeObject(resources);kit.dispose();
});

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

test('curved shared tables preserve the existing footprint, surface height and bounded geometry', t => {
  canvasDocument(t);
  const kit=new SceneKit(),all=new THREE.Group();
  for(const style of ['rect','soft','capsule']){
    const desk=new THREE.Group();all.add(desk);table(desk,kit,0,0,2.75,1.4,style);desk.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(desk);
    assert.ok(bounds.min.x>=-1.3751&&bounds.max.x<=1.3751&&bounds.min.z>=-.7001&&bounds.max.z<=.7001,style);
    assert.ok(Math.abs(bounds.max.y-.82)<1e-6,`${style} supports the existing desk objects`);
    let triangles=0;desk.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
    assert.ok(triangles<4000,`${style}: ${triangles} triangles`);
    assert.equal(desk.userData.floorContacts.length,4);
  }
  disposeObject(all);kit.dispose();
});

test('diverse connected plants keep actual vertices inside their certified floor envelopes and release owned meshes once', () => {
  const kit = new SceneKit(), resources = new THREE.Group(), owned = new Set();
  for (const [kind, bound] of [['leaf', 0.5], ['broad', 0.57], ['spear', 0.28], ['herb', 0.48], ['ivy', 0.5]]) {
    const root = new THREE.Group(); plant(root, kit, 0, 0, 1, kind === 'ivy' ? 1.48 : 0.1, '#bca581', kind);
    const group = root.children[0], canopy = group.getObjectByName('Connected botanical canopy'); root.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert(), point = new THREE.Vector3();
    let leaves = 0, triangles = 0;const leafForms=new Set(),pitches=[];
    canopy.traverse(object => {
      assert.equal(Boolean(object.isSprite || object.isLight), false, 'canopies are actual mesh forms');
      if (!object.isMesh) return;
      if (object.name === 'Cupped botanical leaf') {leaves++;leafForms.add(object.geometry);pitches.push(object.rotation.x);}
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).applyMatrix4(inverse);
        assert.ok(Math.hypot(point.x, point.z) <= bound + 1e-6, `${kind} cannot widen its navigation obstacle`);
      }
    });
    assert.equal(leaves, { spear:11, herb:17, broad:17, leaf:21, ivy:14 }[kind], 'each authored canopy has a fixed leaf budget');
    if(kind==='leaf'||kind==='broad'){
      assert.equal(leafForms.size,3,'shared curved blades vary without more submitted leaves');
      assert.ok(Math.max(...pitches)-Math.min(...pitches)>.4,'a canopy has several leaf pitches rather than repeated horizontal tiers');
    }
    group.traverse(object => {
      if (!object.isMesh) return;
      triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      if(object.name==='Cupped botanical leaf'){
        if(kind==='leaf'||kind==='broad'){
          const aim=new THREE.Vector3(0,1,0).applyEuler(object.rotation);
          const bearing=new THREE.Vector3(Math.sin(object.rotation.y),0,Math.cos(object.rotation.y));
          aim.y=0;aim.normalize();
          assert.ok(aim.dot(bearing)>.94,'leaf pitch follows its own branch azimuth, not a shared world axis');
        }
        assert.equal(object.material.map?.userData.botanicalGrain,true,'fine veins supplement a real curved leaf');
        assert.equal(object.material.bumpMap,object.material.map);
        assert.equal(object.material.transparent,false,'leaves do not use alpha-cutout cards');
      }else assert.equal(object.material.map,null);
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

test('fine botanical surfaces share one opaque map, preserve UVs when merged and dispose once', () => {
  const kit=new SceneKit(),root=new THREE.Group(),resources=new THREE.Group();
  plant(root,kit,-1,0,1);plant(root,kit,1,0,1,.1,'#bca581','broad');
  const maps=new Set(),originalUV=[];
  root.traverse(mesh=>{
    if(mesh.name!=='Cupped botanical leaf')return;
    maps.add(mesh.material.map);
    const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
    originalUV.push(...geometry.attributes.uv.array);geometry.dispose();
  });
  assert.equal(maps.size,1);const [texture]=maps;
  assert.equal(texture.image.width,128);assert.equal(texture.image.height,256);
  let released=0;texture.addEventListener('dispose',()=>released++);
  tidyStaticMeshes(root);
  const mapped=root.children.filter(mesh=>mesh.material?.map===texture);
  assert.equal(mapped.length,1,'all leaf shades and plants share a single static root draw');
  const mesh=mapped[0];
  assert.deepEqual([...mesh.geometry.attributes.uv.array],originalUV);
  assert.equal(mesh.geometry.attributes.color.count,mesh.geometry.attributes.position.count);
  assert.equal(mesh.material.bumpMap,texture);assert.equal(mesh.material.transparent,false);
  resources.add(root,root.userData.staticSources);disposeObject(resources);kit.dispose();
  assert.equal(released,1);
});

test('small linen notebooks remain bounded tabletop furnishings without new lights or transparent cards',()=>{
  const kit=new SceneKit(),root=new THREE.Group(),book=notebook(root,kit,0,0,'#536e65',-.13);
  root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(book);
  assert.ok(box.min.x>-.27&&box.max.x<.27&&box.min.z>-.31&&box.max.z<.31);
  assert.ok(box.min.y>=.8359&&box.max.y<.916);
  let triangles=0;book.traverse(mesh=>{
    assert.ok(!mesh.isLight);
    if(!mesh.isMesh)return;
    triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;
    assert.equal(mesh.material.transparent,false);assert.equal(mesh.material.map,null);
  });
  assert.ok(triangles<1500);
  disposeObject(root);kit.dispose();
});

test('woven rugs have real rounded corners and retain pile height and bounded footprint', t => {
  canvasDocument(t);
  const kit = new SceneKit(), root = new THREE.Group(); rug(root, kit, '#8b9779', 0, 0, 4.55, 4.2); root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  assert.ok(bounds.min.x >= -2.2751 && bounds.max.x <= 2.2751 && bounds.min.z >= -2.1001 && bounds.max.z <= 2.1001);
  assert.ok(bounds.min.y >= 0.0934 && Math.abs(bounds.max.y - 0.13) < 1e-6);
  const weave=root.children.find(mesh=>mesh.material.map),pile=root.children.find(mesh=>!mesh.material.map);
  const pileTop=new THREE.Box3().setFromObject(pile).max.y;
  assert.ok(weave.position.y-pileTop>=.007,'real separation prevents distant rug z-fighting');
  assert.equal(weave.receiveShadow,true,'the repair retains real furniture shadows');
  assert.equal(weave.material.polygonOffset,true,'the decorative weave has stable depth ordering');
  const ray = new THREE.Raycaster(new THREE.Vector3(2.24, 2, 2.06), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(root, true).length, 0, 'the pill corner is geometry rather than painted transparency');
  ray.ray.origin.set(0, 2, 0);
  assert.ok(ray.intersectObject(root, true).length > 0);
  disposeObject(root); kit.dispose();
});
