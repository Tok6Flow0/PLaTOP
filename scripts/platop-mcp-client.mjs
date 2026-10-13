#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATES, TEAM_IDS, parseUpdate } from '../server/protocol.mjs';
import { ACTION_KINDS, ACTION_GESTURES, MOTION_PACES, MOTION_ROUTES, PLACES, DECOR_SLOTS, DECOR_SHAPES, DECOR_FINISHES, MAX_DECOR_PARTS, ROOM_LIGHT_MODES, parseAction, parseDecoration, parseRoomStyle } from '../server/office-protocol.mjs';
import { parseOfficeCommand } from '../server/office-cli.mjs';
import { sanitizedSnapshot } from '../server/client.mjs';

const SERVER = fileURLToPath(new URL('./platop-mcp.mjs', import.meta.url));
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const VERSION = '2025-11-25';
const FAILURE = 'PLaTOP MCP activity is unconfirmed. Check the local bridge and public team/state arguments.';
const MAX_LINE_BYTES = 524_288;
const MAX_STDOUT_BYTES = 1_048_576;
const MAX_STDERR_BYTES = 8192;
const TIMEOUT_MS = 8000;
const CLOSE_GRACE_MS = 250;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));
const fail = () => new Error(FAILURE);
const boundedEnum = (value, allowed) => Array.isArray(value) && value.length > 0
  && new Set(value).size === value.length && value.every(item => allowed.includes(item));

