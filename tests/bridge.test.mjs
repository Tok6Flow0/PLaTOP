import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, writeFile, readFile, stat, symlink, rm } from 'node:fs/promises';
import { createBridge } from '../server/index.mjs';
import { TEAM_IDS } from '../server/protocol.mjs';

async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'platop-test-'));
  await mkdir(path.join(root, 'dist'));
  await writeFile(path.join(root, 'dist', 'index.html'), '<!doctype html><title>PLaTOP</title>');
  await writeFile(path.join(root, 'dist', 'office.glb'), 'MODEL');
  await writeFile(path.join(root, 'outside.txt'), 'PRIVATE_OUTSIDE');
  const bridge = await createBridge({ root, port: 0, ...options });
  t.after(async () => { await bridge.close(); await rm(root, { recursive: true, force: true }); });
  const token = (await readFile(path.join(root, '.local', 'token'), 'utf8')).trim();
  const request = (url = '/api/state', { method = 'GET', body, headers = {}, auth = false } = {}) => new Promise((resolve, reject) => {
    const serialized = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port: bridge.port, path: url, method, headers: {
      ...(serialized !== undefined ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(serialized) } : {}),
      ...(auth ? { Authorization: `Bearer ${token}` } : {}), ...headers,
    } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, headers: res.headers, text, ...(res.headers['content-type']?.includes('json') ? { json: JSON.parse(text) } : {}) });
      });
    });
    req.on('error', reject); req.end(serialized);
  });
  return { root, bridge, token, request };
}

test('starts unknown, returns only public state, and stores a private token', async t => {
  const { root, request } = await fixture(t);
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.json.app, 'platop');
  assert.equal(response.json.schemaVersion, 1);
  assert.deepEqual(response.json.teams.map(team => team.teamId), TEAM_IDS);
  assert.ok(response.json.teams.every(team => team.state === 'unknown' && team.updatedAt === null));
  assert.equal((await stat(path.join(root, '.local', 'token'))).mode & 0o777, 0o600);
  assert.equal(response.headers['access-control-allow-origin'], undefined);
  assert.ok(response.headers['content-security-policy'].includes("frame-ancestors 'none'"));
});

