// Savor Bridge — Merchant Development: Jarvis coordinates, Scout researches,
// Keeper preserves continuity. Concept style: toy robots, warm orange / teal / green.
import * as THREE from 'three';
import { G, mat, gloss, glow, part, node, hide, limb } from '../lib/kit.mjs';
import { buildRobot, curvedPlate, PALETTE as P } from '../lib/robot.mjs';
import { robotClips, typing, wave, cbump, seg, ease, blink } from '../lib/robot-anim.mjs';

const gold = () => mat(P.gold, { rough: 0.45, metal: 0.3 });

/** Little bridge-arch emblem: the team's own symbol. */
function bridgeEmblem(parent, pos, s) {
  const g = new THREE.Group(); g.position.set(...pos); parent.add(g);
  part(g, G.cyl(20), mat('#f3e6cf', { rough: 0.6 }), [0, 0, 0], [0.12 * s, 0.02 * s, 0.12 * s], [Math.PI / 2, 0, 0]);
  part(g, G.torus(0.035 * s, 0.008 * s, 5, 12, Math.PI), gold(), [0, -0.012 * s, 0.012 * s]);
  part(g, G.box(), gold(), [0, -0.014 * s, 0.012 * s], [0.085 * s, 0.01 * s, 0.01 * s]);
}

export const jarvis = {
  id: 'bridge-jarvis', name: 'Jarvis', team: 'merchant', locomotion: 'waddle', height: 1.08, footprint: 0.34,
  build() {
    return buildRobot({
      id: this.id, scale: 1.0, bodyH: 0.46, bodyW: 0.42,
      helmet: P.ivory, eyes: 'dot', blush: '#e99a7c',
      ears: P.orange, antenna: P.orange, stem: '#8a6b55', collar: '#c96a36',
      body: P.orange, extremity: '#3b6355',
      extras: ({ body, bodyH, bw }) => bridgeEmblem(body, [0, 0.05 + bodyH * 0.55, bw * 0.43], 1),
    });
  },
  animate(rig) {
    robotClips(rig, {
      move: 'waddle', moveOpts: { roll: 0.1, bounce: 0.03 },
      emote: 'spin',
      // Coordinating: types, then looks up and gives a little "this way" point.
      work: (p, pose) => {
        typing(rig, pose, p);
        const point = cbump(p, 0.78, 0.13);
        pose.rot('arm_r', 0.75 * point - 1.2 * point, 0, -0.6 * point);
        pose.rot('head', -0.2 * point, 0.3 * point, 0);
      },
    });
  },
  voice: { preset: 'robot-warm' },
};

export const scout = {
  id: 'bridge-scout', name: 'Scout', team: 'merchant', locomotion: 'hop', height: 0.9, footprint: 0.3, moveSpeed: 1.05,
  build() {
    return buildRobot({
      id: this.id, scale: 0.86, bodyH: 0.4,
      helmet: P.ivory, eyes: 'dot', blush: '#e99a7c',
      ears: P.teal, antenna: P.gold, stem: P.teal, collar: '#2f716c',
      body: P.teal, belly: '#e9e0cf', extremity: '#3f6c5a',
      armExtras: (arm, side, k, s) => {
        if (side !== 'r') return;
        // magnifying glass in the right mitten
        const mg = node(arm, 'prop_lens', [k * 0.08 * s, -0.2 * s, 0.07 * s], [0.3, 0, 0]);
        part(mg, G.cyl(8), mat('#7a5a3a', { rough: 0.6 }), [0, -0.02 * s, 0], [0.025 * s, 0.11 * s, 0.025 * s]);
        part(mg, G.torus(0.055 * s, 0.012 * s, 6, 18), gold(), [0, 0.09 * s, 0.0]);
        part(mg, G.cyl(18), glow('#dff1f2'), [0, 0.09 * s, 0], [0.1 * s, 0.006 * s, 0.1 * s], [Math.PI / 2, 0, 0]);
      },
      extras: ({ body, bodyH, bw, s }) => {
        // compass rose on the belly
        const g = new THREE.Group(); g.position.set(0, 0.05 * s + bodyH * 0.5, bw * 0.45); body.add(g);
        part(g, G.torus(0.04 * s, 0.007 * s, 5, 14), gold(), [0, 0, 0]);
        part(g, G.cone(4), mat('#c4573a', { rough: 0.6 }), [0, 0.015 * s, 0.004 * s], [0.02 * s, 0.04 * s, 0.008 * s]);
      },
    });
  },
  animate(rig) {
    robotClips(rig, {
      move: 'hop', moveDur: 0.55, moveOpts: { height: 0.13, lean: 0.14 },
      emote: 'flip',
      // Researching: lens up to the visor, scanning left and right.
      work: (p, pose) => {
        const up = ease.inOut(seg(p, 0.02, 0.15)) * (1 - ease.inOut(seg(p, 0.88, 1)));
        pose.rot('arm_r', -1.25 * up, 0.25 * up, -0.55 * up);
        pose.rot('head', 0.12 * up, 0.35 * wave(p, 1) * up, 0.08 * wave(p, 2) * up);
        pose.rot('body', 0.1 * up, 0.15 * wave(p, 1) * up, 0);
        pose.scl('prop_lens', 1 + 0.25 * cbump(p, 0.5, 0.08) * up);
        blink(pose, p, ['eye_l', 'eye_r'], [0.66]);
      },
    });
  },
  voice: { preset: 'robot-bright' },
};

