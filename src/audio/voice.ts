/**
 * PLaTOP voices — a tiny formant synthesiser that speaks "PLaTOP-ese".
 *
 * Every sound is synthesised from numbers measured in the founder's original
 * "PLaTOP" recording (pitch, glides, syllable rhythm, mouth resonances, breathiness,
 * spectral tilt and envelope shape). The recording itself never ships; only the
 * measurements below (VOICE_DNA) do. See docs/SOUND.md.
 *
 * Pure functions, no dependencies, no allocation beyond the output buffer. A phrase
 * of ~1 s renders in well under a millisecond, so buffers are made on demand and cached.
 */

// ------------------------------------------------------------------ voice DNA

/** Measurements taken from the original sample (22.7 s, mono, 48 kHz). */
export const VOICE_DNA = {
  /** Median syllable length, onset-to-onset interval, in-phrase gap and between-phrase gap (s). */
  rhythm: { syllable: 0.245, ioi: 0.35, gap: 0.095, phraseGap: 0.85 },
  /** How many syllables each of the sample's twelve phrases had. */
  phraseSizes: [1, 1, 2, 2, 2, 3, 3, 4, 3, 2, 1, 8],
  /** Voiced pitch (Hz). Glides are [start, end] pairs from voiced syllables; most rise. */
  pitch: { median: 149, p10: 102, p90: 295, glides: [[110, 196], [90, 130], [149, 176], [218, 206], [215, 210], [100, 115], [91, 103]] as const },
  /** Vowel formants (F1, F2 Hz): the "a" of plat, the "o" of top, and a relaxed schwa. */
  vowels: { a: [830, 2150], o: [520, 1050], u: [480, 850] } as Record<string, readonly [number, number]>,
  /** Share of frames with clear voicing — the sample is breathy and percussive. */
  voicedRatio: 0.3,
  /** Plosive onsets: attack (ms) and how much noisier the onset is than the vowel body. */
  onset: { attackMs: 50, burstRatio: 1.7, presenceHz: 3000 },
  /** Long-term spectrum: warm peak 400–800 Hz, presence bump near 3 kHz, roll-off past 5 kHz. */
  spectrum: { peakHz: 600, presenceHz: 3000, rolloffHz: 5000 },
  /** Median per-syllable loudness shape (40 points): a "pla" hump then a "top" hump. */
  envelope: [0.02, 0.02, 0.02, 0.05, 0.06, 0.09, 0.15, 0.27, 0.4, 0.3, 0.34, 0.43, 0.45, 0.38, 0.32, 0.28, 0.28, 0.21, 0.24, 0.16,
    0.18, 0.17, 0.34, 0.5, 0.5, 0.44, 0.37, 0.39, 0.35, 0.33, 0.35, 0.29, 0.29, 0.24, 0.2, 0.15, 0.14, 0.11, 0.1, 0.1],
} as const;

// ------------------------------------------------------------------ presets

export interface VoicePreset {
  /** Base pitch (Hz). */
  f0: number;
  /** Pitch range in semitones across a phrase. */
  range: number;
  /** Formant scale: >1 = smaller creature. */
  formant: number;
  /** Breath noise mix 0..1. */
  breath: number;
  /** Speaking-rate multiplier relative to the sample's natural rhythm. */
  speed: number;
  /** 0..1 robotic colour: buzzier source, stepped pitch, faint metallic comb. */
  robot: number;
  /** 0..1 closed-mouth hum (lanterns). */
  hum: number;
  /** Vowel preference, e.g. "aao" (picked per syllable). */
  vowels: string;
}

