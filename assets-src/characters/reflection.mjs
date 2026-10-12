// The Lantern Desk — nightly reflection: Lumen the lantern leads; Echo (lens) and
// Quill (pencil) are two cream plush owls. Concept style: warm beige room, glowing brass lantern.
import * as THREE from 'three';
import { G, mat, gloss, glow, part, node, hide, sleepEyes, arcPart, smoothProfile, blush } from '../lib/kit.mjs';
import { skeleton, idle, sleep, float, spinHop, talk } from '../lib/rig.mjs';
import { buildOwl } from '../lib/owl.mjs';
import { owlClips } from '../lib/owl-anim.mjs';
import { wave, cbump, seg, ease, TAU, blink } from '../lib/anim.mjs';

const BRONZE = '#6f5a3a';
const BRONZE_LIGHT = '#8c7349';
const GOLD = '#cfa04e';

export const lumen = {
  id: 'reflection-lumen', name: 'Lumen', team: 'reflection', locomotion: 'float', airborne: true, height: 0.78, footprint: 0.3, moveSpeed: 0.7,
  build() {
    const { root, body, head } = skeleton({ id: this.id, centerY: 0.38, headY: 0.68, zzzY: 0.88 });
    const bronze = mat(BRONZE, { rough: 0.5, metal: 0.45 });
    const bronzeL = mat(BRONZE_LIGHT, { rough: 0.45, metal: 0.45 });
    // base with little feet
    part(body, G.cyl(24), bronze, [0, 0.075, 0], [0.4, 0.07, 0.4]);
    part(body, G.cyl(24), bronzeL, [0, 0.12, 0], [0.34, 0.03, 0.34]);
    for (const [side, k] of [['l', -1], ['r', 1]]) {
      const f = node(body, `foot_${side}`, [k * 0.1, 0.03, 0.05]);
      part(f, G.sphere(10, 8), bronze, [0, 0, 0], [0.09, 0.06, 0.11]);
    }
    // glass globe: warm glow with a brighter core and a flame
    const globe = smoothProfile([[0.001, 0.13], [0.13, 0.15], [0.17, 0.27], [0.155, 0.4], [0.1, 0.47], [0.001, 0.48]], 18);
    part(body, G.lathe('globe', globe, 22), glow('#d0832f'), [0, 0, 0]);
    const core = node(body, 'glow_core', [0, 0.29, 0]);
    part(core, G.lathe('globe-core', globe.map(([r, y]) => [r * 0.93 + 0.004, (y - 0.29) * 0.92]), 22), glow('#ffc260'), [0, 0, 0.006]);
    const flame = node(body, 'flame', [0, 0.25, 0.04]);
    part(flame, G.sphere(12, 10), glow('#fff2c6'), [0, 0.04, 0], [0.07, 0.13, 0.05]);
    part(flame, G.sphere(10, 8), glow('#ffe39a'), [0, 0.0, 0.004], [0.1, 0.09, 0.06]);
    // cage: rings + wires
    part(body, G.torus(0.158, 0.011, 6, 28), bronze, [0, 0.185, 0], 1, [Math.PI / 2, 0, 0]);
    part(body, G.torus(0.13, 0.011, 6, 28), bronze, [0, 0.445, 0], 1, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      part(body, G.cyl(6), bronze, [Math.cos(a) * 0.17, 0.3, Math.sin(a) * 0.17], [0.014, 0.36, 0.014]);
    }
    // a tiny face on the glass
    const fz = 0.17;
    const el = node(body, 'eye_l', [-0.05, 0.31, fz]);
    const er = node(body, 'eye_r', [0.05, 0.31, fz]);
    part(el, G.sphere(10, 8), gloss('#4a2f14'), [0, 0, 0], [0.032, 0.04, 0.016]);
    part(er, G.sphere(10, 8), gloss('#4a2f14'), [0, 0, 0], [0.032, 0.04, 0.016]);
    sleepEyes(body, [-0.05, 0.305, fz + 0.002], [0.05, 0.305, fz + 0.002], 0.045, mat('#4a2f14', { rough: 0.6 }), 0.26);
    const mouth = node(body, 'mouth', [0, 0.27, fz - 0.002]);
    arcPart(mouth, [0, 0, 0], 0.04, mat('#4a2f14', { rough: 0.6 }), 0.26, false);
    blush(body, [-0.095, 0.275, fz - 0.012], 0.04, '#f08b55');
    blush(body, [0.095, 0.275, fz - 0.012], 0.04, '#f08b55');
    // head = the cap: dome roof, vent, ring handle
    const cap = smoothProfile([[0.2, 0.0], [0.19, 0.03], [0.14, 0.08], [0.07, 0.11], [0.05, 0.12]], 10);
    part(head, G.lathe('lumen-cap', [[0.001, 0], ...cap, [0.001, 0.12]], 22), bronze, [0, -0.2, 0]);
    part(head, G.cyl(16), bronzeL, [0, -0.06, 0], [0.11, 0.05, 0.11]);
    part(head, G.cyl(16), bronze, [0, -0.03, 0], [0.13, 0.02, 0.13]);
    const handle = node(head, 'handle', [0, -0.02, 0]);
    part(handle, G.torus(0.085, 0.014, 6, 22, Math.PI), bronze, [0, 0.0, 0]);
    return root;
  },
  animate(rig) {
    const flicker = (pose, p, amt = 1) => {
      const f = 0.06 * wave(p, 7) + 0.04 * wave(p, 11, 0.3) + 0.03 * wave(p, 17, 0.6);
      pose.scl('flame', 1 - f * 0.4 * amt, 1 + f * amt, 1);
    };
    rig.clip('Idle', 3.0, (p, pose) => {
      pose.rot('body', 0, 0, 0.04 * wave(p, 1));
      pose.scl('body', 1, 1 + 0.012 * wave(p, 1), 1);
      pose.rot('head', 0, 0, -0.03 * wave(p, 1, 0.1));
      pose.rot('handle', 0.2 * wave(p, 1, -0.15), 0, 0);
      flicker(pose, p);
      pose.scl('glow_core', 1 + 0.02 * wave(p, 2));
      blink(pose, p, ['eye_l', 'eye_r'], [0.35, 0.44]);
    });
    rig.clip('Move', 1.2, (p, pose) => {
      float(rig, pose, p, { height: 0.14, bob: 0.04, lean: 0.1, sway: 0.08 });
      pose.rot('handle', 0.4 * wave(p, 1, -0.15), 0, 0);
      flicker(pose, p, 1.6);
      pose.rot('foot_l', 0.4, 0, 0);
      pose.rot('foot_r', 0.4, 0, 0);
    });
    rig.clip('Work', 2.4, (p, pose) => {
      // illuminating the page: leans over the desk and brightens
      const lean = ease.inOut(seg(p, 0.05, 0.25)) * (1 - ease.inOut(seg(p, 0.8, 0.97)));
      pose.rot('body', 0.25 * lean, 0, 0);
      pose.pos('hop', 0, 0.04 * lean, 0.04 * lean);
      pose.scl('glow_core', 1 + 0.06 * lean + 0.03 * wave(p, 3));
      pose.scl('flame', 1 + 0.25 * lean, 1 + 0.45 * lean, 1);
      pose.rot('handle', 0.3 * lean, 0, 0);
      blink(pose, p, ['eye_l', 'eye_r'], [0.6]);
    });
    rig.clip('Emote', 1.3, (p, pose) => {
      spinHop(rig, pose, p, { height: 0.3 });
      pose.scl('flame', 1 + 0.3 * cbump(p, 0.45, 0.25), 1 + 0.8 * cbump(p, 0.45, 0.25), 1);
      pose.scl('glow_core', 1 + 0.08 * cbump(p, 0.45, 0.25));
      pose.rot('handle', 0.8 * Math.sin(Math.PI * seg(p, 0.15, 0.9)) * wave(p, 2), 0, 0);
    });
    rig.clip('Talk', 1.6, (p, pose) => {
      const syl = Math.abs(wave(p, 3.5));
      pose.pos('hop', 0, 0.015 * syl, 0);
      pose.rot('body', 0, 0.08 * wave(p, 1), 0.05 * wave(p, 1, 0.25));
      pose.scl('flame', 1, 1 + 0.35 * syl, 1);
      pose.scl('mouth', 1, 1 + 0.9 * syl, 1);
      pose.rot('handle', 0.15 * wave(p, 2), 0, 0);
      blink(pose, p, ['eye_l', 'eye_r'], [0.62]);
    });
    rig.clip('Sleep', 4.2, (p, pose) => {
      // turned low: tiny flame, dim core, settled to one side
      pose.pos('hop', 0, -0.01, 0);
      pose.rot('body', 0.05, 0, 0.06);
      pose.scl('flame', 0.45, 0.35 + 0.05 * wave(p, 1), 0.45);
      pose.vis('glow_core', 0.001); // the bright core goes out; the deeper amber glass stays
      pose.rot('handle', 0.9, 0, 0);
      pose.scl('eye_l', 1, 0.001, 1);
      pose.scl('eye_r', 1, 0.001, 1);
      pose.vis('eyes_sleep', 1);
      pose.scl('mouth', 0.8, 0.6, 1);
      pose.pos('fx_zzz', 0, rig.zzzLift, 0);
      for (let i = 0; i < 3; i++) {
        const q = ((p + i / 3) % 1);
        const appear = q < 0.18 ? ease.out(q / 0.18) : q > 0.78 ? 1 - ease.inOut((q - 0.78) / 0.22) : 1;
        pose.pos(`fx_z${i}`, Math.sin(q * TAU) * 0.04 + q * 0.12, q * 0.34, 0);
        pose.vis(`fx_z${i}`, appear * (0.75 + q * 0.5));
      }
    });
  },
  voice: { preset: 'lantern-hum' },
};

