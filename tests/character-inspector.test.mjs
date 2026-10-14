import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('individual surface inspection stays development-only, static and disconnected from agent activity',async()=>{
  const source=await readFile(new URL('../tools/character-inspector.ts',import.meta.url),'utf8');
  const guard=source.indexOf("if(!import.meta.env.DEV)throw Error('Development fixture only')");
  assert.ok(guard>=0&&guard<source.indexOf('new THREE.WebGLRenderer'));
  assert.doesNotMatch(source,/\b(fetch|WebSocket|EventSource|requestAnimationFrame)\s*\(/);
  assert.doesNotMatch(source,/from ['"][^'"]*(?:bridge|agentActions|officeAssets|liveStatus)[^'"]*['"]/i);
  assert.match(source,/makeProxy\(member,kit\)/);assert.match(source,/refineCharacterModel\(model\)/);
  assert.match(source,/release\?\.\(\)/);assert.match(source,/resize\.disconnect\(\)/);
});