export const VOICE_PRESETS: Record<string, VoicePreset> = {
  'lantern-soft': { f0: 330, range: 5, formant: 1.25, breath: 0.35, speed: 1.5, robot: 0, hum: 0.25, vowels: 'aaou' },
  'lantern-hum': { f0: 205, range: 4, formant: 1.0, breath: 0.42, speed: 1.1, robot: 0, hum: 0.6, vowels: 'oou' },
  'owl-warm': { f0: 235, range: 5, formant: 1.05, breath: 0.4, speed: 1.3, robot: 0, hum: 0.15, vowels: 'oou' },
  'owl-soft': { f0: 400, range: 6, formant: 1.3, breath: 0.35, speed: 1.4, robot: 0, hum: 0.1, vowels: 'ooa' },
  'owl-bright': { f0: 470, range: 7, formant: 1.35, breath: 0.28, speed: 1.6, robot: 0, hum: 0.05, vowels: 'oaa' },
  'swift-chirp': { f0: 760, range: 9, formant: 1.6, breath: 0.15, speed: 2.2, robot: 0, hum: 0, vowels: 'aa' },
  'robot-warm': { f0: 260, range: 5, formant: 1.1, breath: 0.2, speed: 1.5, robot: 0.45, hum: 0, vowels: 'aao' },
  'robot-bright': { f0: 430, range: 7, formant: 1.3, breath: 0.18, speed: 1.8, robot: 0.5, hum: 0, vowels: 'aao' },
  'robot-soft': { f0: 300, range: 4, formant: 1.15, breath: 0.3, speed: 1.3, robot: 0.3, hum: 0.1, vowels: 'oao' },
  'robot-calm': { f0: 285, range: 4, formant: 1.15, breath: 0.25, speed: 1.4, robot: 0.4, hum: 0, vowels: 'aoo' },
  'robot-careful': { f0: 340, range: 5, formant: 1.2, breath: 0.25, speed: 1.25, robot: 0.4, hum: 0, vowels: 'aou' },
  'robot-bouncy': { f0: 385, range: 8, formant: 1.25, breath: 0.2, speed: 1.9, robot: 0.45, hum: 0, vowels: 'aa' },
  'robot-lead': { f0: 225, range: 4, formant: 1.0, breath: 0.22, speed: 1.35, robot: 0.5, hum: 0, vowels: 'aoo' },
  'robot-curious': { f0: 360, range: 7, formant: 1.25, breath: 0.22, speed: 1.6, robot: 0.45, hum: 0, vowels: 'aao' },
};

export type Mood = 'chat' | 'question' | 'happy' | 'calm' | 'sleepy';

/**
 * A character's own voice: its preset nudged by a stable hash of its id, so two
 * characters sharing a preset still sound like individuals (±8% pitch, ±4% size, ±8% pace).
 */
export function voiceFor(preset: string | VoicePreset, id: string): VoicePreset {
  const base = typeof preset === 'string' ? VOICE_PRESETS[preset] ?? VOICE_PRESETS['lantern-soft'] : preset;
  const r = rng(hashSeed(id));
  return {
    ...base,
    f0: Math.round(base.f0 * (0.92 + r() * 0.16)),
    formant: Math.round(base.formant * (0.96 + r() * 0.08) * 1000) / 1000,
    speed: Math.round(base.speed * (0.92 + r() * 0.16) * 1000) / 1000,
  };
}

