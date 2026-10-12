// Shared clip set for toy robots, with per-character hooks layered on top.
import { idle, sleep, waddle, hopMove, glide, spinHop, backflip, twirl, talk } from './rig.mjs';
import { wave, cbump, seg, ease, blink } from './anim.mjs';

const MOVES = { waddle, hop: hopMove, glide };
const EMOTES = { spin: spinHop, flip: backflip, twirl };

/**
 * opts: {
 *   move: 'waddle'|'hop'|'glide', moveDur, moveOpts,
 *   emote: 'spin'|'flip'|'twirl', emoteOpts,
 *   work(p, pose)   — role action (defaults to laptop typing),
 *   workDur, extra(name, p, pose) — quirks layered on every clip
 * }
 */
export function robotClips(rig, opts = {}) {
  const extra = opts.extra || (() => {});
  const ant = (pose, amount) => { if (rig.has('antenna')) pose.rot('antenna', amount.x || 0, 0, amount.z || 0); };

  rig.clip('Idle', opts.idleDur ?? 3.4, (p, pose) => {
    idle(rig, pose, p, { tilt: 0.07, look: 0.16, blinkAt: [0.28, 0.72] });
    ant(pose, { z: 0.12 * wave(p, 1, -0.12), x: 0.06 * wave(p, 2, -0.1) });
    extra('Idle', p, pose);
  });

  rig.clip('Move', opts.moveDur ?? 0.7, (p, pose) => {
    (MOVES[opts.move ?? 'waddle'])(rig, pose, p, opts.moveOpts);
    ant(pose, { z: -0.25 * wave(p, 1, -0.15), x: 0.15 * wave(p, 2, -0.15) });
    extra('Move', p, pose);
  });

  rig.clip('Work', opts.workDur ?? 2.4, (p, pose) => {
    if (opts.work) opts.work(p, pose);
    else typing(rig, pose, p);
    ant(pose, { x: 0.08 * wave(p, 4, -0.1) });
    extra('Work', p, pose);
  });

  rig.clip('Emote', opts.emoteDur ?? 1.3, (p, pose) => {
    (EMOTES[opts.emote ?? 'spin'])(rig, pose, p, opts.emoteOpts);
    ant(pose, { x: 0.5 * Math.sin(Math.PI * seg(p, 0.1, 0.95)) * wave(p, 3) });
    extra('Emote', p, pose);
  });

  rig.clip('Talk', opts.talkDur ?? 1.6, (p, pose) => {
    talk(rig, pose, p, { syllables: 7 });
    if (rig.has('mouth')) pose.scl('mouth', 1, 1 + 0.9 * Math.abs(wave(p, 3.5)), 1);
    ant(pose, { z: 0.1 * wave(p, 2) });
    extra('Talk', p, pose);
  });

  rig.clip('Sleep', opts.sleepDur ?? 4.0, (p, pose) => {
    sleep(rig, pose, p, { slump: 0.1, droop: 0.24 });
    ant(pose, { x: 0.5, z: 0.15 });
    if (rig.has('mouth')) pose.scl('mouth', 0.8, 0.6, 1);
    extra('Sleep', p, pose);
  });
}

/** Cosy laptop typing: alternating taps, small nods, a glance up. */
export function typing(rig, pose, p) {
  pose.rot('arm_l', -0.75 - 0.12 * Math.max(0, wave(p, 8)), 0, 0.15);
  pose.rot('arm_r', -0.75 - 0.12 * Math.max(0, wave(p, 8, 0.5)), 0, -0.15);
  pose.rot('head', 0.16 + 0.03 * wave(p, 4) - 0.18 * cbump(p, 0.7, 0.1), 0.06 * wave(p, 1), 0);
  pose.rot('body', 0.05, 0, 0);
  blink(pose, p, ['eye_l', 'eye_r'], [0.35]);
}

export { wave, cbump, seg, ease, blink };
