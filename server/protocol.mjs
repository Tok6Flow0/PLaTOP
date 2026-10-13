export const TEAM_IDS = Object.freeze(['merchant', 'hr', 'intake', 'support', 'reflection', 'email']);
export const STATES = Object.freeze(['active', 'sleeping', 'waiting', 'unknown']);
export const SOURCES = Object.freeze(['codex', 'skill', 'manual']);
export const ACTIVE_TTL_MS = 120_000;
export const MAX_BODY_BYTES = 8192;
export const MAX_SNAPSHOT_BYTES = 131_072;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, allowed, required) {
  return isRecord(value) && Object.keys(value).every(key => allowed.includes(key)) && required.every(key => Object.hasOwn(value, key));
}

// Public telemetry is deliberately a closed vocabulary. Never store chat content.
export function parseUpdate(value) {
  if (!exactKeys(value, ['teamId', 'state', 'source'], ['teamId', 'state']) ||
      !TEAM_IDS.includes(value.teamId) || !STATES.includes(value.state) ||
      (value.source !== undefined && !SOURCES.includes(value.source))) {
    throw new Error('Invalid public activity update.');
  }
  return { teamId: value.teamId, state: value.state, source: value.source ?? 'skill' };
}

export function parseUpdates(value) {
  const batch = exactKeys(value, ['teams'], ['teams']);
  if (!batch) return [parseUpdate(value)];
  if (!Array.isArray(value.teams) || value.teams.length < 1 || value.teams.length > TEAM_IDS.length) {
    throw new Error('Invalid public activity snapshot.');
  }
  const updates = value.teams.map(parseUpdate);
  if (new Set(updates.map(update => update.teamId)).size !== updates.length) {
    throw new Error('Duplicate team in activity snapshot.');
  }
  return updates;
}

export function parsePersisted(value, now) {
  if (!exactKeys(value, ['teams'], ['teams']) || !Array.isArray(value.teams) || value.teams.length > TEAM_IDS.length) {
    throw new Error('Invalid saved state.');
  }
  const seen = new Set();
  return value.teams.map(item => {
    if (!exactKeys(item, ['teamId', 'state', 'source', 'updatedAt'], ['teamId', 'state', 'source', 'updatedAt'])) {
      throw new Error('Invalid saved state.');
    }
    const update = parseUpdate({ teamId: item.teamId, state: item.state, source: item.source });
    const time = typeof item.updatedAt === 'string' ? Date.parse(item.updatedAt) : NaN;
    if (!Number.isFinite(time) || time > now + 1000 || seen.has(item.teamId)) throw new Error('Invalid saved state.');
    seen.add(item.teamId);
    return { ...update, updatedAt: new Date(time).toISOString() };
  });
}

export function publicState(team, now, ttlMs = ACTIVE_TTL_MS) {
  if (team.state === 'active' && now - Date.parse(team.updatedAt) >= ttlMs) return { ...team, state: 'unknown' };
  return { ...team };
}
