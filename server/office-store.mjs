import { mkdir, lstat, chmod, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { MAX_SNAPSHOT_BYTES } from './protocol.mjs';
import { parseAction, parseDecoration, parseOfficeSnapshot, parseRoomStyle } from './office-protocol.mjs';

export async function createOfficeStore({ localDirectory }) {
  await mkdir(localDirectory, { recursive: true, mode: 0o700 });
  const directory = await lstat(localDirectory);
  if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('Invalid local office directory.');
  await chmod(localDirectory, 0o700);
  const file = path.join(localDirectory, 'office.json');
  let actions = {};
  let assets = {};
  let rooms = {};
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_SNAPSHOT_BYTES) throw new Error();
    const saved = JSON.parse(await readFile(file, 'utf8'));
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)
      || Object.keys(saved).some(key => !['actions', 'assets', 'rooms'].includes(key))) throw new Error();
    const parsed = parseOfficeSnapshot(saved);
    actions = parsed.actions ?? {};
    assets = parsed.assets ?? {};
    rooms = parsed.rooms ?? {};
    await chmod(file, 0o600);
  } catch { actions = {}; assets = {}; rooms = {}; /* Never echo missing/corrupt saved contents. */ }
  const snapshot = () => structuredClone({ ...(Object.keys(actions).length ? { actions } : {}), ...(Object.keys(assets).length ? { assets } : {}), ...(Object.keys(rooms).length ? { rooms } : {}) });
  let queue = Promise.resolve();
  async function persist(candidate) {
    const data = JSON.stringify(candidate);
    if (Buffer.byteLength(data) > MAX_SNAPSHOT_BYTES - 8192) throw new Error('Local office data limit reached.');
    const temporary = path.join(localDirectory, `office-${randomBytes(8).toString('hex')}.tmp`);
    try {
      await writeFile(temporary, data, { flag: 'wx', mode: 0o600 });
      await rename(temporary, file);
    } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
  }
  function update(mutate) {
    const operation = queue.then(async () => {
      const candidate = { actions: structuredClone(actions), assets: structuredClone(assets), ...(Object.keys(rooms).length ? { rooms: structuredClone(rooms) } : {}) };
      const changed = mutate(candidate);
      if (!changed) return { changed: false, ...snapshot() };
      await persist(candidate);
      actions = candidate.actions;
      assets = candidate.assets;
      rooms = candidate.rooms ?? {};
      return { changed: true, ...snapshot() };
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return {
    snapshot,
    action(value) {
      const { actorId, kind, target } = parseAction(value);
      return update(candidate => {
        candidate.actions[actorId] = { id: randomUUID(), actorId, kind, ...(target ? { target } : {}) };
        return true;
      });
    },
    decorate(value) {
      const { teamId, slot, parts } = parseDecoration(value);
      return update(candidate => {
        const previous = candidate.assets[teamId]?.[slot];
        if (!parts.length) {
          if (!previous) return false;
          delete candidate.assets[teamId][slot];
          if (!Object.keys(candidate.assets[teamId]).length) delete candidate.assets[teamId];
        } else {
          if (previous && JSON.stringify(previous.parts) === JSON.stringify(parts)) return false;
          candidate.assets[teamId] ??= {};
          candidate.assets[teamId][slot] = { id: randomUUID(), parts };
        }
        return true;
      });
    },
    style(value) {
      const patch = parseRoomStyle(value);
      return update(candidate => {
        const previous = candidate.rooms?.[patch.teamId];
        if (patch.reset) {
          if (!previous) return false;
          delete candidate.rooms[patch.teamId];
          if (!Object.keys(candidate.rooms).length) delete candidate.rooms;
        } else {
          const palette = { ...previous?.palette, ...patch.palette };
          const lighting = { ...previous?.lighting, ...patch.lighting };
          if (previous && JSON.stringify(previous.palette) === JSON.stringify(palette)
            && JSON.stringify(previous.lighting) === JSON.stringify(lighting)) return false;
          candidate.rooms ??= {};
          candidate.rooms[patch.teamId] = { id: randomUUID(), palette, lighting };
        }
        return true;
      });
    },
  };
}
