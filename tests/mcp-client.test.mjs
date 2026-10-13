import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, access, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createBridge } from '../server/index.mjs';
import { TEAM_IDS, STATES } from '../server/protocol.mjs';

const exec = promisify(execFile);
const FAILURE = 'PLaTOP MCP activity is unconfirmed. Check the local bridge and public team/state arguments.';
const SNAPSHOT = { app: 'platop', schemaVersion: 1, serverTime: '2026-10-12T12:00:00.000Z',
  teams: TEAM_IDS.map(teamId => ({ teamId, state: 'unknown', source: 'skill', updatedAt: null })) };
const TOOLS = [{ name: 'platop_status', inputSchema: { additionalProperties: false } },
  { name: 'platop_set_activity', inputSchema: { additionalProperties: false,
    properties: { teamId: { enum: TEAM_IDS }, state: { enum: STATES } } } }];

async function fixture(t, body) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'platop-mcp-client-')));
  await Promise.all(['scripts', 'server', 'dist'].map(name => mkdir(path.join(root, name))));
  await copyFile(new URL('../scripts/platop-mcp-client.mjs', import.meta.url), path.join(root, 'scripts/platop-mcp-client.mjs'));
  await copyFile(new URL('../server/protocol.mjs', import.meta.url), path.join(root, 'server/protocol.mjs'));
  await copyFile(new URL('../server/office-protocol.mjs', import.meta.url), path.join(root, 'server/office-protocol.mjs'));
  await copyFile(new URL('../server/office-cli.mjs', import.meta.url), path.join(root, 'server/office-cli.mjs'));
  await copyFile(new URL('../server/client.mjs', import.meta.url), path.join(root, 'server/client.mjs'));
  if (body !== undefined) await writeFile(path.join(root, 'scripts/platop-mcp.mjs'), body);
  t.after(() => rm(root, { recursive: true, force: true }));
  const cli = (args, extra = {}) => exec(process.execPath, [path.join(root, 'scripts/platop-mcp-client.mjs'), ...args], {
    env: { ...process.env, PLATOP_ROOT: root, ...extra }, timeout: 12_000, maxBuffer: 32_768,
  });
  return { root, cli };
}

function server(change = '') {
  return `import { createInterface } from 'node:readline';
import { appendFileSync, writeFileSync } from 'node:fs';
const tools = ${JSON.stringify(TOOLS)};
const snapshot = ${JSON.stringify(SNAPSHOT)};
let initialized = false;
const lines = createInterface({input: process.stdin});
lines.on('line', line => {
  const message = JSON.parse(line);
  appendFileSync(new URL('../methods.jsonl', import.meta.url), JSON.stringify(message) + '\\n');
  if (message.method === 'notifications/initialized') { initialized = true; return; }
  let result = message.method === 'initialize'
    ? {protocolVersion:'2025-11-25', serverInfo:{name:'platop'}, capabilities:{tools:{}}}
    : message.method === 'tools/list' ? {tools}
    : {isError:false, structuredContent:snapshot, content:[{type:'text',text:'PRIVATE_CHILD_TEXT'}]};
  if (message.method === 'tools/call' && message.params.name === 'platop_set_activity') {
    const team = snapshot.teams.find(team => team.teamId === message.params.arguments.teamId);
    Object.assign(team, {state:message.params.arguments.state, source:'skill', updatedAt:snapshot.serverTime});
  }
  let response = {jsonrpc:'2.0',id:message.id,result};
  if (message.method !== 'initialize' && !initialized) throw Error('Initialization was skipped');
  ${change}
  process.stdout.write(JSON.stringify(response)+'\\n');
});`;
}

function sanitized(error) {
  assert.equal(error.code, 1);
  assert.equal(error.stdout, '');
  assert.equal(error.stderr.trim(), FAILURE);
  return true;
}

test('local MCP client uses actual initialize/list/call protocol and authenticated skill-source activity', async t => {
  const { root, cli } = await fixture(t);
  await copyFile(new URL('../scripts/platop-mcp.mjs', import.meta.url), path.join(root, 'scripts/platop-mcp.mjs'));
  await copyFile(new URL('../server/client.mjs', import.meta.url), path.join(root, 'server/client.mjs'));
  const bridge = await createBridge({ root, port: 0 });
  t.after(() => bridge.close());
  const env = { PLATOP_PORT: String(bridge.port) };
  const initial = JSON.parse((await cli(['status'], env)).stdout);
  assert.ok(initial.teams.every(team => team.state === 'unknown'));
  for (const state of STATES) {
    assert.equal((await cli(['set', 'intake', state], env)).stdout.trim(), `PLaTOP MCP: intake ${state}.`);
    const snapshot = JSON.parse((await cli(['status'], env)).stdout);
    const team = snapshot.teams.find(team => team.teamId === 'intake');
    assert.equal(team.state, state);
    assert.equal(team.source, 'skill');
    assert.ok(team.updatedAt);
  }
  const token = (await readFile(path.join(root, '.local/token'), 'utf8')).trim();
  assert.ok(!JSON.stringify(initial).includes(token));
});

