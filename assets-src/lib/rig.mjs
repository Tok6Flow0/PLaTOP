// Standard PLaTOP rig and reusable motions.
//
//   root (moved by the app; never animated)
//   ├─ hop    feet pivot · vertical bounce + squash/stretch
//   │  └─ spin   centre-of-mass pivot · flips and twirls
//   │     └─ body   ground pivot again · lean, sway, breathing
//   │        ├─ head   neck pivot · nods, tilts, droops
//   │        ├─ arm_l / arm_r, wing_l / wing_r, foot_l / foot_r …
//   └─ fx_zzz  three Zs above the head, hidden unless sleeping
//
// Motions are written as offsets from the rest pose, so a character can
// layer its own quirks on top of any shared helper.
import * as THREE from 'three';
import { node, zzz } from './kit.mjs';
import { TAU, wave, cwave, hop as hopShape, squash, ease, seg, cbump, bump, blink, breathe, zzzFloat, sleepyEyes } from './anim.mjs';

export function skeleton({ id, centerY = 0.45, headY = 0.4, zzzY = 1.1 }) {
  const root = new THREE.Group();
  root.name = id;
  const hop = node(root, 'hop');
  const spin = node(hop, 'spin', [0, centerY, 0]);
  const body = node(spin, 'body', [0, -centerY, 0]);
  const head = node(body, 'head', [0, headY, 0]);
  zzz(root, zzzY);
  return { root, hop, spin, body, head };
}

const has = (rig, n) => rig.has(n);

// ------------------------------------------------------------ idle & sleep

export function idle(rig, pose, p, { tilt = 0.06, blinkAt = [0.42], breath = 0.018, look = 0.12 } = {}) {
  breathe(pose, p, 'body', breath, 1);
  pose.rot('head', 0.03 * wave(p, 1, 0.25), look * wave(p, 1), tilt * wave(p, 1, 0.1));
  if (has(rig, 'eye_l')) blink(pose, p, ['eye_l', 'eye_r'], blinkAt);
  if (has(rig, 'arm_l')) {
    pose.rot('arm_l', 0.05 * wave(p, 1, 0.2), 0, 0.04 * wave(p, 1));
    pose.rot('arm_r', 0.05 * wave(p, 1, 0.7), 0, -0.04 * wave(p, 1));
  }
}

export function sleep(rig, pose, p, { slump = 0.12, droop = 0.2, sink = 0.025, breath = 0.035, lean = 0.06 } = {}) {
  const w = wave(p, 1);
  pose.pos('hop', 0, -sink, 0);
  pose.rot('body', slump + 0.015 * w, 0, lean);
  const b = 1 + breath * (0.5 + 0.5 * w);
  pose.scl('body', 1 + (b - 1) * 0.6, b, 1 + (b - 1) * 0.6);
  pose.rot('head', droop + 0.03 * w, 0, 0.1);
  if (has(rig, 'eye_l')) sleepyEyes(pose, 1);
  if (has(rig, 'arm_l')) { pose.rot('arm_l', 0.12, 0, 0.12); pose.rot('arm_r', 0.12, 0, -0.12); }
  zzzFloat(pose, p, 1, rig.zzzLift);
}

// ------------------------------------------------------------ locomotion

/** Side-to-side waddle with alternating feet. Two steps per cycle. */
export function waddle(rig, pose, p, { roll = 0.12, bounce = 0.035, lean = 0.08, lift = 0.05 } = {}) {
  const w = wave(p, 1);
  pose.pos('hop', 0, bounce * Math.abs(wave(p, 2)), 0);
  pose.rot('body', lean, 0.06 * w, roll * w);
  pose.rot('head', -0.03, -0.04 * w, -roll * 0.6 * w);
  if (has(rig, 'foot_l')) {
    pose.pos('foot_l', 0, lift * Math.max(0, wave(p, 1)), 0.02 * cwave(p, 1));
    pose.pos('foot_r', 0, lift * Math.max(0, -wave(p, 1)), -0.02 * cwave(p, 1));
  }
  if (has(rig, 'arm_l')) {
    pose.rot('arm_l', 0.25 * w, 0, 0.1 + 0.08 * Math.abs(w));
    pose.rot('arm_r', -0.25 * w, 0, -0.1 - 0.08 * Math.abs(w));
  }
}

