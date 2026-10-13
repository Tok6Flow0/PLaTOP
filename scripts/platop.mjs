#!/usr/bin/env node
import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { MAX_BODY_BYTES, SOURCES, TEAM_IDS, parseUpdate, parseUpdates } from '../server/protocol.mjs';
import { requestActivity as request } from '../server/client.mjs';
import { requestAction, requestDecoration } from '../server/client.mjs';
import { parseOfficeCommand } from '../server/office-cli.mjs';
const USAGE = `PLaTOP local activity\n\n  node scripts/platop.mjs status\n  node scripts/platop.mjs set <team> <state> [--source skill|codex|demo|manual]\n  node scripts/platop.mjs snapshot <public-snapshot.json>\n  node scripts/platop.mjs run <team> [--source skill|codex|demo|manual] -- <command> [args...]\n\nTeams: merchant, hr, intake, support, reflection, email\nStates: active, sleeping, waiting, unknown\n`;
const OFFICE_USAGE = `\nLocal office visuals (inline JSON only):\n  node scripts/platop.mjs action <team> <kind> [<actor-and-target-json>]\n  node scripts/platop.mjs decorate <team> <slot> <parts-json>\n\nAction options accept only actorId and target. Empty parts [] clears the slot.\n`;

function sourceOption(args) {
  if (args.length === 0) return 'skill';
  if (args.length !== 2 || args[0] !== '--source' || !SOURCES.includes(args[1])) throw new Error('Invalid source option.');
  return args[1];
}

async function run(teamId, args) {
  const separator = args.indexOf('--');
  if (separator < 0 || separator === args.length - 1) throw new Error('A command after -- is required.');
  const source = sourceOption(args.slice(0, separator));
  parseUpdate({ teamId, state: 'active', source });
  const command = args.slice(separator + 1);
  await request({ teamId, state: 'active', source });
  let heartbeatInFlight = Promise.resolve();
  let heartbeatRunning = false;
  const heartbeat = setInterval(() => {
    if (heartbeatRunning) return;
    heartbeatRunning = true;
    heartbeatInFlight = request({ teamId, state: 'active', source })
      .catch(() => { /* Bridge displays unknown after stale heartbeat; task continues. */ })
      .finally(() => { heartbeatRunning = false; });
  }, 30_000);
  const child = spawn(command[0], command.slice(1), { stdio: 'inherit', shell: false });
  const interrupt = () => child.kill('SIGINT');
  const terminate = () => child.kill('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  let code = 127;
  try {
    code = await new Promise(resolve => {
      child.once('error', () => resolve(127));
      child.once('exit', (exitCode, signal) => resolve(exitCode ?? (signal === 'SIGINT' ? 130 : 143)));
    });
  } finally {
    clearInterval(heartbeat);
    process.off('SIGINT', interrupt); process.off('SIGTERM', terminate);
    await heartbeatInFlight;
    try { await request({ teamId, state: code === 0 ? 'sleeping' : 'waiting', source }); }
    catch { console.error('PLaTOP could not publish the final activity state.'); }
  }
  return code;
}

export async function main(args = process.argv.slice(2)) {
  const [command = 'status', ...rest] = args;
  if (['--help', '-h', 'help'].includes(command)) { process.stdout.write(USAGE + OFFICE_USAGE); return 0; }
  if (command === 'status' && rest.length === 0) { console.log(JSON.stringify(await request(), null, 2)); return 0; }
  if (command === 'set' && rest.length >= 2) {
    const [teamId, state, ...options] = rest;
    const payload = parseUpdate({ teamId, state, source: sourceOption(options) });
    await request(payload);
    console.log(`PLaTOP: ${teamId} ${state}.`);
    return 0;
  }
  if (command === 'action' || command === 'decorate') {
    const operation = parseOfficeCommand(command, rest);
    if (command === 'action') await requestAction(operation.arguments);
    else await requestDecoration(operation.arguments);
    console.log(`PLaTOP: ${command === 'action' ? 'action queued' : 'decoration saved'}.`);
    return 0;
  }
  if (command === 'snapshot' && rest.length === 1) {
    const stat = await lstat(rest[0]);
    if (!stat.isFile() || stat.size > MAX_BODY_BYTES) throw new Error('Invalid public snapshot file.');
    const data = JSON.parse(await readFile(rest[0], 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.hasOwn(data, 'teams')) throw new Error('Snapshot must contain teams.');
    const teams = parseUpdates(data);
    await request({ teams });
    console.log(`PLaTOP: updated ${teams.length} team${teams.length === 1 ? '' : 's'}.`);
    return 0;
  }
  if (command === 'run' && TEAM_IDS.includes(rest[0])) return run(rest[0], rest.slice(1));
  throw new Error('Invalid command. Run with --help.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(() => {
    // No response body, user input, command text, file path, or token is printed on failure.
    console.error('PLaTOP activity update failed. Check --help, the local bridge, and the public snapshot format.');
    process.exitCode = 1;
  });
}