// ------------------------------------------------------------------ helpers

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable seed from a string (character id + something). */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Biquad band-pass (constant 0 dB peak), direct form I. */
class BandPass {
  private b0 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(private sr: number) {}
  set(freq: number, q: number): void {
    const w = (2 * Math.PI * Math.min(freq, this.sr * 0.45)) / this.sr;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    this.b0 = alpha / a0; this.b2 = -alpha / a0;
    this.a1 = (-2 * Math.cos(w)) / a0; this.a2 = (1 - alpha) / a0;
  }
  run(x: number): number {
    const y = this.b0 * x + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** One-pole low-pass. */
class LowPass {
  private y = 0; private k = 0;
  constructor(sr: number, freq: number) { this.k = 1 - Math.exp((-2 * Math.PI * freq) / sr); }
  run(x: number): number { this.y += this.k * (x - this.y); return this.y; }
}

const envAt = (u: number): number => {
  const e = VOICE_DNA.envelope;
  const x = Math.min(0.9999, Math.max(0, u)) * (e.length - 1);
  const i = Math.floor(x);
  return e[i] + (e[i + 1] - e[i]) * (x - i);
};
const semis = (n: number): number => Math.pow(2, n / 12);

// ------------------------------------------------------------------ syllables

type Onset = '' | 'p' | 'pl' | 't' | 'l';
type Coda = '' | 'p' | 't';
interface Syllable { onset: Onset; vowel: string; coda: Coda; dur: number; f0: number; glide: number; level: number }

/** The sample's sound inventory: P, L, A, T, O, P. */
const ONSETS: Onset[] = ['p', 'pl', 't', 'l', 'p', 't', ''];
const CODAS: Coda[] = ['', '', '', 'p', 't'];

function synthSyllable(out: Float32Array, start: number, sr: number, v: VoicePreset, s: Syllable, rand: () => number): void {
  const n = Math.floor(s.dur * sr);
  const f1 = new BandPass(sr); const f2 = new BandPass(sr); const f3 = new BandPass(sr);
  const burst = new BandPass(sr);
  const [va1, va2] = VOICE_DNA.vowels[s.vowel] ?? VOICE_DNA.vowels.a;
  const fs = v.formant;
  const onsetLen = s.onset === '' ? 0 : s.onset === 'l' ? 0.03 : s.onset === 'pl' ? 0.05 : 0.016;
  const codaAt = s.coda === '' ? 1 : 0.72;
  let phase = rand();
  let prevPulse = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const u = i / n;
    // pitch: base glide (the sample mostly rises), tiny vibrato, robots step in semitones
    let f = s.f0 * semis(s.glide * u) * (1 + 0.012 * Math.sin(2 * Math.PI * 5.5 * t));
    if (v.robot > 0) {
      const stepped = s.f0 * semis(Math.round(s.glide * u * 2) / 2);
      f = f * (1 - v.robot) + stepped * v.robot;
    }
    phase += f / sr;
    if (phase >= 1) phase -= 1;
    // glottal-ish source: soft saw blended with a buzzier pulse for robots
    const saw = 2 * phase - 1;
    const pulse = phase < 0.35 ? 1 : -0.54;
    let src = saw * (1 - 0.6 * v.robot) + pulse * 0.6 * v.robot;
    src = src * 0.7 + prevPulse * 0.3; // soften the edge
    prevPulse = src;
    const noise = rand() * 2 - 1;
    // formants glide from the "l" (F1 low, F2 mid) into the vowel
    const inL = (s.onset === 'l' || s.onset === 'pl') ? Math.max(0, 1 - t / (onsetLen + 0.04)) : 0;
    const F1 = (va1 * (1 - inL) + 360 * inL) * fs;
    const F2 = (va2 * (1 - inL) + 1150 * inL) * fs;
    if ((i & 31) === 0) {
      f1.set(F1, 5); f2.set(F2, 7); f3.set(2800 * fs, 9);
      burst.set(s.onset.startsWith('t') ? VOICE_DNA.onset.presenceHz * fs : 1300 * fs, 1.6);
    }
    const excite = src * (1 - v.breath) + noise * v.breath * 0.8;
    let voice = f1.run(excite) * 1.0 + f2.run(excite) * (0.5 - 0.12 * v.robot) + f3.run(excite) * (0.2 - 0.08 * v.robot);
    // closed-mouth hum: a bit of the raw source, low-passed later by the master
    voice += src * 0.18 * v.hum;
    // loudness: the sample's double-hump envelope, with a plosive gap before the coda
    let amp = 0.25 + 1.6 * envAt(u);
    amp *= Math.min(1, t / 0.008) * Math.min(1, (n - i) / (0.012 * sr));
    if (u > codaAt && u < codaAt + 0.1) amp *= 0.05;
    // onset burst: short noisy pop, brighter for "t"
    let b = 0;
    if (s.onset !== '' && s.onset !== 'l' && t < 0.018) {
      b = burst.run(noise) * VOICE_DNA.onset.burstRatio * Math.exp(-t / 0.004);
      amp *= t < 0.012 ? 0.25 : 1; // the vowel opens just after the pop
    }
    // coda release pop
    if (s.coda !== '' && u >= codaAt + 0.1 && u < codaAt + 0.16) b += burst.run(noise) * 0.9 * Math.exp(-(u - codaAt - 0.1) * 60);
    out[start + i] += (voice * amp + b) * s.level;
  }
}

function pickVowel(v: VoicePreset, rand: () => number): string {
  const opts = v.vowels.replace(/[^aou]/g, '') || 'a';
  return opts[Math.floor(rand() * opts.length)];
}

/** Intonation per mood: semitone offset for syllable k of n, plus a final glide. */
function contour(mood: Mood, k: number, n: number, range: number, rand: () => number): { st: number; glide: number } {
  const last = k === n - 1;
  const jitter = (rand() - 0.5) * range * 0.6;
  switch (mood) {
    case 'question': return { st: jitter + (k / Math.max(1, n - 1)) * range * 0.4, glide: last ? range * 0.9 : 1.5 };
    case 'happy': return { st: jitter + range * 0.35 + (k % 2) * range * 0.25, glide: last ? range * 0.6 : 2 };
    case 'calm': return { st: jitter * 0.6 - (k / Math.max(1, n - 1)) * range * 0.3, glide: last ? -range * 0.4 : -0.5 };
    case 'sleepy': return { st: -range * 0.5 + jitter * 0.3, glide: -range * 0.5 };
    default: return { st: jitter, glide: last ? range * 0.3 : 1 + rand() * 1.5 }; // the sample's gentle rises
  }
}

// ------------------------------------------------------------------ master

function finish(out: Float32Array, sr: number, v: VoicePreset | null, peak = 0.7): Float32Array {
  // the sample's spectral tilt: warm, roll-off past ~5 kHz (lower for hummy voices)
  const lp = new LowPass(sr, VOICE_DNA.spectrum.rolloffHz * (v ? (1 - 0.45 * v.hum) * (1 - 0.3 * v.robot) * Math.min(1, 1.25 / v.formant) : 1));
  const robot = v?.robot ?? 0;
  const combLen = Math.floor(sr / 900);
  const comb = new Float32Array(combLen);
  let ci = 0;
  let max = 1e-6;
  for (let i = 0; i < out.length; i++) {
    let x = lp.run(out[i]);
    if (robot > 0) { const y = x + comb[ci] * 0.35 * robot; comb[ci] = y; ci = (ci + 1) % combLen; x = y; }
    x = Math.tanh(x * 1.4);
    out[i] = x;
    max = Math.max(max, Math.abs(x));
  }
  const g = peak / max;
  for (let i = 0; i < out.length; i++) out[i] *= g;
  return out;
}

// ------------------------------------------------------------------ public API

export interface PhraseOptions { seed: number; mood?: Mood; syllables?: number; sampleRate?: number }

/** A short babble phrase in the given voice. */
export function renderPhrase(v: VoicePreset, { seed, mood = 'chat', syllables, sampleRate = 22050 }: PhraseOptions): Float32Array {
  const rand = rng(seed);
  const sizes = VOICE_DNA.phraseSizes;
  const n = Math.max(1, Math.min(6, syllables ?? sizes[Math.floor(rand() * (sizes.length - 1))] + (mood === 'happy' ? 1 : 0)));
  const slow = mood === 'sleepy' ? 1.6 : mood === 'calm' ? 1.15 : 1;
  const syls: Syllable[] = [];
  let total = 0.06;
  for (let k = 0; k < n; k++) {
    const { st, glide } = contour(mood, k, n, v.range, rand);
    const dur = (VOICE_DNA.rhythm.syllable * (0.75 + rand() * 0.5) * slow) / v.speed * (k === n - 1 ? 1.3 : 1);
    const gap = (VOICE_DNA.rhythm.gap * (0.6 + rand() * 0.8) * slow) / v.speed;
    syls.push({
      onset: k === 0 && rand() < 0.6 ? 'pl' : ONSETS[Math.floor(rand() * ONSETS.length)],
      vowel: pickVowel(v, rand),
      coda: k === n - 1 && rand() < 0.5 ? 'p' : CODAS[Math.floor(rand() * CODAS.length)],
      dur, f0: v.f0 * semis(st), glide,
      level: (mood === 'sleepy' ? 0.5 : 1) * (0.8 + rand() * 0.25),
    });
    total += dur + gap;
  }
  const out = new Float32Array(Math.ceil((total + 0.08) * sampleRate));
  let at = 0.03;
  for (const s of syls) {
    synthSyllable(out, Math.floor(at * sampleRate), sampleRate, v, s, rand);
    at += s.dur + (VOICE_DNA.rhythm.gap * (0.6 + rand() * 0.8) * slow) / v.speed;
  }
  return finish(out, sampleRate, v, mood === 'sleepy' ? 0.35 : 0.7);
}

export type SfxName = 'jingle' | 'wake' | 'snore' | 'celebrate' | 'greet' | 'tap';

/** Signature sounds, all from the same DNA. `v` colours them per character where it makes sense. */
export function renderSfx(name: SfxName, v: VoicePreset = VOICE_PRESETS['lantern-soft'], sampleRate = 22050, seed = 7): Float32Array {
  const rand = rng(seed);
  const sr = sampleRate;
  const make = (sec: number) => new Float32Array(Math.ceil(sec * sr));
  if (name === 'jingle') return jingle(sr);
  if (name === 'tap') {
    // a soft key-tap: the sample's "t" pop, low level
    const out = make(0.06);
    const bp = new BandPass(sr); bp.set(VOICE_DNA.onset.presenceHz * 0.8, 1.2);
    for (let i = 0; i < out.length; i++) out[i] = bp.run(rand() * 2 - 1) * Math.exp(-i / (0.006 * sr));
    return finish(out, sr, null, 0.25);
  }
  const plan: Syllable[] = [];
  const S = (onset: Onset, vowel: string, coda: Coda, dur: number, st: number, glide: number, level = 1) =>
    plan.push({ onset, vowel, coda, dur: dur / v.speed, f0: v.f0 * semis(st), glide, level });
  if (name === 'wake') { S('', 'u', '', 0.42, -5, 9, 0.8); S('pl', 'a', '', 0.2, 4, 3); }
  else if (name === 'snore') { S('', 'u', '', 0.7, -12, -2, 0.35); }
  else if (name === 'celebrate') { S('p', 'a', '', 0.12, 0, 1); S('p', 'a', '', 0.12, 3, 1); S('t', 'a', '', 0.12, 5, 1); S('t', 'o', 'p', 0.3, 9, 4); }
  else if (name === 'greet') { S('pl', 'a', '', 0.16, 0, 2); S('t', 'o', '', 0.22, 4, 5); }
  let total = 0.06;
  for (const s of plan) total += s.dur + 0.04;
  const out = make(total + 0.1);
  let at = 0.03;
  for (const s of plan) { synthSyllable(out, Math.floor(at * sr), sr, v, s, rand); at += s.dur + 0.04; }
  if (name === 'snore') {
    // breathy exhale tail
    const lp = new LowPass(sr, 700);
    for (let i = Math.floor(0.4 * sr); i < out.length; i++) out[i] += lp.run(rand() * 2 - 1) * 0.15 * Math.sin(Math.PI * Math.min(1, (i / sr - 0.4) / 0.4));
  }
  return finish(out, sr, v, name === 'snore' ? 0.25 : 0.7);
}

/**
 * The PLaTOP jingle: "pla · ta · top!" sung on the first voiced pitches of the sample,
 * snapped to a major pentatonic and doubled by a soft bell.
 */
function jingle(sr: number): Float32Array {
  // The sample's first voiced syllables, in semitones from its median pitch, snapped to pentatonic:
  // 135 Hz → −2 (A), 299 Hz → +12 (C'), 110→196 Hz glide → −5→+5, 214 Hz → +7 (G)
  const notes = [{ st: -3, glide: 0, syl: ['pl', 'a', ''] }, { st: 4, glide: 0, syl: ['t', 'a', ''] }, { st: 0, glide: 7, syl: ['t', 'o', 'p'] }, { st: 12, glide: 0, syl: ['', 'a', ''] }] as const;
  const base = 523.25; // C5: small, bright, friendly
  const beat = VOICE_DNA.rhythm.ioi * 0.62;
  const out = new Float32Array(Math.ceil((beat * notes.length + 1.2) * sr));
  const v: VoicePreset = { ...VOICE_PRESETS['lantern-soft'], f0: base, speed: 1.4 };
  const rand = rng(11);
  notes.forEach((nt, k) => {
    const start = Math.floor((0.03 + k * beat) * sr);
    const dur = k === notes.length - 1 ? 0.5 : beat * 0.9;
    synthSyllable(out, start, sr, v, { onset: nt.syl[0] as Onset, vowel: nt.syl[1], coda: nt.syl[2] as Coda, dur, f0: base * semis(nt.st), glide: nt.glide, level: 0.55 }, rand);
    // bell: two partials with a fast attack and long decay
    const f = base * semis(nt.st + (nt.glide ? nt.glide : 0)) * 1;
    const len = Math.floor((k === notes.length - 1 ? 1.1 : 0.6) * sr);
    for (let i = 0; i < len && start + i < out.length; i++) {
      const t = i / sr;
      const e = Math.min(1, t / 0.004) * Math.exp(-t / (k === notes.length - 1 ? 0.45 : 0.22));
      out[start + i] += 0.32 * e * (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t / 0.08));
    }
  });
  return finish(out, sr, null, 0.75);
}

