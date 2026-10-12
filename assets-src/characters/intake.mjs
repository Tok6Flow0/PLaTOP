// Savor Wayfinders — Rider & Backend Intake: Jarvis leads; Beacon checks records,
// Relay checks receipts, Compass investigates technical evidence.
// Concept style: navy room; ivory helmets, near-black visors with glowing cyan eyes, navy limbs.
import * as THREE from 'three';
import { G, mat, gloss, glow, part, node, hide, limb } from '../lib/kit.mjs';
import { buildRobot, PALETTE as P } from '../lib/robot.mjs';
import { robotClips, typing, wave, cbump, seg, ease, blink } from '../lib/robot-anim.mjs';
import { TAU } from '../lib/anim.mjs';

const VISOR = '#151b26';
const gold = () => mat(P.gold, { rough: 0.45, metal: 0.3 });
const base = (id, extras, more = {}) => ({
  id, scale: 1, bodyH: 0.41,
  helmet: P.ivory, visor: VISOR, eyes: 'glow', eyeColor: P.cyan, smile: false,
  ears: P.navy, antenna: null, collar: P.navy,
  body: P.ivory, belly: null, limbs: P.navy, extremity: '#2d4250',
  extras, ...more,
});

export const jarvis = {
  id: 'intake-jarvis', name: 'Jarvis', team: 'intake', locomotion: 'glide', height: 1.12, footprint: 0.36,
  build() {
    return buildRobot(base(this.id, ({ head, body, hc, headR, neckY, bodyH, bw, s }) => {
      // navy hood with a gold star tip
      // sits behind the helmet's face so the visor stays clear; shows as a navy rim and crown
      part(head, G.sphere(22, 14), mat(P.navy, { rough: 0.7 }), [0, hc[1] + 0.025, -0.065], [headR * 2.2, headR * 2.0, headR * 1.95]);
      const tip = node(head, 'hood_tip', [0, hc[1] + headR * 0.95, -0.02]);
      part(tip, G.cone(14), mat(P.navy, { rough: 0.7 }), [0, 0.06, 0], [0.12, 0.16, 0.12]);
      part(tip, G.octa(), gold(), [0, 0.16, 0], [0.06, 0.07, 0.025]);
      // cape: a soft open cylinder section behind the body
      const cape = node(body, 'cape', [0, neckY - 0.02, -0.04]);
      const capeGeo = G.custom('cape', () => {
        const g = new THREE.CylinderGeometry(0.2, 0.3, 0.42, 16, 3, true, Math.PI * 0.55, Math.PI * 0.9);
        g.translate(0, -0.21, 0);
        return g;
      });
      part(cape, capeGeo, mat(P.navy, { rough: 0.75 }), [0, 0, 0]);
      part(cape, capeGeo, mat('#33456a', { rough: 0.8 }), [0, 0, 0.004], [0.97, 1, 0.97]);
      // gold compass medallion on the chest
      const med = new THREE.Group(); med.position.set(0, 0.05 + bodyH * 0.6, bw * 0.43); body.add(med);
      part(med, G.cyl(18), gold(), [0, 0, 0], [0.09, 0.014, 0.09], [Math.PI / 2, 0, 0]);
      part(med, G.cyl(18), mat(P.navy, { rough: 0.6 }), [0, 0, 0.006], [0.07, 0.008, 0.07], [Math.PI / 2, 0, 0]);
      part(med, G.octa(), gold(), [0, 0, 0.011], [0.022, 0.06, 0.006]);
      part(med, G.octa(), gold(), [0, 0, 0.011], [0.06, 0.022, 0.006]);
    }, { scale: 1.04 }));
  },
  animate(rig) {
    robotClips(rig, {
      move: 'glide', moveDur: 1.0, moveOpts: { lean: 0.12, bob: 0.025 },
      emote: 'twirl', emoteOpts: { turns: 1 },
      // Leading: checks the map on a laptop, then a calm "this way" with the whole arm.
      work: (p, pose) => {
        typing(rig, pose, p);
        const point = cbump(p, 0.72, 0.14);
        pose.rot('arm_r', 0.75 * point - 1.3 * point, -0.2 * point, -0.5 * point);
        pose.rot('head', -0.18 * point, 0.25 * point, 0);
      },
      extra: (clip, p, pose) => {
        const flutter = { Move: 0.35, Emote: 0.6, Idle: 0.05, Talk: 0.08, Work: 0.04, Sleep: 0.02 }[clip];
        pose.rot('cape', -flutter * (0.6 + 0.4 * wave(p, clip === 'Move' ? 2 : 1)), 0, 0);
        pose.scl('cape', 1 + 0.06 * flutter * wave(p, 2, 0.2), 1, 1 + 0.15 * flutter);
        pose.rot('hood_tip', clip === 'Sleep' ? 0.5 : 0.12 * wave(p, 2, -0.15), 0, 0.1 * wave(p, 1, -0.2));
      },
    });
  },
  voice: { preset: 'robot-lead' },
};

