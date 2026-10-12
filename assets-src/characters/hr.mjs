// Clear Path — Savor HR: Compass coordinates, Lens reviews facts, Relay follows through.
// Concept style: sage room; butter and ivory helmets, sage and deep-teal bodies.
import * as THREE from 'three';
import { G, mat, gloss, glow, part, node, hide } from '../lib/kit.mjs';
import { buildRobot, PALETTE as P } from '../lib/robot.mjs';
import { robotClips, typing, wave, cbump, seg, ease, blink } from '../lib/robot-anim.mjs';

const gold = () => mat(P.gold, { rough: 0.45, metal: 0.3 });
const paper = () => mat('#f7f1e3', { rough: 0.9 });

function compassEmblem(parent, pos, s) {
  const g = node(parent, 'emblem_face', pos);
  part(g, G.cyl(20), mat('#f3ecdc', { rough: 0.6 }), [0, 0, 0], [0.1 * s, 0.015 * s, 0.1 * s], [Math.PI / 2, 0, 0]);
  part(g, G.torus(0.05 * s, 0.008 * s, 5, 16), gold(), [0, 0, 0.008 * s]);
  const needle = node(g, 'compass_needle', [0, 0, 0.012 * s]);
  part(needle, G.octa(), mat('#2f6563', { rough: 0.5 }), [0, 0.018 * s, 0], [0.018 * s, 0.05 * s, 0.006 * s]);
  part(needle, G.octa(), gold(), [0, -0.018 * s, 0], [0.018 * s, 0.05 * s, 0.006 * s]);
  return g;
}

export const compass = {
  id: 'hr-compass', name: 'Compass', team: 'hr', locomotion: 'waddle', height: 1.0, footprint: 0.34,
  build() {
    return buildRobot({
      id: this.id, scale: 1.0, bodyH: 0.42,
      helmet: P.ivory, eyes: 'dot', blush: '#e9a08a',
      ears: P.sageDeep, antenna: '#5f8f6d', stem: P.sageDeep, collar: P.sageDeep,
      body: '#e8e3d2', belly: null, limbs: P.sage, extremity: '#52694d',
      extras: ({ body, bodyH, bw }) => {
        // compass node must hang off an animatable parent: give it its own pivot on the body
        const pivot = node(body, 'emblem', [0, 0.05 + bodyH * 0.52, bw * 0.43]);
        compassEmblem(pivot, [0, 0, 0], 1);
      },
    });
  },
  animate(rig) {
    robotClips(rig, {
      move: 'waddle', moveOpts: { roll: 0.1, bounce: 0.03 },
      emote: 'twirl',
      // Coordinating: needle swings, settles on a direction; a nod and a point.
      work: (p, pose) => {
        typing(rig, pose, p);
        const settle = ease.out(seg(p, 0.1, 0.55));
        pose.rot('compass_needle', 0, 0, (1 - settle) * 6 * Math.sin(p * 30) * 0.3 + 0.6 * settle - 0.6 * ease.inOut(seg(p, 0.9, 1)));
        const point = cbump(p, 0.68, 0.12);
        pose.rot('arm_l', 0.75 * point - 1.1 * point, 0, 0.6 * point);
      },
    });
  },
  voice: { preset: 'robot-calm' },
};

export const lens = {
  id: 'hr-lens', name: 'Lens', team: 'hr', locomotion: 'waddle', height: 0.98, footprint: 0.34, moveSpeed: 0.8,
  build() {
    return buildRobot({
      id: this.id, scale: 0.97, bodyH: 0.41,
      helmet: P.butter, visor: '#2c3434', eyes: 'dot', eyeColor: '#f3ead6', smileColor: '#f3ead6', sleepColor: '#f3ead6',
      ears: P.sageDeep, antenna: '#b9923f', stem: '#b9923f', collar: P.sageDeep,
      body: P.sage, belly: '#ece4d1', extremity: '#52694d',
      armExtras: (arm, side, k, s) => {
        if (side !== 'r') return;
        // a page under review
        const sheet = hide(node(arm, 'prop_page', [k * 0.06 * s, -0.2 * s, 0.1 * s], [-0.4, 0, 0.1]));
        part(sheet, G.box(), paper(), [0, 0, 0], [0.12 * s, 0.16 * s, 0.004 * s]);
        for (let i = 0; i < 4; i++) part(sheet, G.box(), mat('#9aa59a', { rough: 0.9 }), [-0.01 * s, (0.05 - i * 0.03) * s, 0.003 * s], [0.08 * s, 0.006 * s, 0.002 * s]);
      },
      extras: ({ head, s, faceY, fz }) => {
        // monocle around the right eye: careful factual review
        const m = node(head, 'monocle', [0.065 * s, faceY + 0.012 * s, fz + 0.006 * s]);
        part(m, G.torus(0.045 * s, 0.009 * s, 6, 20), gold(), [0, 0, 0]);
        part(m, G.cyl(6), gold(), [0.03 * s, -0.06 * s, -0.004 * s], [0.006 * s, 0.05 * s, 0.006 * s], [0, 0, 0.5]);
      },
    });
  },
  animate(rig) {
    robotClips(rig, {
      move: 'waddle', moveDur: 0.78, moveOpts: { roll: 0.08, bounce: 0.025 },
      emote: 'spin',
      // Reviewing: holds a page close, leans in, the monocle "zooms", a satisfied nod.
      work: (p, pose) => {
        const hold = ease.inOut(seg(p, 0.03, 0.15)) * (1 - ease.inOut(seg(p, 0.86, 0.98)));
        pose.vis('prop_page', hold);
        pose.rot('arm_r', -1.0 * hold, 0.2 * hold, -0.45 * hold);
        pose.rot('arm_l', -0.35 * hold, 0, 0.2 * hold);
        const lean = ease.inOut(seg(p, 0.2, 0.35)) * (1 - ease.inOut(seg(p, 0.6, 0.75)));
        pose.rot('body', 0.12 * lean, 0, 0);
        pose.rot('head', 0.2 * hold + 0.1 * lean, -0.1 * hold, 0.12 * lean);
        pose.scl('monocle', 1 + 0.35 * lean);
        pose.rot('head', -0.15 * cbump(p, 0.8, 0.05), 0, 0); // nod
        blink(pose, p, ['eye_l', 'eye_r'], [0.15]);
      },
    });
  },
  voice: { preset: 'robot-careful' },
};