export interface Line { speaker: 0 | 1; at: number; mood: Mood; seed: number }

/**
 * A pass-by chat between two characters: call and response, alternating moods,
 * spaced by the sample's between-phrase rhythm. Returns a schedule; render each line
 * with renderPhrase(voiceOf(line.speaker), line).
 */
export function planConversation(seed: number, turns = 3): Line[] {
  const rand = rng(seed);
  const lines: Line[] = [];
  let at = 0;
  const moods: Mood[][] = [['question', 'happy'], ['chat', 'chat'], ['chat', 'question'], ['happy', 'happy'], ['calm', 'chat']];
  for (let k = 0; k < turns * 2; k++) {
    const speaker = (k % 2) as 0 | 1;
    const pair = moods[Math.floor(rand() * moods.length)];
    lines.push({ speaker, at, mood: pair[speaker], seed: Math.floor(rand() * 1e9) });
    at += 0.55 + rand() * 0.35 + (k % 2 ? VOICE_DNA.rhythm.phraseGap * 0.4 : 0);
  }
  return lines;
}

// ------------------------------------------------------------------ Web Audio player

/**
 * Lightweight player: renders on demand, caches buffers, one master gain.
 * `new PlatopVoices(new AudioContext())` after a user gesture.
 */
export class PlatopVoices {
  private cache = new Map<string, AudioBuffer>();
  private master: GainNode;
  constructor(private ctx: AudioContext, volume = 0.35) {
    this.master = ctx.createGain();
    this.master.gain.value = volume;
    this.master.connect(ctx.destination);
  }

