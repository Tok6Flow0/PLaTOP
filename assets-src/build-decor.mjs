#!/usr/bin/env node
// Workspace decor for the "Make it their own" upgrades (plant · lamp · art).
// Each team's art and lamp come from what the team put in its own portrait:
// Bridge's golden arch, Clear Path's hills and sun, the Wayfinders' terracotta sun,
// Beacon's chat-bubble glow, the Lantern Desk's crescent moon, Dispatch's teal halo and spark.
//
//   node assets-src/build-decor.mjs
import * as THREE from 'three';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { toGLB } from './lib/export.mjs';
import { G, mat, glow, part, mergeStatic, triangleCount, drawCalls, smoothProfile, limb } from './lib/kit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'public', 'assets', 'decor');
const C = (c, rough = 0.8) => mat(c, { rough });
const WOOD = '#b98d62'; const WOOD_DARK = '#8f6a48'; const GOLD = '#cfa04e';
const gold = () => mat(GOLD, { rough: 0.45, metal: 0.3 });

// ------------------------------------------------------------------ helpers

function frame(g, w, h, canvas = '#f6efe1', wood = WOOD) {
  part(g, G.rbox(w + 0.08, h + 0.08, 0.05, 0.02, 2), C(wood), [0, 0, 0.025]);
  part(g, G.box(), C(canvas, 0.95), [0, 0, 0.052], [w, h, 0.01]);
}
function disc(g, r, color, z, rough = 0.85, segs = 32) {
  return part(g, G.cyl(segs), typeof color === 'string' ? C(color, rough) : color, [0, 0, z], [r * 2, 0.02, r * 2], [Math.PI / 2, 0, 0]);
}
function spark(g, pos, size, m = gold()) {
  part(g, G.octa(), m, pos, [size * 0.35, size, size * 0.2]);
  part(g, G.octa(), m, pos, [size, size * 0.35, size * 0.2]);
}
function pot(g, color, r = 0.16, h = 0.24) {
  const prof = smoothProfile([[0.001, 0], [r * 0.78, 0.0], [r * 0.85, h * 0.2], [r, h * 0.92], [r * 1.06, h]], 10);
  part(g, G.lathe(`pot${r}:${h}`, [...prof, [r * 0.95, h], [0.001, h * 0.9]], 20), C(color, 0.7), [0, 0, 0]);
  part(g, G.cyl(20), C('#5a4636', 0.95), [0, h * 0.93, 0], [r * 1.8, 0.02, r * 1.8]);
}
function leaf(g, base, len, yaw, pitch, color, width = 0.07) {
  const m = new THREE.Mesh(G.sphere(10, 8), C(color, 0.75));
  m.scale.set(width, len * 0.5, width * 0.35);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  m.quaternion.copy(q);
  const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  m.position.set(...base).addScaledVector(dir, len * 0.5);
  g.add(m);
}

// ------------------------------------------------------------------ plants (concept: lots of them)

const plants = {
  'plant-leafy': (g) => {
    pot(g, '#c47c56');
    const greens = ['#5f8a5a', '#6f9a63', '#557d52'];
    for (let i = 0; i < 11; i++) leaf(g, [0, 0.22, 0], 0.28 + (i % 3) * 0.05, (i / 11) * Math.PI * 2, 0.55 + (i % 2) * 0.3, greens[i % 3], 0.1);
  },
  'plant-snake': (g) => {
    pot(g, '#e8e0d0', 0.14, 0.26);
    const greens = ['#4f7a52', '#6a945c', '#3f6b48'];
    for (let i = 0; i < 9; i++) leaf(g, [Math.cos(i * 2.4) * 0.05, 0.24, Math.sin(i * 2.4) * 0.05], 0.45 + (i % 4) * 0.08, i * 2.4, 0.12 + (i % 3) * 0.08, greens[i % 3], 0.06);
  },
  'plant-palm': (g) => {
    pot(g, '#9fb194', 0.17, 0.26);
    limb(g, [0, 0.24, 0], [0.02, 0.62, 0.01], 0.018, C('#6d5a3f'));
    const greens = ['#5f8a5a', '#77a067'];
    for (let i = 0; i < 8; i++) leaf(g, [0.02, 0.62, 0.01], 0.34, (i / 8) * Math.PI * 2, 1.05 + (i % 2) * 0.2, greens[i % 2], 0.09);
  },
};

