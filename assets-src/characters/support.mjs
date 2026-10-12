// Savor WhatsApp Support — Beacon, the calm little lantern.
// Portrait cues: forest-green matte ceramic, bell cap with ring handle,
// a warm amber glow shaped like a chat bubble, happy ^ ^ eyes, paws clasped.
import * as THREE from 'three';
import { G, mat, gloss, glow, part, node, hide, arcPart, sleepEyes, limb, layeredGlow, blush } from '../lib/kit.mjs';
import { skeleton, idle, sleep, waddle, spinHop, talk } from '../lib/rig.mjs';
import { wave, cbump, seg, ease } from '../lib/anim.mjs';

const GREEN = '#2f5d46';
const GREEN_DEEP = '#264d3a';
const AMBER = ['#f1bf55', '#f7d06c', '#fbdd87'];
const AMBER_DIM = '#8e6735';
const EYE = '#5b3a17';

function bubbleShape(w, h, r, tail = true) {
  const s = new THREE.Shape();
  const x0 = -w / 2; const y0 = -h / 2;
  s.moveTo(x0 + r, y0);
  if (tail) {
    s.lineTo(w / 2 - r * 1.3, y0);
    s.quadraticCurveTo(w / 2 - r * 0.45, y0, w / 2 + r * 0.05, y0 - h * 0.16); // little tail
    s.quadraticCurveTo(w / 2 - r * 0.02, y0 + h * 0.02, w / 2, y0 + r * 0.9);
  } else {
    s.lineTo(w / 2 - r, y0);
    s.quadraticCurveTo(w / 2, y0, w / 2, y0 + r);
  }
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(x0 + r, h / 2);
  s.quadraticCurveTo(x0, h / 2, x0, h / 2 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

export const beacon = {
  id: 'support-beacon',
  name: 'Beacon',
  team: 'support',
  locomotion: 'waddle',
  height: 1.02,
  footprint: 0.34,
  build() {
    const { root, body, head } = skeleton({ id: this.id, centerY: 0.48, headY: 0.4, zzzY: 1.08 });
    const green = mat(GREEN, { rough: 0.86 });
    const deep = mat(GREEN_DEEP, { rough: 0.9 });

    // torso: a soft bean that the head sits on
    part(body, G.sphere(), green, [0, 0.25, 0], [0.52, 0.44, 0.46]);
    part(body, G.sphere(), mat('#cfd6b4', { rough: 0.85 }), [0, 0.22, 0.09], [0.34, 0.3, 0.3]);
    const fl = node(body, 'foot_l', [-0.11, 0.045, 0.05]);
    const fr = node(body, 'foot_r', [0.11, 0.045, 0.05]);
    part(fl, G.sphere(14, 10), deep, [0, 0, 0], [0.15, 0.09, 0.19]);
    part(fr, G.sphere(14, 10), deep, [0, 0, 0], [0.15, 0.09, 0.19]);

    // paws clasped over the belly
    for (const [side, s] of [['l', -1], ['r', 1]]) {
      const arm = node(body, `arm_${side}`, [s * 0.2, 0.36, 0.08]);
      limb(arm, [0, 0, 0], [-s * 0.12, -0.12, 0.13], 0.058, green);
      part(arm, G.sphere(14, 10), green, [-s * 0.14, -0.14, 0.15 + (s > 0 ? 0.02 : 0)], [0.13, 0.1, 0.1]);
    }

    // head block with soft corners
    part(head, G.rbox(0.66, 0.52, 0.54, 0.22, 3), green, [0, 0.25, 0]);
    // bell cap + brim + ring handle
    part(head, G.cyl(20, 0.5, 0.5), deep, [0, 0.505, 0], [0.5, 0.035, 0.46]);
    part(head, G.hemi(18, 6), green, [0, 0.515, 0], [0.38, 0.22, 0.36]);
    part(head, G.sphere(12, 8), green, [0, 0.61, 0], [0.07, 0.05, 0.07]);
    const handle = node(head, 'handle', [0, 0.62, 0]);
    part(handle, G.torus(0.075, 0.024, 6, 16), green, [0, 0.07, 0]);

    // face: bubble-shaped window with a soft bezel, bright and dim glows
    const face = [0, 0.245, 0.272];
    part(head, G.shape('bezel', bubbleShape(0.475, 0.34, 0.135), 0.016, 0.01), deep, [face[0], face[1], face[2] - 0.004]);
    part(head, G.shape('bubble-dim', bubbleShape(0.44, 0.31, 0.12), 0.012, 0.006), glow(AMBER_DIM), [face[0], face[1], face[2] + 0.006]);
    const on = node(head, 'glow_on', [face[0], face[1], face[2] + 0.012]);
    layeredGlow(on, 'beacon', (k) => bubbleShape(0.44 * k, 0.31 * k, 0.12 * k, k > 0.99), AMBER, 0, 0.0025);

    // eyes: happy ^ ^ (blinks squash them); sleepy ‿ ‿ when the chat is quiet
    const eyeMat = mat(EYE, { rough: 0.6 });
    for (const [side, k] of [['l', -1], ['r', 1]]) {
      const e = node(head, `eye_${side}`, [k * 0.085, 0.27, face[2] + 0.028]);
      part(e, G.sphere(12, 9), gloss(EYE), [0, 0, 0], [0.05, 0.06, 0.02]);
      part(e, G.sphere(6, 4), glow('#ffffff'), [0.01, 0.014, 0.008], [0.016, 0.016, 0.006]);
    }
    const mouth = node(head, 'mouth', [0, 0.215, face[2] + 0.026]);
    arcPart(mouth, [0, 0, 0], 0.05, eyeMat, 0.24, false);
    // headset ear discs: this is the support desk, after all
    for (const k of [-1, 1]) {
      part(head, G.cyl(18), green, [k * 0.335, 0.25, 0], [0.15, 0.06, 0.15], [0, 0, Math.PI / 2]);
      part(head, G.cyl(18), mat('#cfd6b4', { rough: 0.7 }), [k * 0.365, 0.25, 0], [0.09, 0.02, 0.09], [0, 0, Math.PI / 2]);
    }
    sleepEyes(head, [-0.085, 0.25, face[2] + 0.03], [0.085, 0.25, face[2] + 0.03], 0.07, eyeMat, 0.22);
    blush(head, [-0.15, 0.2, face[2] + 0.024], 0.06, '#f59a62');
    blush(head, [0.15, 0.2, face[2] + 0.024], 0.06, '#f59a62');

    // "typing…" bubble that appears while working
    const dots = hide(node(head, 'fx_typing', [0.34, 0.62, 0.05]));
    part(dots, G.shape('typing', bubbleShape(0.24, 0.13, 0.065), 0.04, 0.014), mat('#fffaf0', { rough: 0.7 }), [0, 0, 0]);
    for (let i = 0; i < 3; i++) {
      const d = node(dots, `dot${i}`, [(i - 1) * 0.055, 0.005, 0.03]);
      part(d, G.sphere(10, 8), green, [0, 0, 0], 0.034);
    }
    return root;
  },
  animate(rig) {
    rig.clip('Idle', 3.2, (p, pose) => {
      idle(rig, pose, p, { tilt: 0.07, blinkAt: [0.38, 0.47] });
      pose.rot('handle', 0, 0, -0.18 * wave(p, 1, 0.15));
      pose.scl('glow_on', 1 + 0.015 * wave(p, 2));
    });
    rig.clip('Move', 0.72, (p, pose) => {
      waddle(rig, pose, p, { roll: 0.13, bounce: 0.04, lean: 0.07 });
      pose.rot('handle', 0, 0, 0.35 * wave(p, 1, -0.12));
      pose.rot('arm_l', 0, 0, 0); // paws stay clasped; the body does the waddling
    });
    rig.clip('Work', 2.4, (p, pose) => {
      // Listening, then typing a careful reply: head tilts toward the bubble, paws tap.
      pose.rot('head', 0.05 + 0.03 * wave(p, 2), 0.1, -0.1 + 0.03 * wave(p, 1));
      pose.rot('body', 0.04, 0, 0.02 * wave(p, 2));
      const tap = Math.abs(wave(p, 7));
      pose.rot('arm_l', -0.25 * tap, 0, 0);
      pose.rot('arm_r', -0.25 * Math.abs(wave(p, 7, 0.25)), 0, 0);
      pose.vis('fx_typing', ease.out(seg(p, 0, 0.08)) * (1 - ease.inOut(seg(p, 0.92, 1))));
      pose.pos('fx_typing', 0, 0.015 * wave(p, 2), 0);
      for (let i = 0; i < 3; i++) pose.pos(`dot${i}`, 0, 0.03 * Math.max(0, wave(p, 4, -i * 0.12)), 0);
      pose.scl('glow_on', 1 + 0.04 * Math.max(0, wave(p, 4)));
      pose.rot('handle', 0, 0, 0.08 * wave(p, 2, 0.3));
    });
    rig.clip('Emote', 1.3, (p, pose) => {
      spinHop(rig, pose, p, { height: 0.34, armsUp: 1.6 });
      pose.rot('handle', 0, 0, 0.6 * Math.sin(Math.PI * seg(p, 0.15, 0.9)) * wave(p, 2));
      pose.scl('glow_on', 1 + 0.12 * cbump(p, 0.45, 0.3));
    });
    rig.clip('Talk', 1.6, (p, pose) => {
      talk(rig, pose, p, { syllables: 7, gesture: false });
      pose.scl('glow_on', 1 + 0.05 * Math.abs(wave(p, 3.5)));
      pose.rot('arm_l', -0.2 * cbump(p, 0.3, 0.2), 0, 0);
      pose.rot('arm_r', -0.2 * cbump(p, 0.7, 0.2), 0, 0);
      pose.rot('handle', 0, 0, 0.12 * wave(p, 2));
    });
    rig.clip('Sleep', 4.0, (p, pose) => {
      sleep(rig, pose, p, { slump: 0.08, droop: 0.16 });
      pose.scl('glow_on', 0.001, 0.001, 1); // the light dims to a low ember
      pose.rot('handle', 0, 0, 0.25);
    });
  },
  voice: { preset: 'lantern-soft' },
};

export default [beacon];
