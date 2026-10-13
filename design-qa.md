# Source comparison and unseen observer review

Current result: the stricter character-level reference pass is implemented and functionally verified. The scene and portraits are closer to the supplied concept, but exact visual equivalence has not been achieved or approved. The earlier qualitative acceptance and 84/100 comparison do not establish an exact match.

## Current surface refinement checkpoint

The October 13 surface series supersedes the older captures and counts below.
See [the complete surface review ledger](docs/AVATAR-SURFACE-REVIEW.md): the latest
independent result is **8.4/10 B+ for portraits and 8.0/10 B for the campus**, not
the requested A. The original sections below describe the earlier checkpoint.

All sixteen procedural characters now have exactly 100× authored triangles in
their worker-built close-up tier, with at most three resident detailed avatars.
The overview stays coarse. All 28 day/night and individual portraits use those
same model surfaces. Folded paper depth, feather winding, inset eye sockets,
cape lining, Beacon's handle, rounded face aperture, foliage and wood finishes
have been refined. No fake activity or observer authority was introduced.

The current suite passes **281 tests** and the production build passes. The
existing bundle-size warning remains. Matched full-face camera checks measured
49.50 submitted scene fps with three dense avatars versus 45.29 baseline; these
are variable same-machine samples, not a GPU-completion or locked-frame-rate
claim. Mobile header mask icons were repaired without removing their labels.

Remaining work includes character primary-shape refinement, paper head/body
transitions, clean feather overlaps, localized lantern warmth and furnishing
variety. The independent review acknowledged the clearer neutral orientations,
heart-shaped owl face, bowed book covers and visible seating.
Live agent actions remain the only source of work gestures and locomotion.

## Earlier checkpoint evidence

- Reference: `public/reference/office-concept.png`, the left-hand image supplied by the user.
- Current campus: `docs/images/studio-campus-after.png`.
- Paired source/current: `docs/images/studio-source-comparison.png`.
- Paired source/current characters: `docs/images/studio-portraits-comparison.png`.
- Third-person mist: `docs/images/studio-mist-third-person.png`.
- Mobile mist controls: `docs/images/studio-mist-mobile.png`.

Desktop captures use a verified 1536 × 1024 CSS viewport at 1× screenshot density. The comparison presents both full views at the same scale; the character comparison enlarges the reference portrait and the actual model-generated portrait equally. Mobile checks use a verified 390 × 844 CSS viewport. These are screenshots of the running application, without injected activity or live-chat reads.

## Refinement

Successive paired reviews corrected the back-wall height, room framing, rug palette, oversized computer clutter, disconnected-looking furnishings, narrow foliage and weak surface depth. The current space has connected leaves and branches, rolled clay pots, rounded wood and woven rugs. Real doorways, foyer gaps and floor bridges retain usable routes. A shared floor overlap was removed so close views do not flicker.

The sixteen default models now follow the approved concept's ceramic helpers, ivory/navy owls, lanterns and ochre bird. Names, stable IDs and roles are unchanged. Fitted visors and belly panels, joined arms and feet, fuller bodies, rounded jaw contours, oval ears and more faithful face proportions replace the earlier costume interpretations. All 22 interface portraits are freshly rendered from these same models. The last character comparison prompted richer orange/green finishes, Scout's larger cream face and belly, Jarvis's taller visor, wider botanical staging and less blur on foreground characters.

Contact shading reuses depth from one geometry draw. The colour target is capped at 1600 pixels and the eight-sample occlusion target at 800; allocation or draw failures fall back to direct rendering. Transparent walls and luminous mist preserve bounded alpha coverage. The scene retains a 1.5× backing-density cap and a 2048-square static shadow map. No ray tracing, PS5-equivalent quality or whole-device performance claim is made.

## Functional verification

The complete suite passes 246 tests, including the real installed occlusion pass's rendering-state restoration and failure fallback, all actor routes with decorations on/off, physical door/floor geometry, character clearance and surface fit, lossless PNG output, no status-driven gestures, demo-source rejection and mist isolation. The production build and source/output fingerprint check pass.

Browser checks cover the default campus, all six office windows, close zoom and optional mist entry, first/third person, movement through a wall, keyboard exit, window-view exit, responsive controls and loaded portraits. First person hides the observer's own mist. Camera restoration at an unchanged viewport was verified by two parked-cursor captures with zero changed pixels. Resized exits restore the orbit then apply the normal responsive fit. Mobile Float, Look, perspective and Exit controls have at least 44-pixel target height. No WebGL warning or error appeared in the reviewed desktop session.

The neutral scene has no standing animation loop. Mist is a local camera object with no identity, bridge writes, collision body, occupancy, agent visibility or decorating authority. There is no Preview activity control, preview state or automatic busy choreography. The README preserves the creator's requested quote about minimalism and the agents' chosen embodiments.

## Remaining visual differences

The reference has richer organic foliage, finer material irregularity and more photographic light falloff. The procedural characters remain more stylized, and their neutral positions differ from the reference's staged seated poses. A staged working tableau would conflict with the requirement that only agent-chosen actions animate the space. Camera and window controls remain for the observer; the reference's activity and decorating buttons are deliberately absent.

The latest captures supersede the earlier `studio-before-after.png` and agent-practice images, which remain historical evidence. This pass does not establish adoption by installed skills, existing automations or a running native companion, and it does not modify the private live bridge.