// ------------------------------------------------------------------ lamps

function floorLamp(g, shade) {
  part(g, G.cyl(20), C('#5a5048', 0.5), [0, 0.02, 0], [0.32, 0.04, 0.32]);
  part(g, G.cyl(8), C('#5a5048', 0.5), [0, 0.7, 0], [0.025, 1.36, 0.025]);
  part(g, G.cyl(24, 0.36, 0.5, true), C(shade, 0.9), [0, 1.42, 0], [0.42, 0.3, 0.42]);
  part(g, G.cyl(24, 0.36, 0.5), glow('#ffe6b0'), [0, 1.33, 0], [0.38, 0.06, 0.38]);
}
const lamps = {
  'lamp-floor-cream': (g) => floorLamp(g, '#f3e7cf'),
  'lamp-floor-sage': (g) => floorLamp(g, '#cfdcc7'),
  'lamp-floor-teal': (g) => floorLamp(g, '#cfe0dc'),
  // Beacon: a green camp lantern on a little stand (the roster avatar)
  'lamp-lantern-green': (g) => {
    part(g, G.cyl(20), C(WOOD), [0, 0.3, 0], [0.34, 0.04, 0.34]);
    [0, 1, 2].forEach((i) => { const a = (i / 3) * Math.PI * 2; limb(g, [Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12], [Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16], 0.015, C(WOOD_DARK)); });
    const green = C('#2f5d46', 0.6);
    part(g, G.cyl(20), green, [0, 0.35, 0], [0.2, 0.05, 0.2]);
    part(g, G.cyl(20), glow('#ffd77e'), [0, 0.47, 0], [0.15, 0.2, 0.15]);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.78; part(g, G.cyl(6), green, [Math.cos(a) * 0.085, 0.47, Math.sin(a) * 0.085], [0.015, 0.22, 0.015]); }
    part(g, G.cone(20), green, [0, 0.62, 0], [0.22, 0.1, 0.22]);
    part(g, G.torus(0.05, 0.01, 6, 16, Math.PI), green, [0, 0.68, 0]);
  },
  // Wayfinders: a little lighthouse
  'lamp-lighthouse': (g) => {
    const stripes = ['#efe7d8', '#26344f', '#efe7d8', '#26344f'];
    stripes.forEach((c, i) => part(g, G.cyl(20, 0.5 - i * 0.03, 0.5 - (i - 1) * 0.03), C(c, 0.7), [0, 0.12 + i * 0.22, 0], [0.34 - i * 0.03, 0.22, 0.34 - i * 0.03]));
    part(g, G.cyl(20), C('#26344f', 0.6), [0, 0.98, 0], [0.26, 0.04, 0.26]);
    part(g, G.cyl(16), glow('#ffd27a'), [0, 1.07, 0], [0.16, 0.14, 0.16]);
    part(g, G.cone(16), C('#c4573a', 0.6), [0, 1.2, 0], [0.24, 0.12, 0.24]);
  },
  // Lantern Desk: a brass hurricane lantern on a round stool
  'lamp-hurricane': (g) => {
    part(g, G.cyl(20), C(WOOD), [0, 0.42, 0], [0.4, 0.05, 0.4]);
    part(g, G.cyl(16), C(WOOD_DARK), [0, 0.2, 0], [0.08, 0.4, 0.08]);
    part(g, G.cyl(20), C(WOOD_DARK), [0, 0.02, 0], [0.3, 0.04, 0.3]);
    const brass = mat('#6f5a3a', { rough: 0.5, metal: 0.45 });
    part(g, G.cyl(20), brass, [0, 0.48, 0], [0.22, 0.05, 0.22]);
    const prof = smoothProfile([[0.001, 0.5], [0.08, 0.51], [0.1, 0.6], [0.08, 0.68], [0.001, 0.7]], 10);
    part(g, G.lathe('hurr', prof, 18), glow('#ffc260'), [0, 0, 0]);
    part(g, G.cone(18), brass, [0, 0.74, 0], [0.22, 0.08, 0.22]);
    part(g, G.torus(0.05, 0.009, 6, 16, Math.PI), brass, [0, 0.79, 0]);
  },
};

