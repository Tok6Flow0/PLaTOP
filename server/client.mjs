import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_SNAPSHOT_BYTES, TEAM_IDS, parseUpdate, parseUpdates } from './protocol.mjs';
import { parseAction, parseDecoration, parseOfficeSnapshot, parseRoomStyle } from './office-protocol.mjs';

// Configuration comes from the local process, never from a model's tool arguments.
const defaultRoot = fileURLToPath(new URL('../', import.meta.url));

export function sanitizedSnapshot(value) {
  if (value?.app !== 'platop' || value.schemaVersion !== 1 || !Array.isArray(value.teams) ||
      value.teams.length !== TEAM_IDS.length || typeof value.serverTime !== 'string' || !Number.isFinite(Date.parse(value.serverTime))) {
    throw new Error('Invalid local bridge response.');
  }
  const teams = value.teams.map(item => {
    if (typeof item?.source !== 'string') throw new Error('Invalid local bridge response.');
    const update = parseUpdate({ teamId: item?.teamId, state: item?.state, source: item?.source });
    if (item.updatedAt !== null && (typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt)))) {
      throw new Error('Invalid local bridge response.');
    }
    return { ...update, updatedAt: item.updatedAt === null ? null : new Date(item.updatedAt).toISOString() };
  });
  if (new Set(teams.map(item => item.teamId)).size !== TEAM_IDS.length) throw new Error('Invalid local bridge response.');
  return { app: 'platop', schemaVersion: 1, teams, serverTime: new Date(value.serverTime).toISOString(), ...parseOfficeSnapshot(value) };
}

export async function requestActivity(payload, { root = process.env.PLATOP_ROOT ?? defaultRoot, port = Number(process.env.PLATOP_PORT ?? 4317) } = {}) {
  if (payload !== undefined) {
    const updates = parseUpdates(payload);
    payload = Object.hasOwn(payload, 'teams') ? { teams: updates } : updates[0];
  }
  return localRequest(payload === undefined ? 'state' : 'events', payload, { root, port });
}

export async function requestAction(payload, options) { return localRequest('actions', parseAction(payload), options); }
export async function requestDecoration(payload, options) { return localRequest('assets', parseDecoration(payload), options); }
export async function requestRoomStyle(payload, options) { return localRequest('rooms', parseRoomStyle(payload), options); }

async function localRequest(route, payload, { root = process.env.PLATOP_ROOT ?? defaultRoot, port = Number(process.env.PLATOP_PORT ?? 4317) } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local port.');
  const headers = {};
  if (payload !== undefined) {
    // Each exported operation validates before this private token boundary.
    const tokenFile = path.join(root, '.local', 'token');
    const stat = await lstat(tokenFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 128) throw new Error('Local token unavailable.');
    const token = (await readFile(tokenFile, 'utf8')).trim();
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Local token unavailable.');
    headers.Authorization = `Bearer ${token}`;
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`http://127.0.0.1:${port}/api/${route}`, {
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
    if (bytes > MAX_SNAPSHOT_BYTES) throw new Error('Invalid local bridge response.');
    chunks.push(chunk);
  }
  return sanitizedSnapshot(JSON.parse(Buffer.concat(chunks).toString('utf8')));
}
