# PLaTOP character and animation integration

The default scene uses sixteen cohesive procedural characters in `src/scene/proxies.ts` and `src/scene/characterGeometry.ts`. Rounded ceramic robots, lanterns, owls and a swift share the room's material and lighting direction. Claude's sixteen authored GLB deliveries and animations remain available as source assets. The user asked Codex to lead a reference-matching rebuild and independent critique; delivery and visual approval are separate. `public/assets/approved.json` currently enables no GLBs. That gate can opt individual reviewed models back in without changing the delivery manifest; a missing or failed model retains its procedural character.

The user-approved starting-space concept in `public/reference/office-concept.png` is the current style target. Original team portraits in `public/portraits/` preserve identity cues. The viewer's member and team portraits in `public/avatars/` are renders of the current procedural models, rather than crops of the concept image. Preserve each team's chosen identity, silhouette, materials, emblem, and small companion details. `src/teams.ts` contains the roster and description, but a written palette shorthand must not override a clear visual identity in the source portrait. Keep the final work cute and polished, with simple ceramic, paper and lantern forms that read at a small size.

## Optional authored GLB delivery

Put one binary glTF 2.0 file per character in `public/assets/characters/`, named with its stable ID. Set the matching `path` in `manifest.json` to `/assets/characters/<id>.glb`. Keep an undelivered model's path `null`. The application does not request null or unapproved paths, and a failed model keeps its reference character. Use `schemaVersion: 1` and preserve the manifest's four clip keys.

All textures and buffers must be embedded in the GLB. The loader permits same-origin files in this character directory only, rejects external resource URLs, and does not download Draco, meshopt or Basis decoders. Do not include URLs, scripts, private chat transcripts, email content, or credentials in models or metadata.

Example delivered entry:

```json
"bridge-jarvis": {
  "path": "/assets/characters/bridge-jarvis.glb",
  "clips": { "Idle": "Idle", "Move": "Move", "Work": "Work", "Sleep": "Sleep" }
}
```

## Authored geometry and performance

- Target **2,500 triangles or fewer** and **512 KB or less** per model, including clips. The runtime rejects files over 4 MB as an integration ceiling, not a target.
- Use Y-up, meters, feet at the origin, facing **+Z**, and a nominal rest height of **1 meter**. The runtime normalizes reviewed owl/lantern models to the office’s display scale defensively; stable feet and facing still matter.
- Prefer one mesh and one material where possible. Keep textures at 256 px or below when a material color can do the job. Use low-roughness variation sparingly; readability comes from shape and palette.
- Avoid character-owned dynamic lights, shadow dependencies, particle systems, cloth, physics and postprocessing. The room uses fixed hemisphere/directional lighting, a small prefiltered studio environment, a static soft-shadow map and local lamp glows. An explicit agent room style may add one bounded, shadow-free fill. Character motion uses inexpensive contact pads.
- A lightweight armature is welcome where useful. Avoid unnecessary bones, constraints, unused actions and hidden high-detail geometry.

## Four animation clips

Export four named looping **in-place** clips, with no root translation. The scene owns navigation; the clip owns the character's personality and body movement. All clips need a calm, seamless loop, and the first frame must read sensibly as a static pose.

| Clip | When used | Character-specific direction |
| --- | --- | --- |
| `Idle` | Neutral or waiting | A relaxed attentive stance; no implied task progress. |
| `Move` | Activity with local navigation | Robot walk, lantern bob/step, owl hop or flight, swift wingbeats, as appropriate to the character. |
| `Work` | Activity at the workspace | Small reading, looking, writing, checking or communicating gesture tied to the member's role. |
| `Sleep` | Confirmed inactive chat | Resting pose, eyelids or tucked wings where appropriate. The application adds a small Z indicator only when the model lacks its own Sleep effect. |

Aim for 2–4 seconds per loop and a small number of keys. Keep contact within a roughly 0.8-meter footprint. Do not animate cameras, room objects or lights inside a character model. A missing clip falls back to `Idle` where available and is reported as pending.

The default procedural characters have small head, limb, wing and glow gestures synchronized to the scene's motor state. For an explicitly approved GLB, the application uses authored `Move`, `Work` and `Sleep` clips. Any richer character actions, flips or flourishes can extend the contract later without making the first version expensive.

## Model portraits

`scripts/render-avatars.mjs` optionally renders sixteen member portraits and six
team portraits into `public/avatars/`, along with a manifest of generation-input
and PNG fingerprints. It imports the same procedural models, shared geometry
and materials, with the app's prefiltered studio environment.

With an existing Playwright installation available to Node, run:

```sh
node scripts/render-avatars.mjs
```

