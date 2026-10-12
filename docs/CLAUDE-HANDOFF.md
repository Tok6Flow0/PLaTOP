# PLaTOP: character and animation handoff

Codex owns the application, renderer integration, activity bridge, skill and desktop window. Claude owns the polished 3D characters, their four short animation clips, and the team's choice of workspace props. Model parameters remain the user's choice.

## Shared implementation

The app is a small, roofless isometric office with six team areas. Sixteen characters live here. The public roster in `src/teams.ts` contains the stable identifiers, names and visual descriptions. The original portraits in `public/portraits/` are the visual source of truth. They are art references, not complete 3D assets.

Read `docs/ASSET-CONTRACT.md` for the exact exporter/loader contract and `public/assets/characters/manifest.json` for the delivery slots. Until models arrive, the renderer uses clearly labeled integration proxies. Replace the proxies through the manifest; preserve character IDs and avoid modifying Codex's renderer or bridge.

| Team | Members | Portrait |
| --- | --- | --- |
| Savor Bridge | Jarvis, Scout, Keeper | `merchant.png` |
| Clear Path — Savor HR | Compass, Lens, Relay | `hr.png` |
| Savor Wayfinders | Jarvis, Beacon, Relay, Compass | `intake.png` |
| WhatsApp Support | Beacon, representing Jarvis | `support.png` |
| The Lantern Desk | Lumen, Echo, Quill | `reflection.png` |
| Savor Dispatch | courier owl and origami swift | `email.png` |

The Dispatch team did not name its individual birds. “Courier” and “Swift” in the code are provisional display labels. Other duplicate names belong to different teams and have unique prefixed IDs.

## Animation brief

Deliver four lightweight, in-place clips per character: `Idle`, `Move`, `Work`, `Sleep`. Let the silhouette determine movement: little steps, a gentle lantern glide, an owl hop or a swift's restrained wingbeat. Choose a small character-specific working gesture and a readable restful pose. Keep personality subtle and loops seamless. Root translation belongs to the renderer, so clips must not move the entire model through the world. The renderer provides the floating Z indicator.

Preserve the ceramic and folded-paper visual language, simple eyes, clean silhouettes and the supplied palettes. Viewability from above matters more than tiny details. Let each team choose a few office props that fit its character and role. Keep props practical, quiet and optional.

Target at most 2,500 triangles and 512 KB per character; prefer shared materials, embedded assets, texture atlases no larger than 1024px and minimal joints. No live lights, physics, particles, environment maps or external textures embedded as URLs. Export glTF 2.0 binary `.glb`, Y-up, feet at origin, forward +Z, nominal standing height 1 unit. Use the asset contract's final normalization rules if they differ from this overview.

## Delivery and review

Write models under `public/assets/characters/` and update only the asset manifest entries you delivered. Include editable generation/source files in `art-source/` if useful, with a concise reproducible export command. Record model path, triangle count, byte size, clip names and source attribution in an asset delivery note. A still image or `.blend` file alone is not a runtime delivery.

Use a `CLAUDE-STATUS.md` note in your supplied shared workspace for progress, decisions, export paths or blockers. Codex will read that note and verify the files before claiming integration complete. No model-setting changes are requested.
