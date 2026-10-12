// Shared clip set for plush owls.
import { idle, sleep, waddle, hopMove, talk } from './rig.mjs';
import { wave, cbump, seg, ease, blink, hop as hopShape, squash, TAU } from './anim.mjs';

export function owlClips(rig, opts = {}) {
  const extra = opts.extra || (() => {});
  const tufts = (pose, a) => { pose.rot('tuft_l', 0, 0, a); pose.rot('tuft_r', 0, 0, -a); };

  rig.clip('Idle', 3.6, (p, pose) => {
    idle(rig, pose, p, { tilt: 0.04, look: 0, blinkAt: [0.22, 0.7] });
    // owls swivel and tilt: a slow look one way, a curious head-tilt, back
    pose.rot('head', 0, 0.45 * (cbump(p, 0.3, 0.15) - cbump(p, 0.72, 0.13)), 0.22 * cbump(p, 0.5, 0.07));
    tufts(pose, 0.12 * cbump(p, 0.51, 0.05));
    pose.rot('wing_l', 0, 0, 0.04 * wave(p, 2));
    pose.rot('wing_r', 0, 0, -0.04 * wave(p, 2));
    extra('Idle', p, pose);
  });

  rig.clip('Move', opts.moveDur ?? 0.8, (p, pose) => {
    if (opts.move === 'hop') hopMove(rig, pose, p, { height: 0.12, lean: 0.1 });
    else waddle(rig, pose, p, { roll: 0.15, bounce: 0.035, lean: 0.05, lift: 0.04 });
    const flap = opts.move === 'hop' ? 0.5 * Math.max(0, wave(p, 1, 0.1)) : 0.12;
    pose.rot('wing_l', 0, 0, 0.15 + flap + 0.1 * wave(p, 1));
    pose.rot('wing_r', 0, 0, -0.15 - flap + 0.1 * wave(p, 1));
    tufts(pose, 0.08 * wave(p, 2, -0.1));
    extra('Move', p, pose);
  });

  rig.clip('Work', opts.workDur ?? 2.6, (p, pose) => {
    opts.work?.(p, pose);
    extra('Work', p, pose);
  });

  rig.clip('Emote', 1.4, (p, pose) => {
    // a proud flutter: wings out, a hop and a full turn
    const { y, k } = hopShape(p, { start: 0.15, land: 0.78 });
    pose.pos('hop', 0, 0.3 * y, 0);
    pose.scl('hop', ...squash(k));
    const air = seg(p, 0.15, 0.78);
    pose.rot('spin', 0, TAU * ease.inOut(air), 0);
    const flap = Math.sin(Math.PI * air);
    pose.rot('wing_l', 0, 0, (1.1 + 0.45 * wave(p, 4)) * flap);
    pose.rot('wing_r', 0, 0, -(1.1 + 0.45 * wave(p, 4)) * flap);
    tufts(pose, 0.3 * flap);
    extra('Emote', p, pose);
  });

  rig.clip('Talk', 1.6, (p, pose) => {
    talk(rig, pose, p, { syllables: 6, gesture: false, tilt: 0.16 });
    pose.scl('beak', 1, 1 + 0.4 * Math.abs(wave(p, 3)), 1);
    pose.rot('wing_r', 0, 0, -0.4 * cbump(p, 0.35, 0.18));
    tufts(pose, 0.1 * Math.abs(wave(p, 3)));
    extra('Talk', p, pose);
  });

  rig.clip('Sleep', 4.2, (p, pose) => {
    sleep(rig, pose, p, { slump: 0.04, droop: 0.24, sink: 0.03 });
    tufts(pose, 0.3);
    pose.scl('body', 1.04, 0.98, 1.04); // fluffed up
    extra('Sleep', p, pose);
  });
}

export { wave, cbump, seg, ease, blink, TAU };
