import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/scene/agentExpression.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { agentExpression } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const reports = ['active', 'sleeping', 'waiting', 'unknown'];

test('activity observations alone never select work, sleep or movement for any teammate', () => {
  for (const report of reports) assert.equal(agentExpression('idle', undefined, report, true, false), 'idle');
  assert.equal(agentExpression('work', undefined, 'active', true, false), 'work');
  assert.equal(agentExpression('rest', undefined, 'waiting', true, false), 'rest');
  assert.equal(agentExpression('rest', undefined, 'active', true, false), 'rest', 'heartbeat does not undo an explicit rest');
});

test('a real dependency wait preserves the agent choice through active and waiting reports', () => {
  for (const gesture of ['think', 'file', 'talk', 'wait']) {
    for (const report of ['active', 'waiting']) {
      assert.equal(agentExpression('interact', gesture, report, true, false), gesture);
    }
  }
  assert.equal(agentExpression('work', undefined, 'waiting', true, false), 'idle', 'computer work pauses while waiting');
  assert.equal(agentExpression('interact', 'work', 'sleeping', true, false), 'idle');
  assert.equal(agentExpression('interact', 'file', 'sleeping', true, false), 'idle', 'observed idle quiets old work');
});

test('accepted locomotion is independent of reports; stale and disconnected views invent no work', () => {
  for (const report of reports) assert.equal(agentExpression('walk', undefined, report, true, true), 'walk');
  assert.equal(agentExpression('walk', 'think', 'active', true, false), 'idle', 'turn before interacting');
  for (const mode of ['work', 'rest', 'celebrate', 'interact']) {
    assert.equal(agentExpression(mode, 'file', 'unknown', true, false), 'idle');
    for (const report of reports) assert.equal(agentExpression(mode, 'wait', report, false, false), 'idle');
  }
  assert.equal(agentExpression('walk', undefined, 'active', false, true), 'idle');
});
