// Procedural animation baked to keyframes. A clip is a pose function sampled
// at a fixed rate; tracks are emitted only for nodes the clip touches, then
// thinned with a tolerance so files stay tiny.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Normalised progress of p through [a, b]. */
export const seg = (p, a, b) => clamp01((p - a) / (b - a));
export const wave = (p, cycles = 1, offset = 0) => Math.sin(TAU * (p * cycles + offset));
export const cwave = (p, cycles = 1, offset = 0) => Math.cos(TAU * (p * cycles + offset));
export const ease = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t ** 3,
  smooth: (t) => t * t * (3 - 2 * t),
  back: (t) => { const c = 1.6; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
};
/** Smooth bump centred at c with half-width w (0 outside). */
export const bump = (p, c, w) => { const d = Math.abs(p - c) / w; return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d); };
/** Same as bump but wraps around the loop. */
export const cbump = (p, c, w) => Math.max(bump(p, c, w), bump(p + 1, c, w), bump(p - 1, c, w));

/**
 * Hop shape over p∈[0,1): anticipation squash → launch stretch → airtime → landing squash.
 * Returns { y, k } where y is height (0..1) and k is squash (+stretch / −squash).
 */
export function hop(p, { start = 0.12, land = 0.78 } = {}) {
  let y = 0;
  let k = 0;
  if (p < start) k = -0.16 * Math.sin(Math.PI * (p / start));
  else if (p < land) {
    const q = (p - start) / (land - start);
    y = 4 * q * (1 - q);
    k = 0.12 * Math.cos(Math.PI * q) * (q < 0.5 ? 1 : 0.4);
  } else {
    const q = (p - land) / (1 - land);
    k = -0.2 * Math.sin(Math.PI * q) * (1 - q * 0.3);
  }
  return { y, k };
}

/** Volume-preserving squash scale for squash/stretch amount k. */
export const squash = (k) => [1 / Math.sqrt(1 + k), 1 + k, 1 / Math.sqrt(1 + k)];

class Pose {
  constructor() { this.r = new Map(); this.p = new Map(); this.s = new Map(); }
  /** Add Euler rotation offset (radians). */
  rot(n, x = 0, y = 0, z = 0) { const v = this.r.get(n) || [0, 0, 0]; this.r.set(n, [v[0] + x, v[1] + y, v[2] + z]); return this; }
  /** Add position offset. */
  pos(n, x = 0, y = 0, z = 0) { const v = this.p.get(n) || [0, 0, 0]; this.p.set(n, [v[0] + x, v[1] + y, v[2] + z]); return this; }
  /** Multiply scale. A single number scales uniformly. */
  scl(n, x = 1, y, z) {
    if (y === undefined) { y = x; z = x; }
    const v = this.s.get(n) || [1, 1, 1];
    this.s.set(n, [v[0] * x, v[1] * y, v[2] * z]);
    return this;
  }
  /** Hide (scale≈0) or show a node by factor 0..1. */
  vis(n, f) { const k = Math.max(0.001, f); return this.scl(n, k, k, k); }
}

export class Rig {
  constructor(root) {
    this.root = root;
    this.nodes = {};
    root.traverse((o) => { if (o.userData.animatable) this.nodes[o.name] = o; });
    this.rest = {};
    for (const [name, o] of Object.entries(this.nodes)) {
      this.rest[name] = { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() };
      if (o.userData.hidden) o.scale.setScalar(0.001);
    }
    this.clips = [];
    const fx = this.nodes.fx_zzz;
    this.zzzLift = fx ? (fx.userData.socketY ?? fx.position.y) - fx.position.y : 0;
  }

  has(name) { return !!this.nodes[name]; }

