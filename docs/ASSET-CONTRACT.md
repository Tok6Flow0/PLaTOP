# PLaTOP character and animation integration

The application uses editable reference characters plus visually reviewed authored GLBs. Claude has delivered all sixteen source models and their animation. The user then asked Codex to lead a reference-matching rebuild and independent critique; delivery and visual approval are separate. `public/assets/approved.json` enables individual reviewed GLB IDs without changing Claude’s delivery manifest. Undelivered or unapproved models use the editable ceramic characters in `src/scene/proxies.ts`.

The user-approved starting-space concept in `public/reference/office-concept.png` is the current style target. Original team portraits in `public/portraits/` preserve identity cues. Preserve each team's chosen identity, silhouette, materials, emblem, and small companion details. `src/teams.ts` contains the roster and description, but a written palette shorthand must not override a clear visual identity in the source portrait. Keep the final work cute and polished, with simple ceramic, paper and lantern forms that read at a small size.

## Delivery

Put one binary glTF 2.0 file per character in `public/assets/characters/`, named with its stable ID. Set the matching `path` in `manifest.json` to `/assets/characters/<id>.glb`. Keep an undelivered model's path `null`. The application does not request null or unapproved paths, and a failed model keeps its reference character. Use `schemaVersion: 1` and preserve the manifest's four clip keys.

All textures and buffers must be embedded in the GLB. The loader permits same-origin files in this character directory only, rejects external resource URLs, and does not download Draco, meshopt or Basis decoders. Do not include URLs, scripts, private chat transcripts, email content, or credentials in models or metadata.

Example delivered entry:

```json
"bridge-jarvis": {
  "path": "/assets/characters/bridge-jarvis.glb",
  "clips": { "Idle": "Idle", "Move": "Move", "Work": "Work", "Sleep": "Sleep" }
}
```

## Geometry and performance

- Target **2,500 triangles or fewer** and **512 KB or less** per model, including clips. The runtime rejects files over 4 MB as an integration ceiling, not a target.
- Use Y-up, meters, feet at the origin, facing **+Z**, and a nominal rest height of **1 meter**. The runtime normalizes reviewed owl/lantern models to the office’s display scale defensively; stable feet and facing still matter.
- Prefer one mesh and one material where possible. Keep textures at 256 px or below when a material color can do the job. Use low-roughness variation sparingly; readability comes from shape and palette.
- Avoid dynamic lights, shadow dependencies, particle systems, cloth, physics and postprocessing. The room uses fixed hemisphere/directional lighting, a static soft-shadow map and small local lamp glows. Character motion uses inexpensive contact pads.
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

The editable reference characters have small procedural head, limb, wing and glow gestures. For approved models, the application uses authored `Move`, `Work` and `Sleep` clips. Any richer character actions, flips or flourishes can extend the contract later without making the first version expensive.

## Exact roster: six teams, sixteen characters

| Team / portrait | Stable model ID | Identity |
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

The six offices use a cozy perspective view with warm off-white, sage, teal and terracotta, now viewed through a bounded perspective camera. Each team stays in its own office. Plant, lamp and abstract art decorations are controlled independently by application state. Office decoration is open to the teams' tastes; there is no required CEO tribute.

The scene renders at a maximum 24 fps while any team is active and 4 fps for sleep-only animation. Neutral scenes, pause, reduced motion, a hidden document, or a minimized native window have no repeating animation timer. Camera input redraws at up to 24 fps even when characters are sleeping or frozen. Device pixel ratio is capped at 1.5 while active and 1 for static/sleep scenes. Reduced motion shows informative still poses.

For a delivery review: verify all sixteen stable IDs, portrait identity, height/facing/feet, four clip names, seamless loops, triangle/file budgets, local embedded resources, readability at room scale, and correct sleep/active/neutral behavior. Tests should also cover an absent model, missing clip, model load failure, disposal during a load, minimize/resume and reduced motion. Source completion, authored-asset completion and packaged-app runtime verification are separate evidence.

Loader and mixer integration follows the [official Three.js documentation](https://threejs.org/docs/).
