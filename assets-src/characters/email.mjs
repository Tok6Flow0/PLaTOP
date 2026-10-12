// Savor Dispatch — Official Email.
// Courier: a navy plush owl with cream eye rings and an envelope on its chest.
// Swift: a small warm-tan clay swift with teal wing tips, the review helper.
import * as THREE from 'three';
import { G, mat, gloss, glow, part, node, hide, sleepEyes, limb } from '../lib/kit.mjs';
import { skeleton, fly } from '../lib/rig.mjs';
import { buildOwl } from '../lib/owl.mjs';
import { owlClips } from '../lib/owl-anim.mjs';
import { wave, cbump, seg, ease, TAU, blink } from '../lib/anim.mjs';

const GOLD = '#d2a24c';

function envelope(parent, pos, size, rot = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.set(...pos); g.rotation.set(...rot);
  parent.add(g);
  part(g, G.rbox(1, 0.66, 0.1, 0.05, 2), mat('#f3e9d4', { rough: 0.8 }), [0, 0, 0], size);
  const flap = mat('#c9b38c', { rough: 0.8 });
  part(g, G.box(), flap, [-0.24 * size, 0.08 * size, 0.06 * size], [0.6 * size, 0.06 * size, 0.02 * size], [0, 0, -0.52]);
  part(g, G.box(), flap, [0.24 * size, 0.08 * size, 0.06 * size], [0.6 * size, 0.06 * size, 0.02 * size], [0, 0, 0.52]);
  part(g, G.cyl(12), mat('#c4573a', { rough: 0.5 }), [0, -0.05 * size, 0.07 * size], [0.18 * size, 0.04 * size, 0.18 * size], [Math.PI / 2, 0, 0]); // wax seal
  return g;
}

export const courier = {
  id: 'email-owl', name: 'Courier', team: 'email', locomotion: 'waddle', height: 1.02, footprint: 0.36, moveSpeed: 0.75,
  build() {
    return buildOwl({
      id: this.id, scale: 1.0,
      body: '#26324c', belly: '#34425f', wing: '#1d2840', chevron: '#26324c', ring: '#efe4cc', ringEdge: '#c9b998',
      beak: '#e3a043', feet: '#e3a043', tuftInner: '#1d2840', blush: '#c98a86',
      extras: ({ body, s }) => {
        // gold-trimmed envelope badge on the chest
        envelope(body, [0, 0.36 * s, 0.25 * s], 0.11 * s, [-0.2, 0, 0]);
        // letter carried while working (hidden at rest)
        const letter = hide(node(body, 'prop_letter', [0.26 * s, 0.34 * s, 0.24 * s]));
        envelope(letter, [0, 0, 0], 0.16 * s, [0, -0.3, 0.25]);
      },
    });
  },
  animate(rig) {
    owlClips(rig, {
      // Sorting the post: lift a letter, check it, stamp it twice, file it.
      work: (p, pose) => {
        pose.vis('prop_letter', ease.out(seg(p, 0.02, 0.12)) * (1 - ease.inOut(seg(p, 0.88, 0.98))));
        const lift = ease.inOut(seg(p, 0.05, 0.2)) * (1 - ease.inOut(seg(p, 0.82, 0.95)));
        pose.rot('wing_r', -0.4 * lift, 0, -0.9 * lift);
        pose.pos('prop_letter', 0, 0.08 * lift, 0);
        pose.rot('head', 0.12 * lift, 0.25 * lift, -0.15 * lift);
        const st = cbump(p, 0.45, 0.06) + cbump(p, 0.62, 0.06);
        pose.pos('hop', 0, -0.015 * st, 0);
        pose.scl('hop', 1 + 0.03 * st, 1 - 0.05 * st, 1 + 0.03 * st);
        pose.pos('prop_letter', 0, -0.05 * st, 0);
        pose.rot('head', 0.1 * st, 0, 0);
        blink(pose, p, ['eye_l', 'eye_r'], [0.3]);
      },
    });
  },
  voice: { preset: 'owl-warm' },
};

// ---------------------------------------------------------------- swift