/** A fixed local stdio transport; callers can supply only public tool arguments. */
export async function callPlatopMcp(name, args = {}) {
  try {
    if (name === 'platop_status') {
      if (!exact(args, [])) throw fail();
      args = {};
    } else if (name === 'platop_set_activity') {
      if (!exact(args, ['teamId', 'state'])) throw fail();
      args = { teamId: args.teamId, state: args.state };
      parseUpdate(args);
    } else if (name === 'platop_action') args = parseAction(args);
    else if (name === 'platop_decorate') args = parseDecoration(args);
    else if (name === 'platop_style') args = parseRoomStyle(args);
    else throw fail();
  } catch { throw fail(); }

  // Only operator-provided bridge settings cross the process boundary. In
  // particular, Node preload options and unrelated credentials are not copied.
  const env = {};
  for (const key of ['PLATOP_ROOT', 'PLATOP_PORT']) if (process.env[key] !== undefined) env[key] = process.env[key];
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(process.execPath, [SERVER], { cwd: ROOT, env, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch { reject(fail()); return; }
    let pending = Buffer.alloc(0);
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stage = 0;
    let outcome;
    let closed = false;
    let closeTimer;
    const deadline = setTimeout(() => stop(), TIMEOUT_MS);

    function cleanup() {
      closed = true;
      clearTimeout(deadline);
      clearTimeout(closeTimer);
      child.stdin.destroy();
      child.stdout.destroy();
      child.stderr.destroy();
      pending = Buffer.alloc(0);
    }
    function stop(snapshot) {
      if (closed) return;
      if (snapshot !== undefined && outcome === undefined) outcome = { snapshot };
      else if (snapshot === undefined) outcome = { error: true };
      clearTimeout(deadline);
      if (outcome.error) { child.stdin.destroy(); child.kill('SIGTERM'); }
      else child.stdin.end();
      if (!closeTimer) closeTimer = setTimeout(() => child.kill('SIGKILL'), CLOSE_GRACE_MS);
    }
    function send(message) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    }
    function response(message) {
      if (stage > 2 || !record(message) || message.jsonrpc !== '2.0' || message.id !== stage + 1
        || !Object.hasOwn(message, 'result') || Object.hasOwn(message, 'error') || !record(message.result)) throw fail();
      const result = message.result;
      if (stage === 0) {
        if (result.protocolVersion !== VERSION || result.serverInfo?.name !== 'platop' || !record(result.capabilities?.tools)) throw fail();
        stage = 1;
        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
      } else if (stage === 1) {
        const known = ['platop_status', 'platop_set_activity', 'platop_action', 'platop_decorate', 'platop_style'];
        if (!Array.isArray(result.tools) || result.tools.length < 2 || result.tools.length > known.length
          || result.tools.some(tool => !record(tool) || !known.includes(tool.name) || tool.inputSchema?.additionalProperties !== false)) throw fail();
        const tools = new Map(result.tools.map(tool => [tool.name, tool]));
        if (tools.size !== result.tools.length || !tools.has('platop_status') || !tools.has('platop_set_activity') || !tools.has(name)
          || JSON.stringify(tools.get('platop_set_activity').inputSchema?.properties?.teamId?.enum) !== JSON.stringify(TEAM_IDS)
          || JSON.stringify(tools.get('platop_set_activity').inputSchema?.properties?.state?.enum) !== JSON.stringify(STATES)) throw fail();
        const actionProperties = tools.get('platop_action')?.inputSchema?.properties;
        const actionKinds = actionProperties?.kind?.enum;
        const actionPlaces = actionProperties?.target?.properties?.place?.enum;
        if (tools.has('platop_action') && ![ACTION_KINDS, ACTION_KINDS.filter(kind => kind !== 'interact')]
          .some(kinds => JSON.stringify(actionKinds) === JSON.stringify(kinds))) throw fail();
        if (actionProperties?.gesture && JSON.stringify(actionProperties.gesture.enum) !== JSON.stringify(ACTION_GESTURES)) throw fail();
        if (actionPlaces !== undefined && ![PLACES, PLACES.slice(0, 3)]
          .some(places => JSON.stringify(actionPlaces) === JSON.stringify(places))) throw fail();
        if (name === 'platop_action') {
          if (!actionKinds.includes(args.kind)) throw fail();
          if (args.gesture && JSON.stringify(actionProperties?.gesture?.enum) !== JSON.stringify(ACTION_GESTURES)) throw fail();
          if (args.target && !PLACES.slice(0, 3).includes(args.target.place)
            && !actionPlaces?.includes(args.target.place)) throw fail();
          if (args.motion) {
            const motionSchema = actionProperties?.motion;
            if (motionSchema?.additionalProperties !== false) throw fail();
            for (const [key, allowed] of [['pace', MOTION_PACES], ['route', MOTION_ROUTES]]) if (args.motion[key]) {
              const advertised = motionSchema?.properties?.[key]?.enum;
              if (!boundedEnum(advertised, allowed) || !advertised.includes(args.motion[key])) throw fail();
            }
          }
        }
        if (tools.has('platop_decorate') && JSON.stringify(tools.get('platop_decorate').inputSchema?.properties?.slot?.enum) !== JSON.stringify(DECOR_SLOTS)) throw fail();
        if (tools.has('platop_style') && JSON.stringify(tools.get('platop_style').inputSchema?.properties?.lighting?.properties?.mode?.enum) !== JSON.stringify(ROOM_LIGHT_MODES)) throw fail();
        let wireArgs = args;
        if (name === 'platop_decorate') {
          const partSchema = tools.get(name).inputSchema?.properties?.parts;
          const finishSchema = partSchema?.items?.properties?.finish;
          const shapeSchema = partSchema?.items?.properties?.shape;
          const shapes = shapeSchema?.enum ?? DECOR_SHAPES.slice(0, 5);
          const finishes = finishSchema?.enum ?? ['matte'];
          const budget = partSchema?.maxItems ?? 12;
          if (!boundedEnum(shapes, DECOR_SHAPES) || !boundedEnum(finishes, DECOR_FINISHES)
            || !Number.isInteger(budget) || budget < 0 || budget > MAX_DECOR_PARTS
            || args.parts.length > budget || args.parts.some(part => !shapes.includes(part.shape) || !finishes.includes(part.finish))) throw fail();
          // Original four-tool servers predate finishes and the two organic
          // shapes. Keep their original recipes usable without widening them.
          if (!finishSchema) {
            wireArgs = { ...args, parts: args.parts.map(({ finish, ...part }) => part) };
          }
        }
        if (name === 'platop_style') {
          const lightingProperties = tools.get(name).inputSchema?.properties?.lighting?.properties;
          for (const key of ['ambientColor', 'ambientBrightness', 'ambientPosition']) {
            if (Object.hasOwn(args.lighting ?? {}, key) && !Object.hasOwn(lightingProperties ?? {}, key)) throw fail();
          }
        }
        stage = 2;
        send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name, arguments: wireArgs } });
      } else {
        if (result.isError !== false) throw fail();
        const snapshot = sanitizedSnapshot(result.structuredContent);
        if (name === 'platop_set_activity') {
          const updated = snapshot.teams.find(team => team.teamId === args.teamId);
          if (updated.state !== args.state || updated.source !== 'skill' || updated.updatedAt === null) throw fail();
        }
        if (name === 'platop_action') {
          const action = snapshot.actions?.[args.actorId];
          if (!action || action.kind !== args.kind || action.gesture !== args.gesture || JSON.stringify(action.target) !== JSON.stringify(args.target)
            || JSON.stringify(action.motion) !== JSON.stringify(args.motion)) throw fail();
        }
        if (name === 'platop_decorate') {
          const asset = snapshot.assets?.[args.teamId]?.[args.slot];
          if (args.parts.length ? !asset || JSON.stringify(asset.parts) !== JSON.stringify(args.parts) : asset !== undefined) throw fail();
        }
        if (name === 'platop_style') {
          const style = snapshot.rooms?.[args.teamId];
          if (args.reset ? style !== undefined : !style || ['palette', 'lighting'].some(section =>
            Object.entries(args[section] ?? {}).some(([key, value]) => JSON.stringify(style[section][key]) !== JSON.stringify(value)))) throw fail();
        }
        stage = 3;
        stop(snapshot);
      }
    }

    child.once('spawn', () => {
      if (outcome) return;
      send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: VERSION, capabilities: {}, clientInfo: { name: 'platop-local-client', version: '0.1.0' },
      } });
    });
    child.once('error', () => { if (!child.pid) { cleanup(); reject(fail()); } else stop(); });
    child.stdin.on('error', () => stop());
    child.stdout.on('error', () => stop());
    child.stderr.on('error', () => stop());
    child.stdout.on('data', chunk => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) { stop(); return; }
      let start = 0;
      while (start < chunk.length && !outcome?.error) {
        const end = chunk.indexOf(10, start);
        const part = chunk.subarray(start, end === -1 ? chunk.length : end);
        if (pending.length + part.length > MAX_LINE_BYTES) { stop(); return; }
        pending = Buffer.concat([pending, part]);
        if (end === -1) return;
        const line = pending;
        pending = Buffer.alloc(0);
        try { response(JSON.parse(line.toString('utf8'))); }
        catch { stop(); return; }
        start = end + 1;
      }
    });
    // Count and discard diagnostics; even failure output cannot reflect it.
    child.stderr.on('data', chunk => { stderrBytes += chunk.length; if (stderrBytes > MAX_STDERR_BYTES) stop(); });
    child.once('close', (code, signal) => {
      const snapshot = code === 0 && !signal && !pending.length && !outcome?.error ? outcome?.snapshot : undefined;
      cleanup();
      if (snapshot) resolve(snapshot); else reject(fail());
    });
  });
}

