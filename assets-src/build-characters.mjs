#!/usr/bin/env node
// Builds every PLaTOP character to public/assets/characters/<id>.glb and
// writes manifest.json in the schema src/scene/assets.ts reads.
//
//   node assets-src/build-characters.mjs            # all characters
//   node assets-src/build-characters.mjs support-beacon email-owl
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { toGLB } from './lib/export.mjs';
import { mergeStatic, triangleCount, drawCalls } from './lib/kit.mjs';
import { Rig } from './lib/anim.mjs';
import * as THREE from 'three';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'public', 'assets', 'characters');
const TEAMS = ['support', 'email', 'intake', 'hr', 'merchant', 'reflection'];
export const CLIPS = ['Idle', 'Move', 'Work', 'Sleep', 'Emote', 'Talk'];

export async function loadCharacters() {
  const all = [];
  for (const team of TEAMS) {
    try {
      const mod = await import(`./characters/${team}.mjs`);
      all.push(...mod.default);
    } catch (e) {
      if (e.code !== 'ERR_MODULE_NOT_FOUND' || !String(e.message).includes(`characters/${team}.mjs`)) throw e;
      console.warn(`(skipping ${team}: no module yet)`);
    }
  }
  return all;
}

async function main() {
  const only = process.argv.slice(2);
  await mkdir(outDir, { recursive: true });
  const characters = await loadCharacters();
  const manifest = { schemaVersion: 1, generator: 'assets-src/build-characters.mjs', characters: {} };
  let total = 0;
  for (const c of characters) {
    const root = c.build();
    mergeStatic(root);
    const rig = new Rig(root);
    // measured standing height in the rest pose (hidden-at-rest nodes are ~0 scale)
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (let a = o; a; a = a.parent) if (a.userData.hidden || a.name === 'fx_zzz') return;
      box.expandByObject(o);
    });
    const height = +box.max.y.toFixed(3);
    c.animate(rig);
    const names = rig.clips.map((k) => k.name);
    for (const need of CLIPS) if (!names.includes(need)) throw new Error(`${c.id} is missing clip ${need}`);
    const file = `${c.id}.glb`;
    if (!only.length || only.includes(c.id)) {
      const glb = await toGLB(root, rig.clips);
      await writeFile(path.join(outDir, file), glb);
      total += glb.length;
      const keys = rig.clips.reduce((n, k) => n + k.tracks.reduce((m, t) => m + t.times.length, 0), 0);
      console.log(`${c.id.padEnd(20)} ${String(triangleCount(root)).padStart(6)} tris  ${String(drawCalls(root)).padStart(3)} draws  ${String(keys).padStart(5)} keys  ${(glb.length / 1024).toFixed(0).padStart(5)} KB`);
    }
    manifest.characters[c.id] = {
      path: `/assets/characters/${file}`,
      clips: { Idle: 'Idle', Move: 'Move', Work: 'Work', Sleep: 'Sleep' },
      extras: {
        name: c.name,
        team: c.team,
        height,
        footprint: c.footprint,
        locomotion: c.locomotion,
        airborne: !!c.airborne,
        moveSpeed: c.moveSpeed ?? 0.9,
        clips: { Emote: 'Emote', Talk: 'Talk' },
        clipDurations: Object.fromEntries(rig.clips.map((k) => [k.name, +k.duration.toFixed(3)])),
        oneShot: ['Emote'],
        sockets: { zzz: +(rig.nodes.fx_zzz.userData.socketY ?? rig.nodes.fx_zzz.position.y).toFixed(3), bubble: +(height + 0.12).toFixed(3) },
        voice: { preset: c.voice.preset },
      },
    };
  }
  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  if (total) console.log(`total ${(total / 1024).toFixed(0)} KB → ${path.relative(process.cwd(), outDir)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