test('rejects unauthenticated writes, cross-origin requests, and rebinding hosts', async t => {
  const { request, bridge } = await fixture(t);
  const body = { teamId: 'merchant', state: 'active' };
  assert.equal((await request('/api/events', { method: 'POST', body })).status, 401);
  assert.equal((await request('/api/events', { method: 'POST', body, headers: { Authorization: 'Bearer wrong' } })).status, 401);
  for (const origin of ['https://evil.example', 'null', `http://127.0.0.1:${bridge.port + 1}`]) {
    assert.equal((await request('/api/events', { method: 'POST', body, auth: true, headers: { Origin: origin } })).status, 403);
  }
  assert.equal((await request('/api/state', { headers: { Host: `evil.example:${bridge.port}` } })).status, 403);
  assert.equal((await request('/api/events', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request('/api/events', { method: 'POST', body, auth: true, headers: { Origin: `http://127.0.0.1:${bridge.port}` } })).status, 200);
});

test('rejects cross-site browser requests even when a GET has no Origin header', async t => {
  const { request } = await fixture(t);
  for (const site of ['cross-site', 'same-site']) {
    const headers = { 'Sec-Fetch-Site': site };
    assert.equal((await request('/api/state', { headers })).status, 403);
    // Invalid input avoids any provider request if this guard regresses.
    assert.equal((await request('/api/weather?latitude=100&longitude=2', { headers })).status, 403);
    assert.equal((await request('/', { headers })).status, 403);
  }
  for (const site of ['same-origin', 'none']) {
    assert.equal((await request('/api/state', { headers: { 'Sec-Fetch-Site': site } })).status, 200);
  }
  // Native clients and the local command-line bridge do not send Fetch Metadata.
  assert.equal((await request('/api/state')).status, 200);
});

test('does not serve hidden files accidentally copied into the build', async t => {
  const { root, request } = await fixture(t);
  await writeFile(path.join(root, 'dist', '.env'), 'PRIVATE_BUILD_DATA');
  await mkdir(path.join(root, 'dist', '.local'));
  await writeFile(path.join(root, 'dist', '.local', 'token'), 'PRIVATE_BUILD_DATA');
  for (const url of ['/.env', '/.local/token']) {
    const response = await request(url);
    assert.equal(response.status, 404);
    assert.ok(!response.text.includes('PRIVATE_BUILD_DATA'));
  }
});

test('accepts closed-vocabulary batches atomically and persists no history or extra fields', async t => {
  const { root, request, token } = await fixture(t);
  const response = await request('/api/events', { method: 'POST', auth: true, body: { teams: [
    { teamId: 'merchant', state: 'active', source: 'codex' },
    { teamId: 'hr', state: 'waiting', source: 'skill' },
  ] } });
  assert.equal(response.status, 200);
  assert.equal(response.json.teams[0].state, 'active');
  assert.equal(response.json.teams[1].state, 'waiting');
  assert.equal(response.json.teams[0].updatedAt, response.json.teams[1].updatedAt);
  const persisted = await readFile(path.join(root, '.local', 'state.json'), 'utf8');
  assert.equal(JSON.parse(persisted).teams.length, 2);
  assert.ok(!persisted.includes(token));
  assert.equal((await stat(path.join(root, '.local', 'state.json'))).mode & 0o777, 0o600);
});

test('removed demo source is rejected without changing activity or private persistence, including mixed batches', async t => {
  const { root, request } = await fixture(t);
  const established = await request('/api/events', { method: 'POST', auth: true, body: { teamId: 'merchant', state: 'active', source: 'skill' } });
  const file = path.join(root, '.local', 'state.json');
  const saved = await readFile(file, 'utf8');
  for (const body of [
    { teamId: 'merchant', state: 'sleeping', source: 'demo' },
    { teams: [{ teamId: 'hr', state: 'waiting', source: 'codex' }, { teamId: 'merchant', state: 'sleeping', source: 'demo' }] },
  ]) {
    assert.equal((await request('/api/events', { method: 'POST', auth: true, body })).status, 400);
    assert.deepEqual((await request()).json.teams, established.json.teams);
    assert.equal(await readFile(file, 'utf8'), saved);
  }
  await writeFile(file, JSON.stringify({ teams: [{ teamId: 'merchant', state: 'active', source: 'demo', updatedAt: new Date().toISOString() }] }));
  const restored = await createBridge({ root, port: 0 }); t.after(() => restored.close());
  const response = await fetch(`http://127.0.0.1:${restored.port}/api/state`);
  const snapshot = await response.json();
  assert.ok(snapshot.teams.every(team => team.state === 'unknown' && team.updatedAt === null));
  assert.ok(snapshot.teams.every(team => team.source !== 'demo'));
});

test('rejects private fields, arbitrary state/source/IDs, malformed JSON, duplicates and oversized data', async t => {
  const { request } = await fixture(t);
  const invalid = [
    { teamId: 'merchant', state: 'active', message: 'PRIVATE_TEXT' },
    { teamId: 'merchant', state: 'active', updatedAt: new Date().toISOString() },
    { teamId: 'merchant', state: 'active', source: 'private chat title' },
    { teamId: 'private-thread-id', state: 'active' },
    { teamId: 'merchant', state: 'working' },
    { teams: [{ teamId: 'hr', state: 'active' }, { teamId: 'hr', state: 'sleeping' }] },
    { teams: [] }, null, '{"broken"',
  ];
  for (const body of invalid) {
    const response = await request('/api/events', { method: 'POST', auth: true, body: body === null ? 'null' : body });
    assert.equal(response.status, 400);
    assert.ok(!response.text.includes('PRIVATE_TEXT'));
  }
  assert.equal((await request('/api/events', { method: 'POST', auth: true, body: 'x'.repeat(8193) })).status, 413);
  assert.equal((await request('/api/events', { method: 'POST', auth: true, body: '{}', headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.ok((await request()).json.teams.every(team => team.state === 'unknown'));
});

test('serves built assets with correct MIME and blocks traversing paths and outside symlinks', async t => {
  const { root, request } = await fixture(t);
  await symlink(path.join(root, 'outside.txt'), path.join(root, 'dist', 'leak.txt'));
  assert.equal((await request('/')).headers['content-type'], 'text/html; charset=utf-8');
  assert.equal((await request('/office.glb')).headers['content-type'], 'model/gltf-binary');
  assert.equal((await request('/leak.txt')).status, 404);
  assert.equal((await request('/.local/token')).text.includes('Local token'), false);
  for (const url of ['/../outside.txt', '/%2e%2e/outside.txt', '/assets/%2e%2e/outside.txt', '/%5c..%5coutside.txt', '/%00', '/%zz']) {
    const response = await request(url);
    assert.equal(response.status, 400, url);
    assert.ok(!response.text.includes('PRIVATE_OUTSIDE'));
  }
  assert.equal((await request('/api/unknown')).status, 404);
});

test('will not serve a dist directory symlinked outside the repository', async t => {
  const { root, request } = await fixture(t);
  // Restart tests below cover initial realpath rejection; cached directories still resolve files safely.
  const outside = await mkdtemp(path.join(os.tmpdir(), 'platop-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, 'index.html'), 'PRIVATE_OUTSIDE');
  const secondRoot = await mkdtemp(path.join(os.tmpdir(), 'platop-symlink-'));
  await symlink(outside, path.join(secondRoot, 'dist'));
  const second = await createBridge({ root: secondRoot, port: 0 });
  t.after(async () => { await second.close(); await rm(secondRoot, { recursive: true, force: true }); });
  const response = await fetch(`http://127.0.0.1:${second.port}/`);
  assert.equal(response.status, 404);
  assert.ok(!(await response.text()).includes('PRIVATE_OUTSIDE'));
  assert.equal((await request()).status, 200);
  assert.ok(root);
});

test('active telemetry expires to unknown while observed sleeping remains sleeping', async t => {
  let clock = Date.parse('2026-10-12T12:00:00Z');
  const { request } = await fixture(t, { now: () => clock });
  await request('/api/events', { method: 'POST', auth: true, body: { teams: [{ teamId: 'merchant', state: 'active' }, { teamId: 'hr', state: 'sleeping' }] } });
  const before = (await request()).json;
  assert.equal(before.teams[0].state, 'active');
  clock += 120_000;
  const after = (await request()).json;
  assert.equal(after.teams[0].state, 'unknown');
  assert.equal(after.teams[0].updatedAt, before.teams[0].updatedAt);
  assert.equal(after.teams[1].state, 'sleeping');
});

test('SSE delivers initial state, activity changes, heartbeat, and stale expiry without polling', async t => {
  let clock = Date.now();
  const { bridge, request, token } = await fixture(t, { now: () => clock, ttlMs: 100, heartbeatMs: 20, expiryCheckMs: 10 });
  const controller = new AbortController();
  t.after(() => controller.abort());
  const response = await fetch(`http://127.0.0.1:${bridge.port}/api/events`, { signal: controller.signal });
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  const reader = response.body.getReader();
  let received = '';
  const until = async predicate => {
    const deadline = Date.now() + 2000;
    while (!predicate(received)) {
      if (Date.now() >= deadline) throw new Error('SSE event missing.');
      const { value, done } = await reader.read();
      if (done) throw new Error('SSE stream closed.');
      received += new TextDecoder().decode(value);
    }
  };
  await until(text => text.includes('event: state') && text.includes('"state":"unknown"'));
  await request('/api/events', { method: 'POST', auth: true, body: { teamId: 'merchant', state: 'active' } });
  await until(text => text.includes('"state":"active"'));
  const countBefore = received.split('event: state').length;
  clock += 101;
  await until(text => text.split('event: state').length > countBefore && text.includes(': heartbeat'));
  assert.ok(!received.includes(token));
  const latest = received.split('data: ').at(-1).split('\n')[0];
  assert.equal(JSON.parse(latest).teams[0].state, 'unknown');
  controller.abort();
});

test('persisted sanitized states reload while corrupt/private state defaults to unknown', async t => {
  const { root, request } = await fixture(t);
  await request('/api/events', { method: 'POST', auth: true, body: { teamId: 'support', state: 'sleeping', source: 'codex' } });
  const second = await createBridge({ root, port: 0 });
  t.after(() => second.close());
  const saved = await fetch(`http://127.0.0.1:${second.port}/api/state`).then(response => response.json());
  assert.equal(saved.teams.find(team => team.teamId === 'support').state, 'sleeping');
  await writeFile(path.join(root, '.local', 'state.json'), JSON.stringify({ teams: [{ teamId: 'support', state: 'active', source: 'codex', updatedAt: new Date().toISOString(), content: 'PRIVATE_TEXT' }] }));
  const third = await createBridge({ root, port: 0 });
  t.after(() => third.close());
  const corrupt = await fetch(`http://127.0.0.1:${third.port}/api/state`).then(response => response.json());
  assert.ok(corrupt.teams.every(team => team.state === 'unknown'));
  assert.ok(!JSON.stringify(corrupt).includes('PRIVATE_TEXT'));
});