export async function main(args = process.argv.slice(2)) {
  const [command = 'status', ...rest] = args;
  if (['--help', '-h', 'help'].includes(command) && rest.length === 0) {
    console.log('PLaTOP local MCP\n\n  node scripts/platop-mcp-client.mjs status\n  node scripts/platop-mcp-client.mjs set <team> <state>\n  node scripts/platop-mcp-client.mjs action <team> <kind> [<action-options-json>]\n  node scripts/platop-mcp-client.mjs decorate <team> <slot> <parts-json>\n  node scripts/platop-mcp-client.mjs style <team> <palette-and-lighting-json>\n\ninteract requires target and gesture; other kinds reject gesture. Optional motion accepts pace (unhurried/steady/brisk) and/or route (direct/roomy); celebrate rejects motion. Only bounded public activity and office data are accepted; no files, URLs or commands.');
    return 0;
  }
  if (command === 'status' && rest.length === 0) {
    console.log(JSON.stringify(await callPlatopMcp('platop_status'), null, 2));
    return 0;
  }
  if (command === 'set' && rest.length === 2) {
    const [teamId, state] = rest;
    await callPlatopMcp('platop_set_activity', { teamId, state });
    console.log(`PLaTOP MCP: ${teamId} ${state}.`);
    return 0;
  }
  if (['action', 'decorate', 'style'].includes(command)) {
    const operation = parseOfficeCommand(command, rest);
    await callPlatopMcp(operation.name, operation.arguments);
    console.log(`PLaTOP MCP: ${command === 'action' ? 'action queued' : command === 'decorate' ? 'decoration saved' : 'room style saved'}.`);
    return 0;
  }
  throw fail();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(() => { console.error(FAILURE); process.exitCode = 1; });
}