// ------------------------------------------------------------------ art (each team's own symbol)

const art = {
  // Savor Bridge: the golden arch from their portrait, at sunrise
  'art-merchant-bridge': (g) => {
    frame(g, 1.0, 0.62, '#f7ecdc');
    part(g, G.sphere(20, 12), C('#e8945e', 0.9), [0.22, 0.04, 0.06], [0.26, 0.26, 0.02]);
    part(g, G.torus(0.3, 0.022, 6, 28, Math.PI), gold(), [0, -0.2, 0.07]);
    part(g, G.box(), gold(), [0, -0.12, 0.07], [0.82, 0.03, 0.02]);
    for (let i = -3; i <= 3; i++) part(g, G.box(), gold(), [i * 0.08, -0.12 + Math.sqrt(Math.max(0, 0.09 - (i * 0.08) ** 2)) * 0.45, 0.068], [0.012, Math.sqrt(Math.max(0, 0.09 - (i * 0.08) ** 2)) * 0.9, 0.012]);
    part(g, G.box(), C('#3f8c86', 0.9), [0, -0.27, 0.06], [1.0, 0.06, 0.012]);
  },
  // Clear Path: sage hills, a winding path and a quiet golden sun
  'art-hr-clearpath': (g) => {
    disc(g, 0.42, '#efe8d8', 0.02); disc(g, 0.44, C(WOOD), 0.01);
    part(g, G.sphere(20, 12), C('#e0b85c', 0.8), [0.12, 0.12, 0.035], [0.22, 0.22, 0.01]);
    part(g, G.sphere(22, 12), C('#93ad92', 0.9), [-0.12, -0.2, 0.04], [0.62, 0.36, 0.02]);
    part(g, G.sphere(22, 12), C('#6f8f74', 0.9), [0.16, -0.26, 0.045], [0.62, 0.3, 0.02]);
    part(g, G.torus(0.14, 0.012, 5, 20, Math.PI), C('#f4ead6', 0.9), [0.0, -0.3, 0.06], 1, [0, 0, 0.3]);
    for (const [x, y, r] of [[-0.3, 0.05, 0.4], [-0.24, 0.14, -0.3]]) part(g, G.sphere(10, 8), C('#7e9e7b', 0.8), [x, y, 0.04], [0.06, 0.16, 0.012], [0, 0, r]);
  },
  // Wayfinders: the terracotta sun-disc behind their team portrait, with a compass star
  'art-intake-sundisc': (g) => {
    frame(g, 0.86, 0.86, '#26344f', '#efe7d8');
    disc(g, 0.3, '#c9785c', 0.065, 0.9);
    spark(g, [0, 0, 0.085], 0.12);
    part(g, G.torus(0.36, 0.006, 4, 40), gold(), [0, 0, 0.07]);
  },
  // Beacon: a soft green chat-bubble sign with a warm "…"
  'art-support-bubble': (g) => {
    part(g, G.rbox(0.9, 0.56, 0.06, 0.2, 3), C('#2f5d46', 0.8), [0, 0, 0.03]);
    part(g, G.cone(4), C('#2f5d46', 0.8), [0.3, -0.33, 0.03], [0.16, 0.18, 0.06], [0, 0, 0.6]);
    part(g, G.rbox(0.8, 0.46, 0.02, 0.17, 3), glow('#f7d47a'), [0, 0, 0.065]);
    for (let i = -1; i <= 1; i++) part(g, G.sphere(12, 8), C('#2f5d46', 0.7), [i * 0.15, 0, 0.08], [0.09, 0.09, 0.03]);
  },
  // The Lantern Desk: crescent moon and two small stars on midnight blue
  'art-reflection-moon': (g) => {
    frame(g, 0.7, 0.86, '#1f2a44', WOOD_DARK);
    part(g, G.sphere(22, 14), C('#e9c46a', 0.6), [0.04, 0.1, 0.06], [0.34, 0.34, 0.02]);
    part(g, G.sphere(22, 14), C('#1f2a44', 0.95), [0.13, 0.16, 0.068], [0.3, 0.3, 0.02]);
    spark(g, [-0.2, 0.28, 0.07], 0.06); spark(g, [-0.12, -0.22, 0.07], 0.045); spark(g, [0.2, -0.12, 0.07], 0.035);
  },
  // Savor Dispatch: the teal halo with its single gold spark, and a little envelope
  'art-email-halo': (g) => {
    disc(g, 0.42, '#7fa9a6', 0.02, 0.9);
    disc(g, 0.44, C('#efe7d8'), 0.01);
    spark(g, [0.2, 0.2, 0.05], 0.09);
    part(g, G.rbox(0.3, 0.2, 0.03, 0.02, 2), C('#f3e9d4', 0.8), [-0.04, -0.06, 0.05]);
    part(g, G.box(), C('#c9b38c'), [-0.1, -0.03, 0.068], [0.18, 0.015, 0.01], [0, 0, -0.55]);
    part(g, G.box(), C('#c9b38c'), [0.02, -0.03, 0.068], [0.18, 0.015, 0.01], [0, 0, 0.55]);
    part(g, G.cyl(12), C('#c4573a', 0.5), [-0.04, -0.09, 0.07], [0.04, 0.01, 0.04], [Math.PI / 2, 0, 0]);
  },
};

