# Sound

PLaTOP's characters speak a tiny made-up language, *PLaTOP-ese*. It's built from one short recording: the founder making the noise that became the app's name.

**The recording itself is never used or shipped.** It was analysed once. Only the numbers it produced live in the code (`VOICE_DNA` in [`src/audio/voice.ts`](../src/audio/voice.ts)), and every sound is synthesised from those numbers.

## What was measured

| Trait | From the recording | How the synth uses it |
| --- | --- | --- |
| Sounds | Plosive *p* / *t* pops, an *l* glide, an "a" (F1 ≈ 830 Hz, F2 ≈ 2150 Hz) and an "o" (F1 ≈ 520, F2 ≈ 1050) | Syllables are only ever made of P, L, a, T, O, P: *pla*, *to*, *top*, *pa*, *lo*… |
| Rhythm | Syllables ≈ 0.25 s, onsets every ≈ 0.35 s, 1–4 syllables per phrase, ≈ 0.85 s between phrases | Phrase length and spacing, sped up per character |
| Pitch | Median 149 Hz (102–295), glides that mostly **rise** | Every voice keeps the gentle upward lilt, shifted into its own range |
| Texture | Only ~30% clearly voiced; breathy and percussive | Breath noise mixed through the same mouth resonances |
| Colour | Warm peak at 400–800 Hz, presence bump near 3 kHz, roll-off past 5 kHz | Formant gains, a "t"-burst filter at 3 kHz, master low-pass |
| Shape | Each syllable has two loudness humps (*pla* then *top*) | Used as the loudness envelope of every syllable |

## Voices

Each character has a preset (owl, lantern, robot flavours…) plus a stable per-character nudge, so no two of the 16 sound the same. Pitch runs from about 220 Hz (Lumen's low hum) to about 960 Hz (Swift's chirp). Robots get a buzzier source, pitch that steps in semitones, and a faint metallic shimmer. Lanterns hum with a closed mouth. Each character's manifest entry names its preset (`extras.voice.preset`); `voiceFor(preset, id)` returns that character's exact voice.

## Using it in the app

```ts
import { PlatopVoices, voiceFor } from './audio/voice';

const voices = new PlatopVoices(new AudioContext(), 0.35); // after a user gesture
const scout = voiceFor('robot-bright', 'bridge-scout');     // preset from manifest extras.voice
voices.sfx('jingle');                                       // app start / wake-up
voices.say(scout, 'happy');                                 // one phrase
voices.converse(scout, voiceFor('owl-warm', 'email-owl'));  // two characters passing by
voices.sfx('snore', scout, 0, 0.4);                         // rare, quiet, while sleeping
```

Moods: `chat`, `question`, `happy`, `calm`, `sleepy`. Sound effects: `jingle`, `wake`, `greet`, `celebrate`, `snore`, `tap`.

**Cost:** a phrase renders in well under a millisecond on the main thread and is cached (at most 160 buffers). Nothing plays until the app creates an `AudioContext`. Keep the master volume low and conversations occasional: this is an idle app.

## Listening previews

`public/assets/audio/` holds rendered previews: the jingle, a "hello" in each character's voice, a Scout ⇄ Courier pass-by chat, and the effects. Regenerate them with:

```sh
node assets-src/voice/render.mjs
```

(This uses macOS `afconvert` for AAC and falls back to WAV elsewhere.)