export const keeper = {
  id: 'bridge-keeper', name: 'Keeper', team: 'merchant', locomotion: 'waddle', height: 0.98, footprint: 0.34, moveSpeed: 0.8,
  build() {
    return buildRobot({
      id: this.id, scale: 0.98, bodyH: 0.4, bodyW: 0.44,
      helmet: P.ivory, visor: null, eyes: 'dot', blush: '#efa48a',
      ears: P.green, antenna: P.green, stem: P.green, collar: '#3f7659',
      body: P.green, belly: '#efe6d4', extremity: '#2f5a48',
      armExtras: (arm, side, k, s) => {
        if (side !== 'l') return;
        // the team's continuity book, hugged in the left arm
        const book = node(arm, 'prop_book', [k * 0.02 * s, -0.17 * s, 0.13 * s], [0.2, 0.5, 0]);
        part(book, G.rbox(0.15 * s, 0.19 * s, 0.045 * s, 0.01 * s, 2), mat('#2e5b4e', { rough: 0.7 }), [0, 0, 0]);
        part(book, G.box(), mat('#f4ead6', { rough: 0.9 }), [0.004 * s, 0, 0], [0.13 * s, 0.175 * s, 0.035 * s]);
        const cover = node(book, 'book_cover', [-0.075 * s, 0, 0.024 * s]);
        part(cover, G.rbox(0.15 * s, 0.19 * s, 0.01 * s, 0.004 * s, 1), mat('#2e5b4e', { rough: 0.7 }), [0.075 * s, 0, 0]);
        // sprout emblem
        part(cover, G.sphere(8, 6), gold(), [0.06 * s, 0.03 * s, 0.006 * s], [0.03 * s, 0.045 * s, 0.01 * s], [0, 0, 0.6]);
        part(cover, G.sphere(8, 6), gold(), [0.09 * s, 0.03 * s, 0.006 * s], [0.03 * s, 0.045 * s, 0.01 * s], [0, 0, -0.6]);
        part(cover, G.box(), gold(), [0.075 * s, -0.01 * s, 0.006 * s], [0.008 * s, 0.06 * s, 0.006 * s]);
      },
      extras: ({ head, hc, headR, s }) => {
        // green cap over the ivory face, like the concept's Keeper
        part(head, G.hemi(22, 8), mat(P.green, { rough: 0.55 }), [0, hc[1] + headR * 0.28, -0.01 * s], [headR * 2.1, headR * 1.5, headR * 1.9]);
      },
    });
  },
  animate(rig) {
    robotClips(rig, {
      move: 'waddle', moveDur: 0.8, moveOpts: { roll: 0.09, bounce: 0.025, lean: 0.05 },
      emote: 'twirl',
      // Preserving continuity: opens the book, turns a page, closes it.
      work: (p, pose) => {
        const open = ease.inOut(seg(p, 0.05, 0.2)) * (1 - ease.inOut(seg(p, 0.85, 0.97)));
        pose.rot('arm_l', -0.55 * open, -0.3 * open, 0.2 * open);
        pose.rot('arm_r', -0.6 * open, 0, -0.35 * open);
        pose.rot('book_cover', 0, -2.4 * open + 0.4 * cbump(p, 0.55, 0.08), 0);
        pose.rot('head', 0.22 * open, -0.12 * open, 0.06 * wave(p, 2) * open);
        blink(pose, p, ['eye_l', 'eye_r'], [0.42]);
      },
    });
  },
  voice: { preset: 'robot-soft' },
};

export default [jarvis, scout, keeper];
