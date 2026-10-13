import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, stat, symlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import { createBridge } from '../server/index.mjs';
import { requestActivity, requestAction, requestDecoration, requestRoomStyle } from '../server/client.mjs';
import { TEAM_IDS, MAX_SNAPSHOT_BYTES } from '../server/protocol.mjs';
import { TEAM_ACTORS, ACTOR_IDS, ACTION_KINDS, ACTION_GESTURES, PLACES, DECOR_SHAPES, DECOR_FINISHES, DECOR_SLOTS, ROOM_LIGHT_MODES, parseAction, parseDecoration, parseOfficeSnapshot, parseRoomStyle } from '../server/office-protocol.mjs';
import { parseOfficeCommand } from '../server/office-cli.mjs';

const exec = promisify(execFile);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ASSET = { teamId: 'merchant', slot: 'desk', parts: [{ shape: 'box', color: '#A1B2C3', glow: true }] };
const ACTION = { teamId: 'merchant', kind: 'walk_to', target: { officeId: 'hr', place: 'lounge' } };
const STYLE = { teamId: 'merchant', palette: { wall: '#A1B2C3' }, lighting: { mode: 'cozy', brightness: 0.8 } };

async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'platop-office-'));
  await mkdir(path.join(root, 'dist'));
  const bridge = await createBridge({ root, port: 0, ...options });
  const token = (await readFile(path.join(root, '.local/token'), 'utf8')).trim();
  t.after(async () => { await bridge.close(); await rm(root, { recursive: true, force: true }); });
  const request = async (route = '/api/state', { body, auth = false, headers = {} } = {}) => {
    const response = await fetch(`http://127.0.0.1:${bridge.port}${route}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(auth ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
    return { status: response.status, text: await response.text() };
  };
  const client = { root, port: bridge.port };
  return { root, bridge, token, request, client };
}

test('server public actor ownership exactly matches the actual frontend roster', async () => {
  const source = await readFile(new URL('../src/teams.ts', import.meta.url), 'utf8');
  const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const { teams } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
  assert.deepEqual(TEAM_ACTORS, Object.fromEntries(teams.map(team => [team.id, team.members.map(member => member.id)])));
  assert.equal(new Set(ACTOR_IDS).size, 16);
  assert.deepEqual(Object.keys(TEAM_ACTORS), TEAM_IDS);
});

test('actions default owned actors, normalize arrival targets and permit only named public places', () => {
  assert.deepEqual(parseAction(ACTION), { ...ACTION, actorId: 'bridge-jarvis' });
  assert.deepEqual(parseAction({ teamId: 'email', kind: 'arrive' }),
    { teamId: 'email', actorId: 'email-owl', kind: 'arrive', target: { officeId: 'email', place: 'door' } });
  for (const kind of ACTION_KINDS.filter(kind => !['walk_to', 'interact'].includes(kind))) assert.equal(parseAction({ teamId: 'hr', kind }).kind, kind);
  for (const kind of ['walk_to', 'arrive']) for (const place of PLACES) assert.equal(parseAction({ teamId: 'hr', kind, target: { officeId: 'email', place } }).target.place, place);
  for (const value of [
    { ...ACTION, actorId: 'email-owl' }, { ...ACTION, actorId: 'private-thread' },
    { teamId: 'merchant', kind: 'walk_to' }, { teamId: 'merchant', kind: 'work', target: ACTION.target },
    { ...ACTION, target: { officeId: 'hr', place: 'private' } }, { ...ACTION, target: { officeId: 'hr', place: 'desk', x: 2 } },
    { ...ACTION, id: 'caller-controlled' }, { ...ACTION, text: 'PRIVATE' }, { ...ACTION, kind: 'eval' },
  ]) assert.throws(() => parseAction(value));
});

test('interact requires the agent-chosen gesture and named target, with no gesture on other actions', () => {
  const interaction = { teamId: 'hr', kind: 'interact', target: { officeId: 'merchant', place: 'whiteboard' }, gesture: 'think' };
  assert.deepEqual(parseAction(interaction), { ...interaction, actorId: 'hr-compass' });
  for (const gesture of ACTION_GESTURES) for (const place of PLACES) {
    const parsed = parseAction({ ...interaction, actorId: 'hr-lens', gesture, target: { officeId: 'email', place } });
    assert.equal(parsed.gesture, gesture); assert.equal(parsed.target.place, place);
  }
  for (const value of [
    { teamId: 'hr', kind: 'interact', gesture: 'think' },
    { teamId: 'hr', kind: 'interact', target: interaction.target },
    { ...interaction, gesture: 'PRIVATE_THOUGHT' }, { ...interaction, gesture: null },
    { ...interaction, gesture: { thought: 'PRIVATE' } }, { ...interaction, duration: 999 },
    { ...interaction, actorId: 'email-owl' }, { ...interaction, reasoning: 'PRIVATE' },
    { ...interaction, target: { officeId: 'merchant', place: 'whiteboard', text: 'PRIVATE' } },
    ...ACTION_KINDS.filter(kind => kind !== 'interact').map(kind => ({ teamId: 'hr', kind, gesture: 'wait', ...(['walk_to', 'arrive'].includes(kind) ? { target: interaction.target } : {}) })),
  ]) assert.throws(() => parseAction(value));
  const input = structuredClone(interaction), normalized = parseAction(input);
  input.target.place = 'PRIVATE'; input.gesture = 'PRIVATE';
  assert.equal(normalized.target.place, 'whiteboard'); assert.equal(normalized.gesture, 'think');
  const id = '00000000-0000-4000-8000-000000000001';
  const action = { id, actorId: 'hr-compass', kind: 'interact', target: interaction.target, gesture: 'think' };
  assert.deepEqual(parseOfficeSnapshot({ actions: { 'hr-compass': action } }).actions['hr-compass'], action);
  for (const invalid of [{ ...action, gesture: undefined }, { ...action, target: undefined },
    { ...action, kind: 'work' }, { ...action, private: 'PRIVATE' }]) assert.throws(() => parseOfficeSnapshot({ actions: { 'hr-compass': invalid } }));
});

test('interactions preserve the chosen gesture in current private persistence and sanitized restart readback', async t => {
  const { root, request, client } = await fixture(t);
  for (const [place, gesture] of [['whiteboard', 'think'], ['cabinet', 'file'], ['lounge', 'wait']]) {
    const snapshot = await requestAction({ teamId: 'hr', actorId: 'hr-lens', kind: 'interact', target: { officeId: 'hr', place }, gesture }, client);
    assert.equal(snapshot.actions['hr-lens'].gesture, gesture);
    assert.equal(snapshot.actions['hr-lens'].target.place, place);
    assert.match(snapshot.actions['hr-lens'].id, UUID);
  }
  const before = await requestActivity(undefined, client);
  const rejected = await request('/api/actions', { auth: true, body: { teamId: 'hr', kind: 'interact', target: { officeId: 'hr', place: 'cabinet' }, gesture: 'PRIVATE_THOUGHT' } });
  assert.equal(rejected.status, 400); assert.ok(!rejected.text.includes('PRIVATE'));
  assert.deepEqual((await requestActivity(undefined, client)).actions, before.actions);
  const saved = JSON.parse(await readFile(path.join(root, '.local/office.json'), 'utf8'));
  assert.deepEqual(saved.actions, before.actions);
  assert.deepEqual(Object.keys(saved.actions), ['hr-lens']);
  assert.equal((await stat(path.join(root, '.local/office.json'))).mode & 0o777, 0o600);
  const restarted = await createBridge({ root, port: 0 }); t.after(() => restarted.close());
  assert.deepEqual((await requestActivity(undefined, { root, port: restarted.port })).actions, before.actions);
});

test('primitive recipes normalize defaults and reject unbounded counts, values, extents and private fields', () => {
  const normalized = parseDecoration(ASSET);
  assert.deepEqual(normalized.parts[0], { shape: 'box', position: [0, 0, 0], size: [0.3, 0.3, 0.3], rotation: [0, 0, 0], color: '#a1b2c3', glow: true, finish: 'matte' });
  for (const shape of DECOR_SHAPES) assert.equal(parseDecoration({ ...ASSET, parts: [{ shape }] }).parts[0].shape, shape);
  for (const finish of DECOR_FINISHES) assert.equal(parseDecoration({ ...ASSET, parts: [{ shape: 'capsule', finish }] }).parts[0].finish, finish);
  for (const part of [
    { shape: 'plane' }, { shape: 'box', text: 'PRIVATE' }, { shape: 'box', url: 'https://example.invalid' },
    { shape: 'box', color: 'red' }, { shape: 'box', color: '#fff' }, { shape: 'box', color: '#123456;evil' },
    { shape: 'box', size: [0, 1, 1] }, { shape: 'box', size: [2, 1, 1] },
    { shape: 'box', size: [NaN, 0.3, 0.3] }, { shape: 'box', position: [Infinity, 0, 0] },
    { shape: 'box', position: [1.2, 0, 0], size: [1.2, 1.2, 1.2] },
    { shape: 'box', rotation: [0, 4, 0] }, { shape: 'box', glow: 'yes' },
    { shape: 'box', segments: 1000000 }, { shape: 'box', position: [0, 0] }, { shape: 'box', finish: 'shader' },
  ]) assert.throws(() => parseDecoration({ ...ASSET, parts: [part] }));
  for (const value of [
    { ...ASSET, parts: Array.from({ length: 13 }, () => ({ shape: 'box' })) },
    { ...ASSET, parts: new Array(2) }, { ...ASSET, slot: 'private-slot' }, { ...ASSET, teamId: 'private-team' },
    { ...ASSET, path: '/private/file' }, { ...ASSET, source: 'manual' },
  ]) assert.throws(() => parseDecoration(value));
  const input = { ...ASSET, parts: [{ shape: 'box', position: [0, 0, 0] }] };
  const copy = parseDecoration(input);
  input.parts[0].position[0] = 900;
  assert.equal(copy.parts[0].position[0], 0);
});

test('office HTTP writes require existing local token/origin protections and sanitized bounded JSON', async t => {
  const { request, token } = await fixture(t);
  for (const [route, body] of [['/api/actions', ACTION], ['/api/assets', ASSET], ['/api/rooms', STYLE]]) {
    assert.equal((await request(route, { body })).status, 401);
    assert.equal((await request(route, { body, auth: true, headers: { Origin: 'https://example.invalid' } })).status, 403);
    assert.equal((await request(route, { body, auth: true, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    assert.equal((await request(route, { body, auth: true, headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal((await request(route, { body: 'x'.repeat(8193), auth: true })).status, 413);
    const invalid = await request(route, { body: { ...body, token, path: '/private/file', text: 'PRIVATE_TEXT' }, auth: true });
    assert.equal(invalid.status, 400);
    assert.ok(!invalid.text.includes(token) && !invalid.text.includes('PRIVATE'));
  }
  const snapshot = JSON.parse((await request()).text);
  assert.equal(snapshot.actions, undefined);
  assert.equal(snapshot.assets, undefined);
  assert.equal(snapshot.rooms, undefined);
});

test('room style accepts only explicit bounded visual overrides and exclusive reset', () => {
  assert.deepEqual(parseRoomStyle(STYLE), { ...STYLE, palette: { wall: '#a1b2c3' } });
  for (const mode of ROOM_LIGHT_MODES) assert.equal(parseRoomStyle({ teamId: 'hr', lighting: { mode } }).lighting.mode, mode);
  assert.deepEqual(parseRoomStyle({ teamId: 'hr', reset: true }), { teamId: 'hr', reset: true });
  for (const value of [
    { teamId: 'hr' }, { teamId: 'hr', palette: {} }, { teamId: 'hr', lighting: {} },
    { ...STYLE, palette: { wall: 'red' } }, { ...STYLE, palette: { wall: '#fff' } },
    { ...STYLE, palette: { wall: '#123456', text: 'PRIVATE' } },
    { ...STYLE, lighting: { mode: 'automatic', schedule: 'PRIVATE' } },
    ...[-0.1, 1.6, NaN, Infinity, '1'].map(brightness => ({ teamId: 'hr', lighting: { brightness } })),
    { teamId: 'hr', lighting: { color: 'https://PRIVATE' } },
    { teamId: 'hr', reset: false }, { ...STYLE, reset: true },
    { ...STYLE, command: 'PRIVATE' }, { ...STYLE, path: '/PRIVATE/file' }, { ...STYLE, teamId: 'PRIVATE' },
  ]) assert.throws(() => parseRoomStyle(value));
  const input = structuredClone(STYLE);
  const copy = parseRoomStyle(input);
  input.palette.wall = '#000000'; input.lighting.brightness = 100;
  assert.equal(copy.palette.wall, '#a1b2c3'); assert.equal(copy.lighting.brightness, 0.8);
  const id = '00000000-0000-4000-8000-000000000001';
  for (const rooms of [
    { hr: { id, palette: {}, lighting: {} } },
    { hr: { id, palette: { wall: '#123456' }, lighting: {}, label: 'PRIVATE' } },
    { hr: { id: 'PRIVATE', palette: { wall: '#123456' }, lighting: {} } },
    { PRIVATE: { id, palette: { wall: '#123456' }, lighting: {} } },
  ]) assert.throws(() => parseOfficeSnapshot({ rooms }));
});

test('room style merges sparse choices, stays idempotent and persists privately; reset restores authored defaults', async t => {
  const { root, client } = await fixture(t);
  const first = await requestRoomStyle(STYLE, client);
  const style = first.rooms.merchant;
  assert.match(style.id, UUID);
  assert.deepEqual(style.palette, { wall: '#a1b2c3' });
  assert.deepEqual(style.lighting, STYLE.lighting);
  assert.equal((await requestRoomStyle(STYLE, client)).rooms.merchant.id, style.id);
  const next = await requestRoomStyle({ teamId: 'merchant', palette: { rug: '#123456' }, lighting: { color: '#FFEEDD' } }, client);
  assert.notEqual(next.rooms.merchant.id, style.id);
  assert.deepEqual(next.rooms.merchant.palette, { wall: '#a1b2c3', rug: '#123456' });
  assert.deepEqual(next.rooms.merchant.lighting, { mode: 'cozy', brightness: 0.8, color: '#ffeedd' });
  assert.equal(next.actions, undefined); assert.equal(next.assets, undefined);
  const saved = JSON.parse(await readFile(path.join(root, '.local/office.json'), 'utf8'));
  assert.deepEqual(saved.rooms, next.rooms);
  assert.ok(!JSON.stringify(saved).includes('updatedAt') && !JSON.stringify(saved).includes('history'));
  assert.equal((await stat(path.join(root, '.local/office.json'))).mode & 0o777, 0o600);
  const restarted = await createBridge({ root, port: 0 }); t.after(() => restarted.close());
  assert.deepEqual((await requestActivity(undefined, { root, port: restarted.port })).rooms, next.rooms);
  assert.equal((await requestRoomStyle({ teamId: 'merchant', reset: true }, client)).rooms, undefined);
  assert.equal((await requestRoomStyle({ teamId: 'merchant', reset: true }, client)).rooms, undefined);
  assert.equal(JSON.parse(await readFile(path.join(root, '.local/office.json'), 'utf8')).rooms, undefined);
});

test('current actions persist only server UUIDs per owned actor without altering activity expiry', async t => {
  let clock = Date.parse('2026-10-12T12:00:00Z');
  const { root, request, client } = await fixture(t, { now: () => clock });
  const first = await requestAction(ACTION, client);
  const action = first.actions['bridge-jarvis'];
  assert.match(action.id, UUID);
  assert.deepEqual(action.target, ACTION.target);
  const second = await requestAction({ teamId: 'merchant', kind: 'rest' }, client);
  assert.notEqual(second.actions['bridge-jarvis'].id, action.id);
  assert.equal(Object.keys(second.actions).length, 1);
  assert.equal(second.actions['bridge-jarvis'].target, undefined);
  await requestActivity({ teamId: 'merchant', state: 'active', source: 'skill' }, client);
  clock += 120_000;
  const expired = JSON.parse((await request()).text);
  assert.equal(expired.teams[0].state, 'unknown');
  assert.equal(expired.actions['bridge-jarvis'].id, second.actions['bridge-jarvis'].id);
  const saved = JSON.parse(await readFile(path.join(root, '.local/office.json'), 'utf8'));
  assert.deepEqual(Object.keys(saved), ['actions', 'assets']);
  assert.deepEqual(Object.keys(saved.actions), ['bridge-jarvis']);
  assert.equal(saved.actions['bridge-jarvis'].id, second.actions['bridge-jarvis'].id);
  assert.equal((await stat(path.join(root, '.local/office.json'))).mode & 0o777, 0o600);
  const restarted = await createBridge({ root, port: 0 });
  t.after(() => restarted.close());
  const restored = await requestActivity(undefined, { root, port: restarted.port });
  assert.deepEqual(restored.actions, second.actions);
});

test('slot replacement, identical recipes, clearing and full bounded office capacity stay current-only', async t => {
  const { root, client } = await fixture(t);
  const first = await requestDecoration(ASSET, client);
  const id = first.assets.merchant.desk.id;
  assert.match(id, UUID);
  const same = await requestDecoration(ASSET, client);
  assert.equal(same.assets.merchant.desk.id, id);
  const changed = await requestDecoration({ ...ASSET, parts: [{ shape: 'cone' }] }, client);
  assert.notEqual(changed.assets.merchant.desk.id, id);
  const parts = Array.from({ length: 12 }, (_, index) => ({ shape: DECOR_SHAPES[index % DECOR_SHAPES.length] }));
  for (const teamId of TEAM_IDS) for (const slot of DECOR_SLOTS) await requestDecoration({ teamId, slot, parts }, client);
  const full = await requestActivity(undefined, client);
  assert.equal(Object.values(full.assets).flatMap(slots => Object.values(slots)).length, 30);
  assert.ok(Buffer.byteLength(JSON.stringify(full)) < MAX_SNAPSHOT_BYTES);
  assert.ok((await stat(path.join(root, '.local/office.json'))).size < MAX_SNAPSHOT_BYTES);
  for (const teamId of TEAM_IDS) await requestRoomStyle({ teamId, palette: { wall: '#123456', rug: '#234567', furniture: '#345678' }, lighting: { color: '#456789', brightness: 1.5, mode: 'night' } }, client);
  const decoratedAndStyled = await requestActivity(undefined, client);
  assert.equal(Object.keys(decoratedAndStyled.rooms).length, TEAM_IDS.length);
  assert.ok(Buffer.byteLength(JSON.stringify(decoratedAndStyled)) < MAX_SNAPSHOT_BYTES);
  const mcp = fileURLToPath(new URL('../scripts/platop-mcp-client.mjs', import.meta.url));
  const viaMcp = await exec(process.execPath, [mcp, 'status'], { env: { ...process.env, PLATOP_ROOT: root, PLATOP_PORT: String(client.port) }, maxBuffer: 524_288, timeout: 12_000 });
  assert.deepEqual(JSON.parse(viaMcp.stdout).assets, full.assets);
  const cleared = await requestDecoration({ teamId: 'merchant', slot: 'desk', parts: [] }, client);
  assert.equal(cleared.assets.merchant.desk, undefined);
  assert.equal(Object.keys(cleared.assets.merchant).length, 4);
  assert.deepEqual(parseOfficeSnapshot(cleared).assets, cleared.assets);
});

test('full office capacity with precise vectors, finishes, actor intents and room styles stays below the bounded snapshot ceiling', async t => {
  const { root, client } = await fixture(t);
  const part = { shape: 'cylinder', position: Array(3).fill(-0.12345678901234566), size: Array(3).fill(1.1234567890123457),
    rotation: Array(3).fill(-3.1234567890123457), color: '#ffffff', finish: 'ceramic', glow: true };
  for (const teamId of TEAM_IDS) {
    for (const actorId of TEAM_ACTORS[teamId]) await requestAction({ teamId, actorId, kind: 'walk_to', target: { officeId: 'reflection', place: 'lounge' } }, client);
    for (const slot of DECOR_SLOTS) await requestDecoration({ teamId, slot, parts: Array(12).fill(part) }, client);
    await requestRoomStyle({ teamId, palette: { wall: '#123456', rug: '#234567', furniture: '#345678' },
      lighting: { color: '#456789', brightness: 1.1234567890123457, mode: 'night' } }, client);
  }
  const snapshot = await requestActivity(undefined, client);
  assert.equal(Object.keys(snapshot.actions).length, ACTOR_IDS.length);
  assert.equal(Object.values(snapshot.assets).flatMap(slots => Object.values(slots)).length, 30);
  assert.equal(Object.keys(snapshot.rooms).length, TEAM_IDS.length);
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) < MAX_SNAPSHOT_BYTES);
  assert.ok((await stat(path.join(root, '.local/office.json'))).size < MAX_SNAPSHOT_BYTES - 8192);
});

test('corrupt or symlinked office persistence never exposes private content or follows outside files', async t => {
  const { root } = await fixture(t);
  const file = path.join(root, '.local/office.json');
  await writeFile(file, JSON.stringify({ actions: {}, assets: {}, history: ['PRIVATE_HISTORY'] }));
  const corrupt = await createBridge({ root, port: 0 });
  t.after(() => corrupt.close());
  assert.equal((await requestActivity(undefined, { root, port: corrupt.port })).actions, undefined);
  await rm(file);
  const outside = path.join(root, 'outside-office.json');
  await writeFile(outside, 'PRIVATE_OUTSIDE');
  await symlink(outside, file);
  const linked = await createBridge({ root, port: 0 });
  t.after(() => linked.close());
  const snapshot = await requestActivity(undefined, { root, port: linked.port });
  assert.equal(snapshot.assets, undefined);
  assert.ok(!JSON.stringify(snapshot).includes('PRIVATE'));
  await requestAction({ teamId: 'hr', kind: 'work' }, { root, port: linked.port });
  assert.equal(await readFile(outside, 'utf8'), 'PRIVATE_OUTSIDE');
});

test('office persistence failure rolls back current state and queued concurrent actor updates stay bounded', async t => {
  const { root, client } = await fixture(t);
  const writes = await Promise.all(TEAM_IDS.flatMap(teamId => TEAM_ACTORS[teamId].map(actorId => requestAction({ teamId, actorId, kind: 'work' }, client))));
  const before = await requestActivity(undefined, client);
  assert.equal(Object.keys(before.actions).length, ACTOR_IDS.length);
  assert.ok(writes.every(snapshot => snapshot.actions));
  const file = path.join(root, '.local/office.json');
  await rm(file);
  await mkdir(file);
  await assert.rejects(requestAction({ teamId: 'merchant', kind: 'celebrate' }, client));
  await assert.rejects(requestDecoration(ASSET, client));
  await assert.rejects(requestRoomStyle(STYLE, client));
  const after = await requestActivity(undefined, client);
  assert.deepEqual(after.actions, before.actions);
  assert.equal(after.assets, undefined);
  assert.equal(after.rooms, undefined);
});

test('snapshots expose only committed office state during delayed or failed persistence', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'platop-office-commit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fsModule = path.join(root, 'delayed-fs.mjs');
  await writeFile(fsModule, `export {mkdir,lstat,chmod,readFile,rename,unlink} from 'node:fs/promises';
import {writeFile as actualWrite} from 'node:fs/promises';
let gate;
export function pauseNextWrite(){
  let release,enter;
  const pending=new Promise(resolve=>{release=resolve;});
  const started=new Promise(resolve=>{enter=resolve;});
  gate={pending,enter}; return {started,release};
}
export async function writeFile(...args){
  if(gate){const current=gate;gate=undefined;current.enter();if(await current.pending)throw Error('Controlled persistence failure');}
  return actualWrite(...args);
}`);
  const source = (await readFile(new URL('../server/office-store.mjs', import.meta.url), 'utf8'))
    .replace("from 'node:fs/promises'", "from './delayed-fs.mjs'")
    .replace("from './protocol.mjs'", `from ${JSON.stringify(new URL('../server/protocol.mjs', import.meta.url).href)}`)
    .replace("from './office-protocol.mjs'", `from ${JSON.stringify(new URL('../server/office-protocol.mjs', import.meta.url).href)}`);
  const storeFile = path.join(root, 'office-store-probe.mjs');
  await writeFile(storeFile, source);
  const { createOfficeStore } = await import(new URL(`file://${storeFile}`).href);
  const { pauseNextWrite } = await import(new URL(`file://${fsModule}`).href);
  const store = await createOfficeStore({ localDirectory: path.join(root, '.local') });
  const delayed = pauseNextWrite();
  const action = store.action({ teamId: 'support', kind: 'work' });
  await delayed.started;
  assert.deepEqual(store.snapshot(), {}, 'in-flight action must not be published before its file commits');
  delayed.release(false);
  await action;
  const committed = store.snapshot();
  assert.equal(committed.actions['support-beacon'].kind, 'work');
  const failed = pauseNextWrite();
  const decoration = store.decorate(ASSET);
  await failed.started;
  assert.deepEqual(store.snapshot(), committed, 'in-flight asset must not leak into reads');
  failed.release(true);
  await assert.rejects(decoration);
  assert.deepEqual(store.snapshot(), committed);
  await store.decorate(ASSET);
  assert.ok(store.snapshot().assets.merchant.desk);
  const beforeStyle = store.snapshot();
  const delayedStyle = pauseNextWrite();
  const pendingStyle = store.style(STYLE);
  await delayedStyle.started;
  assert.deepEqual(store.snapshot(), beforeStyle);
  delayedStyle.release(true);
  await assert.rejects(pendingStyle);
  assert.deepEqual(store.snapshot(), beforeStyle);
  await store.style(STYLE);
  assert.equal(store.snapshot().rooms.merchant.palette.wall, '#a1b2c3');
  const beforeInteraction = store.snapshot(), delayedInteraction = pauseNextWrite();
  const interaction = store.action({ teamId: 'support', kind: 'interact', target: { officeId: 'support', place: 'whiteboard' }, gesture: 'think' });
  await delayedInteraction.started;
  assert.deepEqual(store.snapshot(), beforeInteraction);
  delayedInteraction.release(false);
  await interaction;
  assert.equal(store.snapshot().actions['support-beacon'].gesture, 'think');
});