Generation uses an existing Playwright package by default. Set
`PLATOP_PLAYWRIGHT_MODULE` to another importable installation when needed; there
is no mandatory Playwright runtime dependency. Its Chromium browser and working
WebGL must be available. The script owns a temporary Vite server on an available
loopback port, rooted in this checkout, and closes both server and browser after
generation. It takes no URL argument or prestarted server, preventing unrelated
or stale development sources from being stamped as current portraits. It does
not use chat contents. Fingerprints detect stale portraits after model
changes; they do not guarantee identical pixels across different graphics drivers.

## Exact roster: six teams, sixteen characters

| Team / source portrait | Stable model ID | Identity |
| --- | --- | --- |
| Savor Bridge / `merchant.png` | `bridge-jarvis` | Jarvis, warm orange ceramic coordination robot |
| Savor Bridge / `merchant.png` | `bridge-scout` | Scout, teal research robot with magnifying/compass cue |
| Savor Bridge / `merchant.png` | `bridge-keeper` | Keeper, ivory book-like continuity helper |
| Clear Path / `hr.png` | `hr-compass` | Compass, calm central guardian; follow the ivory teardrop source silhouette |
| Clear Path / `hr.png` | `hr-lens` | Lens, sage factual reviewer |
| Clear Path / `hr.png` | `hr-relay` | Relay, teal follow-through helper |
| Savor Wayfinders / `intake.png` | `intake-jarvis` | Jarvis, cream navigation guardian, navy faceplate, compass cue |
| Savor Wayfinders / `intake.png` | `intake-beacon` | Beacon, cream guardian, navy faceplate, terracotta/gold beacon cue |
| Savor Wayfinders / `intake.png` | `intake-relay` | Relay, cream reliable-records helper, paired-receipt cue |
| Savor Wayfinders / `intake.png` | `intake-compass` | Compass, cream backend-continuity guardian, circuit cue |
| Beacon / `support.png` | `support-beacon` | Forest-green ceramic lantern with amber conversation-bubble front; represents accountable assistant Jarvis |
| The Lantern Desk / `reflection.png` | `reflection-lumen` | Lumen, warm amber lantern |
| The Lantern Desk / `reflection.png` | `reflection-echo` | Echo, cream origami owl with magnifying lens |
| The Lantern Desk / `reflection.png` | `reflection-quill` | Quill, folded-paper owl with pencil |
| Savor Dispatch / `email.png` | `email-owl` | Navy ceramic courier owl, pale facial discs, envelope cue; display name remains provisional |
| Savor Dispatch / `email.png` | `email-swift` | Ochre paper swift with teal edge; display name describes the species |

Characters with the same spoken name in different teams remain separate assets and preserve their different identities. Do not merge Jarvis, Relay, Compass or Beacon IDs.

## Application behavior and review

The six offices use a cozy perspective view with warm off-white, sage, teal and terracotta, viewed through a bounded perspective camera. Each team owns an office; characters can walk through the connected campus and visit other offices. Screens and chairs face their assigned characters. Viewers select offices, move the camera, choose a window view or pause playback. They have no decorating or avatar-action controls. Office decoration is open to the teams' tastes; there is no required CEO tribute.

Agents compose one bounded local asset per desk, shelf, wall, floor or festive
slot through `platop_decorate`. Up to twelve parts choose `box`, `sphere`,
`cylinder`, `cone`, `torus`, `capsule` or `leaf`, with optional normalized position,
size, rotation, hex colour, boolean glow and `matte`, `ceramic`, `wood` or `metal`
finish. Shapes share smooth geometry with at most 512 triangles per primitive.
Glow is material emission, not another light. The scene places and scales each
slot away from walking routes. Empty parts removes an asset.

`platop_style` lets the owning team choose wall, rug and furniture colours and
lamp colour, brightness and `day`, `cozy`, `night` or `off` mood. Sparse choices
merge; omitted fields preserve the current look. An exclusive `reset:true`
removes the style and restores the authored palette and lamp settings without
clearing assets. These data-only choices accept no scripts, external files,
URLs, text or arbitrary scene graphs. The [activity bridge](ACTIVITY-BRIDGE.md)
defines the complete contract and local persistence bounds.

Visible active and sleeping animation uses a display-synchronized cinematic
30 fps cadence. Camera input redraws at up to 60 fps. Neutral scenes, pause,
reduced motion, a hidden document or a minimized native window do not schedule
continuous animation; a brief transition may finish before settling. The scene
pixel-ratio cap is 1 with native antialiasing, while interface text retains native
display density. Reduced motion shows informative still poses. These are frame
budgets, not a guarantee of presented refresh rate or whole-device CPU savings.

For a delivery review: verify all sixteen stable IDs, portrait identity, height/facing/feet, four clip names, seamless loops, triangle/file budgets, local embedded resources, readability at room scale, and correct sleep/active/neutral behavior. Tests should also cover an absent model, missing clip, model load failure, disposal during a load, minimize/resume and reduced motion. Source completion, authored-asset completion and packaged-app runtime verification are separate evidence.

Loader and mixer integration follows the [official Three.js documentation](https://threejs.org/docs/).
