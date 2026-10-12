import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_BODY_BYTES, TEAM_IDS, parseUpdate, parseUpdates } from './protocol.mjs';

// Configuration comes from the local process, never from a model's tool arguments.
const defaultRoot = fileURLToPath(new URL('../', import.meta.url));

function sanitizedSnapshot(value) {
  if (value?.app !== 'platop' || value.schemaVersion !== 1 || !Array.isArray(value.teams) ||
      value.teams.length !== TEAM_IDS.length || !Number.isFinite(Date.parse(value.serverTime))) {
    throw new Error('Invalid local bridge response.');
  }
  const teams = value.teams.map(item => {
    const update = parseUpdate({ teamId: item?.teamId, state: item?.state, source: item?.source });
    if (item.updatedAt !== null && (typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt)))) {
      throw new Error('Invalid local bridge response.');
    }
    return { ...update, updatedAt: item.updatedAt === null ? null : new Date(item.updatedAt).toISOString() };
  });
  if (new Set(teams.map(item => item.teamId)).size !== TEAM_IDS.length) throw new Error('Invalid local bridge response.');
  return { app: 'platop', schemaVersion: 1, teams, serverTime: new Date(value.serverTime).toISOString() };
}

export async function requestActivity(payload, { root = process.env.PLATOP_ROOT ?? defaultRoot, port = Number(process.env.PLATOP_PORT ?? 4317) } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local port.');
  const headers = {};
  if (payload !== undefined) {
    // Validate again at the process boundary, before accessing the private token.
    const updates = parseUpdates(payload);
    payload = Object.hasOwn(payload, 'teams') ? { teams: updates } : updates[0];
    const tokenFile = path.join(root, '.local', 'token');
    const stat = await lstat(tokenFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 128) throw new Error('Local token unavailable.');
    const token = (await readFile(tokenFile, 'utf8')).trim();
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Local token unavailable.');
    headers.Authorization = `Bearer ${token}`;
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`http://127.0.0.1:${port}/api/${payload === undefined ? 'state' : 'events'}`, {
    method: payload === undefined ? 'GET' : 'POST', headers, redirect: 'error',
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal: AbortSignal.timeout(5000),
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json') || !response.body) {
    await response.body?.cancel();
    throw new Error('Local bridge rejected the request.');
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw new Error('Invalid local bridge response.');
    chunks.push(chunk);
  }
  return sanitizedSnapshot(JSON.parse(Buffer.concat(chunks).toString('utf8')));
}