// ---------------------------------------------------------------- owls

const CREAM = { chevrons: false, body: '#eee6d8', belly: '#f8f3ea', wing: '#cdb99b', chevron: '#e0d3bd', ring: '#f9f6f0', ringEdge: '#cfc4b2', beak: '#e09a45', feet: '#e09a45', tuftInner: '#d8c7aa', blush: '#f2a99a' };

export const echo = {
  id: 'reflection-echo', name: 'Echo', team: 'reflection', locomotion: 'hop', height: 1.0, footprint: 0.34, moveSpeed: 0.8,
  build() {
    return buildOwl({
      id: this.id, scale: 0.96, ...CREAM,
      wingExtras: (w, side, k, s) => {
        if (side !== 'r') return;
        const mg = hide(node(w, 'prop_lens', [k * 0.06 * s, -0.22 * s, 0.14 * s], [0.2, 0, 0.3]));
        part(mg, G.cyl(8), mat('#7a5a3a', { rough: 0.6 }), [0, -0.05 * s, 0], [0.02 * s, 0.1 * s, 0.02 * s]);
        part(mg, G.torus(0.05 * s, 0.011 * s, 6, 18), mat(GOLD, { rough: 0.45, metal: 0.3 }), [0, 0.05 * s, 0]);
        part(mg, G.cyl(18), glow('#e8f3f2'), [0, 0.05 * s, 0], [0.09 * s, 0.005 * s, 0.09 * s], [Math.PI / 2, 0, 0]);
      },
    });
  },
  animate(rig) {
    owlClips(rig, {
      move: 'hop', moveDur: 0.6,
      // Careful evidence: lens up, peer left, peer right, an "aha" tuft wiggle.
      work: (p, pose) => {
        const up = ease.inOut(seg(p, 0.03, 0.15)) * (1 - ease.inOut(seg(p, 0.86, 0.98)));
        pose.vis('prop_lens', up);
        pose.rot('wing_r', -1.1 * up, 0.2 * up, -0.9 * up);
        pose.rot('head', 0.12 * up, 0.35 * wave(p, 1) * up, 0.1 * wave(p, 2) * up);
        pose.scl('prop_lens', 1 + 0.3 * cbump(p, 0.5, 0.08));
        pose.rot('tuft_l', 0, 0, 0.25 * cbump(p, 0.75, 0.05));
        pose.rot('tuft_r', 0, 0, -0.25 * cbump(p, 0.75, 0.05));
        blink(pose, p, ['eye_l', 'eye_r'], [0.66]);
      },
    });
  },
  voice: { preset: 'owl-soft' },
};