export const beacon = {
  id: 'intake-beacon', name: 'Beacon', team: 'intake', locomotion: 'waddle', height: 1.12, footprint: 0.34,
  build() {
    return buildRobot(base(this.id, ({ head, hc, headR, body, bodyH, bw }) => {
      // little lighthouse lamp on top
      const lamp = node(head, 'lamp', [0, hc[1] + headR * 0.88, 0]);
      part(lamp, G.cyl(16), mat(P.navy, { rough: 0.6 }), [0, 0.02, 0], [0.12, 0.04, 0.12]);
      part(lamp, G.cyl(14), glow('#ffd27a'), [0, 0.07, 0], [0.085, 0.07, 0.085]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.PI / 4;
        part(lamp, G.cyl(6), gold(), [Math.cos(a) * 0.045, 0.07, Math.sin(a) * 0.045], [0.01, 0.07, 0.01]);
      }
      part(lamp, G.cone(16), mat(P.navy, { rough: 0.6 }), [0, 0.125, 0], [0.13, 0.05, 0.13]);
      part(lamp, G.sphere(8, 6), gold(), [0, 0.16, 0], 0.025);
      const beam = hide(node(lamp, 'lamp_flash', [0, 0.07, 0]));
      part(beam, G.sphere(14, 10), glow('#fff0c4'), [0, 0, 0], 0.13);
      // navy stripe "lighthouse" band on the belly
      part(body, G.cyl(20, 0.5, 0.5, true), mat(P.navy, { rough: 0.7 }), [0, 0.05 + bodyH * 0.45, 0], [bw * 1.0, 0.05, bw * 0.87]);
    }));
  },
  animate(rig) {
    robotClips(rig, {
      move: 'waddle', moveOpts: { roll: 0.12, bounce: 0.035 },
      emote: 'spin',
      // Checking records: types, glances side to side, the lamp sweeps and blinks.
      work: (p, pose) => {
        typing(rig, pose, p);
        pose.rot('lamp', 0, TAU * p, 0);
        pose.vis('lamp_flash', 0.6 * cbump(p, 0.3, 0.05) + 0.6 * cbump(p, 0.8, 0.05));
      },
      extra: (clip, p, pose) => {
        if (clip === 'Emote') pose.vis('lamp_flash', cbump(p, 0.45, 0.2));
        if (clip === 'Idle') pose.rot('lamp', 0, 0.3 * wave(p, 1), 0);
      },
    });
  },
  voice: { preset: 'robot-bright' },
};

export const relay = {
  id: 'intake-relay', name: 'Relay', team: 'intake', locomotion: 'hop', height: 1.1, footprint: 0.34, moveSpeed: 1.0,
  build() {
    return buildRobot(base(this.id, ({ head, hc, headR, body, bodyH, bw }) => {
      // receipt roll on top
      const roll = node(head, 'receipt', [0, hc[1] + headR * 0.88, 0]);
      part(roll, G.cyl(14), mat('#f7f1e3', { rough: 0.9 }), [0, 0.05, 0], [0.13, 0.13, 0.13], [0, 0, Math.PI / 2]);
      part(roll, G.cyl(10), mat(P.navy, { rough: 0.6 }), [0, 0.05, 0], [0.04, 0.15, 0.04], [0, 0, Math.PI / 2]);
      const sheet = node(roll, 'receipt_sheet', [0, 0.1, 0.02]);
      part(sheet, G.box(), mat('#fbf7ee', { rough: 0.95 }), [0, 0.05, 0], [0.11, 0.1, 0.004]);
      for (let i = 0; i < 3; i++) part(sheet, G.box(), mat('#9aa2b0', { rough: 0.9 }), [0, 0.03 + i * 0.022, 0.003], [0.07, 0.005, 0.002]);
      // checklist panel on the chest
      const g = new THREE.Group(); g.position.set(0, 0.05 + bodyH * 0.52, bw * 0.42); body.add(g);
      part(g, G.rbox(0.11, 0.12, 0.02, 0.012, 2), mat('#f7f1e3', { rough: 0.8 }), [0, 0, 0]);
      part(g, G.box(), mat(P.navy, { rough: 0.6 }), [-0.012, -0.004, 0.012], [0.035, 0.012, 0.006], [0, 0, -0.8]);
      part(g, G.box(), mat(P.navy, { rough: 0.6 }), [0.014, 0.008, 0.012], [0.06, 0.012, 0.006], [0, 0, 0.9]);
    }));
  },
  animate(rig) {
    robotClips(rig, {
      move: 'hop', moveDur: 0.6, moveOpts: { height: 0.12 },
      emote: 'flip',
      // Checking receipts: the receipt feeds out, a tick on the chest panel, the roll rewinds.
      work: (p, pose) => {
        typing(rig, pose, p);
        const feed = ease.inOut(seg(p, 0.1, 0.5)) * (1 - ease.inOut(seg(p, 0.8, 0.95)));
        pose.scl('receipt_sheet', 1, 1 + 1.4 * feed, 1);
        pose.rot('receipt', TAU * 0.5 * feed, 0, 0);
        const tick = cbump(p, 0.62, 0.06);
        pose.rot('arm_l', -0.8 * tick, 0, 0.5 * tick);
      },
      extra: (clip, p, pose) => {
        if (clip === 'Move' || clip === 'Emote') pose.rot('receipt_sheet', 0.4 * wave(p, 2, -0.1), 0, 0);
      },
    });
  },
  voice: { preset: 'robot-bouncy' },
};

