import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';

const source=await readFile(new URL('../src/scene.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('scene.ts',source,ts.ScriptTarget.Latest,true);
const body=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='createScene').body;
const declares=(node,name)=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(item=>item.name.getText(ast)===name);
// Execute the actual light setup, including its initial application. No WebGL,
// timers, agent bridge, or duplicated test implementation of that setup.
const start=body.statements.findIndex(node=>declares(node,'skyLight'));
const end=body.statements.findIndex(node=>declares(node,'kit'));
assert.ok(start>=0&&end>start);
const setup=body.statements.slice(start,end).map(node=>node.getText(ast)).join('\n');
const clockSource=await readFile(new URL('../src/localDaylight.ts',import.meta.url),'utf8');
const compile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const clock={exports:{}};vm.runInNewContext(compile(clockSource),{module:clock,exports:clock.exports});

test('the first exact-noon scene already has the device-clock profile, not constructor defaults',()=>{
  const scene=new THREE.Scene(),renderer={shadowMap:{needsUpdate:false}},backdrops=[];
  const context={THREE,scene,renderer,daylightAtHour:clock.exports.daylightAtHour,output:{setBackdrop:(...args)=>backdrops.push(args)}};
  vm.runInNewContext(compile(setup),context);
  const expected=clock.exports.daylightAtHour(12),sky=scene.children.find(light=>light.isHemisphereLight),sun=scene.children.find(light=>light.isDirectionalLight);
  assert.equal(sky.intensity,expected.ambient);assert.equal(sky.color.getHexString(),expected.sky.slice(1));
  assert.equal(sky.groundColor.getHexString(),expected.ground.slice(1));
  assert.equal(sun.intensity,expected.sunIntensity);assert.equal(sun.color.getHexString(),expected.sun.slice(1));
  assert.deepEqual(sun.position.toArray(),Array.from(expected.sunPosition));
  assert.equal(scene.environmentIntensity,expected.reflection);assert.equal(renderer.shadowMap.needsUpdate,true);
  assert.equal(backdrops.length,1);assert.deepEqual(backdrops[0].slice(0,2),Array.from(expected.backdrop));
  sun.shadow.dispose();
});