export const relay = {
  id: 'hr-relay', name: 'Relay', team: 'hr', locomotion: 'hop', height: 0.98, footprint: 0.34, moveSpeed: 1.0,
  build() {
    return buildRobot({
      id: this.id, scale: 0.97, bodyH: 0.41,
      helmet: P.butter, eyes: 'dot', blush: '#e9a08a',
      ears: P.deepTeal, antenna: '#b9923f', stem: '#b9923f', collar: '#25504f',
      body: P.deepTeal, belly: null, extremity: '#52694d',
      armExtras: (arm, side, k, s) => {
        if (side !== 'r') return;
        const env = hide(node(arm, 'prop_handoff', [k * 0.08 * s, -0.21 * s, 0.08 * s], [0, 0, 0.2]));
        part(env, G.rbox(0.14 * s, 0.09 * s, 0.012 * s, 0.006 * s, 1), paper(), [0, 0, 0]);
        part(env, G.box(), gold(), [0, 0.0, 0.007 * s], [0.03 * s, 0.03 * s, 0.003 * s], [0, 0, Math.PI / 4]);
      },
      extras: ({ body, bodyH, bw, s }) => {
        // connected dots: follow-through
        const g = new THREE.Group(); g.position.set(0, 0.05 * s + bodyH * 0.52, bw * 0.43); body.add(g);
        const pts = [[-0.04, -0.025], [0.035, 0.035], [0.04, -0.04]];
        pts.forEach(([x, y]) => part(g, G.sphere(10, 8), gold(), [x * s, y * s, 0], 0.03 * s));
        const bar = (a, b) => {
          const dx = b[0] - a[0]; const dy = b[1] - a[1];
          part(g, G.cyl(6), gold(), [(a[0] + b[0]) / 2 * s, (a[1] + b[1]) / 2 * s, -0.002 * s], [0.008 * s, Math.hypot(dx, dy) * s, 0.008 * s], [0, 0, -Math.atan2(dx, dy)]);
        };
        bar(pts[0], pts[1]); bar(pts[0], pts[2]);
      },
    });
  },
  animate(rig) {
    robotClips(rig, {
      move: 'hop', moveDur: 0.6, moveOpts: { height: 0.12, lean: 0.1 },
      emote: 'flip',
      // Following through: picks up a note, hands it off to the side, little thumbs-up bounce.
      work: (p, pose) => {
        const hold = ease.out(seg(p, 0.05, 0.15)) * (1 - ease.inOut(seg(p, 0.62, 0.7)));
        pose.vis('prop_handoff', hold);
        const reach = ease.inOut(seg(p, 0.3, 0.5)) * (1 - ease.inOut(seg(p, 0.6, 0.75)));
        pose.rot('arm_r', -0.6 * hold - 0.5 * reach, 0.6 * reach, -0.9 * reach);
        pose.rot('body', 0, 0.5 * reach, 0);
        pose.rot('head', 0.08, 0.35 * reach, 0);
        const yay = cbump(p, 0.85, 0.08);
        pose.pos('hop', 0, 0.05 * yay, 0);
        pose.rot('arm_l', -1.6 * yay, 0, 0.3 * yay);
        blink(pose, p, ['eye_l', 'eye_r'], [0.2]);
      },
    });
  },
  voice: { preset: 'robot-bouncy' },
};

export default [lens, compass, relay];