// ------------------------------------------------------------------ team kits

const TEAMS = {
  merchant: { plant: 'plant-leafy', lamp: 'lamp-floor-cream', art: 'art-merchant-bridge' },
  hr: { plant: 'plant-palm', lamp: 'lamp-floor-sage', art: 'art-hr-clearpath' },
  intake: { plant: 'plant-snake', lamp: 'lamp-lighthouse', art: 'art-intake-sundisc' },
  support: { plant: 'plant-leafy', lamp: 'lamp-lantern-green', art: 'art-support-bubble' },
  reflection: { plant: 'plant-snake', lamp: 'lamp-hurricane', art: 'art-reflection-moon' },
  email: { plant: 'plant-palm', lamp: 'lamp-floor-teal', art: 'art-email-halo' },
};

const SLOTS = { plant: 'floor', lamp: 'floor', art: 'wall' };

async function main() {
  await mkdir(outDir, { recursive: true });
  const items = {};
  const all = { ...plants, ...lamps, ...art };
  for (const [id, make] of Object.entries(all)) {
    const root = new THREE.Group(); root.name = id;
    const inner = new THREE.Group();
    if (id.startsWith('plant-')) inner.scale.setScalar(1.7); // concept plants stand about knee-to-shoulder on a character
    root.add(inner);
    make(inner);
    mergeStatic(root);
    const glb = await toGLB(root);
    await writeFile(path.join(outDir, `${id}.glb`), glb);
    const box = new THREE.Box3().setFromObject(root);
    const kind = id.split('-')[0];
    items[id] = {
      path: `/assets/decor/${id}.glb`, kind, slot: SLOTS[kind],
      size: box.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(3)),
    };
    console.log(`${id.padEnd(22)} ${String(triangleCount(root)).padStart(5)} tris ${String(drawCalls(root)).padStart(3)} draws ${(glb.length / 1024).toFixed(0).padStart(4)} KB`);
  }
  const manifest = {
    schemaVersion: 1,
    generator: 'assets-src/build-decor.mjs',
    note: 'Origins: floor items stand on y=0; wall art hangs with its back at z=0 facing +Z, centred on its own origin.',
    items,
    teams: TEAMS,
  };
  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

await main();