const TAN = '#e0b27c';
const TAN_DEEP = '#c9955c';
const BELLY = '#f3dcb8';
const TEAL = '#4c8a88';

export const swift = {
  id: 'email-swift', name: 'Swift', team: 'email', locomotion: 'fly', airborne: true, height: 0.5, footprint: 0.22, moveSpeed: 1.25,
  build() {
    const { root, body, head } = skeleton({ id: this.id, centerY: 0.22, headY: 0.28, zzzY: 0.62 });
    const tan = mat(TAN, { rough: 0.8 });
    const deep = mat(TAN_DEEP, { rough: 0.8 });
    // round body, tipped forward like a perched bird
    part(body, G.sphere(), tan, [0, 0.19, -0.02], [0.24, 0.24, 0.32], [0.35, 0, 0]);
    part(body, G.sphere(), mat(BELLY, { rough: 0.85 }), [0, 0.16, 0.04], [0.19, 0.19, 0.22], [0.35, 0, 0]);
    for (const [side, k] of [['l', -1], ['r', 1]]) {
      const f = node(body, `foot_${side}`, [k * 0.05, 0.04, 0.02]);
      limb(f, [0, 0.04, 0], [0, 0, 0.02], 0.009, mat('#b07b44', { rough: 0.7 }));
    }
    // head + face
    part(head, G.sphere(), tan, [0, 0.04, 0.06], [0.2, 0.19, 0.2]);
    part(head, G.cone(10), mat('#d58b3e', { rough: 0.6 }), [0, 0.025, 0.18], [0.045, 0.08, 0.045], [Math.PI / 2, 0, 0]);
    for (const [side, k] of [['l', -1], ['r', 1]]) {
      const e = node(head, `eye_${side}`, [k * 0.055, 0.06, 0.14]);
      part(e, G.sphere(10, 8), gloss('#1d1a17'), [0, 0, 0], [0.035, 0.04, 0.025]);
      part(e, G.sphere(6, 4), glow('#ffffff'), [0.008, 0.01, 0.01], 0.012);
    }
    sleepEyes(head, [-0.055, 0.055, 0.15], [0.055, 0.055, 0.15], 0.04, mat('#1d1a17', { rough: 0.6 }), 0.28);
    part(head, G.sphere(10, 8), mat('#eea08e', { rough: 1 }), [-0.08, 0.02, 0.12], [0.035, 0.022, 0.01]);
    part(head, G.sphere(10, 8), mat('#eea08e', { rough: 1 }), [0.08, 0.02, 0.12], [0.035, 0.022, 0.01]);
    // wings with teal tips, hinged at the shoulders
    // folded against the body at rest; Move swings them out to ±80° and flaps
    for (const [side, k] of [['l', -1], ['r', 1]]) {
      const w = node(body, `wing_${side}`, [k * 0.1, 0.25, -0.01]);
      part(w, G.sphere(), deep, [k * 0.012, -0.07, -0.06], [0.045, 0.15, 0.27], [-0.35, 0, 0]);
      part(w, G.sphere(), mat(TEAL, { rough: 0.8 }), [k * 0.014, -0.1, -0.17], [0.04, 0.08, 0.12], [-0.35, 0, 0]);
    }
    // forked tail
    const tail = node(body, 'tail', [0, 0.18, -0.16]);
    for (const k of [-1, 1]) part(tail, G.sphere(10, 8), k < 0 ? deep : mat(TEAL, { rough: 0.8 }), [k * 0.035, -0.02, -0.08], [0.05, 0.025, 0.18], [0.3, k * 0.25, 0]);
    return root;
  },
  animate(rig) {
    rig.clip('Idle', 2.8, (p, pose) => {
      // perched: quick bird head-twitches, a tail flick, a little wing stretch
      const turn = 0.5 * (seg(p, 0.18, 0.22) - seg(p, 0.42, 0.46)) - 0.45 * (seg(p, 0.56, 0.6) - seg(p, 0.8, 0.84));
      pose.rot('head', 0.15 * cbump(p, 0.2, 0.025) - 0.1 * cbump(p, 0.58, 0.025), turn, 0);
      pose.rot('tail', 0.35 * cbump(p, 0.7, 0.04), 0, 0);
      pose.rot('wing_r', 0, 0, 1.1 * cbump(p, 0.9, 0.07)); // the concept's raised-wing stretch
      pose.scl('body', 1, 1 + 0.025 * wave(p, 2), 1);
      blink(pose, p, ['eye_l', 'eye_r'], [0.5], 0.03);
    });
    rig.clip('Move', 0.5, (p, pose) => {
      fly(rig, pose, p, { height: 0.42, bob: 0.05, flaps: 2, amp: 0.55, pitch: 0.1 });
      pose.rot('wing_l', 0, 0, -1.35);
      pose.rot('wing_r', 0, 0, 1.35);
      pose.rot('foot_l', 0.9, 0, 0);
      pose.rot('foot_r', 0.9, 0, 0);
    });
    rig.clip('Work', 2.2, (p, pose) => {
      // proofreading: three quick pecks at the page, then a satisfied fluff
      const peck = cbump(p, 0.2, 0.05) + cbump(p, 0.36, 0.05) + cbump(p, 0.52, 0.05);
      pose.rot('body', 0.35 * peck, 0, 0);
      pose.rot('head', 0.4 * peck, 0, 0);
      const fluff = cbump(p, 0.78, 0.1);
      pose.scl('body', 1 + 0.1 * fluff, 1 + 0.06 * fluff, 1 + 0.1 * fluff);
      pose.rot('wing_l', 0, 0, -0.45 * fluff);
      pose.rot('wing_r', 0, 0, 0.45 * fluff);
      pose.rot('tail', 0.4 * cbump(p, 0.82, 0.05), 0, 0);
    });
    rig.clip('Emote', 1.4, (p, pose) => {
      // a little loop-the-loop
      const a = ease.inOut(seg(p, 0.1, 0.85));
      const up = Math.sin(Math.PI * seg(p, 0.05, 0.95));
      pose.pos('hop', 0, 0.42 * up, 0);
      pose.rot('spin', -TAU * a, 0, 0);
      const f = wave(p, 5) * up;
      pose.rot('wing_l', 0, 0, -(1.35 * up + 0.55 * f));
      pose.rot('wing_r', 0, 0, 1.35 * up + 0.55 * f);
    });
    rig.clip('Talk', 1.2, (p, pose) => {
      const chirp = Math.abs(wave(p, 3));
      pose.rot('head', -0.18 * chirp, 0.2 * wave(p, 1), 0.15 * wave(p, 1, 0.25));
      pose.rot('tail', 0.25 * chirp, 0, 0);
      pose.scl('body', 1, 1 + 0.03 * chirp, 1);
      pose.pos('hop', 0, 0.015 * chirp, 0);
    });
    rig.clip('Sleep', 3.6, (p, pose) => {
      // head tucked, feathers puffed
      pose.rot('head', 0.45, 0.8, 0.2);
      pose.pos('head', 0, -0.04, -0.03);
      const b = 1.1 + 0.03 * wave(p, 1);
      pose.scl('body', b, b * 0.97, b);
      pose.pos('hop', 0, -0.015, 0);
      pose.scl('eye_l', 1, 0.001, 1);
      pose.scl('eye_r', 1, 0.001, 1);
      pose.vis('eyes_sleep', 1);
      pose.pos('fx_zzz', 0, rig.zzzLift, 0);
      for (let i = 0; i < 3; i++) {
        const q = ((p + i / 3) % 1);
        const appear = q < 0.18 ? ease.out(q / 0.18) : q > 0.78 ? 1 - ease.inOut((q - 0.78) / 0.22) : 1;
        pose.pos(`fx_z${i}`, Math.sin(q * TAU) * 0.03 + q * 0.08, q * 0.26, 0);
        pose.vis(`fx_z${i}`, appear * (0.55 + q * 0.35));
      }
    });
  },
  voice: { preset: 'swift-chirp' },
};

export default [courier, swift];