/** Bouncy hops; `hops` per cycle. */
export function hopMove(rig, pose, p, { height = 0.16, hops = 1, lean = 0.12, sway = 0.05 } = {}) {
  const q = (p * hops) % 1;
  const { y, k } = hopShape(q);
  pose.pos('hop', 0, height * y, 0);
  pose.scl('hop', ...squash(k));
  pose.rot('body', lean * (0.5 + 0.5 * y), 0, sway * wave(p, 1));
  pose.rot('head', -0.15 * k, 0, 0);
  if (has(rig, 'arm_l')) {
    pose.rot('arm_l', -0.4 * y, 0, 0.25 * y);
    pose.rot('arm_r', -0.4 * y, 0, -0.25 * y);
  }
  if (has(rig, 'foot_l')) {
    pose.rot('foot_l', 0.4 * y, 0, 0);
    pose.rot('foot_r', 0.4 * y, 0, 0);
  }
}

/** Smooth glide: forward lean, gentle float bob. */
export function glide(rig, pose, p, { lean = 0.14, bob = 0.03, sway = 0.05 } = {}) {
  pose.pos('hop', 0, bob * (0.5 + 0.5 * wave(p, 2)), 0);
  pose.rot('body', lean, 0, sway * wave(p, 1));
  pose.rot('head', -lean * 0.5, 0, -sway * 0.5 * wave(p, 1, 0.1));
  if (has(rig, 'arm_l')) {
    pose.rot('arm_l', 0.35 + 0.08 * wave(p, 2), 0, 0.1);
    pose.rot('arm_r', 0.35 + 0.08 * wave(p, 2, 0.5), 0, -0.1);
  }
}

/** Hover for floaty characters (lanterns). */
export function float(rig, pose, p, { height = 0.14, bob = 0.04, lean = 0.12, sway = 0.07 } = {}) {
  pose.pos('hop', 0, height + bob * wave(p, 1), 0);
  pose.rot('body', lean, 0, sway * wave(p, 1, 0.25));
  pose.rot('head', -0.04, 0, -sway * 0.4 * wave(p, 1, 0.4));
}

/** Rolling on wheels with a happy jiggle. */
export function roll(rig, pose, p, { lean = 0.1, jiggle = 0.012, wheelTurns = 2 } = {}) {
  pose.pos('hop', 0, jiggle * Math.abs(wave(p, 4)), 0);
  pose.rot('body', lean, 0, 0.03 * wave(p, 2));
  pose.rot('head', -0.05, 0, 0.04 * wave(p, 2, 0.25));
  for (const n of ['wheel_l', 'wheel_r']) if (has(rig, n)) pose.rot(n, TAU * wheelTurns * p, 0, 0);
  if (has(rig, 'arm_l')) {
    pose.rot('arm_l', 0.3, 0, 0.18 + 0.05 * wave(p, 2));
    pose.rot('arm_r', 0.3, 0, -0.18 - 0.05 * wave(p, 2));
  }
}

/** Wing flaps while airborne (birds). */
export function fly(rig, pose, p, { height = 0.42, bob = 0.05, flaps = 2, amp = 0.9, pitch = 0.18 } = {}) {
  const f = wave(p, flaps);
  pose.pos('hop', 0, height + bob * wave(p, flaps, 0.25), 0);
  pose.rot('body', pitch, 0, 0.05 * wave(p, 1));
  pose.rot('wing_l', 0, 0, -amp * f);
  pose.rot('wing_r', 0, 0, amp * f);
  if (has(rig, 'tail')) pose.rot('tail', 0.12 * wave(p, flaps, 0.3), 0, 0);
  if (has(rig, 'head')) pose.rot('head', -pitch * 0.7, 0, 0);
}