export const quill = {
  id: 'reflection-quill', name: 'Quill', team: 'reflection', locomotion: 'waddle', height: 0.98, footprint: 0.34, moveSpeed: 0.75,
  build() {
    return buildOwl({
      id: this.id, scale: 0.93, ...CREAM, body: '#ece2d0', belly: '#f6efe2',
      wingExtras: (w, side, k, s) => {
        if (side !== 'r') return;
        const pen = hide(node(w, 'prop_pencil', [k * 0.05 * s, -0.24 * s, 0.13 * s], [0.6, 0, -0.5]));
        part(pen, G.cyl(6), mat('#e0b04a', { rough: 0.6 }), [0, 0, 0], [0.025 * s, 0.17 * s, 0.025 * s]);
        part(pen, G.cone(6), mat('#efd2a6', { rough: 0.8 }), [0, -0.1 * s, 0], [0.025 * s, 0.035 * s, 0.025 * s], [Math.PI, 0, 0]);
        part(pen, G.cyl(6), mat('#e8a0a0', { rough: 0.8 }), [0, 0.095 * s, 0], [0.026 * s, 0.025 * s, 0.026 * s]);
      },
    });
  },
  animate(rig) {
    owlClips(rig, {
      // Useful improvement: writes a little note, taps a full stop, admires it.
      work: (p, pose) => {
        const hold = ease.inOut(seg(p, 0.03, 0.12)) * (1 - ease.inOut(seg(p, 0.88, 0.98)));
        pose.vis('prop_pencil', hold);
        pose.rot('wing_r', -0.8 * hold, 0.3 * hold, -0.6 * hold);
        const writing = seg(p, 0.15, 0.7) > 0 && seg(p, 0.15, 0.7) < 1 ? 1 : 0;
        pose.rot('wing_r', 0.12 * wave(p, 9) * writing * hold, 0.1 * wave(p, 9, 0.25) * writing * hold, 0);
        pose.rot('head', 0.28 * hold, 0.1 * wave(p, 9) * writing * 0.3, 0.06 * wave(p, 2));
        pose.rot('body', 0.08 * hold, 0, 0);
        const dot = cbump(p, 0.74, 0.03);
        pose.rot('wing_r', 0.3 * dot, 0, 0);
        pose.rot('head', -0.3 * cbump(p, 0.83, 0.06), 0, 0.18 * cbump(p, 0.83, 0.06));
        blink(pose, p, ['eye_l', 'eye_r'], [0.85]);
      },
    });
  },
  voice: { preset: 'owl-bright' },
};

export default [lumen, echo, quill];
