import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, access, rm } from 'node:fs/promises';
import { createBridge } from '../server/index.mjs';

const exec = promisify(execFile);
const SCRIPT = fileURLToPath(new URL('../scripts/platop.mjs', import.meta.url));
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'platop-cli-'));
  await mkdir(path.join(root, 'dist'));
  const bridge = await createBridge({ root, port: 0 });
  t.after(async () => { await bridge.close(); await rm(root, { recursive: true, force: true }); });
  const cli = args => exec(process.execPath, [SCRIPT, ...args], { env: { ...process.env, PLATOP_ROOT: root, PLATOP_PORT: String(bridge.port) }, timeout: 10_000 });
  const state = () => fetch(`http://127.0.0.1:${bridge.port}/api/state`).then(response => response.json());
  return { root, bridge, cli, state };
}

test('CLI status and set use sanitized telemetry without revealing the write token', async t => {
  const { cli } = await fixture(t);
  const initial = JSON.parse((await cli(['status'])).stdout);
  assert.equal(initial.app, 'platop');
  assert.ok(initial.teams.every(team => team.state === 'unknown'));
  assert.match((await cli(['set', 'email', 'active', '--source', 'codex'])).stdout, /email active/);
  const next = JSON.parse((await cli(['status'])).stdout);
  assert.equal(next.teams.find(team => team.teamId === 'email').source, 'codex');
  assert.ok(!JSON.stringify(next).includes('Bearer'));
});

test('CLI snapshot rejects private fields before any update and accepts a public batch', async t => {
  const { root, cli, state } = await fixture(t);
  const snapshot = path.join(root, 'snapshot.json');
  await writeFile(snapshot, JSON.stringify({ teams: [{ teamId: 'merchant', state: 'active', content: 'PRIVATE_TEXT' }] }));
  await assert.rejects(cli(['snapshot', snapshot]), error => error.code === 1 && !error.stderr.includes('PRIVATE_TEXT'));
  assert.ok((await state()).teams.every(team => team.state === 'unknown'));
  await writeFile(snapshot, JSON.stringify({ teams: [{ teamId: 'merchant', state: 'sleeping', source: 'codex' }, { teamId: 'hr', state: 'waiting' }] }));
  assert.match((await cli(['snapshot', snapshot])).stdout, /updated 2 teams/);
  assert.equal((await state()).teams[0].state, 'sleeping');
});

test('removed demo source cannot update telemetry or launch a wrapped command', async t => {
  const { root, cli, state } = await fixture(t);
  await cli(['set', 'merchant', 'sleeping', '--source', 'skill']);
  const before = (await state()).teams;
  await assert.rejects(cli(['set', 'merchant', 'active', '--source', 'demo']), error => error.code === 1);
  const marker = path.join(root, 'demo-command-must-not-run');
  await assert.rejects(cli(['run', 'merchant', '--source', 'demo', '--', process.execPath, '-e',
    'require("node:fs").writeFileSync(process.argv[1], "unexpected")', marker]), error => error.code === 1);
  await assert.rejects(access(marker));
  assert.deepEqual((await state()).teams, before);
});

test('CLI run passes literal arguments without shell evaluation and marks successful work sleeping', async t => {
  const { root, cli, state } = await fixture(t);
  const marker = path.join(root, 'should-not-exist');
  const literal = `$(touch ${marker}); echo shell-is-not-running`;
  const output = await cli(['run', 'support', '--', process.execPath, '-e', 'console.log(process.argv[1])', literal]);
  assert.equal(output.stdout.trim(), literal);
  await assert.rejects(access(marker));
  assert.equal((await state()).teams.find(team => team.teamId === 'support').state, 'sleeping');
});

test('CLI run preserves failure code and marks recoverable attention waiting', async t => {
  const { cli, state } = await fixture(t);
  await assert.rejects(cli(['run', 'reflection', '--source', 'codex', '--', process.execPath, '-e', 'process.exit(7)']), error => error.code === 7);
  const team = (await state()).teams.find(team => team.teamId === 'reflection');
  assert.equal(team.state, 'waiting');
  assert.equal(team.source, 'codex');
  await assert.rejects(cli(['run', 'intake', '--', 'platop-command-that-does-not-exist']), error => error.code === 127);
  assert.equal((await state()).teams.find(item => item.teamId === 'intake').state, 'waiting');
});

test('CLI run publishes active before executing the command', async t => {
  const { bridge, cli } = await fixture(t);
  const script = `const s=await fetch('http://127.0.0.1:${bridge.port}/api/state').then(r=>r.json()); process.exit(s.teams.find(t=>t.teamId==='merchant').state==='active'?0:9)`;
  await cli(['run', 'merchant', '--', process.execPath, '--input-type=module', '-e', script]);
});
