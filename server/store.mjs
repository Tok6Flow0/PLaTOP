import { mkdir, readFile, writeFile, rename, chmod, lstat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { TEAM_IDS, ACTIVE_TTL_MS, parsePersisted, publicState } from './protocol.mjs';

async function privateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Local data directory must be a real directory.');
  await chmod(directory, 0o700);
}

export async function ensureToken(localDirectory) {
  await privateDirectory(localDirectory);
  const tokenPath = path.join(localDirectory, 'token');
  try {
    await writeFile(tokenPath, `${randomBytes(32).toString('hex')}\n`, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const stat = await lstat(tokenPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 128) throw new Error('Local token file is invalid.');
  await chmod(tokenPath, 0o600);
  const token = (await readFile(tokenPath, 'utf8')).trim();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Local token file is invalid.');
  return token;
}

export async function createStore({ localDirectory, now = Date.now, ttlMs = ACTIVE_TTL_MS }) {
  await privateDirectory(localDirectory);
  const statePath = path.join(localDirectory, 'state.json');
  const teams = new Map(TEAM_IDS.map(teamId => [teamId, { teamId, state: 'unknown', updatedAt: null, source: 'manual' }]));
  try {
    const stat = await lstat(statePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16_384) throw new Error('Invalid saved state.');
    const saved = parsePersisted(JSON.parse(await readFile(statePath, 'utf8')), now());
    saved.forEach(team => teams.set(team.teamId, team));
    await chmod(statePath, 0o600);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // A corrupt file never becomes live telemetry; do not echo its contents.
      teams.forEach((team, teamId) => teams.set(teamId, { ...team, state: 'unknown', updatedAt: null, source: 'manual' }));
    }
  }
  let queue = Promise.resolve();
  const snapshot = () => ({ app: 'platop', schemaVersion: 1, teams: TEAM_IDS.map(teamId => publicState(teams.get(teamId), now(), ttlMs)), serverTime: new Date(now()).toISOString() });
  const persist = async () => {
    const temporary = path.join(localDirectory, `state-${randomBytes(8).toString('hex')}.tmp`);
    // Null defaults need not be persisted; absence is always unknown on restart.
    const data = JSON.stringify({ teams: [...teams.values()].filter(team => team.updatedAt !== null) });
    try {
      await writeFile(temporary, data, { flag: 'wx', mode: 0o600 });
      await rename(temporary, statePath);
    } catch (error) {
      await unlink(temporary).catch(() => {});
      throw error;
    }
  };
  return {
    snapshot,
    update(updates) {
      const operation = queue.then(async () => {
        const previous = new Map(teams);
        const updatedAt = new Date(now()).toISOString();
        updates.forEach(update => teams.set(update.teamId, { ...update, updatedAt }));
        try { await persist(); } catch (error) {
          teams.clear();
          previous.forEach((team, teamId) => teams.set(teamId, team));
          throw error;
        }
        return snapshot();
      });
      queue = operation.catch(() => {});
      return operation;
    },
    expire() {
      let changed = false;
      teams.forEach((team, teamId) => {
        const visible = publicState(team, now(), ttlMs);
        if (visible.state !== team.state) {
          teams.set(teamId, visible);
          changed = true;
        }
      });
      return changed;
    },
  };
}
