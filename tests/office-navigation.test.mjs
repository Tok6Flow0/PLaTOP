import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ACTOR_IDS } from '../server/office-protocol.mjs';

const source = await readFile(new URL('../src/scene/officeNavigation.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { OfficeNavigator, OfficeMotor, makeOfficeMap, movementProfile, angleDifference } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
const modules = new Map();
async function loadScene(relative) {
  const file = new URL(`../src/${relative}`, import.meta.url);
  if (modules.has(file.href)) return import(modules.get(file.href));
  let js = ts.transpileModule(await readFile(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  for (const match of [...js.matchAll(/from ['"]([^'"]+)['"]/g)]) {
    const specifier = match[1]; let target;
    if (specifier.startsWith('.')) {
      const dependency = new URL(`${specifier}.ts`, file);
      const root = new URL('../src/', import.meta.url);
      await loadScene(dependency.pathname.slice(root.pathname.length)); target = modules.get(dependency.href);
    } else target = import.meta.resolve(specifier);
    js = js.replace(match[0], `from ${JSON.stringify(target)}`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
  modules.set(file.href, url); return import(url);
}

async function realLayout({ withCampus = false } = {}) {
  // Structural floor tests need no browser/GPU. Canvas painting is deliberately
  // stubbed; these textures are never rendered or used for image assertions.
  const previous = globalThis.document, noop = () => {};
  const context = new Proxy({}, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'measureText') return () => ({ width: 10 });
    if (String(key).startsWith('create')) return () => ({ addColorStop: noop });
    return noop;
  }, set(target, key, value) { target[key] = value; return true; } });
  globalThis.document = { createElement: () => ({ width: 1, height: 1, getContext: () => context }) };
  try {
    const { SceneKit, disposeObject } = await loadScene('scene/primitives.ts');
    const { makeRoom, makeCampus, campusNavigation } = await loadScene('scene/rooms.ts');
    const { teams } = await loadScene('teams.ts'); const kit = new SceneKit();
    const rooms = new Map(teams.map((team, index) => [team.id, makeRoom(team, index, kit)]));
    return { teams, rooms, kit, disposeObject, campus: withCampus ? makeCampus(kit) : undefined,
      navigator: new OfficeNavigator(makeOfficeMap(rooms, teams, campusNavigation)) };
  } finally { globalThis.document = previous; }
}

function fixture({ chair = false } = {}) {
  const home = { officeId: 'home', place: 'desk', actorId: 'actor', deskIndex: 0, position: [-4, 0], egress: [-4, -.9], floorY: .1, seatHeight: .2, facing: Math.PI };
  const map = {
    zones: [{ bounds: [-6, -3, 0, 3], floorY: .1, officeId: 'home' }, { bounds: [0, -3, 6, 3], floorY: .1, officeId: 'other' }],
    blockers: [{ bounds: [-.8, -1, .8, 1] }, ...(chair ? [{ bounds: [-4.3, -.3, -3.7, .3], officeId: 'home', deskIndex: 0 }] : [])],
    waypoints: [[-2, -2], [2, -2], [-2, 2], [2, 2]],
    anchors: [home, { officeId: 'home', place: 'task', position: [-4, -2], floorY: .1 },
      { officeId: 'other', place: 'lounge', position: [4, 0], floorY: .1 },
      { officeId: 'other', place: 'door', position: [3, -2], floorY: .1 },
      { officeId: 'other', place: 'whiteboard', position: [4, -1.6], floorY: .1, facing: Math.PI },
      { officeId: 'other', place: 'cabinet', position: [4, 1.6], floorY: .1, facing: -Math.PI / 2 }],
    exit: [-5, -2], floorY: .1,
  };
  const navigator = new OfficeNavigator(map);
  return { navigator, home, motor: new OfficeMotor('actor', 'home', .4, navigator, home) };
}

test('Beacon starter reading nook fits the existing reserved floor slot and leaves neutral homes unchanged', async () => {
  const {rooms,kit,disposeObject}=await realLayout();
  const room=rooms.get('support'),nook=room.defaultSlotProps.floor;
  const {roomVisibilityRoots}=await loadScene('scene/rooms.ts');
  assert.ok(roomVisibilityRoots(room).includes(nook),'batch pruning must not override agent-controlled fallback visibility');
  room.root.updateMatrixWorld(true);
  const world=new THREE.Box3().setFromObject(nook),offset=room.root.position;
  const min=world.min.clone().sub(offset),max=world.max.clone().sub(offset);
  assert.ok(min.x>=-2.825&&max.x<=-1.475&&min.z>=.325&&max.z<=1.675);
  assert.ok(min.y>=.069&&max.y<1.8,'low shelf and supported plant stay below the character sightline');
  assert.deepEqual(room.actorHomes.map(p=>p.toArray()),[[0,.1,-1.4]]);
  assert.deepEqual(room.navigation.desks[0].screen,[-.92,-.22]);
  assert.deepEqual(room.actorFacing,[0],'neutral orientation is unchanged by the furniture revision');
  assert.ok(Math.abs(room.navigation.desks[0].facing-Math.atan2(-.92,1.18))<1e-12,
    'only an agent-chosen work interaction turns toward the actual monitor');
  assert.deepEqual(room.root.userData.rugSurface.bounds,[-2.05,-1.625,2.05,1.725]);
  assert.equal(Object.keys(room.defaultSlotProps).length,1);
  for(const [id,other] of rooms)if(id!=='support')assert.equal(Object.keys(other.defaultSlotProps).length,0);
  const resources=new THREE.Group();for(const other of rooms.values()){
    other.root.traverse(object=>{if(object.userData.staticSources)resources.add(object.userData.staticSources);});resources.add(other.root);
  }
  disposeObject(resources);kit.dispose();
});
function run(motor, limit = 4000) { for (let index = 0; index < limit && motor.pending; index++) motor.update(1 / 30); assert.equal(motor.pending, false); }

test('all sixteen public identities have stable individual pacing, turning, stride and path preferences', () => {
  const profiles = ACTOR_IDS.map(id => movementProfile(id));
  for (const field of ['speed', 'acceleration', 'turnSpeed', 'stride', 'phase', 'lateral']) {
    assert.equal(new Set(profiles.map(profile => profile[field])).size, ACTOR_IDS.length, field);
  }
  assert.equal(new Set(profiles.map(profile => profile.side)).size, 2);
  for (const id of [...ACTOR_IDS].reverse()) {
    const profile = movementProfile(id);
    assert.deepEqual(profile, profiles[ACTOR_IDS.indexOf(id)], 'construction order does not change identity');
    assert.equal(Object.isFrozen(profile), true);
    assert.ok(movementProfile(id, { pace: 'unhurried' }).speed < profile.speed);
    assert.ok(movementProfile(id, { pace: 'brisk' }).speed > profile.speed);
    assert.deepEqual(movementProfile(id, { pace: 'steady' }), profile);
  }
});

test('the same destination permits distinct deterministic safe lines without changing the endpoint', () => {
  const { navigator } = fixture();
  for (const route of [undefined, 'roomy', 'direct']) {
    const routes = ACTOR_IDS.map(id => navigator.route([-4, 0], [4, 0], .4, movementProfile(id, { route })));
    if (route !== 'direct') assert.equal(new Set(routes.map(path => JSON.stringify(path))).size, ACTOR_IDS.length);
    routes.forEach((path, index) => {
      assert.ok(path?.length);
      assert.deepEqual(path.at(-1), [4, 0]);
      assert.deepEqual(path, navigator.route([-4, 0], [4, 0], .4, movementProfile(ACTOR_IDS[index], { route })));
      let previous = [-4, 0];
      for (const next of path) { assert.equal(navigator.segmentClear(previous, next, .4), true); previous = next; }
      const length = path.reduce((sum, point, i) => sum + Math.hypot(point[0] - (i ? path[i - 1][0] : -4), point[1] - (i ? path[i - 1][1] : 0)), 0);
      assert.ok(length < 12, 'variation must not turn a short journey into a tour');
    });
  }
});

test('roomy preference falls back through a narrow corridor instead of clipping or refusing a safe journey', () => {
  const navigator = new OfficeNavigator({ zones: [{ bounds: [-5, -.45, 5, .45], floorY: 0 }],
    blockers: [], waypoints: [], anchors: [], exit: [4, 0], floorY: 0 });
  for (const id of ACTOR_IDS) {
    const path = navigator.route([-4, 0], [4, 0], .4, movementProfile(id, { route: 'roomy' }));
    assert.deepEqual(path, [[4, 0]], 'tight space legitimately shares the only safe line');
  }
  assert.deepEqual(navigator.route([-4, 0], [4, 0], .4, movementProfile('actor', { route: 'direct' })), [[4, 0]]);
});

test('chosen pace survives heartbeats and replan, restores without replay, and resets only on the next intent', () => {
  const { motor } = fixture();
  const action = { id: 'chosen', actorId: 'actor', kind: 'interact', target: { officeId: 'other', place: 'whiteboard' },
    gesture: 'think', motion: { pace: 'unhurried', route: 'roomy' } };
  motor.apply(action); motor.update(.1);
  const profile = motor.profile, pose = [motor.x, motor.z, motor.walkPhase];
  for (const status of ['active', 'waiting', 'sleeping', 'unknown']) motor.fallback(status);
  motor.update(0); assert.equal(motor.apply(action), false);
  assert.deepEqual([motor.x, motor.z, motor.walkPhase], pose); assert.equal(motor.profile, profile);
  motor.replan(); assert.equal(motor.profile, profile); run(motor);
  const restored = fixture().motor;
  assert.equal(restored.restore(action), true); assert.deepEqual(restored.profile, profile);
  assert.equal(restored.pending, false); assert.deepEqual([restored.x, restored.z], [motor.x, motor.z]);
  assert.equal(motor.apply({ id: 'invalid', actorId: 'actor', kind: 'walk_to', target: { officeId: 'missing', place: 'door' }, motion: { pace: 'brisk' } }), false);
  assert.equal(motor.profile, profile, 'invalid destination does not change current pacing');
  motor.apply({ id: 'next', actorId: 'actor', kind: 'work' });
  assert.deepEqual(motor.profile, movementProfile('actor')); run(motor);
});

test('all paces carry momentum through gentle waypoints and brake at the final destination', () => {
  for (const actorId of ACTOR_IDS) for (const pace of ['unhurried', 'steady', 'brisk']) {
    const { navigator, home } = fixture();
    navigator.map.blockers = [];
    const motor = new OfficeMotor(actorId, 'home', .4, navigator, { ...home, actorId, facing: Math.PI / 2 });
    motor.apply({ id: 'journey', actorId, kind: 'walk_to', target: { officeId: 'other', place: 'lounge' }, motion: { pace } });
    let movingCorners = 0;
    for (let frame = 0; frame < 4000 && motor.pending; frame++) {
      const corner = motor.pathIndex, speed = motor.speed, heading = motor.heading, from = [motor.x, motor.z];
      motor.update(1 / 30);
      assert.ok(motor.speed <= motor.profile.speed + 1e-9);
      assert.ok(motor.speed - speed <= motor.profile.acceleration / 30 + 1e-9);
      assert.ok(Math.abs(angleDifference(motor.heading, heading)) <= motor.profile.turnSpeed / 30 + 1e-9);
      assert.equal(navigator.segmentClear(from, [motor.x, motor.z], .4), true);
      if (motor.pathIndex !== corner && motor.pending && motor.speed > motor.profile.speed * .15) movingCorners++;
    }
    assert.ok(movingCorners >= 3, 'intermediate waypoints are not repeated full stops');
    assert.equal(motor.pending, false); assert.equal(motor.speed, 0);
    assert.deepEqual([motor.x, motor.z], [4, 0]);
  }
});

test('switching to reduced motion settles the current chosen route once without replaying it', () => {
  const { motor, navigator } = fixture();
  const action = { id: 'current', actorId: 'actor', kind: 'interact', target: { officeId: 'other', place: 'whiteboard' }, gesture: 'think' };
  assert.equal(motor.apply(action), true); motor.update(.1); assert.equal(motor.pending, true);
  assert.equal(motor.restore(action), true);
  assert.deepEqual([motor.x, motor.z], navigator.anchor('other', 'whiteboard').position);
  assert.equal(motor.pending, false); assert.equal(motor.gesture, 'think');
  assert.equal(motor.restore(action), false);
});

test('routes across connected floor rectangles around furniture with continuous clearance', () => {
  const { navigator } = fixture();
  const path = navigator.route([-4, 0], [4, 0], .4);
  assert.ok(path && path.length > 1);
  let previous = [-4, 0];
  for (const next of path) { assert.equal(navigator.segmentClear(previous, next, .4), true); previous = next; }
  assert.equal(navigator.segmentClear([-4, 0], [4, 0], .4), false);
  assert.equal(navigator.pointClear([0, -2], .4), true, 'shared room boundary remains walkable');
});

test('thin blockers and floor edges cannot be crossed by a large step', () => {
  const { navigator } = fixture();
  navigator.map.blockers.push({ bounds: [-3, -3, -2.99, 3] });
  navigator.setDecorations({});
  assert.equal(navigator.route([-4, 0], [4, 0], .4), null);
  assert.equal(navigator.segmentClear([-5.8, 0], [-5.8, 2], .4), false);
});

test('motors cap speed and turn rate, stop at target, and never circle their chair', () => {
  const { motor, navigator } = fixture();
  assert.equal(motor.apply({ id: 'one', actorId: 'actor', kind: 'walk_to', target: { officeId: 'other', place: 'lounge' } }), true);
  for (let index = 0; index < 4000 && motor.pending; index++) {
    const previous = [motor.x, motor.z], heading = motor.heading;
    motor.update(1 / 30);
    assert.ok(motor.speed <= motor.profile.speed + 1e-9);
    assert.ok(Math.abs(angleDifference(motor.heading, heading)) <= motor.profile.turnSpeed / 30 + 1e-9);
    assert.equal(navigator.segmentClear(previous, [motor.x, motor.z], motor.radius), true);
  }
  assert.equal(motor.pending, false);
  assert.deepEqual([motor.x, motor.z], [4, 0]);
  const rest = [motor.x, motor.z, motor.heading, motor.distance];
  for (let index = 0; index < 600; index++) motor.update(1 / 30);
  assert.deepEqual([motor.x, motor.z, motor.heading, motor.distance], rest);
});

test('repeated action ids do not restart a route; replacement starts at actual position', () => {
  const { motor } = fixture();
  const action = { id: 'one', actorId: 'actor', kind: 'walk_to', target: { officeId: 'other', place: 'lounge' } };
  motor.apply(action); for (let index = 0; index < 80; index++) motor.update(1 / 30);
  const before = [motor.x, motor.z, motor.distance];
  assert.equal(motor.apply(action), false);
  assert.deepEqual([motor.x, motor.z, motor.distance], before);
  assert.equal(motor.apply({ id: 'two', actorId: 'actor', kind: 'work' }), true);
  assert.deepEqual([motor.x, motor.z, motor.distance], before);
  run(motor); assert.deepEqual([motor.x, motor.z], [-4, 0]); assert.equal(motor.heading, Math.PI);
});

test('only the assigned desk egress may cross its chair footprint', () => {
  const { motor, navigator, home } = fixture({ chair: true });
  assert.equal(navigator.pointClear(home.position, .4), false);
  assert.equal(navigator.segmentClear(home.position, home.egress, .4, home), true);
  assert.equal(navigator.segmentClear(home.position, home.egress, .4, { ...home, deskIndex: 1 }), false);
  assert.equal(motor.apply({ id: 'one', actorId: 'actor', kind: 'walk_to', target: { officeId: 'other', place: 'lounge' } }), true);
  run(motor); assert.equal(motor.y, .1);
  motor.apply({ id: 'two', actorId: 'actor', kind: 'work' }); run(motor);
  assert.deepEqual([motor.x, motor.y, motor.z, motor.heading], [-4, .2, 0, Math.PI]);
});

test('leave hides only after reaching exit; arrive walks back without teleporting present avatars', () => {
  const { motor, navigator } = fixture();
  motor.apply({ id: 'leave', actorId: 'actor', kind: 'leave' }); assert.equal(motor.present, true);
  run(motor); assert.equal(motor.present, false); assert.deepEqual([motor.x, motor.z], navigator.map.exit);
  motor.apply({ id: 'arrive', actorId: 'actor', kind: 'arrive' }); assert.equal(motor.present, true);
  assert.deepEqual([motor.x, motor.z], navigator.map.exit);
  run(motor); assert.equal(motor.mode, 'work'); assert.deepEqual([motor.x, motor.z], [-4, 0]);
});

test('activity reports never move avatars, select gestures, or release explicit routes and poses', () => {
  const { motor } = fixture();
  const statuses = ['active', 'sleeping', 'waiting', 'unknown', 'active', 'sleeping'];
  const initial = [motor.x, motor.y, motor.z, motor.heading, motor.mode, motor.distance, motor.gesture];
  for (let index = 0; index < 600; index++) { motor.fallback(statuses[index % statuses.length]); motor.update(1 / 30); }
  assert.deepEqual([motor.x, motor.y, motor.z, motor.heading, motor.mode, motor.distance, motor.gesture], initial);
  motor.apply({ id: 'one', actorId: 'actor', kind: 'walk_to', target: { officeId: 'other', place: 'lounge' } });
  for (let index = 0; index < 4000 && motor.pending; index++) { motor.fallback(statuses[index % statuses.length]); motor.update(1 / 30); }
  assert.deepEqual([motor.x, motor.z], [4, 0]); assert.equal(motor.mode, 'idle');
  const completed = [motor.x, motor.y, motor.z, motor.heading, motor.mode, motor.distance];
  for (let index = 0; index < 600; index++) { motor.fallback(statuses[index % statuses.length]); motor.update(1 / 30); }
  assert.deepEqual([motor.x, motor.y, motor.z, motor.heading, motor.mode, motor.distance], completed);
  assert.equal(motor.manual, true, 'only the agent can replace its intent');
});

test('activity changes never respawn an absent avatar or release an explicit arrival or rest', () => {
  const { motor } = fixture();
  motor.fallback('active'); run(motor);
  motor.apply({ id: 'leave', actorId: 'actor', kind: 'leave' }); run(motor);
  motor.fallback('sleeping'); motor.fallback('active'); assert.equal(motor.present, false);
  motor.apply({ id: 'return', actorId: 'actor', kind: 'arrive' });
  motor.fallback('sleeping'); run(motor); assert.equal(motor.mode, 'work');
  motor.fallback('active'); run(motor); assert.equal(motor.mode, 'work');
  motor.fallback('sleeping'); run(motor); assert.equal(motor.mode, 'work');
  motor.apply({ id: 'rest', actorId: 'actor', kind: 'rest' }); run(motor);
  motor.fallback('active'); assert.equal(motor.mode, 'rest');
});

test('invalid targets and actor ids cannot displace avatars; zero elapsed time freezes motor pose', () => {
  const { motor } = fixture();
  const before = [motor.x, motor.y, motor.z, motor.heading];
  assert.equal(motor.apply({ id: 'bad', actorId: 'someone-else', kind: 'leave' }), false);
  assert.equal(motor.apply({ id: 'unknown', actorId: 'actor', kind: 'walk_to', target: { officeId: 'missing', place: 'lounge' } }), false);
  assert.deepEqual([motor.x, motor.y, motor.z, motor.heading], before);
  motor.apply({ id: 'valid', actorId: 'actor', kind: 'leave' }); motor.update(0);
  assert.deepEqual([motor.x, motor.y, motor.z, motor.heading], before);
});

test('decoration changes invalidate graph clearance and safely reject an obstructed route', () => {
  const { navigator } = fixture();
  navigator.map.blockers.push({ officeId: 'home', decoration: 'plant', bounds: [-3, -3, -2.8, 3] });
  assert.ok(navigator.route([-4, 0], [4, 0], .4));
  navigator.setDecorations({ home: ['plant'] });
  assert.equal(navigator.route([-4, 0], [4, 0], .4), null);
});

test('persisted work/rest at startup stays agent-owned through later bridge transitions', () => {
  const { motor } = fixture();
  motor.fallback('active'); motor.apply({ id: 'persisted', actorId: 'actor', kind: 'rest' });
  assert.equal(motor.mode, 'rest'); assert.equal(motor.pending, false);
  motor.fallback('active'); assert.equal(motor.mode, 'rest');
  motor.fallback('sleeping'); assert.equal(motor.mode, 'rest');
  motor.fallback('active'); run(motor); assert.equal(motor.mode, 'rest');
  motor.apply({ id: 'agent-work', actorId: 'actor', kind: 'work' }); run(motor); assert.equal(motor.mode, 'work');
});

test('opening a new view restores the last chosen interaction or departure without staging a trip', () => {
  const { motor, navigator } = fixture({ chair: true });
  const interaction = { id: 'chosen', actorId: 'actor', kind: 'interact', gesture: 'file', target: { officeId: 'other', place: 'cabinet' } };
  assert.equal(motor.restore(interaction), true);
  const cabinet = navigator.anchor('other', 'cabinet');
  assert.deepEqual([motor.x, motor.y, motor.z, motor.heading], [cabinet.position[0], cabinet.floorY, cabinet.position[1], cabinet.facing]);
  assert.equal(motor.gesture, 'file'); assert.equal(motor.mode, 'interact');
  assert.equal(motor.distance, 0); assert.equal(motor.pending, false);
  assert.equal(motor.restore(interaction), false); assert.equal(motor.apply(interaction), false);
  const chosen = [motor.x, motor.y, motor.z, motor.heading, motor.mode, motor.gesture, motor.distance];
  assert.equal(motor.restore({ ...interaction, id: 'missing', target: { officeId: 'missing', place: 'cabinet' } }), false);
  assert.deepEqual([motor.x, motor.y, motor.z, motor.heading, motor.mode, motor.gesture, motor.distance], chosen);
  assert.equal(motor.apply({ id: 'next', actorId: 'actor', kind: 'work' }), true);
  assert.deepEqual([motor.x, motor.z], cabinet.position, 'later intent starts at the restored place');
  run(motor); assert.deepEqual([motor.x, motor.z], motor.home.position); assert.ok(motor.distance > 0);

  const reopened = fixture({ chair: true }).motor;
  const departure = { id: 'departed', actorId: 'actor', kind: 'leave' };
  assert.equal(reopened.restore(departure), true); assert.equal(reopened.present, false);
  assert.equal(reopened.pending, false); assert.equal(reopened.distance, 0);
  assert.equal(reopened.apply(departure), false); reopened.fallback('active'); assert.equal(reopened.present, false);
  assert.equal(reopened.apply({ id: 'return', actorId: 'actor', kind: 'arrive' }), true);
  assert.deepEqual([reopened.x, reopened.z], reopened.navigator.map.exit);
  run(reopened); assert.equal(reopened.present, true); assert.deepEqual([reopened.x, reopened.z], reopened.home.position);
});

test('restoration preserves target validation, assigned seats and neutral consumed celebrations', () => {
  const { motor, navigator } = fixture({ chair: true });
  for (const kind of ['work', 'rest']) {
    assert.equal(motor.restore({ id: kind, actorId: 'actor', kind }), true);
    assert.deepEqual([motor.x, motor.y, motor.z], [motor.home.position[0], motor.home.seatHeight, motor.home.position[1]]);
    assert.equal(motor.mode, kind); assert.equal(motor.pending, false);
  }
  assert.equal(motor.restore({ id: 'arrived', actorId: 'actor', kind: 'arrive', target: { officeId: 'other', place: 'door' } }), true);
  assert.deepEqual([motor.x, motor.z], navigator.anchor('other', 'door').position);
  assert.equal(motor.mode, 'idle'); assert.equal(motor.pending, false);
  assert.equal(motor.restore({ id: 'visitor', actorId: 'actor', kind: 'walk_to', target: { officeId: 'other', place: 'desk' } }), true);
  assert.deepEqual([motor.x, motor.z], navigator.anchor('other', 'lounge').position);
  const before = [motor.x, motor.y, motor.z, motor.heading, motor.mode, motor.gesture];
  navigator.map.blockers.push({ bounds: [3.2, 0.8, 4.8, 2.4] }); navigator.setDecorations({});
  assert.equal(motor.restore({ id: 'blocked', actorId: 'actor', kind: 'interact', target: { officeId: 'other', place: 'cabinet' }, gesture: 'file' }), false);
  assert.deepEqual([motor.x, motor.y, motor.z, motor.heading, motor.mode, motor.gesture], before);
  assert.equal(motor.restore({ id: 'cheer', actorId: 'actor', kind: 'celebrate' }), true);
  assert.equal(motor.mode, 'idle'); assert.equal(motor.celebration, 0); assert.equal(motor.pending, false);
  assert.equal(motor.apply({ id: 'cheer', actorId: 'actor', kind: 'celebrate' }), false);
  const untouched = fixture().motor;
  assert.equal(untouched.restore({ id: 'other-actor', actorId: 'someone-else', kind: 'leave' }), false);
  assert.equal(untouched.present, true); assert.equal(untouched.mode, 'idle');
});

test('explicit interaction travels once, faces the prop, and holds its gesture through status and heartbeat changes', () => {
  const { motor, navigator } = fixture({ chair: true });
  const action = { id: 'thinking', actorId: 'actor', kind: 'interact', gesture: 'think', target: { officeId: 'other', place: 'whiteboard' } };
  assert.equal(motor.apply(action), true); assert.equal(motor.gesture, undefined);
  for (let index = 0; index < 4000 && motor.pending; index++) {
    assert.equal(motor.gesture, undefined, 'gesture starts only after movement and final facing');
    motor.fallback(index % 2 ? 'active' : 'sleeping'); motor.update(1 / 30);
  }
  assert.equal(motor.pending, false); assert.equal(motor.mode, 'interact'); assert.equal(motor.gesture, 'think');
  const anchor = navigator.anchor('other', 'whiteboard');
  assert.deepEqual([motor.x, motor.z, motor.heading], [...anchor.position, anchor.facing]);
  const held = [motor.x, motor.y, motor.z, motor.heading, motor.distance, motor.gesture];
  for (let index = 0; index < 600; index++) {
    assert.equal(motor.apply(action), false, 'repeat heartbeat id is stable');
    motor.fallback(['waiting', 'unknown', 'active', 'sleeping'][index % 4]); motor.update(1 / 30);
  }
  assert.deepEqual([motor.x, motor.y, motor.z, motor.heading, motor.distance, motor.gesture], held);
  assert.equal(motor.apply({ ...action, id: 'invalid', target: { officeId: 'absent', place: 'whiteboard' } }), false);
  assert.deepEqual([motor.x, motor.y, motor.z, motor.heading, motor.distance, motor.gesture], held, 'invalid interaction cannot replace a valid pose');
  motor.apply({ id: 'work', actorId: 'actor', kind: 'work' }); assert.equal(motor.gesture, undefined);
  run(motor); assert.equal(motor.mode, 'work'); assert.equal(motor.heading, motor.home.facing);
});

test('all gestures are agent choices at any valid target; visitors keep their own assigned desks', () => {
  const { motor } = fixture();
  for (const gesture of ['work', 'think', 'file', 'talk', 'wait']) {
    assert.equal(motor.apply({ id: gesture, actorId: 'actor', kind: 'interact', gesture, target: { officeId: 'other', place: 'cabinet' } }), true);
    run(motor); assert.equal(motor.gesture, gesture);
  }
  const held = [motor.x, motor.y, motor.z, motor.heading, motor.gesture];
  motor.update(0); assert.deepEqual([motor.x, motor.y, motor.z, motor.heading, motor.gesture], held);
  motor.apply({ id: 'visitor', actorId: 'actor', kind: 'interact', gesture: 'talk', target: { officeId: 'other', place: 'desk' } });
  run(motor); assert.deepEqual([motor.x, motor.z], [4, 0]); assert.equal(motor.gesture, 'talk');
  motor.apply({ id: 'leaving', actorId: 'actor', kind: 'leave' }); assert.equal(motor.gesture, undefined);
  const paused = [motor.x, motor.y, motor.z, motor.heading, motor.distance];
  motor.update(0); assert.deepEqual([motor.x, motor.y, motor.z, motor.heading, motor.distance], paused);
  run(motor); assert.equal(motor.present, false); assert.equal(motor.gesture, undefined);
  motor.fallback('active'); assert.equal(motor.present, false);
});

test('real sixteen-avatar layout connects every assigned desk, interaction stop, six doors/lounges and exit with decoration on/off', async t => {
  const { teams, rooms, kit, disposeObject, navigator } = await realLayout();
  t.after(() => { for (const room of rooms.values()) disposeObject(room.root); kit.dispose(); });
  for (const decorated of [false, true]) {
    navigator.setDecorations(Object.fromEntries(teams.map(team => [team.id, decorated ? ['plant', 'lamp', 'art'] : []])));
    for (const team of teams) for (const character of team.members) {
      const radius = character.kind === 'owl' ? .7 : character.kind === 'swift' ? .6 : .61;
      const home = navigator.desk(character.id), label = `${character.id} decorations=${decorated}`;
      assert.ok(navigator.segmentClear(home.position, home.egress, radius, home), `${label} assigned chair egress`);
      const create = () => new OfficeMotor(character.id, team.id, radius, navigator, home);
      const active = create(); active.fallback('active'); assert.equal(active.blocked, false, `${label} inert activity report`);
      assert.equal(active.distance, 0); assert.equal(active.mode, 'idle'); assert.equal(active.heading, home.facing, `${label} exact desk facing`);
      for (const target of teams) for (const place of ['door', 'lounge', 'whiteboard', 'cabinet']) {
        const anchor = navigator.anchor(target.id, place);
        assert.ok(anchor, `${target.id}/${place} exists only for a real prop`);
        const motor = create();
        assert.equal(motor.apply({ id: `${target.id}-${place}`, actorId: character.id, kind: 'walk_to', target: { officeId: target.id, place } }), true, `${label} ${target.id}/${place}`);
        run(motor); assert.equal(motor.blocked, false);
        assert.deepEqual([motor.x, motor.z], anchor.position);
        if (anchor.facing !== undefined) assert.equal(motor.heading, anchor.facing);
        const restored = create();
        assert.equal(restored.restore({ id: 'reopened', actorId: character.id, kind: 'walk_to', target: { officeId: target.id, place } }), true, `${label} restore ${target.id}/${place}`);
        assert.deepEqual([restored.x, restored.z], anchor.position); assert.equal(restored.pending, false);
        motor.apply({ id: 'return', actorId: character.id, kind: 'work' }); run(motor);
        assert.deepEqual([motor.x, motor.z], home.position, `${label} return home`);
      }
      const leaving = create(); assert.equal(leaving.apply({ id: 'leave', actorId: character.id, kind: 'leave' }), true, `${label} exit`); run(leaving);
      assert.equal(leaving.present, false); leaving.apply({ id: 'arrive', actorId: character.id, kind: 'arrive' }); run(leaving); assert.equal(leaving.present, true);
    }
  }
});

test('three-member side places use their real floor-height homes beside their shared desk without imaginary chairs', async t => {
  const { teams, rooms, kit, disposeObject, navigator } = await realLayout();
  t.after(() => { for (const room of rooms.values()) disposeObject(room.root); kit.dispose(); });
  for (const officeId of ['merchant', 'hr']) {
    const room = rooms.get(officeId), { desks, blockers, floorY } = room.navigation;
    const width=officeId==='hr'?2.5:2.75,depth=officeId==='hr'?1.6:1.4;
    const table = blockers.find(({ bounds: [x0, z0, x1, z1], deskIndex }) => deskIndex === undefined
      && Math.abs(x1 - x0 - width) < 1e-9 && Math.abs(z1 - z0 - depth) < 1e-9);
    assert.ok(table, `${officeId} blocks its actual shared table dimensions`);
    const [x0, z0, x1, z1] = table.bounds, tableZ = (z0 + z1) / 2;
    for (const memberIndex of [0, 2]) {
      const desk = desks[memberIndex], home = room.actorHomes[memberIndex];
      assert.deepEqual([home.x, home.y, home.z], [desk.position[0], floorY, desk.position[1]], `${officeId}/${memberIndex} has no visual-only offset`);
      assert.equal(desk.seatHeight, floorY, `${officeId}/${memberIndex} stands rather than floating over a missing chair`);
      assert.ok(Math.abs(desk.position[1] - tableZ) < .4, `${officeId}/${memberIndex} is beside the table, not along its front edge`);
      assert.ok(memberIndex === 0 ? desk.position[0] < x0 : desk.position[0] > x1, `${officeId}/${memberIndex} is outside the tabletop`);
      assert.equal(blockers.some(blocker => blocker.deskIndex === memberIndex), false, `${officeId}/${memberIndex} has no unrendered side chair`);
      const character=teams.find(team=>team.id===officeId).members[memberIndex];
      const motor=new OfficeMotor(character.id,officeId,.61,navigator,navigator.desk(character.id));
      motor.heading=room.actorFacing[memberIndex];
      assert.equal(motor.pending,false,'neutral authored facing does not schedule a turn');
      assert.equal(motor.mode,'idle');
      assert.equal(motor.heading,memberIndex===0?.32:-.38,'neutral pose remains the actual physical motor heading');
      assert.equal(motor.restore({id:`chosen-work-${memberIndex}`,actorId:character.id,kind:'work'}),true);
      assert.equal(motor.heading,desk.facing,'only a chosen work action restores desk-facing pose');
    }
    assert.ok(desks[1].position[1] < z0, `${officeId} center resident remains behind the desk`);
    assert.ok(blockers.some(blocker => blocker.deskIndex === 1), `${officeId} center resident retains a real chair`);
  }
});

test('all sixteen bodies retain clearance and settle with every chosen pace and route in furnished rooms', async t => {
  const { teams, rooms, kit, disposeObject, navigator } = await realLayout();
  t.after(() => { for (const room of rooms.values()) disposeObject(room.root); kit.dispose(); });
  navigator.setDecorations(Object.fromEntries(teams.map(team => [team.id, ['plant', 'lamp', 'art']])));
  for (const [index, team] of teams.entries()) for (const character of team.members) {
    const radius = character.kind === 'owl' ? .7 : character.kind === 'swift' ? .6 : .61;
    const home = navigator.desk(character.id), target = { officeId: teams[(index + 1) % teams.length].id, place: 'whiteboard' };
    for (const pace of ['unhurried', 'steady', 'brisk']) for (const route of ['direct', 'roomy']) {
      const motor = new OfficeMotor(character.id, team.id, radius, navigator, home);
      assert.equal(motor.apply({ id: 'chosen', actorId: character.id, kind: 'walk_to', target, motion: { pace, route } }), true, `${character.id} ${pace}/${route} reaches ${target.officeId}/${target.place}`);
      for (let frame = 0; frame < 4000 && motor.pending; frame++) {
        const from = [motor.x, motor.z]; motor.update(1 / 30);
        const chairException = navigator.pointClear(from, radius) ? undefined : home;
        assert.equal(navigator.segmentClear(from, [motor.x, motor.z], radius, chairException), true,
          `${character.id} ${pace}/${route} retains actual body clearance`);
      }
      assert.equal(motor.pending, false); assert.equal(motor.blocked, false);
      assert.deepEqual([motor.x, motor.z], navigator.anchor(target.officeId, target.place).position);
    }
  }
});

test('lower inner-side doors cut real walls and parapets above physical bridge floors while their back walls stay solid', async t => {
  const { rooms, kit, disposeObject, navigator, campus } = await realLayout({ withCampus: true });
  campus.updateMatrixWorld(true);
  t.after(() => { disposeObject(campus); for (const room of rooms.values()) disposeObject(room.root); kit.dispose(); });
  const meshes = root => { const result = []; root.traverse(object => { if (object.isMesh) result.push(object); }); return result; };
  const foyer = rooms.get('reflection');
  for (const [officeId, direction] of [['support', 1], ['email', -1]]) {
    const room = rooms.get(officeId), door = navigator.anchor(officeId, 'door'); room.root.updateMatrixWorld(true);
    const localZ = door.position[1] - room.center.z;
    assert.equal(door.position[0] - room.center.x, direction * 3, `${officeId} enters through its actual inner side`);
    const wall = room.walls.find(wall => wall.normal.x === direction);
    const ray = new THREE.Raycaster(new THREE.Vector3(room.center.x + direction * 2, 1.2, door.position[1]), new THREE.Vector3(direction, 0, 0), 0, 1.5);
    assert.equal(ray.intersectObjects(meshes(wall.root)).length, 0, `${officeId} doorway has no physical wall or base trim across its body clearance`);
    ray.ray.origin.z += 1.15;
    assert.ok(ray.intersectObjects(meshes(wall.root)).length > 0, `${officeId} preserves its solid wall beside the opening`);
    const back = room.walls.find(wall => wall.normal.z === -1);
    const backRay = new THREE.Raycaster(new THREE.Vector3(room.center.x, .6, room.center.z), new THREE.Vector3(0, 0, -1));
    for (const localX of [-2, 0, 2]) {
      backRay.ray.origin.x = room.center.x + localX;
      assert.ok(backRay.intersectObjects(meshes(back.root)).length > 0, `${officeId} back wall is physically solid at x=${localX}`);
    }
    foyer.root.updateMatrixWorld(true);
    const foyerDirection = -direction, parapet = foyer.walls.find(wall => wall.normal.x === foyerDirection);
    const parapetRay = new THREE.Raycaster(new THREE.Vector3(foyerDirection * 2, .5, foyer.center.z + localZ), new THREE.Vector3(foyerDirection, 0, 0), 0, 1.5);
    assert.equal(parapetRay.intersectObjects(meshes(parapet.root)).length, 0, `${officeId} passage also cuts the real foyer parapet`);
    parapetRay.ray.origin.z += 1.15;
    assert.ok(parapetRay.intersectObjects(meshes(parapet.root)).length > 0, `${officeId} keeps the remaining foyer parapet`);
    const bridge = [foyerDirection * 3.075, door.position[1]];
    assert.equal(navigator.pointClear(bridge, .7), true, `${officeId} bridge carries the largest avatar disk`);
    const floorRay = new THREE.Raycaster(new THREE.Vector3(bridge[0], .2, bridge[1]), new THREE.Vector3(0, -1, 0));
    const floor = floorRay.intersectObjects(meshes(campus))[0];
    assert.ok(floor && Math.abs(floor.point.y - .075) < 1e-6, `${officeId} bridge has a rendered walking surface, not only floor metadata`);
  }
});

test('wall decoration anchors bind to a real wall or the foyer parapet', async t => {
  const { rooms, kit, disposeObject } = await realLayout();
  t.after(() => { for (const room of rooms.values()) disposeObject(room.root); kit.dispose(); });
  for (const [id, room] of rooms) {
    const anchor = room.assetSlots.wall.position;
    const wall = room.walls.find(wall => wall.normal.x < -0.5);
    assert.ok(wall, `${id} has a matching physical wall and cutaway normal`);
    room.root.updateMatrixWorld(true);
    const point = room.root.localToWorld(new THREE.Vector3(...anchor));
    const bounds = new THREE.Box3().setFromObject(wall.root);
    assert.ok(bounds.distanceToPoint(point) < 0.07, `${id} mount sits against its actual wall`);
    assert.ok(point.y >= bounds.min.y && point.y <= bounds.max.y, `${id} mount fits its wall height`);
  }
});

test('shelf decoration anchors follow actual varied storage top surfaces',async t=>{
  const {rooms,kit,disposeObject}=await realLayout();
  t.after(()=>{for(const room of rooms.values())disposeObject(room.root);kit.dispose();});
  const heights=new Set();
  for(const [id,room]of rooms){
    room.root.updateMatrixWorld(true);
    const local=new THREE.Vector3(...room.assetSlots.shelf.position);heights.add(local.y);
    const origin=room.root.localToWorld(local.clone());
    const surfaces=[];room.root.traverse(object=>{if(object.isMesh)surfaces.push(object);});
    const hit=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),0,.04).intersectObjects(surfaces)[0];
    assert.ok(hit&&hit.distance<.025,`${id} shelf recipe sits just above a real plank`);
  }
  assert.ok(heights.size>=3,'the campus retains low foyer storage and varied taller bookcases');
});

test('every interaction stop faces a nearby real prop with full avatar clearance', async t => {
  const { teams, rooms, kit, disposeObject, navigator } = await realLayout();
  t.after(() => { for (const room of rooms.values()) disposeObject(room.root); kit.dispose(); });
  navigator.setDecorations(Object.fromEntries(teams.map(team => [team.id, ['plant', 'lamp', 'art']])));
  for (const [officeId, room] of rooms) {
    room.root.updateMatrixWorld(true);
    for (const place of ['whiteboard', 'cabinet']) {
      const anchor = navigator.anchor(officeId, place), prop = room.root.getObjectByName(`${officeId}:${place}`);
      assert.ok(prop, `${officeId}/${place} has a physical prop`);
      const bounds = new THREE.Box3().setFromObject(prop), center = prop.getWorldPosition(new THREE.Vector3());
      assert.equal(bounds.isEmpty(), false, `${officeId}/${place} contains visible geometry`);
      assert.equal(navigator.pointClear(anchor.position, .7), true, `${officeId}/${place} fits the largest avatar`);
      const direction = Math.atan2(center.x - anchor.position[0], center.z - anchor.position[1]);
      assert.ok(Math.abs(angleDifference(anchor.facing, direction)) < 1e-9, `${officeId}/${place} faces its prop`);
      const stop = new THREE.Vector3(anchor.position[0], THREE.MathUtils.clamp(1.0, bounds.min.y, bounds.max.y), anchor.position[1]);
      assert.ok(bounds.distanceToPoint(stop) < 1.35, `${officeId}/${place} is within a small interaction's reach`);
    }
  }
  const reflection = rooms.get('reflection'), cabinet = reflection.root.getObjectByName('reflection:cabinet');
  const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(cabinet.getWorldQuaternion(new THREE.Quaternion()));
  const stop = navigator.anchor('reflection', 'cabinet'), center = cabinet.getWorldPosition(new THREE.Vector3());
  assert.ok(facing.dot(new THREE.Vector3(stop.position[0] - center.x, 0, stop.position[1] - center.z).normalize()) > .99, 'reflection files at the cabinet front');
});

test('folded Swift transit silhouette remains inside its certified clearance across a full wing cycle', async t => {
  const { teams, kit } = await realLayout();
  const { makeProxy, animateCharacter } = await loadScene('scene/proxies.ts');
  const swift = teams.flatMap(team => team.members).find(character => character.kind === 'swift');
  const model = makeProxy(swift, kit), vertex = new THREE.Vector3(); t.after(() => kit.dispose());
  for (let index = 0; index < 72; index++) {
    animateCharacter(model, 'active', index / 12, 0, true, false, { phase: index / 72 * Math.PI * 2, speed: .85, seatLift: 0, celebration: 0, foldWings: true });
    model.updateMatrixWorld(true);
    model.traverse(object => {
      if (!object.isMesh) return;
      const positions = object.geometry.attributes.position;
      for (let index = 0; index < positions.count; index++) {
        vertex.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
        assert.ok(Math.hypot(vertex.x, vertex.z) <= .6, 'folded geometry fits transit motor disk');
      }
    });
  }
});

test('approved authored owl feet retain their exact standing world positions while seated, through all runtime clips', async () => {
  const { AuthoredFootPose } = await loadScene('scene/proxies.ts');
  for (const id of ['email-owl', 'reflection-echo', 'reflection-quill']) {
    const bytes = await readFile(new URL(`../public/assets/characters/${id}.glb`, import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const bounds = new THREE.Box3().setFromObject(gltf.scene), scale = 1.85 / (bounds.max.y - bounds.min.y);
    gltf.scene.scale.multiplyScalar(scale); gltf.scene.position.multiplyScalar(scale); gltf.scene.position.y -= bounds.min.y * scale;
    const root = new THREE.Group(); root.add(gltf.scene);
    const mixer = new THREE.AnimationMixer(gltf.scene), feet = ['foot_l', 'foot_r'].map(name => gltf.scene.getObjectByName(name));
    const restFeet = feet.map(foot => foot.position.clone());
    const pose = new AuthoredFootPose(gltf.scene);
    for (const name of ['Idle', 'Move', 'Work', 'Sleep']) {
      pose.restore();
      mixer.stopAllAction(); mixer.clipAction(gltf.animations.find(clip => clip.name === name)).play();
      for (let frame = 0; frame < 60; frame++) {
        pose.restore(); mixer.update(1 / 30); root.position.y = .1; root.updateMatrixWorld(true);
        const standing = feet.map(foot => foot.getWorldPosition(new THREE.Vector3()));
        root.position.y = .45; pose.apply(.35); root.updateMatrixWorld(true);
        feet.forEach((foot, index) => assert.ok(foot.getWorldPosition(new THREE.Vector3()).distanceTo(standing[index]) < 1e-10, `${id}/${name} seated foot grounding`));
      }
    }
    pose.restore(); mixer.stopAllAction();
    let previous;
    for (let frame = 0; frame < 150; frame++) {
      // Restore before play() activates bindings and saves original state.
      pose.restore();
      if (frame % 30 === 0 && frame < 120) {
        const name = ['Work', 'Move', 'Work', 'Idle'][frame / 30];
        const action = mixer.clipAction(gltf.animations.find(clip => clip.name === name)).reset().setEffectiveWeight(1).play();
        previous?.crossFadeTo(action, .3, false); previous = action;
      }
      mixer.update(1 / 30); pose.apply(.35);
    }
    pose.restore();
    feet.forEach((foot, index) => assert.ok(foot.position.distanceTo(restFeet[index]) < 1e-10, `${id} crossfade restores original foot binding baseline`));
    pose.restore(); mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene);
  }
});
