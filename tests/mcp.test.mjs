import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createBridge } from '../server/index.mjs';
import { requestActivity } from '../server/client.mjs';
import { TEAM_IDS, MAX_SNAPSHOT_BYTES } from '../server/protocol.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/platop-mcp.mjs', import.meta.url));
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'platop-mcp-'));
  await mkdir(path.join(root, 'dist'));
  const bridge = await createBridge({ root, port: 0 });
  const child = spawn(process.execPath, [SCRIPT], { env: { ...process.env, PLATOP_ROOT: root, PLATOP_PORT: String(bridge.port) }, stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = createInterface({ input: child.stdout });
  const waiters = new Map();
  const unsolicited = [];
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  lines.on('line', line => {
    const message = JSON.parse(line);
    const waiter = waiters.get(message.id);
    if (waiter) { waiters.delete(message.id); waiter(message); }
    else unsolicited.push(message);
  });
  let nextId = 0;
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { waiters.delete(id); reject(new Error('MCP response timeout.')); }, 10_000);
    waiters.set(id, message => { clearTimeout(timer); resolve(message); });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) })}\n`);
  });
  const initialize = async () => {
    const result = await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'platop-test', version: '1.0' } });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    return result;
  };
  t.after(async () => {
    child.stdin.end();
    await once(child, 'exit');
    await bridge.close();
    await rm(root, { recursive: true, force: true });
  });
  return { root, bridge, child, request, initialize, unsolicited, stderr: () => stderr };
}

test('MCP initializes, lists closed tools, and performs authenticated local set/status round trips', async t => {
  const { root, request, initialize, unsolicited, stderr } = await fixture(t);
  assert.equal((await request('tools/list')).error.code, -32002);
  const initialized = await initialize();
  assert.equal(initialized.result.protocolVersion, '2025-11-25');
  assert.deepEqual(initialized.result.capabilities, { tools: { listChanged: false } });
  const tools = (await request('tools/list')).result.tools;
  assert.deepEqual(tools.map(tool => tool.name), ['platop_status', 'platop_set_activity', 'platop_action', 'platop_decorate', 'platop_style']);
  assert.ok(tools.every(tool => tool.inputSchema.additionalProperties === false && tool.annotations.openWorldHint === false && tool.annotations.destructiveHint === false));
  assert.equal(tools[1].annotations.idempotentHint, false); // Active writes renew freshness.
  const initial = (await request('tools/call', { name: 'platop_status', arguments: {} })).result;
  assert.ok(initial.structuredContent.teams.every(team => team.state === 'unknown'));
  for (const state of ['active', 'waiting', 'sleeping', 'unknown']) {
    const result = (await request('tools/call', { name: 'platop_set_activity', arguments: { teamId: 'intake', state } })).result;
    assert.equal(result.isError, false);
    const team = result.structuredContent.teams.find(item => item.teamId === 'intake');
    assert.equal(team.state, state);
    assert.equal(team.source, 'skill');
  }
  const snapshot = (await request('tools/call', { name: 'platop_status' })).result.structuredContent;
  assert.deepEqual(snapshot.teams.map(team => team.teamId), TEAM_IDS);
  const token = (await readFile(path.join(root, '.local', 'token'), 'utf8')).trim();
  assert.ok(!JSON.stringify({ initialized, tools, snapshot, unsolicited }).includes(token));
  assert.equal(stderr(), '');
  assert.equal(unsolicited.length, 0);
});

test('MCP rejects private data, URLs, paths, commands and invalid tools without mutating activity', async t => {
  const { request, initialize } = await fixture(t);
  await initialize();
  const invalid = [
    { teamId: 'email', state: 'active', message: 'PRIVATE_MESSAGE' },
    { teamId: 'email', state: 'active', source: 'PRIVATE_SOURCE' },
    { teamId: 'private-thread-id', state: 'active' },
    { teamId: 'email', state: 'working' },
    { teamId: 'email', state: 'active', url: 'https://example.invalid' },
    { teamId: 'email', state: 'active', root: '/private/path' },
    { teamId: 'email', state: 'active', command: 'echo should-not-run' },
  ];
  for (const args of invalid) {
    const result = await request('tools/call', { name: 'platop_set_activity', arguments: args });
    assert.equal(result.error.code, -32602);
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  }
  assert.equal((await request('tools/call', { name: 'execute_command', arguments: {} })).error.code, -32602);
  assert.equal((await request('tools/call', { name: 'platop_status', arguments: { path: '/private/path' } })).error.code, -32602);
  assert.equal((await request('unknown/method')).error.code, -32601);
  assert.ok((await request('tools/call', { name: 'platop_status' })).result.structuredContent.teams.every(team => team.state === 'unknown'));
});

test('MCP office tools enforce owned actors and bounded data-only primitive capability', async t => {
  const { request, initialize } = await fixture(t);
  await initialize();
  const tools = (await request('tools/list')).result.tools;
  const action = tools.find(tool => tool.name === 'platop_action');
  const decorate = tools.find(tool => tool.name === 'platop_decorate');
  assert.equal(action.inputSchema.additionalProperties, false);
  assert.deepEqual(action.inputSchema.properties.kind.enum, ['walk_to', 'work', 'rest', 'celebrate', 'arrive', 'leave', 'interact']);
  assert.deepEqual(action.inputSchema.properties.gesture.enum, ['work', 'think', 'file', 'talk', 'wait']);
  assert.deepEqual(action.inputSchema.properties.motion.properties.pace.enum, ['unhurried', 'steady', 'brisk']);
  assert.deepEqual(action.inputSchema.properties.motion.properties.route.enum, ['direct', 'roomy']);
  assert.equal(action.inputSchema.properties.motion.additionalProperties, false);
  assert.equal(action.inputSchema.properties.motion.minProperties, 1);
  assert.deepEqual(action.inputSchema.properties.target.properties.place.enum, ['desk', 'door', 'lounge', 'whiteboard', 'cabinet']);
  assert.equal(decorate.inputSchema.properties.parts.maxItems, 24);
  assert.equal(decorate.inputSchema.properties.parts.items.additionalProperties, false);
  const arrived = (await request('tools/call', { name: 'platop_action', arguments: { teamId: 'email', kind: 'arrive' } })).result;
  assert.equal(arrived.isError, false);
  assert.equal(arrived.structuredContent.actions['email-owl'].kind, 'arrive');
  assert.deepEqual(arrived.structuredContent.actions['email-owl'].target, { officeId: 'email', place: 'door' });
  for (const [place, gesture] of [['whiteboard', 'think'], ['cabinet', 'file'], ['lounge', 'talk'], ['desk', 'work'], ['door', 'wait']]) {
    const motion = { pace: 'brisk', route: 'direct' };
    const interacted = (await request('tools/call', { name: 'platop_action', arguments: { teamId: 'email', kind: 'interact', target: { officeId: 'email', place }, gesture, motion } })).result;
    assert.deepEqual(interacted.structuredContent.actions['email-owl'].motion, motion);
    assert.equal(interacted.isError, false);
    assert.equal(interacted.structuredContent.actions['email-owl'].gesture, gesture);
    assert.equal(interacted.structuredContent.actions['email-owl'].target.place, place);
  }
  const decorated = (await request('tools/call', { name: 'platop_decorate', arguments: {
    teamId: 'email', slot: 'wall', parts: [{ shape: 'arch', finish: 'stone', color: '#abcdef', glow: true },
      { shape: 'vase', finish: 'lacquer' }, { shape: 'cushion', finish: 'fabric' }, { shape: 'dome' }],
  } })).result;
  assert.equal(decorated.isError, false);
  assert.equal(decorated.structuredContent.assets.email.wall.parts[0].glow, true);
  assert.deepEqual(decorated.structuredContent.assets.email.wall.parts.map(part => part.shape), ['arch', 'vase', 'cushion', 'dome']);
  assert.deepEqual(decorated.structuredContent.assets.email.wall.parts.map(part => part.finish), ['stone', 'lacquer', 'fabric', 'matte']);
  for (const [name, args] of [
    ['platop_action', { teamId: 'email', actorId: 'bridge-jarvis', kind: 'work' }],
    ['platop_action', { teamId: 'email', kind: 'work', target: { officeId: 'email', place: 'desk' } }],
    ['platop_action', { teamId: 'email', kind: 'leave', text: 'PRIVATE_CHAT' }],
    ['platop_action', { teamId: 'email', kind: 'interact', target: { officeId: 'email', place: 'whiteboard' } }],
    ['platop_action', { teamId: 'email', kind: 'interact', gesture: 'think' }],
    ['platop_action', { teamId: 'email', kind: 'interact', target: { officeId: 'email', place: 'cabinet' }, gesture: 'PRIVATE_THOUGHT' }],
    ['platop_action', { teamId: 'email', kind: 'work', gesture: 'work' }],
    ['platop_decorate', { teamId: 'email', slot: 'wall', parts: [{ shape: 'box', file: '/PRIVATE/file' }] }],
    ['platop_decorate', { teamId: 'email', slot: 'wall', parts: [{ shape: 'sphere', segments: 1000000 }] }],
    ['platop_decorate', { teamId: 'email', slot: 'wall', parts: Array.from({ length: 25 }, () => ({ shape: 'box' })) }],
  ]) {
    const result = await request('tools/call', { name, arguments: args });
    assert.equal(result.error.code, -32602);
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  }
  const cleared = (await request('tools/call', { name: 'platop_decorate', arguments: { teamId: 'email', slot: 'wall', parts: [] } })).result;
  assert.equal(cleared.isError, false);
  assert.equal(cleared.structuredContent.assets, undefined);
});

test('MCP room studio exposes compact closed style choices and rejects nonvisual authority', async t => {
  const { request, initialize } = await fixture(t);
  await initialize();
  const tool = (await request('tools/list')).result.tools.find(tool => tool.name === 'platop_style');
  assert.equal(tool.inputSchema.additionalProperties, false);
  assert.equal(tool.inputSchema.properties.palette.additionalProperties, false);
  assert.equal(tool.inputSchema.properties.lighting.additionalProperties, false);
  assert.deepEqual(tool.inputSchema.properties.lighting.properties.mode.enum, ['day', 'cozy', 'night', 'off']);
  assert.equal(tool.inputSchema.properties.lighting.properties.ambientBrightness.maximum, 1.5);
  assert.deepEqual(tool.inputSchema.properties.lighting.properties.ambientPosition.prefixItems.map(axis => [axis.minimum, axis.maximum]),
    [[-2.5, 2.5], [0.6, 3], [-2.5, 2.5]]);
  const styled = (await request('tools/call', { name: 'platop_style', arguments: {
    teamId: 'support', palette: { wall: '#284E39', furniture: '#7a5239' }, lighting: { color: '#FFCC88', brightness: 0.7, mode: 'cozy',
      ambientColor: '#AABBCC', ambientBrightness: 0.2, ambientPosition: [-2, 1.5, 2] },
  } })).result;
  assert.equal(styled.isError, false);
  assert.deepEqual(styled.structuredContent.rooms.support.palette, { wall: '#284e39', furniture: '#7a5239' });
  assert.deepEqual(styled.structuredContent.rooms.support.lighting, { color: '#ffcc88', brightness: 0.7, mode: 'cozy',
    ambientColor: '#aabbcc', ambientBrightness: 0.2, ambientPosition: [-2, 1.5, 2] });
  for (const argumentsValue of [
    { teamId: 'support', palette: { wall: '#123456', url: 'PRIVATE_URL' } },
    { teamId: 'support', lighting: { mode: 'cozy', schedule: 'PRIVATE' } },
    { teamId: 'support', lighting: { brightness: 1000000 } },
    { teamId: 'support', lighting: { ambientBrightness: 1000000 } },
    { teamId: 'support', lighting: { ambientPosition: [0, 0, 0] } },
    { teamId: 'support', lighting: { ambientPosition: [3, 2, 0] } },
    { teamId: 'support', lighting: { mode: 'off' }, command: 'PRIVATE' },
    { teamId: 'support', reset: true, palette: { wall: '#123456' } },
  ]) {
    const rejected = await request('tools/call', { name: 'platop_style', arguments: argumentsValue });
    assert.equal(rejected.error.code, -32602);
    assert.ok(!JSON.stringify(rejected).includes('PRIVATE'));
  }
  const reset = (await request('tools/call', { name: 'platop_style', arguments: { teamId: 'support', reset: true } })).result;
  assert.equal(reset.isError, false);
  assert.equal(reset.structuredContent.rooms, undefined);
});

test('MCP reports visualization failure without exposing token or paths, then recovers', async t => {
  const { root, request, initialize } = await fixture(t);
  await initialize();
  const tokenFile = path.join(root, '.local', 'token');
  const token = await readFile(tokenFile, 'utf8');
  await rm(tokenFile);
  const result = (await request('tools/call', { name: 'platop_set_activity', arguments: { teamId: 'merchant', state: 'active' } })).result;
  assert.equal(result.isError, true);
  assert.ok(!JSON.stringify(result).includes(root));
  assert.ok(!JSON.stringify(result).includes(token.trim()));
  assert.match(result.content[0].text, /Continue the authorized task/);
  assert.equal((await request('ping')).result.constructor, Object);
  assert.equal((await request('tools/call', { name: 'platop_status' })).result.isError, false);
});

test('MCP bounds messages and recovers after malformed input without reflecting content', async t => {
  const { child, request, initialize, unsolicited } = await fixture(t);
  await initialize();
  child.stdin.write('{"private":"PRIVATE_BAD_JSON"\n');
  child.stdin.write(`${'x'.repeat(20_000)}\n`);
  await request('ping');
  assert.equal(unsolicited.length, 2);
  assert.ok(unsolicited.every(item => item.error.code === -32700));
  assert.ok(!JSON.stringify(unsolicited).includes('PRIVATE_BAD_JSON'));
});

test('local activity client never follows redirects carrying the private write token', async t => {
  const { root } = await fixture(t);
  let destinationHits = 0;
  const destination = http.createServer((req, res) => { destinationHits++; res.end('{}'); });
  await new Promise(resolve => destination.listen(0, '127.0.0.1', resolve));
  const redirect = http.createServer((req, res) => { res.writeHead(307, { Location: `http://127.0.0.1:${destination.address().port}/capture` }); res.end(); });
  await new Promise(resolve => redirect.listen(0, '127.0.0.1', resolve));
  t.after(() => Promise.all([new Promise(resolve => destination.close(resolve)), new Promise(resolve => redirect.close(resolve))]));
  await assert.rejects(requestActivity({ teamId: 'support', state: 'active' }, { root, port: redirect.address().port }));
  assert.equal(destinationHits, 0);
});

test('local activity client strips unexpected response fields and bounds oversized responses', async t => {
  let oversized = false;
  const snapshot = { app: 'platop', schemaVersion: 1, teams: TEAM_IDS.map(teamId => ({ teamId, state: 'unknown', source: 'manual', updatedAt: null, private: 'PRIVATE' })), serverTime: new Date().toISOString(), token: 'PRIVATE' };
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(oversized ? { ...snapshot, extra: 'x'.repeat(MAX_SNAPSHOT_BYTES) } : snapshot)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  assert.ok(!JSON.stringify(await requestActivity(undefined, { port: server.address().port })).includes('PRIVATE'));
  oversized = true;
  await assert.rejects(requestActivity(undefined, { port: server.address().port }));
});
