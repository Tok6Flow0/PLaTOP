import { TEAM_IDS } from './protocol.mjs';

// Public character IDs mirror src/teams.ts; a roster crosscheck guards drift.
export const TEAM_ACTORS = Object.freeze({
  merchant: Object.freeze(['bridge-jarvis', 'bridge-scout', 'bridge-keeper']),
  hr: Object.freeze(['hr-compass', 'hr-lens', 'hr-relay']),
  intake: Object.freeze(['intake-jarvis', 'intake-beacon', 'intake-relay', 'intake-compass']),
  support: Object.freeze(['support-beacon']),
  reflection: Object.freeze(['reflection-lumen', 'reflection-echo', 'reflection-quill']),
  email: Object.freeze(['email-owl', 'email-swift']),
});
export const ACTOR_IDS = Object.freeze(Object.values(TEAM_ACTORS).flat());
export const ACTION_KINDS = Object.freeze(['walk_to', 'work', 'rest', 'celebrate', 'arrive', 'leave']);
export const PLACES = Object.freeze(['desk', 'door', 'lounge']);
export const DECOR_SLOTS = Object.freeze(['desk', 'shelf', 'wall', 'floor', 'festive']);
export const DECOR_SHAPES = Object.freeze(['box', 'sphere', 'cylinder', 'cone', 'torus']);
export const MAX_DECOR_PARTS = 12;
export const DEFAULT_DECOR_COLOR = '#efe3c8';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys, required = keys) => record(value)
  && Object.keys(value).every(key => keys.includes(key)) && required.every(key => Object.hasOwn(value, key));
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const invalid = () => new Error('Invalid public office data.');

export function parseAction(value) {
  if (!exact(value, ['teamId', 'actorId', 'kind', 'target'], ['teamId', 'kind'])) throw invalid();
  const { teamId, kind, actorId: suppliedActor } = value;
  if (!TEAM_IDS.includes(teamId) || !ACTION_KINDS.includes(kind)) throw invalid();
  const actorId = suppliedActor === undefined ? TEAM_ACTORS[teamId][0] : suppliedActor;
  if (!TEAM_ACTORS[teamId].includes(actorId)) throw invalid();
  let target;
  if (Object.hasOwn(value, 'target')) {
    const inputTarget = value.target;
    if (!['walk_to', 'arrive'].includes(kind) || !exact(inputTarget, ['officeId', 'place'])) throw invalid();
    const { officeId, place } = inputTarget;
    if (!TEAM_IDS.includes(officeId) || !PLACES.includes(place)) throw invalid();
    target = { officeId, place };
  } else if (kind === 'walk_to') throw invalid();
  else if (kind === 'arrive') target = { officeId: teamId, place: 'door' };
  return { teamId, actorId, kind, ...(target ? { target } : {}) };
}

function vector(value, fallback, minimum, maximum) {
  const input = value === undefined ? fallback : value;
  if (!Array.isArray(input) || input.length !== 3) throw invalid();
  const result = [input[0], input[1], input[2]];
  if (!result.every(number => typeof number === 'number'
    && Number.isFinite(number) && number >= minimum && number <= maximum)) throw invalid();
  return [...result];
}

export function parseDecoration(value) {
  if (!exact(value, ['teamId', 'slot', 'parts'])) throw invalid();
  const { teamId, slot, parts: inputParts } = value;
  if (!TEAM_IDS.includes(teamId) || !DECOR_SLOTS.includes(slot) || !Array.isArray(inputParts) || inputParts.length > MAX_DECOR_PARTS) throw invalid();
  const parts = Array.from(inputParts, part => {
    if (!exact(part, ['shape', 'position', 'size', 'rotation', 'color', 'glow'], ['shape'])) throw invalid();
    const { shape, position: inputPosition, size: inputSize, rotation: inputRotation, color: inputColor, glow: inputGlow } = part;
    if (!DECOR_SHAPES.includes(shape)) throw invalid();
    const position = vector(inputPosition, [0, 0, 0], -1.2, 1.2);
    const size = vector(inputSize, [0.3, 0.3, 0.3], 0.04, 1.2);
    const rotation = vector(inputRotation, [0, 0, 0], -Math.PI, Math.PI);
    const color = inputColor === undefined ? DEFAULT_DECOR_COLOR : inputColor;
    const glow = inputGlow === undefined ? false : inputGlow;
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color) || typeof glow !== 'boolean') throw invalid();
    // Every rotation of the normalized primitive remains inside its slot cube.
    const radius = Math.hypot(...size) / 2;
    if (position.some(number => Math.abs(number) + radius > 1.5)) throw invalid();
    return { shape, position, size, rotation, color: color.toLowerCase(), glow };
  });
  return { teamId, slot, parts };
}

/** Reconstruct only current public office data; reject unknown map keys. */
export function parseOfficeSnapshot(value) {
  const output = {};
  if (Object.hasOwn(value, 'actions')) {
    if (!record(value.actions) || Object.keys(value.actions).length > ACTOR_IDS.length) throw invalid();
    output.actions = Object.fromEntries(Object.entries(value.actions).map(([actorId, action]) => {
      const teamId = TEAM_IDS.find(team => TEAM_ACTORS[team].includes(actorId));
      if (!teamId || !exact(action, ['id', 'actorId', 'kind', 'target'], ['id', 'actorId', 'kind'])
        || action.actorId !== actorId || !uuid(action.id)) throw invalid();
      const parsed = parseAction({ teamId, actorId, kind: action.kind, ...(Object.hasOwn(action, 'target') ? { target: action.target } : {}) });
      return [actorId, { id: action.id, actorId, kind: parsed.kind, ...(parsed.target ? { target: parsed.target } : {}) }];
    }));
  }
  if (Object.hasOwn(value, 'assets')) {
    if (!record(value.assets) || Object.keys(value.assets).length > TEAM_IDS.length) throw invalid();
    output.assets = Object.fromEntries(Object.entries(value.assets).map(([teamId, slots]) => {
      if (!TEAM_IDS.includes(teamId) || !record(slots) || Object.keys(slots).length > DECOR_SLOTS.length) throw invalid();
      return [teamId, Object.fromEntries(Object.entries(slots).map(([slot, asset]) => {
        if (!DECOR_SLOTS.includes(slot) || !exact(asset, ['id', 'parts']) || !uuid(asset.id)) throw invalid();
        return [slot, { id: asset.id, parts: parseDecoration({ teamId, slot, parts: asset.parts }).parts }];
      }))];
    }));
  }
  return output;
}
