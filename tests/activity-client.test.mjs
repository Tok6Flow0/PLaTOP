import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as officeProtocol from '../server/office-protocol.mjs';

const source = await readFile(new URL('../src/useActivity.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const teamIds = ['merchant', 'hr', 'intake', 'support', 'reflection', 'email'];
const snapshot = (state, serverTime = '2026-10-12T12:00:00.000Z') => ({
  serverTime,
  teams: teamIds.map(teamId => ({ teamId, state, source: 'skill', updatedAt: null })),
});
const flush = () => new Promise(resolve => setImmediate(resolve));

// Run the actual hook with a small state/effect host so network completion order
// is deterministic, without a browser, live bridge, or additional dependencies.
function activityClient() {
  const cells = [];
  const streams = [];
  let cursor = 0;
  let cleanup;
  let effectMounted = false;
  let mounted = true;
  let writes = 0;
  let request;
  let resolveFetch;
  let rejectFetch;
  const pendingFetch = new Promise((resolve, reject) => { resolveFetch = resolve; rejectFetch = reject; });
  class EventSource {
    constructor(url) { this.url = url; this.listeners = new Map(); this.closed = false; streams.push(this); }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    close() { this.closed = true; }
    state(value) { this.listeners.get('state')?.({ data: JSON.stringify(value) }); }
    error() { this.onerror?.(); }
  }
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = initial;
      return [cells[index], value => { cells[index] = value; writes++; }];
    },
    useEffect(effect) {
      if (!effectMounted) { effectMounted = true; cleanup = effect(); }
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(javascript, {
    module, exports: module.exports, AbortController,
    EventSource,
    fetch(url, options) { request = { url, ...options }; return pendingFetch; },
    require(name) {
      if (name === 'react') return hooks;
      if (name === './teams') return { teams: teamIds.map(id => ({ id })) };
      if (name === '../server/office-protocol.mjs') return officeProtocol;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  let current;
  const render = () => {
    if (mounted) { cursor = 0; current = module.exports.useActivity(); }
    return current;
  };
  render();
  return {
    get value() { return render(); },
    get writes() { return writes; },
    get request() { return request; },
    stream: streams[0],
    rejectFetch,
    resolveFetch(value) { resolveFetch({ ok: true, json: async () => value }); },
    unmount() { mounted = false; cleanup(); },
  };
}

test('a late initial fetch failure keeps a valid SSE connection and snapshot', async () => {
  const client = activityClient();
  assert.equal(client.value.connected, false);
  client.stream.state(snapshot('active'));
  assert.equal(client.value.connected, true);
  const received = client.value.snapshot;
  client.rejectFetch(new Error('Initial request canceled during reload'));
  await flush();
  assert.equal(client.value.connected, true);
  assert.equal(client.value.snapshot, received);
  assert.equal(client.value.snapshot.teams[0].state, 'active');
  client.unmount();
});

test('an unavailable initial fetch never invents a connection', async () => {
  const client = activityClient();
  client.rejectFetch(new Error('Bridge unavailable'));
  await flush();
  assert.equal(client.value.connected, false);
  assert.equal(client.value.snapshot, null);
  client.unmount();
});

test('removed demo records never connect the browser or replace a valid observed snapshot', async () => {
  const client = activityClient();
  const simulated = snapshot('active');
  simulated.teams[0].source = 'demo';
  client.resolveFetch(simulated);
  await flush();
  assert.equal(client.value.connected, false);
  assert.equal(client.value.snapshot, null);
  client.stream.state(simulated);
  assert.equal(client.value.connected, false);
  assert.equal(client.value.snapshot, null);
  client.stream.state(snapshot('sleeping'));
  const observed = client.value.snapshot;
  assert.equal(client.value.connected, true);
  client.stream.state(simulated);
  assert.equal(client.value.connected, true);
  assert.equal(client.value.snapshot, observed);
  client.unmount();
});

test('a successful initial fetch connects before the stream reports an outcome', async () => {
  const client = activityClient();
  client.resolveFetch(snapshot('sleeping', '2026-10-12T12:00:00.000Z'));
  await flush();
  assert.equal(client.value.connected, true);
  assert.equal(client.value.snapshot.teams[0].state, 'sleeping');
  assert.equal(client.value.snapshot.serverTime, '2026-10-12T12:00:00.000Z');
  client.unmount();
});

test('a late successful initial fetch cannot replace a newer valid stream snapshot', async () => {
  const client = activityClient();
  client.stream.state(snapshot('active', '2026-10-12T12:00:02.000Z'));
  const received = client.value.snapshot;
  client.resolveFetch(snapshot('sleeping', '2026-10-12T12:00:00.000Z'));
  await flush();
  assert.equal(client.value.connected, true);
  assert.equal(client.value.snapshot, received);
  assert.equal(client.value.snapshot.teams[0].state, 'active');
  assert.equal(client.value.snapshot.serverTime, '2026-10-12T12:00:02.000Z');
  client.unmount();
});

test('a late successful initial fetch cannot reconnect after a stream error', async () => {
  const client = activityClient();
  client.stream.error();
  client.resolveFetch(snapshot('sleeping', '2026-10-12T12:00:00.000Z'));
  await flush();
  assert.equal(client.value.connected, false);
  assert.equal(client.value.snapshot, null);
  client.stream.state(snapshot('active', '2026-10-12T12:00:02.000Z'));
  assert.equal(client.value.connected, true);
  assert.equal(client.value.snapshot.teams[0].state, 'active');
  client.unmount();
});

test('malformed stream snapshots leave the successful initial fetch available', async () => {
  const client = activityClient();
  client.stream.state({ teams: [], serverTime: null });
  client.resolveFetch(snapshot('sleeping', '2026-10-12T12:00:00.000Z'));
  await flush();
  assert.equal(client.value.connected, true);
  assert.equal(client.value.snapshot.teams[0].state, 'sleeping');
  client.unmount();
});

test('an actual SSE error disconnects and a fresh valid event recovers', async () => {
  const client = activityClient();
  client.resolveFetch(snapshot('sleeping'));
  await flush();
  assert.equal(client.value.connected, true);
  client.stream.error();
  assert.equal(client.value.connected, false);
  client.stream.state({ teams: [], serverTime: null });
  assert.equal(client.value.connected, false, 'malformed data cannot reconnect the client');
  client.stream.state(snapshot('active'));
  assert.equal(client.value.connected, true);
  assert.equal(client.value.snapshot.teams[0].state, 'active');
  client.unmount();
});

test('unmount aborts the fetch, closes SSE, and ignores late completions and events', async () => {
  const client = activityClient();
  assert.equal(client.request.url, '/api/state');
  assert.equal(client.stream.url, '/api/events');
  assert.equal(client.request.signal.aborted, false);
  client.unmount();
  assert.equal(client.request.signal.aborted, true);
  assert.equal(client.stream.closed, true);
  const writes = client.writes;
  client.resolveFetch(snapshot('active'));
  client.stream.state(snapshot('sleeping'));
  client.stream.error();
  await flush();
  assert.equal(client.writes, writes, 'disposed clients cannot write React state');
});

test('office intents and bounded recipes survive SSE while malformed office data is ignored', () => {
  const client = activityClient();
  const value = snapshot('sleeping');
  value.actions = { 'support-beacon': { id: '12345678-1234-4123-8123-123456789abc', actorId: 'support-beacon', kind: 'leave' } };
  value.assets = { support: { desk: { id: '12345678-1234-4123-8123-123456789abd', parts: [{ shape: 'sphere', color: '#AABBCC' }] } } };
  client.stream.state(value);
  assert.equal(client.value.snapshot.actions['support-beacon'].kind, 'leave');
  assert.equal(client.value.snapshot.assets.support.desk.parts[0].color, '#aabbcc');
  value.actions['support-beacon'] = { id: '12345678-1234-4123-8123-123456789abe', actorId: 'support-beacon', kind: 'interact', target: { officeId: 'support', place: 'cabinet' }, gesture: 'file' };
  client.stream.state(value);
  assert.equal(client.value.snapshot.actions['support-beacon'].gesture, 'file');
  assert.deepEqual(client.value.snapshot.actions['support-beacon'].target, { officeId: 'support', place: 'cabinet' });
  const prior = client.value.snapshot;
  for (const invalid of [
    { ...value, actions: { privateChatId: value.actions['support-beacon'] } },
    { ...value, actions: { 'support-beacon': { ...value.actions['support-beacon'], gesture: 'PRIVATE_REASONING' } } },
    { ...value, actions: { 'support-beacon': { ...value.actions['support-beacon'], kind: 'work' } } },
    { ...value, assets: { support: { desk: { ...value.assets.support.desk, url: 'https://invalid.example' } } } },
    { ...value, teams: [value.teams[0], value.teams[0]] },
    { ...value, serverTime: 'invalid' },
  ]) { client.stream.state(invalid); assert.equal(client.value.snapshot, prior); }
  client.unmount();
});