test('fixed sibling server receives ordered handshake and only exact public arguments', async t => {
  const { root, cli } = await fixture(t, server());
  assert.equal((await cli(['set', 'email', 'active'])).stdout.trim(), 'PLaTOP MCP: email active.');
  const messages = (await readFile(path.join(root, 'methods.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(messages.map(message => message.method), ['initialize', 'notifications/initialized', 'tools/list', 'tools/call']);
  assert.deepEqual(messages[3].params, { name: 'platop_set_activity', arguments: { teamId: 'email', state: 'active' } });
  assert.equal(messages[0].params.clientInfo.name, 'platop-local-client');
});

test('invalid private, path, command and source arguments are rejected before spawning', async t => {
  const { root, cli } = await fixture(t, server());
  for (const args of [
    ['set', 'private-thread', 'active'], ['set', 'email', 'working'],
    ['set', 'email', 'active', '--source', 'codex'], ['status', '--server', '/private/path'],
    ['run', 'email', '--', 'echo', 'PRIVATE_COMMAND'], ['snapshot', '/private/file'],
  ]) await assert.rejects(cli(args), sanitized);
  const clientUrl = new URL(`file://${path.join(root, 'scripts/platop-mcp-client.mjs')}`).href;
  for (const args of [
    { teamId: 'email', state: 'active', token: 'PRIVATE_TOKEN' },
    { teamId: 'email', state: 'active', source: 'manual' },
    { teamId: 'email', state: 'active', command: 'PRIVATE_COMMAND' },
  ]) {
    const result = await exec(process.execPath, ['--input-type=module', '-e',
      `import {callPlatopMcp} from ${JSON.stringify(clientUrl)}; try {await callPlatopMcp('platop_set_activity',${JSON.stringify(args)});} catch(e) {console.log(e.message);}`]);
    assert.equal(result.stdout.trim(), FAILURE);
  }
  await assert.rejects(access(path.join(root, 'methods.jsonl')));
});

test('public API captures validated argument values before caller mutation or getter changes', async t => {
  const { root } = await fixture(t, server());
  const clientUrl = new URL(`file://${path.join(root, 'scripts/platop-mcp-client.mjs')}`).href;
  const result = await exec(process.execPath, ['--input-type=module', '-e', `
    import {callPlatopMcp} from ${JSON.stringify(clientUrl)};
    const args={}; const status=callPlatopMcp('platop_status',args);
    args.private='PRIVATE_MUTATION'; await status;
    let reads=0;
    const changing={get teamId(){return reads++===0?'email':'PRIVATE_GETTER';},state:'active'};
    await callPlatopMcp('platop_set_activity',changing);
    console.log(reads);
  `]);
  assert.equal(result.stdout.trim(), '1');
  assert.equal(result.stderr, '');
  const calls = (await readFile(path.join(root, 'methods.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
    .filter(message => message.method === 'tools/call');
  assert.deepEqual(calls.map(call => call.params.arguments), [{}, { teamId: 'email', state: 'active' }]);
  assert.ok(!JSON.stringify(calls).includes('PRIVATE'));
});

test('missing MCP server and unavailable bridge produce only sanitized unconfirmed errors', async t => {
  const missing = await fixture(t);
  await assert.rejects(missing.cli(['status']), sanitized);
  const unavailable = await fixture(t);
  await copyFile(new URL('../scripts/platop-mcp.mjs', import.meta.url), path.join(unavailable.root, 'scripts/platop-mcp.mjs'));
  await copyFile(new URL('../server/client.mjs', import.meta.url), path.join(unavailable.root, 'server/client.mjs'));
  // Invalid local port fails before any network request or private token read.
  await assert.rejects(unavailable.cli(['status'], { PLATOP_PORT: '0' }), sanitized);
});

test('malformed, mismatched and unexpected protocol responses fail closed without leaking child text', async t => {
  for (const mutate of [
    "process.stdout.write('PRIVATE_BAD_JSON\\n'); return;",
    'response.id = 999;',
    "response.jsonrpc = '1.0';",
    "response.error = {code:-1,message:'PRIVATE_ERROR'};",
    "if(message.method==='initialize') result.serverInfo.name='PRIVATE_SERVER';",
    "if(message.method==='initialize') result.protocolVersion='2024-11-05';",
    "if(message.method==='tools/list') result.tools=[{name:'execute_command'}];",
    "if(message.method==='tools/list') result.tools.push({name:'execute_command',inputSchema:{additionalProperties:false}});",
    "if(message.method==='tools/list') result.tools.push(result.tools[0]);",
    "if(message.method==='tools/call') result.isError=true;",
    "if(message.method==='tools/call') result.structuredContent.teams[0].teamId='PRIVATE_TEAM';",
  ]) {
    const { cli } = await fixture(t, server(mutate));
    await assert.rejects(cli(['status']), sanitized);
  }
});

test('public snapshots strip child content and unexpected private response fields', async t => {
  const { cli } = await fixture(t, server("if(message.method==='tools/call') { result.structuredContent.token='PRIVATE_TOKEN'; result.structuredContent.teams[0].chat='PRIVATE_CHAT'; }"));
  const response = await cli(['status']);
  assert.deepEqual(JSON.parse(response.stdout), SNAPSHOT);
  assert.equal(response.stderr, '');
  assert.ok(!response.stdout.includes('PRIVATE'));
});

test('an unconfirmed or failed write is never acknowledged or retried', async t => {
  for (const change of [
    "if(message.method==='tools/call') result.structuredContent.teams.find(team=>team.teamId==='email').state='unknown';",
    "if(message.method==='tools/call') result.structuredContent.teams.find(team=>team.teamId==='email').source='manual';",
    "if(message.method==='tools/call') result.structuredContent.teams.find(team=>team.teamId==='email').updatedAt=null;",
    "if(message.method==='tools/call') { process.stdout.write(JSON.stringify(response)+'\\n'); process.exitCode=7; lines.close(); process.stdin.destroy(); return; }",
  ]) {
    const { root, cli } = await fixture(t, server(change));
    await assert.rejects(cli(['set', 'email', 'active']), sanitized);
    const messages = (await readFile(path.join(root, 'methods.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(messages.filter(message => message.method === 'tools/call').length, 1);
  }
});

test('early exit, partial JSON and unsolicited extra replies fail without retaining output', async t => {
  for (const change of [
    'process.exit(0);',
    "process.stdout.write('{\\\"private\\\":\\\"PRIVATE\\\"'); lines.close(); process.stdin.destroy(); return;",
    "if(message.method==='tools/call') process.stdout.write(JSON.stringify(response)+'\\n');",
  ]) {
    const { cli } = await fixture(t, server(change));
    await assert.rejects(cli(['status']), sanitized);
  }
});

test('stdout message/total limits and discarded stderr limits terminate the server', async t => {
  for (const change of [
    "process.stdout.write('PRIVATE'+'x'.repeat(525_000)); return;",
    "process.stdout.write('x'.repeat(1_050_000)); return;",
    "process.stderr.write('PRIVATE'+'x'.repeat(9000)); return;",
  ]) {
    const { cli } = await fixture(t, server(change));
    const start = performance.now();
    await assert.rejects(cli(['status']), sanitized);
    assert.ok(performance.now() - start < 3000, 'oversized output should fail without waiting for timeout');
  }
});

test('unrelated secrets and Node preload settings are not inherited by the MCP child', async t => {
  const { root, cli } = await fixture(t, server("if(process.env.PRIVATE_SENTINEL || process.env.NODE_OPTIONS || process.env.NODE_PATH) throw Error('Unexpected inherited environment');"));
  const response = await cli(['status'], { PRIVATE_SENTINEL: 'PRIVATE_VALUE', NODE_PATH: '/private/modules' });
  assert.deepEqual(JSON.parse(response.stdout), SNAPSHOT);
  const clientUrl = new URL(`file://${path.join(root, 'scripts/platop-mcp-client.mjs')}`).href;
  const result = await exec(process.execPath, ['--input-type=module', '-e',
    `process.env.NODE_OPTIONS='--require /private/preload'; const {callPlatopMcp}=await import(${JSON.stringify(clientUrl)}); console.log(JSON.stringify(await callPlatopMcp('platop_status')));`]);
  assert.deepEqual(JSON.parse(result.stdout), SNAPSHOT);
  assert.equal(result.stderr, '');
});

test('bounded timeout kills a stalled TERM-resistant child and leaves no process behind', async t => {
  const { root, cli } = await fixture(t, `import {writeFileSync} from 'node:fs';
writeFileSync(new URL('../child.pid', import.meta.url), String(process.pid));
process.on('SIGTERM',()=>{}); process.stdin.resume(); setInterval(()=>{},1000);`);
  const start = performance.now();
  await assert.rejects(cli(['status']), sanitized);
  const duration = performance.now() - start;
  assert.ok(duration >= 7900 && duration < 10_000, `client timeout should remain bounded: ${duration}`);
  const pid = Number(await readFile(path.join(root, 'child.pid'), 'utf8'));
  assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
});
