#!/usr/bin/env node
// Renders listening previews of every PLaTOP voice to public/assets/audio/.
//   node assets-src/voice/render.mjs          (m4a via macOS afconvert when available, else wav)
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { voice } from './load.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', '..', 'public', 'assets', 'audio');
const SR = 22050;
const { renderPhrase, renderSfx, planConversation, VOICE_PRESETS, voiceFor } = voice;

function wav(samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    if (!Number.isFinite(v)) throw new Error('non-finite sample');
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2);
  }
  return b;
}

let aac = true;
try { execFileSync('which', ['afconvert'], { stdio: 'ignore' }); } catch { aac = false; }
async function save(name, samples) {
  const w = path.join(out, `${name}.wav`);
  await writeFile(w, wav(samples));
  if (aac) {
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', w, path.join(out, `${name}.m4a`)]);
    await rm(w);
  }
  return samples.length / SR;
}

const concat = (parts) => {
  const n = parts.reduce((m, p) => Math.max(m, Math.ceil(p.at * SR) + p.data.length), 0);
  const o = new Float32Array(n);
  for (const p of parts) o.set(p.data.map((x, i) => x + (o[Math.ceil(p.at * SR) + i] || 0)), Math.ceil(p.at * SR));
  return o;
};

const characters = (await import('../build-characters.mjs')).loadCharacters;
const chars = await characters();
await mkdir(out, { recursive: true });
const report = [];
report.push(['jingle', await save('platop-jingle', renderSfx('jingle', undefined, SR))]);
for (const c of chars) {
  const v = voiceFor(c.voice.preset, c.id);
  const hello = concat([
    { at: 0, data: renderPhrase(v, { seed: 1, mood: 'happy', sampleRate: SR }) },
    { at: 0.9, data: renderPhrase(v, { seed: 2, mood: 'question', sampleRate: SR }) },
  ]);
  report.push([c.id, await save(`voice-${c.id}`, hello)]);
}
// a pass-by conversation between two teams
const a = voiceFor('robot-bright', 'bridge-scout'); const b = voiceFor('owl-warm', 'email-owl');
const convo = planConversation(42, 3).map((l) => ({ at: l.at, data: renderPhrase(l.speaker ? b : a, { seed: l.seed % 8, mood: l.mood, sampleRate: SR }) }));
report.push(['conversation', await save('conversation-scout-courier', concat(convo))]);
for (const fx of ['wake', 'celebrate', 'greet', 'snore']) report.push([fx, await save(`sfx-${fx}`, renderSfx(fx, VOICE_PRESETS['lantern-soft'], SR))]);
for (const [n, s] of report) console.log(`${n.padEnd(22)} ${s.toFixed(2)} s`);
