// Parametric designer-toy robot, matching the PLaTOP concept art:
// big round helmet, curved dark visor with a tiny face, coloured ear discs,
// ball-tipped antenna, chubby body with a belly panel, mitten hands, round feet.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { G, mat, gloss, glow, part, node, limb, blush, arcPart, sleepEyes, hide } from './kit.mjs';
import { skeleton } from './rig.mjs';

/**
 * A squircle "screen" lying on an ellipsoid (visors, belly panels).
 * a, b: half width / height; n: squircle exponent (4 ≈ rounded rectangle);
 * radii: ellipsoid [rx, ry, rz]; yOff: patch centre height relative to the ellipsoid centre;
 * lift: how far the face sits proud of the surface; bevel: soft rolled edge depth.
 * The geometry is centred on the ellipsoid centre (place it there).
 */
export function curvedPlate(a, b, n, radii, { yOff = 0, lift = 0.012, bevel = 0.012, rings = 7, segs = 44 } = {}) {
  const [rx, ry, rz] = radii;
  return G.custom(`squircle:${a}:${b}:${n}:${radii.join(',')}:${yOff}:${lift}:${bevel}`, () => {
    const surf = (x, y, out) => {
      const yy = y + yOff;
      const k = Math.max(0, 1 - (x * x) / (rx * rx) - (yy * yy) / (ry * ry));
      return rz * Math.sqrt(k) + out;
    };
    const R = (t) => Math.pow(Math.abs(Math.cos(t) / a) ** n + Math.abs(Math.sin(t) / b) ** n, -1 / n);
    const pos = []; const idx = [];
    pos.push(0, yOff, surf(0, 0, lift));
    // [ρ, outward offset] per ring: face rings, then a rolled bevel tucked into the surface
    const ringDefs = [];
    for (let i = 1; i <= rings; i++) ringDefs.push([i / rings, lift]);
    ringDefs.push([1.012, lift * 0.55], [1.03, -bevel]);
    for (const [rho, out] of ringDefs) {
      for (let j = 0; j < segs; j++) {
        const t = (j / segs) * Math.PI * 2;
        const rr = rho * R(t);
        const x = rr * Math.cos(t); const y = rr * Math.sin(t);
        pos.push(x, y + yOff, surf(x, y, out));
      }
    }
    for (let j = 0; j < segs; j++) idx.push(0, 1 + j, 1 + ((j + 1) % segs));
    for (let r = 0; r < ringDefs.length - 1; r++) {
      const o0 = 1 + r * segs; const o1 = 1 + (r + 1) * segs;
      for (let j = 0; j < segs; j++) {
        const j1 = (j + 1) % segs;
        idx.push(o0 + j, o1 + j, o1 + j1, o0 + j, o1 + j1, o0 + j1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}

export const PALETTE = {
  ivory: '#efe7d8', ivoryShade: '#e2d7c3',
  slate: '#5a7884', ink: '#1b2129', navy: '#26344f', navyDeep: '#1c2840',
  orange: '#d9783f', teal: '#3f8c86', green: '#4f8a6c', sage: '#93ad92', sageDeep: '#6f8f74',
  butter: '#e4c47f', deepTeal: '#2f6563', gold: '#cfa04e', cyan: '#8fdcff',
  visor: '#233b43', glint: '#e6f2ec', smileOnDark: '#a9c4bb',
};

/**
 * o: {
 *   id, scale, bodyH, helmet, visor (null = face painted on helmet), visorW,
 *   eyes: 'dot' | 'glow', eyeColor, sleepColor, smile, blush,
 *   ears, antenna (colour or null), stem, collar, body, belly, limbs, hands, feet,
 *   zzzY
 * }
 */
export function buildRobot(o) {
  const s = o.scale ?? 1;
  const bodyH = (o.bodyH ?? 0.4) * s;
  const neckY = 0.05 * s + bodyH * 0.98;
  const headR = 0.29 * s;
  const { root, body, head } = skeleton({ id: o.id, centerY: neckY * 0.85, headY: neckY, zzzY: o.zzzY ?? neckY + headR * 2.25 });
  const C = (c, rough = 0.62) => mat(c, { rough });

  // feet and little legs
  for (const [side, k] of [['l', -1], ['r', 1]]) {
    const f = node(body, `foot_${side}`, [k * 0.095 * s, 0.045 * s, 0.02 * s]);
    part(f, G.sphere(14, 10), C(o.extremity ?? o.feet ?? o.limbs), [0, 0, 0.015 * s], [0.14 * s, 0.09 * s, 0.18 * s]);
  }
  // body: soft egg, with an optional belly panel
  const bw = (o.bodyW ?? 0.42) * s;
  // block-shaped ceramic torso (critic-approved), softened by a rounded base
  const bd = bw * 0.8;
  part(body, G.rbox(1, 1, 1, 0.24, 4), C(o.body), [0, 0.05 * s + bodyH * 0.56, 0], [bw, bodyH * 0.86, bd]);
  part(body, G.sphere(), C(o.body), [0, 0.05 * s + bodyH * 0.3, 0], [bw * 0.94, bodyH * 0.62, bd * 0.94]);
  if (o.belly) {
    const bp = node(body, 'belly', [0, 0.05 * s + bodyH * 0.47, bw * 0.4]);
    bp.position.z = bw * 0.4;
    if (o.bellyShape === 'square') part(body, curvedPlate(0.065 * s, 0.065 * s, 4, [bw * 0.5, bodyH * 0.51, bw * 0.43], { yOff: -0.015 * s, lift: 0.008 * s, bevel: 0.006 * s }), C(o.belly), [0, 0.05 * s + bodyH * 0.5, 0]);
    else part(bp, G.sphere(16, 10), C(o.belly), [0, -0.01 * s, -0.012 * s], [bw * 0.56, bodyH * 0.62, 0.06 * s]);
  }
  if (o.collar) part(body, G.cyl(18), C(o.collar), [0, neckY - 0.01 * s, 0], [0.2 * s, 0.05 * s, 0.18 * s]);

  // arms: shoulder pivots, a soft upper arm, mitten hands
  for (const [side, k] of [['l', -1], ['r', 1]]) {
    const arm = node(body, `arm_${side}`, [k * bw * 0.46, neckY - 0.07 * s, 0.0]);
    limb(arm, [0, 0, 0], [k * 0.07 * s, -0.15 * s, 0.03 * s], 0.05 * s, C(o.limbs ?? o.body));
    part(arm, G.sphere(12, 9), C(o.extremity ?? o.hands ?? o.limbs), [k * 0.075 * s, -0.195 * s, 0.035 * s], [0.095 * s, 0.095 * s, 0.095 * s]);
    o.armExtras?.(arm, side, k, s);
  }

  // helmet
  const hc = [0, headR * 0.92, 0];
  part(head, G.sphere(22, 16), C(o.helmet, 0.55), hc, [headR * 2.05, headR * 1.85, headR * 1.85]);
  // ear discs
  for (const k of [-1, 1]) {
    part(head, G.cyl(18), C(o.ears, 0.6), [k * headR * 1.0, hc[1], 0], [0.12 * s, 0.07 * s, 0.12 * s], [0, 0, Math.PI / 2]);
    part(head, G.cyl(18), C(o.earsInner ?? PALETTE.ivoryShade, 0.6), [k * headR * 1.04, hc[1], 0], [0.07 * s, 0.03 * s, 0.07 * s], [0, 0, Math.PI / 2]);
  }
  // antenna (wobbles with lag)
  if (o.antenna) {
    const ant = node(head, 'antenna', [0, hc[1] + headR * 0.9, 0]);
    part(ant, G.cyl(8), C(o.stem ?? o.antenna), [0, 0.04 * s, 0], [0.018 * s, 0.09 * s, 0.018 * s]);
    part(ant, G.sphere(12, 9), C(o.antenna, 0.5), [0, 0.1 * s, 0], 0.07 * s);
  }

  // face
  const faceZ = headR * 0.925; // helmet front
  const faceY = hc[1] - 0.01 * s;
  if (o.visor === undefined) o.visor = PALETTE.visor;
  if (o.visor) {
    const vw = (o.visorW ?? 0.36) * s;
    // bend matches the helmet's curvature (z ≈ Rz − Rz/(2Rx²)·x²) so the visor sits flush
    const radii = [headR * 1.025, headR * 0.925, headR * 0.925];
    part(head, curvedPlate(vw / 2, 0.12 * s, 3.2, radii, { yOff: faceY - hc[1], lift: 0.012 * s, bevel: 0.01 * s }), gloss(o.visor), hc);
  }
  const fz = faceZ + (o.visor ? 0.016 : 0.004) * s;
  const ex = 0.065 * s;
  if (o.eyes === 'glow') {
    for (const [side, k] of [['l', -1], ['r', 1]]) {
      const e = node(head, `eye_${side}`, [k * ex, faceY + 0.01 * s, fz]);
      part(e, G.capsule(0.02 * s, 0.025 * s, 3, 8), glow(o.eyeColor ?? PALETTE.cyan), [0, 0, 0], 1, [0, 0, 0]);
    }
  } else {
    for (const [side, k] of [['l', -1], ['r', 1]]) {
      const e = node(head, `eye_${side}`, [k * ex, faceY + 0.012 * s, fz]);
      part(e, G.sphere(12, 9), gloss(o.eyeColor ?? PALETTE.ink), [0, 0, 0], [0.048 * s, 0.056 * s, 0.022 * s]);
      part(e, G.sphere(8, 6), glow(PALETTE.glint), [0.011 * s, 0.015 * s, 0.009 * s], [0.02 * s, 0.022 * s, 0.008 * s]);
      part(e, G.sphere(6, 4), glow(PALETTE.glint), [-0.01 * s, -0.012 * s, 0.009 * s], [0.008 * s, 0.008 * s, 0.004 * s]);
    }
  }
  if (o.smile !== false) {
    const mouth = node(head, 'mouth', [0, faceY - 0.045 * s, fz - 0.004 * s]);
    arcPart(mouth, [0, 0, 0], 0.045 * s, mat(o.smileColor ?? (o.visor ? PALETTE.smileOnDark : PALETTE.ink), { rough: 0.5 }), 0.24, false);
  }
  if (o.blush) {
    blush(head, [-0.12 * s, faceY - 0.03 * s, fz - 0.01 * s], 0.045 * s, o.blush);
    blush(head, [0.12 * s, faceY - 0.03 * s, fz - 0.01 * s], 0.045 * s, o.blush);
  }
  const sleepMat = o.eyes === 'glow' ? glow(o.eyeColor ?? PALETTE.cyan) : mat(o.sleepColor ?? (o.visor ? PALETTE.smileOnDark : PALETTE.ink), { rough: 0.5 });
  sleepEyes(head, [-ex, faceY + 0.005 * s, fz], [ex, faceY + 0.005 * s, fz], 0.05 * s, sleepMat, 0.26);

  const ctx = { root, body, head, s, hc, headR, neckY, bodyH, bw, faceY, fz };
  o.extras?.(ctx);
  return root;
}
