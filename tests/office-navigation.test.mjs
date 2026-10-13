import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const source = await readFile(new URL('../src/scene/officeNavigation.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { OfficeNavigator, OfficeMotor, makeOfficeMap, angleDifference, TURN_SPEED, WALK_ACCELERATION, WALK_SPEED } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
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

async function realLayout() {
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
    const { makeRoom, campusNavigation } = await loadScene('scene/rooms.ts');
    const { teams } = await loadScene('teams.ts'); const kit = new SceneKit();
    const rooms = new Map(teams.map((team, index) => [team.id, makeRoom(team, index, kit)]));
    return { teams, rooms, kit, disposeObject, navigator: new OfficeNavigator(makeOfficeMap(rooms, teams, campusNavigation)) };
  } finally { globalThis.document = previous; }
}

function fixture({ chair = false } = {}) {
  const home = { officeId: 'home', place: 'desk', actorId: 'actor', deskIndex: 0, position: [-4, 0], egress: [-4, -.9], floorY: .1, seatHeight: .2, facing: Math.PI };
  const map = {
    zones: [{ bounds: [-6, -3, 0, 3], floorY: .1, officeId: 'home' }, { bounds: [0, -3, 6, 3], floorY: .1, officeId: 'other' }],
    blockers: [{ bounds: [-.8, -1, .8, 1] }, ...(chair ? [{ bounds: [-4.3, -.3, -3.7, .3], officeId: 'home', deskIndex: 0 }] : [])],
    waypoints: [[-2, -2], [2, -2], [-2, 2], [2, 2]],
    anchors: [home, { officeId: 'home', place: 'task', position: [-4, -2], floorY: .1 }, { officeId: 'other', place: 'lounge', position: [4, 0], floorY: .1 }, { officeId: 'other', place: 'door', position: [3, -2], floorY: .1 }],
    exit: [-5, -2], floorY: .1,
  };
  const navigator = new OfficeNavigator(map);
  return { navigator, home, motor: new OfficeMotor('actor', 'home', .4, navigator, home) };
}
function run(motor, limit = 4000) { for (let index = 0; index < limit && motor.pending; index++) motor.update(1 / 30); assert.equal(motor.pending, false); }

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
    assert.ok(motor.speed <= WALK_SPEED + 1e-9);
    assert.ok(Math.abs(angleDifference(motor.heading, heading)) <= TURN_SPEED / 30 + 1e-9);
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

test('active fallback is one purposeful task-to-desk trip, independent explicit actions take precedence', () => {
  const { motor } = fixture();
  motor.fallback('active'); assert.equal(motor.mode, 'walk'); run(motor);
  assert.ok(motor.distance >= 3.9); assert.equal(motor.mode, 'work');
  const distance = motor.distance;
  for (let index = 0; index < 600; index++) { motor.fallback('active'); motor.update(1 / 30); }
  assert.equal(motor.distance, distance);
  motor.apply({ id: 'one', actorId: 'actor', kind: 'walk_to', target: { officeId: 'other', place: 'lounge' } });
  motor.fallback('sleeping'); run(motor); assert.deepEqual([motor.x, motor.z], [4, 0]);
  motor.fallback('sleeping'); assert.deepEqual([motor.x, motor.z], [4, 0]);
  motor.fallback('active'); run(motor); assert.deepEqual([motor.x, motor.z], [-4, 0]);
  assert.equal(motor.mode, 'work');
});

test('activity changes never respawn an absent avatar; arrival restores future bridge transitions', () => {
  const { motor } = fixture();
  motor.fallback('active'); run(motor);
  motor.apply({ id: 'leave', actorId: 'actor', kind: 'leave' }); run(motor);
  motor.fallback('sleeping'); motor.fallback('active'); assert.equal(motor.present, false);
  motor.apply({ id: 'return', actorId: 'actor', kind: 'arrive' });
  motor.fallback('sleeping'); run(motor); assert.equal(motor.mode, 'work');
  motor.fallback('active'); run(motor); assert.equal(motor.mode, 'work');
  motor.fallback('sleeping'); run(motor); assert.equal(motor.mode, 'rest');
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

test('persisted work/rest at startup wins the initial bridge state and later transitions still release it', () => {
  const { motor } = fixture();
  motor.fallback('active'); motor.apply({ id: 'persisted', actorId: 'actor', kind: 'rest' });
  assert.equal(motor.mode, 'rest'); assert.equal(motor.pending, false);
  motor.fallback('active'); assert.equal(motor.mode, 'rest');
  motor.fallback('sleeping'); assert.equal(motor.mode, 'rest');
  motor.fallback('active'); run(motor); assert.equal(motor.mode, 'work');
});

test('real sixteen-avatar layout connects every assigned desk, six doors/lounges and exit with decoration on/off', async t => {
  const { teams, rooms, kit, disposeObject, navigator } = await realLayout();
  t.after(() => { for (const room of rooms.values()) disposeObject(room.root); kit.dispose(); });
  for (const decorated of [false, true]) {
    navigator.setDecorations(Object.fromEntries(teams.map(team => [team.id, decorated ? ['plant', 'lamp', 'art'] : []])));
    for (const team of teams) for (const character of team.members) {
      const radius = character.kind === 'owl' ? .7 : character.kind === 'swift' ? .6 : .61;
      const home = navigator.desk(character.id), label = `${character.id} decorations=${decorated}`;
      assert.ok(navigator.segmentClear(home.position, home.egress, radius, home), `${label} assigned chair egress`);
      const create = () => new OfficeMotor(character.id, team.id, radius, navigator, home);
      const active = create(); active.fallback('active'); assert.equal(active.blocked, false, `${label} purposeful fallback`); run(active);
      assert.equal(active.heading, home.facing, `${label} exact desk facing`);
      for (const target of teams) for (const place of ['door', 'lounge']) {
        const motor = create();
        assert.equal(motor.apply({ id: `${target.id}-${place}`, actorId: character.id, kind: 'walk_to', target: { officeId: target.id, place } }), true, `${label} ${target.id}/${place}`);
        run(motor); motor.apply({ id: 'return', actorId: character.id, kind: 'work' }); run(motor);
        assert.deepEqual([motor.x, motor.z], home.position, `${label} return home`);
      }
      const leaving = create(); assert.equal(leaving.apply({ id: 'leave', actorId: character.id, kind: 'leave' }), true, `${label} exit`); run(leaving);
      assert.equal(leaving.present, false); leaving.apply({ id: 'arrive', actorId: character.id, kind: 'arrive' }); run(leaving); assert.equal(leaving.present, true);
    }
  }
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
