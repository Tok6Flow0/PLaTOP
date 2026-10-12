#!/usr/bin/env node
import { once } from 'node:events';
import { requestActivity } from '../server/client.mjs';
import { STATES, TEAM_IDS, parseUpdate } from '../server/protocol.mjs';

const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const MAX_MESSAGE_BYTES = 16_384;
const annotations = { destructiveHint: false, openWorldHint: false };
const TOOLS = [
  {
    name: 'platop_status', title: 'Read local PLaTOP activity',
    description: 'Read the six public team activity states from the local PLaTOP bridge. Contains no chat contents or private identifiers.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { ...annotations, readOnlyHint: true, idempotentHint: true },
  },
  {
    name: 'platop_set_activity', title: 'Set local PLaTOP activity',
    description: 'Visualize an already authorized team task: active while working, sleeping when finished, waiting for input, unknown when unavailable. This does not run a chat or any business action. Send active heartbeats during long work.',
    inputSchema: { type: 'object', properties: { teamId: { type: 'string', enum: TEAM_IDS }, state: { type: 'string', enum: STATES } }, required: ['teamId', 'state'], additionalProperties: false },
    annotations: { ...annotations, readOnlyHint: false, idempotentHint: false },
  },
];

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys, required = keys) => record(value) && Object.keys(value).every(key => keys.includes(key)) && required.every(key => Object.hasOwn(value, key));
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
let initialized = false;
let ready = false;

async function handle(message) {
  const hasId = record(message) && Object.hasOwn(message, 'id');
  const id = hasId && (typeof message.id === 'string' || Number.isFinite(message.id)) ? message.id : null;
  if (!record(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' ||
      (hasId && id === null) || (message.params !== undefined && !record(message.params))) {
    return rpcError(null, -32600, 'Invalid request.');
  }
  // Notifications never invoke activity writes and never receive responses.
  if (!hasId) {
    if (message.method === 'notifications/initialized' && initialized) ready = true;
    return undefined;
  }
  if (message.method === 'ping') return { jsonrpc: '2.0', id, result: {} };
  if (message.method === 'initialize') {
    const params = message.params;
    if (initialized || !record(params) || typeof params.protocolVersion !== 'string' || !record(params.capabilities) || !record(params.clientInfo)) {
      return rpcError(id, -32602, 'Invalid initialization.');
    }
    initialized = true;
    return { jsonrpc: '2.0', id, result: {
      protocolVersion: PROTOCOL_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSIONS[0],
      capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'platop', version: '0.1.0' },
      instructions: 'Use only public team IDs and activity states. This local visualization does not authorize task execution. If the bridge is unavailable, continue the authorized task without inventing activity.',
    } };
  }
  if (!ready) return rpcError(id, -32002, 'Server is not initialized.');
  if (message.method === 'tools/list') {
    if (message.params && !exact(message.params, [])) return rpcError(id, -32602, 'Invalid tool list parameters.');
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  }
  if (message.method !== 'tools/call') return rpcError(id, -32601, 'Method not found.');
  const params = message.params;
  if (!exact(params, ['name', 'arguments', '_meta'], ['name']) || !TOOLS.some(tool => tool.name === params.name)) {
    return rpcError(id, -32602, 'Invalid tool call.');
  }
  const args = params.arguments ?? {};
  let payload;
  try {
    if (params.name === 'platop_status') {
      if (!exact(args, [])) throw new Error();
    } else {
      if (!exact(args, ['teamId', 'state'])) throw new Error();
      payload = parseUpdate({ ...args, source: 'skill' });
    }
  } catch {
    return rpcError(id, -32602, 'Only public team IDs and activity states are accepted.');
  }
  try {
    const snapshot = await requestActivity(payload);
    return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(snapshot) }], structuredContent: snapshot, isError: false } };
  } catch {
    return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'PLaTOP local bridge is unavailable or rejected the update. Continue the authorized task; activity is unconfirmed.' }], isError: true } };
  }
}

async function send(message) {
  if (message && !process.stdout.write(`${JSON.stringify(message)}\n`)) await once(process.stdout, 'drain');
}

// Bounded sequential processing provides backpressure without retaining chat data.
let pending = Buffer.alloc(0);
let oversized = false;
for await (const chunk of process.stdin) {
  let start = 0;
  while (start < chunk.length) {
    const end = chunk.indexOf(10, start);
    const stop = end === -1 ? chunk.length : end;
    const part = chunk.subarray(start, stop);
    if (!oversized) {
      if (pending.length + part.length > MAX_MESSAGE_BYTES) {
        pending = Buffer.alloc(0); oversized = true;
      } else pending = Buffer.concat([pending, part]);
    }
    if (end === -1) break;
    if (oversized) await send(rpcError(null, -32700, 'Message exceeds the local limit.'));
    else {
      try { await send(await handle(JSON.parse(pending.toString('utf8')))); }
      catch { await send(rpcError(null, -32700, 'Invalid JSON message.')); }
    }
    pending = Buffer.alloc(0); oversized = false; start = end + 1;
  }
}
if (pending.length || oversized) await send(rpcError(null, -32700, 'Incomplete JSON message.'));