// ------------------------------------------------------------ emotes

/** Hop with a full turn in the air; arms up. */
export function spinHop(rig, pose, p, { height = 0.38, turns = 1, armsUp = 2.2 } = {}) {
  const { y, k } = hopShape(p, { start: 0.16, land: 0.74 });
  pose.pos('hop', 0, height * y, 0);
  pose.scl('hop', ...squash(k));
  const air = seg(p, 0.16, 0.74);
  pose.rot('spin', 0, TAU * turns * ease.inOut(air), 0);
  const up = Math.sin(Math.PI * air);
  if (has(rig, 'arm_l')) {
    pose.rot('arm_l', -armsUp * up, 0, 0.3 * up);
    pose.rot('arm_r', -armsUp * up, 0, -0.3 * up);
  }
  if (has(rig, 'eye_l')) blink(pose, p, ['eye_l', 'eye_r'], [0.88], 0.05);
}

/** Backflip around the centre of mass. */
export function backflip(rig, pose, p, { height = 0.45, armsUp = 2.4 } = {}) {
  const { y, k } = hopShape(p, { start: 0.18, land: 0.76 });
  pose.pos('hop', 0, height * y, 0);
  pose.scl('hop', ...squash(k));
  const air = seg(p, 0.18, 0.76);
  pose.rot('spin', -TAU * ease.inOut(air), 0, 0);
  const tuck = Math.sin(Math.PI * air);
  pose.rot('head', 0.2 * tuck, 0, 0);
  if (has(rig, 'arm_l')) {
    pose.rot('arm_l', -armsUp * tuck, 0, 0.2 * tuck);
    pose.rot('arm_r', -armsUp * tuck, 0, -0.2 * tuck);
  }
}

/** Grounded celebratory twirl (for heavier shapes). */
export function twirl(rig, pose, p, { turns = 1, bounce = 0.08, lean = 0.1 } = {}) {
  const a = ease.inOut(seg(p, 0.08, 0.86));
  pose.rot('spin', 0, TAU * turns * a, 0);
  pose.pos('hop', 0, bounce * Math.sin(Math.PI * a), 0);
  pose.rot('body', 0, 0, lean * Math.sin(TAU * a));
  if (has(rig, 'arm_l')) {
    pose.rot('arm_l', -1.2 * Math.sin(Math.PI * a), 0, 0.5 * Math.sin(Math.PI * a));
    pose.rot('arm_r', -1.2 * Math.sin(Math.PI * a), 0, -0.5 * Math.sin(Math.PI * a));
  }
}

// ------------------------------------------------------------ talk

/** Chatty bobbing on a syllable rhythm (matches the voice synth's ~0.2 s syllables). */
export function talk(rig, pose, p, { syllables = 6, nod = 0.07, tilt = 0.08, gesture = true } = {}) {
  const s = Math.abs(wave(p, syllables / 2));
  pose.rot('head', -nod * s, 0.08 * wave(p, 1), tilt * wave(p, 1, 0.25));
  pose.pos('hop', 0, 0.012 * s, 0);
  breathe(pose, p, 'body', 0.012, 2);
  if (gesture && has(rig, 'arm_r')) {
    const g = cbump(p, 0.3, 0.22) + cbump(p, 0.75, 0.18);
    pose.rot('arm_r', -0.7 * g, 0, -0.35 * g);
    pose.rot('arm_l', -0.15 * cbump(p, 0.55, 0.2), 0, 0.1 * cbump(p, 0.55, 0.2));
  }
  if (has(rig, 'eye_l')) blink(pose, p, ['eye_l', 'eye_r'], [0.62]);
}

export { bump, cbump, seg, ease, wave, cwave, TAU };
