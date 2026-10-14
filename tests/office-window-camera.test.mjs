import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';

const source=await readFile(new URL('../src/scene/officeWindowCamera.ts',import.meta.url),'utf8');
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,
  {module,exports:module.exports,require:name=>{assert.equal(name,'three');return THREE;}});
const {officeWindowFrame}=module.exports;
const room={center:new THREE.Vector3(0,0,4),navigation:{floorY:.1,task:[-.1,0],desks:[
  {position:[-.95,-1.13]},{position:[.30,-1.20]},{position:[1.40,.20]},
]}};

test('Reflection window reveals neutral front-facing residents without moving the room',()=>{
  const before=JSON.stringify(room),frame=officeWindowFrame('reflection',room,1.5);
  const direction=frame.position.clone().sub(frame.target).normalize();
  assert.ok(direction.z>.7&&direction.x<0&&Math.abs(direction.x)<.35,'the fixed view is front-left, not edge-on');
  assert.ok(direction.y>.5&&direction.y<.65,'the observer sees the short lantern face above the tabletop');
  assert.equal(frame.target.y,.85);assert.equal(frame.fov,38);
  for(const desk of room.navigation.desks)for(const y of [.1,1.7]){
    assert.ok(frame.bounds.containsPoint(room.center.clone().add(new THREE.Vector3(desk.position[0],y,desk.position[1]))));
  }
  assert.equal(JSON.stringify(room),before,'camera selection cannot mutate actor/navigation anchors');
});

test('window composition fits the actual authored volume at narrow and wide aspect ratios',()=>{
  for(const team of ['reflection','merchant'])for(const aspect of [.35,.5625,1,1.5,2.4]){
    const frame=officeWindowFrame(team,room,aspect),camera=new THREE.PerspectiveCamera(frame.fov,aspect,.1,180);
    camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld(true);
    for(const x of [frame.bounds.min.x,frame.bounds.max.x])for(const y of [frame.bounds.min.y,frame.bounds.max.y])for(const z of [frame.bounds.min.z,frame.bounds.max.z]){
      const point=new THREE.Vector3(x,y,z).project(camera);
      assert.ok(Math.abs(point.x)<.95&&Math.abs(point.y)<.95&&point.z>-1&&point.z<1,`${team}/${aspect} retains safe image-space margins`);
    }
  }
});

test('all other offices retain the previous diagonal overview and tall framing',()=>{
  const expected=new THREE.Vector3(.65,.62,.48).normalize();
  for(const team of ['merchant','hr','intake','support','email']){
    const frame=officeWindowFrame(team,room,1.5);
    assert.ok(frame.position.clone().sub(frame.target).normalize().distanceTo(expected)<1e-12);
    assert.equal(frame.target.y,1.25);assert.equal(frame.bounds.max.y,3.2);
    assert.ok(frame.position.distanceTo(frame.target)>=6.8*1.2);
  }
});