export const compass = {
  id: 'intake-compass', name: 'Compass', team: 'intake', locomotion: 'waddle', height: 1.1, footprint: 0.34, moveSpeed: 0.85,
  build() {
    return buildRobot(base(this.id, ({ head, hc, headR, body, bodyH, bw }) => {
      // sprout antenna with a glowing gold bud
      const sp = node(head, 'sprout', [0, hc[1] + headR * 0.9, 0]);
      const stem = mat(P.navy, { rough: 0.6 });
      limb(sp, [0, 0, 0], [0.01, 0.12, 0], 0.012, stem);
      part(sp, G.sphere(10, 8), mat('#3f5a4c', { rough: 0.6 }), [-0.04, 0.09, 0], [0.07, 0.025, 0.035], [0, 0, 0.5]);
      part(sp, G.sphere(10, 8), mat('#3f5a4c', { rough: 0.6 }), [0.05, 0.11, 0], [0.07, 0.025, 0.035], [0, 0, -0.5]);
      const bud = node(sp, 'bud', [0.012, 0.135, 0]);
      part(bud, G.sphere(10, 8), glow('#f7c564'), [0, 0, 0], 0.045);
      // circuit board patch on the chest
      const g = new THREE.Group(); g.position.set(0, 0.05 + bodyH * 0.5, bw * 0.4); body.add(g);
      part(g, G.rbox(0.11, 0.14, 0.03, 0.02, 2), mat(P.navy, { rough: 0.6 }), [0, 0, 0]);
      const tr = mat(P.gold, { rough: 0.45, metal: 0.3 });
      part(g, G.box(), tr, [0, 0.0, 0.016], [0.006, 0.08, 0.004]);
      part(g, G.box(), tr, [0.02, 0.025, 0.016], [0.04, 0.006, 0.004]);
      part(g, G.box(), tr, [-0.02, -0.02, 0.016], [0.04, 0.006, 0.004]);
      [[0, 0.045], [0.04, 0.025], [-0.04, -0.02], [0, -0.045]].forEach(([x, y]) => part(g, G.sphere(8, 6), tr, [x, y, 0.016], 0.016));
    }));
  },
  animate(rig) {
    robotClips(rig, {
      move: 'waddle', moveDur: 0.76, moveOpts: { roll: 0.16, bounce: 0.03 },
      emote: 'spin', emoteOpts: { turns: 2, height: 0.3 },
      // Investigating: types, tilts head curiously, the bud pulses as an idea arrives.
      work: (p, pose) => {
        typing(rig, pose, p);
        pose.rot('head', 0, 0, 0.18 * cbump(p, 0.45, 0.12));
        pose.scl('bud', 1 + 0.5 * cbump(p, 0.5, 0.06));
      },
      extra: (clip, p, pose) => {
        const sway = { Move: 0.3, Emote: 0.5, Idle: 0.12, Talk: 0.15, Work: 0.08, Sleep: 0 }[clip];
        pose.rot('sprout', 0.12 * sway * wave(p, 2, -0.15), 0, sway * wave(p, 1, -0.2));
        if (clip === 'Sleep') { pose.rot('sprout', 0.55, 0, 0.3); pose.scl('bud', 0.7); }
      },
    });
  },
  voice: { preset: 'robot-curious' },
};

export default [beacon, jarvis, relay, compass];
