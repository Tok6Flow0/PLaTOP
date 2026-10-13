#!/usr/bin/env node
import { once } from 'node:events';
import { requestActivity, requestAction, requestDecoration } from '../server/client.mjs';
import { STATES, TEAM_IDS, parseUpdate } from '../server/protocol.mjs';
import { ACTOR_IDS, ACTION_KINDS, PLACES, DECOR_SLOTS, DECOR_SHAPES, parseAction, parseDecoration } from '../server/office-protocol.mjs';

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
  {
    name: 'platop_action', title: 'Choose a local avatar action',
    description: 'Queue one current visual intent; acceptance does not prove a destination was reached. actorId must belong to teamId; omitted actorId selects its first public member. walk_to requires a target; arrive defaults to its own office door. No task execution, chat text, coordinates or private identifiers.',
    inputSchema: { type: 'object', properties: {
      teamId: { type: 'string', enum: TEAM_IDS }, actorId: { type: 'string', enum: ACTOR_IDS },
      kind: { type: 'string', enum: ACTION_KINDS },
      target: { type: 'object', properties: { officeId: { type: 'string', enum: TEAM_IDS }, place: { type: 'string', enum: PLACES } }, required: ['officeId', 'place'], additionalProperties: false },
    }, required: ['teamId', 'kind'], additionalProperties: false },
    annotations: { ...annotations, readOnlyHint: false, idempotentHint: false },
  },
  {
    name: 'platop_decorate', title: 'Create a bounded local office decoration',
    description: 'Replace one office slot with at most 12 data-only primitive parts; [] clears it. No files, code, URLs, labels or external calls. Each position plus its bounding-sphere radius must fit within +/-1.5. Glow means material emissive, never another light.',
    inputSchema: { type: 'object', properties: {
      teamId: { type: 'string', enum: TEAM_IDS }, slot: { type: 'string', enum: DECOR_SLOTS },
      parts: { type: 'array', maxItems: 12, items: { type: 'object', properties: {
        shape: { type: 'string', enum: DECOR_SHAPES },
        position: { type: 'array', items: { type: 'number', minimum: -1.2, maximum: 1.2 }, minItems: 3, maxItems: 3 },
        size: { type: 'array', items: { type: 'number', minimum: 0.04, maximum: 1.2 }, minItems: 3, maxItems: 3 },
        rotation: { type: 'array', items: { type: 'number', minimum: -Math.PI, maximum: Math.PI }, minItems: 3, maxItems: 3 },
        color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }, glow: { type: 'boolean' },
      }, required: ['shape'], additionalProperties: false } },
    }, required: ['teamId', 'slot', 'parts'], additionalProperties: false },
    annotations: { ...annotations, readOnlyHint: false, idempotentHint: true },
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
    } else if (params.name === 'platop_set_activity') {
      if (!exact(args, ['teamId', 'state'])) throw new Error();
      payload = parseUpdate({ ...args, source: 'skill' });
    } else if (params.name === 'platop_action') payload = parseAction(args);
    else payload = parseDecoration(args);
  } catch {
    return rpcError(id, -32602, 'Only bounded public PLaTOP arguments are accepted.');
  }
  try {
    const snapshot = params.name === 'platop_action' ? await requestAction(payload)
      : params.name === 'platop_decorate' ? await requestDecoration(payload) : await requestActivity(payload);
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