  /**
   * Bake a clip. poseFn(phase∈[0,1], pose, t) applies offsets relative to rest.
   * Loops are seamless as long as poseFn(0) == poseFn(1).
   */
  clip(name, duration, poseFn, { fps = 30 } = {}) {
    const frames = Math.max(2, Math.round(duration * fps));
    const poses = [];
    const touched = { r: new Set(), p: new Set(), s: new Set() };
    for (let i = 0; i <= frames; i++) {
      const t = (i / frames) * duration;
      const pose = new Pose();
      poseFn(i / frames, pose, t);
      for (const key of ['r', 'p', 's']) for (const n of pose[key].keys()) {
        if (!this.nodes[n]) throw new Error(`${name}: unknown node "${n}"`);
        touched[key].add(n);
      }
      poses.push({ t, pose });
    }
    const tracks = [];
    const e = new THREE.Euler();
    const dq = new THREE.Quaternion();
    for (const n of touched.p) {
      const rest = this.rest[n].p;
      const times = []; const values = [];
      for (const { t, pose } of poses) {
        const d = pose.p.get(n) || [0, 0, 0];
        times.push(t); values.push(rest.x + d[0], rest.y + d[1], rest.z + d[2]);
      }
      tracks.push(thin(new THREE.VectorKeyframeTrack(`${n}.position`, times, values), 0.0012));
    }
    for (const n of touched.r) {
      const rest = this.rest[n].q;
      const times = []; const values = [];
      let prev = null;
      for (const { t, pose } of poses) {
        const d = pose.r.get(n) || [0, 0, 0];
        e.set(d[0], d[1], d[2], 'YXZ');
        dq.setFromEuler(e);
        const q = rest.clone().multiply(dq);
        if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w); // keep hemisphere continuous
        prev = q;
        times.push(t); values.push(q.x, q.y, q.z, q.w);
      }
      tracks.push(thin(new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, times, values), 0.0015));
    }
    for (const n of touched.s) {
      const rest = this.rest[n].s;
      const times = []; const values = [];
      for (const { t, pose } of poses) {
        const d = pose.s.get(n) || [1, 1, 1];
        times.push(t); values.push(rest.x * d[0], rest.y * d[1], rest.z * d[2]);
      }
      tracks.push(thin(new THREE.VectorKeyframeTrack(`${n}.scale`, times, values), 0.002));
    }
    const clip = new THREE.AnimationClip(name, duration, tracks);
    this.clips.push(clip);
    return clip;
  }
}

/** Ramer–Douglas–Peucker over keyframes: drop keys that linear interpolation reproduces. */
function thin(track, eps) {
  const { times, values } = track;
  const stride = values.length / times.length;
  const n = times.length;
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let worst = -1; let worstErr = eps;
    for (let i = a + 1; i < b; i++) {
      const u = (times[i] - times[a]) / (times[b] - times[a]);
      let err = 0;
      for (let k = 0; k < stride; k++) {
        const v = values[a * stride + k] + (values[b * stride + k] - values[a * stride + k]) * u;
        err = Math.max(err, Math.abs(v - values[i * stride + k]));
      }
      if (err > worstErr) { worstErr = err; worst = i; }
    }
    if (worst >= 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  const t2 = []; const v2 = [];
  for (let i = 0; i < n; i++) if (keep[i]) {
    t2.push(times[i]);
    for (let k = 0; k < stride; k++) v2.push(values[i * stride + k]);
  }
  const Ctor = track.constructor;
  return new Ctor(track.name, t2, v2);
}

// ------------------------------------------------------------ shared motions

/** Quick blink(s) at given phases. */
export function blink(pose, p, nodes, at = [0.55], width = 0.035) {
  let c = 0;
  for (const a of at) c = Math.max(c, cbump(p, a, width));
  const k = 1 - 0.92 * c;
  for (const n of nodes) pose.scl(n, 1, k, 1);
}

/** Calm breathing on a body node. */
export function breathe(pose, p, n, amp = 0.02, cycles = 1) {
  const w = wave(p, cycles);
  pose.scl(n, 1 - amp * 0.5 * w, 1 + amp * w, 1 - amp * 0.5 * w);
}

/** Three Zs drifting up, staggered, looping. */
export function zzzFloat(pose, p, cycles = 1, lift = 0) {
  if (lift) pose.pos('fx_zzz', 0, lift, 0);
  for (let i = 0; i < 3; i++) {
    const q = (((p * cycles) + i / 3) % 1 + 1) % 1;
    const appear = q < 0.18 ? ease.out(q / 0.18) : q > 0.78 ? 1 - ease.inOut((q - 0.78) / 0.22) : 1;
    pose.pos(`fx_z${i}`, Math.sin(q * TAU) * 0.04 + q * 0.12, q * 0.34, 0);
    pose.rot(`fx_z${i}`, 0, 0, 0.25 * Math.sin(q * TAU + i));
    pose.vis(`fx_z${i}`, appear * (0.75 + q * 0.5));
  }
}

/** Swap open eyes for sleepy eyes (f=1 fully asleep). */
export function sleepyEyes(pose, f, open = ['eye_l', 'eye_r'], closed = 'eyes_sleep') {
  for (const n of open) pose.scl(n, 1, Math.max(0.001, 1 - f), 1);
  pose.vis(closed, f);
}
