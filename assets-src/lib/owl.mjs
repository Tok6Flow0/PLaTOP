// Plush owl, matching the PLaTOP concept art: a round body under a big round
// head, huge ringed eyes, little orange beak, soft ear tufts, side wings.
import { G, mat, gloss, glow, part, node, sleepEyes, blush } from './kit.mjs';
import { skeleton } from './rig.mjs';

/**
 * o: { id, scale, body, head (defaults body), belly, wing, ring, ringEdge, pupil,
 *      beak, feet, blush, emblem(ctx), extras(ctx) }
 */
export function buildOwl(o) {
  const s = o.scale ?? 1;
  const neck = 0.46 * s;
  const { root, body, head } = skeleton({ id: o.id, centerY: 0.45 * s, headY: neck, zzzY: o.zzzY ?? 1.06 * s });
  const C = (c, rough = 0.85) => mat(c, { rough });

  // body: soft pear with a lighter belly
  part(body, G.sphere(), C(o.body), [0, 0.27 * s, 0], [0.56 * s, 0.54 * s, 0.5 * s]);
  part(body, G.sphere(), C(o.belly), [0, 0.25 * s, 0.07 * s], [0.4 * s, 0.4 * s, 0.38 * s]);
  // a few soft feather chevrons on the belly
  for (let i = 0; i < (o.chevrons === false ? 0 : 3); i++) {
    part(body, G.torus(0.5, 0.12, 4, 10, Math.PI), C(o.chevron ?? o.wing), [(i - 1) * 0.07 * s, (0.26 - (i % 2) * 0.06) * s, 0.255 * s], [0.06 * s, 0.035 * s, 0.05 * s], [0, 0, Math.PI]);
  }
  // feet
  for (const [side, k] of [['l', -1], ['r', 1]]) {
    const f = node(body, `foot_${side}`, [k * 0.1 * s, 0.025 * s, 0.13 * s]);
    for (let t = -1; t <= 1; t++) part(f, G.capsule(0.02 * s, 0.035 * s, 3, 8), C(o.feet, 0.6), [t * 0.03 * s, 0, 0.02 * s], 1, [Math.PI / 2, t * 0.3, 0]);
  }
  // wings: hinged at the shoulder so they can flap and hold things
  for (const [side, k] of [['l', -1], ['r', 1]]) {
    const w = node(body, `wing_${side}`, [k * 0.25 * s, 0.4 * s, -0.01 * s]);
    part(w, G.sphere(), C(o.wing), [k * 0.03 * s, -0.13 * s, 0], [0.13 * s, 0.32 * s, 0.3 * s], [0.15, 0, k * -0.18]);
    o.wingExtras?.(w, side, k, s);
  }

  // head
  const hy = 0.17 * s;
  part(head, G.sphere(22, 16), C(o.head ?? o.body), [0, hy, 0], [0.64 * s, 0.54 * s, 0.56 * s]);
  // tufts
  for (const [side, k] of [['l', -1], ['r', 1]]) {
    const t = node(head, `tuft_${side}`, [k * 0.2 * s, hy + 0.2 * s, 0.0]);
    part(t, G.cone(12), C(o.head ?? o.body), [k * 0.02 * s, 0.05 * s, 0], [0.13 * s, 0.15 * s, 0.11 * s], [0, 0, k * -0.5]);
    part(t, G.cone(10), C(o.tuftInner ?? o.wing), [k * 0.022 * s, 0.045 * s, 0.03 * s], [0.07 * s, 0.09 * s, 0.04 * s], [0, 0, k * -0.5]);
  }
  // big ringed eyes; pupils are the blinking part
  const ez = 0.24 * s;
  for (const [side, k] of [['l', -1], ['r', 1]]) {
    const x = k * 0.115 * s; const y = hy + 0.02 * s;
    part(head, G.sphere(18, 12), C(o.ringEdge ?? o.wing, 0.8), [x, y, ez - 0.012 * s], [0.25 * s, 0.25 * s, 0.07 * s]);
    part(head, G.sphere(18, 12), C(o.ring, 0.7), [x, y, ez], [0.22 * s, 0.22 * s, 0.07 * s]);
    const e = node(head, `eye_${side}`, [x + k * -0.005 * s, y - 0.005 * s, ez + 0.03 * s]);
    part(e, G.sphere(14, 10), gloss(o.pupil ?? '#16130f'), [0, 0, 0], [0.13 * s, 0.135 * s, 0.05 * s]);
    part(e, G.sphere(8, 6), glow('#ffffff'), [0.025 * s, 0.03 * s, 0.022 * s], [0.04 * s, 0.04 * s, 0.012 * s]);
    part(e, G.sphere(6, 4), glow('#ffffff'), [-0.02 * s, -0.025 * s, 0.022 * s], [0.016 * s, 0.016 * s, 0.006 * s]);
  }
  sleepEyes(head, [-0.11 * s, hy + 0.01 * s, ez + 0.04 * s], [0.11 * s, hy + 0.01 * s, ez + 0.04 * s], 0.11 * s, mat(o.pupil ?? '#16130f', { rough: 0.6 }), 0.22);
  const beak = node(head, 'beak', [0, hy - 0.07 * s, ez + 0.035 * s]);
  part(beak, G.cone(10), C(o.beak, 0.55), [0, -0.012 * s, 0], [0.055 * s, 0.075 * s, 0.05 * s], [Math.PI * 0.92, 0, 0]);
  if (o.blush) {
    blush(head, [-0.21 * s, hy - 0.07 * s, 0.19 * s], 0.05 * s, o.blush);
    blush(head, [0.21 * s, hy - 0.07 * s, 0.19 * s], 0.05 * s, o.blush);
  }
  const ctx = { root, body, head, s, hy, ez };
  o.extras?.(ctx);
  return root;
}