test('office SSE emits changed current data while identical recipes and absent clears stay quiet', async t => {
  const { bridge, client } = await fixture(t, { heartbeatMs: 20 });
  const controller = new AbortController();
  t.after(() => controller.abort());
  const response = await fetch(`http://127.0.0.1:${bridge.port}/api/events`, { signal: controller.signal });
  const reader = response.body.getReader();
  let received = '';
  async function until(predicate) {
    const deadline = Date.now() + 2000;
    while (!predicate(received)) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('Missing local office event.');
      let timer;
      try {
        const chunk = await Promise.race([reader.read(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Missing local office event.')), remaining); })]);
        if (chunk.done) throw new Error('Office stream ended.');
        received += new TextDecoder().decode(chunk.value);
      } finally { clearTimeout(timer); }
    }
  }
  await until(text => text.includes('event: state'));
  await requestDecoration(ASSET, client);
  await until(text => text.includes('"assets"'));
  const stateCount = received.split('event: state').length;
  received = received.replaceAll(': heartbeat', ': consumed');
  await requestDecoration(ASSET, client);
  await requestDecoration({ teamId: 'email', slot: 'wall', parts: [] }, client);
  await until(text => text.includes(': heartbeat'));
  assert.equal(received.split('event: state').length, stateCount);
  await requestAction({ teamId: 'support', kind: 'rest' }, client);
  await until(text => text.includes('"support-beacon"'));
  assert.equal(received.split('event: state').length, stateCount + 1);
  await requestRoomStyle(STYLE, client);
  await until(text => text.includes('"rooms"'));
  assert.equal(received.split('event: state').length, stateCount + 2);
  received = received.replaceAll(': heartbeat', ': consumed');
  await requestRoomStyle(STYLE, client);
  await requestRoomStyle({ teamId: 'email', reset: true }, client);
  await until(text => text.includes(': heartbeat'));
  assert.equal(received.split('event: state').length, stateCount + 2);
  await requestRoomStyle({ teamId: 'merchant', reset: true }, client);
  await until(text => text.split('event: state').length === stateCount + 3);
  controller.abort();
});

test('new direct CLI and actual stdio MCP transport preserve exact public action/recipe data', async t => {
  const { root, client } = await fixture(t);
  const env = { ...process.env, PLATOP_ROOT: root, PLATOP_PORT: String(client.port) };
  for (const name of ['platop.mjs', 'platop-mcp-client.mjs']) {
    const script = fileURLToPath(new URL(`../scripts/${name}`, import.meta.url));
    const cli = args => exec(process.execPath, [script, ...args], { env, timeout: 12_000, maxBuffer: 524_288 });
    assert.match((await cli(['action', 'email', 'arrive'])).stdout, /action queued/);
    assert.match((await cli(['action', 'email', 'walk_to', JSON.stringify({ actorId: 'email-swift', target: { officeId: 'intake', place: 'desk' } })])).stdout, /action queued/);
    assert.match((await cli(['action', 'email', 'interact', JSON.stringify({ actorId: 'email-owl', target: { officeId: 'email', place: 'cabinet' }, gesture: 'file' })])).stdout, /action queued/);
    assert.match((await cli(['decorate', 'email', 'festive', JSON.stringify([{ shape: 'torus', glow: true }])])).stdout, /decoration saved/);
    assert.match((await cli(['style', 'email', JSON.stringify({ palette: { wall: '#123456' }, lighting: { mode: 'night' } })])).stdout, /room style saved/);
    const snapshot = JSON.parse((await cli(['status'])).stdout);
    assert.equal(snapshot.actions['email-swift'].target.officeId, 'intake');
    assert.equal(snapshot.actions['email-owl'].target.place, 'cabinet');
    assert.equal(snapshot.actions['email-owl'].gesture, 'file');
    assert.equal(snapshot.assets.email.festive.parts[0].shape, 'torus');
    assert.deepEqual(snapshot.rooms.email.palette, { wall: '#123456' });
    assert.equal(snapshot.rooms.email.lighting.mode, 'night');
    assert.ok(!JSON.stringify(snapshot).includes(root));
    for (const args of [
      ['action', 'email', 'work', '{"actorId":"bridge-jarvis"}'],
      ['action', 'email', 'work', '{"command":"PRIVATE_COMMAND"}'],
      ['action', 'email', 'interact', '{"target":{"officeId":"email","place":"cabinet"}}'],
      ['action', 'email', 'interact', '{"target":{"officeId":"email","place":"cabinet"},"gesture":"PRIVATE_REASONING"}'],
      ['action', 'email', 'work', '{"gesture":"file"}'],
      ['decorate', 'email', 'desk', '/private/file'],
      ['decorate', 'email', 'desk', JSON.stringify([{ shape: 'box', url: 'PRIVATE_URL' }])],
      ['decorate', 'email', 'desk', 'x'.repeat(8193)],
      ['style', 'email', '/private/file'], ['style', 'email', '{"command":"PRIVATE_COMMAND"}'],
      ['style', 'email', '{"teamId":"hr","palette":{"wall":"#123456"}}'],
    ]) await assert.rejects(cli(args), error => error.code === 1 && !error.stdout && !error.stderr.includes('PRIVATE'));
  }
});

test('office CLI parsing rejects alternate programs, files, options and extra private keys', () => {
  assert.equal(parseOfficeCommand('action', ['support', 'rest']).arguments.actorId, 'support-beacon');
  assert.deepEqual(parseOfficeCommand('decorate', ['hr', 'wall', '[]']).arguments.parts, []);
  assert.deepEqual(parseOfficeCommand('style', ['hr', '{"reset":true}']).arguments, { teamId: 'hr', reset: true });
  for (const [command, args] of [
    ['action', ['hr', 'work', '{"id":"private"}']], ['action', ['hr', 'work', '{}', '--server', '/private']],
    ['decorate', ['hr', 'wall', '@file.json']], ['decorate', ['hr', 'wall', '[]', '--source', 'manual']],
    ['run', ['hr', '--', 'PRIVATE_PROGRAM']],
  ]) assert.throws(() => parseOfficeCommand(command, args));
});
