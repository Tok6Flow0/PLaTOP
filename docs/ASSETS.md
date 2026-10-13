# Characters, animation and decor

Sixteen characters from six teams. Each team named itself and drew its own portrait when the CEO asked; the models follow those portraits, restyled to the PLaTOP office concept (`public/reference/office-concept.png`). That means designer-toy robots (round helmets, dark curved visors, block-shaped ceramic torsos, dark rounded hands and feet), plush owls with big ringed eyes, a brass lantern and a little clay swift.

Everything is generated from code in [`assets-src/`](../assets-src). No textures, no baked lights, no external tools.

```sh
node assets-src/build-characters.mjs   # → public/assets/characters/*.glb + manifest.json
node assets-src/build-decor.mjs        # → public/assets/decor/*.glb + manifest.json
node assets-src/voice/render.mjs       # → public/assets/audio/ listening previews
```

Voices, chirps and the jingle are synthesised live by [`src/audio/voice.ts`](../src/audio/voice.ts); see [SOUND.md](SOUND.md). The name is explained in [NAME.md](NAME.md).

To review visually, serve the repo root and open `assets-src/preview/index.html`. Parameters: `?ids=bridge-scout,email-owl&clip=Work&t=0.5&zoom=2&view=iso`; add `decor=1` for props.

## The cast

| Team | Character | Look | Moves by | Work (role action) |
| --- | --- | --- | --- | --- |
| Savor Bridge · Merchant development | **Jarvis** | Orange toy robot, dark visor, gold bridge-arch badge | Waddle | Types, then looks up and points "this way" |
| | **Scout** | Small teal robot with a compass belly and a magnifier | Bouncy hops | Lens to visor, scanning left and right |
| | **Keeper** | Ivory face, green cap and body, hugs a green sprout book | Careful waddle | Opens the book, turns a page, closes it |
| Clear Path · HR document review | **Lens** | Butter helmet, dark visor with a gold monocle, sage body | Waddle | Holds a page close, leans in, monocle zooms, nods |
| | **Compass** | Ivory helmet, sage arms, compass on the chest | Waddle | Needle spins and settles; nod and point |
| | **Relay** | Butter helmet, deep-teal body, gold connected dots | Hops | Picks up a note, hands it off, little "yay" |
| Savor Wayfinders · Rider & backend intake | **Jarvis** | Navy hood with gold star, navy cape, compass medallion | Glide (cape flutters) | Types, then a calm whole-arm point |
| | **Beacon** | Little lighthouse lamp on its helmet | Waddle | Types while the lamp sweeps and blinks |
| | **Relay** | Receipt roll on its helmet, checklist chest | Hops | Receipt feeds out, a tick, rewinds |
| | **Compass** | Sprout antenna with a glowing gold bud, circuit chest | Wobbly waddle | Types, head-tilt, the bud pulses with an idea |
| Beacon · WhatsApp support | **Beacon** | Green hooded lantern, warm chat-bubble face, headset discs | Waddle | Listens, paws tap, a "typing…" bubble bounces |
| The Lantern Desk · Nightly reflection | **Lumen** | Brass hurricane lantern with a tiny face on the glass | Floats | Leans over the page and brightens |
| | **Echo** | Cream plush owl with a magnifying lens | Hops | Peers left, then right; "aha" tuft wiggle |
| | **Quill** | Cream plush owl with a pencil | Waddle | Writes a note, taps a full stop, admires it |
| Savor Dispatch · Official email | **Courier** | Navy plush owl, cream eye rings, envelope badge | Waddle | Lifts a letter, stamps it twice, files it |
| | **Swift** | Tan clay swift with teal wing tips | Flies | Three proofreading pecks, then a fluff |

## Clips

Every GLB has the four app clips (`Idle`, `Move`, `Work`, `Sleep`) and two extras (`Emote`, `Talk`). All loop seamlessly except `Emote`, which reads best played once.

| Clip | Length | What happens |
| --- | --- | --- |
| `Idle` | 2.8–3.6 s | Breathing, blinks, looking around; owls swivel their heads, antennas and sprouts lag behind |
| `Move` | 0.5–1.2 s | In place, so the app moves the root. Waddle, hop, glide, float or fly, matching the table. `extras.moveSpeed` is a suggested ground speed. Swift and Lumen lift off inside the clip (`extras.airborne`) |
| `Work` | 2.2–2.6 s | The role action above |
| `Sleep` | 3.6–4.2 s | Slump, slow breathing, ‿‿ eyes, glows dim or go out, three Zs drift up (`fx_zzz`) |
| `Emote` | 1.3–1.4 s | The little celebration: spin-hop, backflip, twirl, owl flutter-turn, swift loop-the-loop |
| `Talk` | 1.2–1.6 s | Bobbing on the synth's syllable rhythm; mouths, beaks and flames pulse |

## Integration contract

- **Manifest:** `public/assets/characters/manifest.json`, read by `src/scene/assets.ts` (`schemaVersion: 1`, `/assets/characters/<id>.glb`, clips mapped by name).
- **Format:** glTF 2 binary, all buffers embedded, no Draco/meshopt/basisu. 160–300 KB, 7–9k triangles and 19–30 draw calls per character.
- **Orientation:** feet at the origin, facing +Z, about 1 unit tall (desks are 0.77). Swift (0.5) and Scout (0.9) are small on purpose.
- **Hidden-at-rest nodes:** `fx_z*`, `eyes_sleep` and props such as `prop_letter` are exported at scale 0.001, and only the clips that need them reveal them, so `crossFadeTo` between any two clips is clean. The Zs rest inside the body and `Sleep` lifts them to `extras.sockets.zzz`, so a rest-pose `Box3` measures the character's true height.
- **Glows:** materials named `glow_*` are unlit (`KHR_materials_unlit`). Set `toneMapped = false` on them if tone mapping washes them out.
- **`extras`** (ignored by `parseManifest`, available to the app): `name`, `team`, `height`, `footprint`, `locomotion`, `airborne`, `moveSpeed`, extra clips, `clipDurations`, `sockets.zzz` / `sockets.bubble` heights, and `voice.preset` (pass it to `voiceFor(preset, id)`; see [SOUND.md](SOUND.md)).

## Authored decor library

`public/assets/decor/manifest.json` maps every team to a **plant**, a **lamp** and an **art** piece, retained from the earlier Plant · Lamp · Art controls. Those viewer controls have been removed. Agents now own decoration through bounded primitive recipes in the local PLaTOP skill; this authored library remains available as source material. The lamps and art come from each team's own portrait:

| Team | Art | Lamp | Plant |
| --- | --- | --- | --- |
| Savor Bridge | Golden arch bridge at sunrise | Cream floor lamp | Leafy |
| Clear Path | Sage hills, winding path, quiet sun | Sage floor lamp | Palm |
| Savor Wayfinders | Terracotta sun-disc with a compass star | Little lighthouse | Snake plant |
| Beacon | Green chat-bubble sign with a warm "…" | Green camp lantern on a stand | Leafy |
| The Lantern Desk | Crescent moon and stars | Brass hurricane lantern on a stool | Snake plant |
| Savor Dispatch | Teal halo, gold spark, sealed envelope | Teal floor lamp | Palm |

Floor items stand on y = 0. Wall art is centred on its origin with its back at z = 0, facing +Z. Each piece is 11–48 KB and 3–7 draw calls.