  set volume(v: number) { this.master.gain.value = v; }

  private buffer(key: string, make: () => Float32Array): AudioBuffer {
    let b = this.cache.get(key);
    if (!b) {
      const data = make();
      b = this.ctx.createBuffer(1, data.length, 22050);
      b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      if (this.cache.size > 160) this.cache.delete(this.cache.keys().next().value as string);
      this.cache.set(key, b);
    }
    return b;
  }

  private play(b: AudioBuffer, when = 0, pan = 0, gain = 1): void {
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(g).connect(p).connect(this.master);
    src.start(this.ctx.currentTime + when);
  }

  /** One phrase. Reuse a small seed pool per character so the cache stays warm. */
  say(voice: VoicePreset, mood: Mood = 'chat', seed = Math.floor(Math.random() * 6), pan = 0): void {
    const key = `p:${JSON.stringify(voice)}:${mood}:${seed}`;
    this.play(this.buffer(key, () => renderPhrase(voice, { seed, mood })), 0, pan);
  }

  /** Two characters passing by. */
  converse(a: VoicePreset, b: VoicePreset, seed = Math.floor(Math.random() * 1000), panA = -0.3, panB = 0.3): void {
    for (const line of planConversation(seed, 2)) {
      const v = line.speaker === 0 ? a : b;
      const s = line.seed % 8;
      const key = `p:${JSON.stringify(v)}:${line.mood}:${s}`;
      this.play(this.buffer(key, () => renderPhrase(v, { seed: s, mood: line.mood })), line.at, line.speaker === 0 ? panA : panB);
    }
  }

  sfx(name: SfxName, voice?: VoicePreset, pan = 0, gain = 1): void {
    const key = `s:${name}:${voice ? JSON.stringify(voice) : ''}`;
    this.play(this.buffer(key, () => renderSfx(name, voice)), 0, pan, gain);
  }
}
