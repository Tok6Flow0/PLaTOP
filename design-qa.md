# Source comparison and unseen observer review

Current result: the stricter character-level reference pass is implemented and functionally verified. The scene and portraits are closer to the supplied concept, but exact visual equivalence has not been achieved or approved. The earlier qualitative acceptance and 84/100 comparison do not establish an exact match.

## Current surface refinement checkpoint

The October 13 surface series supersedes the older captures and counts below.
See [the complete surface review ledger](docs/AVATAR-SURFACE-REVIEW.md). A fresh
pass-60 reviewer, without prior scores, gave **7.5/10 character craft, 8.0/10
character fidelity, 7.0/10 campus craft and 7.5/10 campus fidelity**. The continuity
reviewer's earlier full-set result was 8.5/10 for portraits and 8.2/10 for campus.
Both judgments remain recorded; neither meets the requested A. The original
sections below describe earlier checkpoints.

All sixteen procedural characters now have exactly 100× authored triangles in
their worker-built close-up tier, with at most three resident detailed avatars.
The overview stays coarse. All 28 day/night and individual portraits use those
same model surfaces. Folded paper depth, feather winding, inset eye sockets,
cape lining, Beacon's handle, rounded face aperture, foliage and wood finishes
have been refined. No fake activity or observer authority was introduced.

The pass-123 suite passes **347 tests** and the production build passes. Its
independent Reflection review remains **7.5 craft / 7.5 fidelity**, retaining
the structural-metal separation but not granting A-level acceptance. Pass 100's
actual-scene review retains localized close contacts at approximately 7.5 craft;
campus remains 7.0 craft / 7.5 fidelity. Pass 101 fixes and tests exact-noon
lighting initialization; pass 102's key-light adjustment is narrowly retained
with the same score. Pass 104 retains quieter wood and irregular textile pile,
correcting pass 103's overly smooth rugs. Pass 105 improves Beacon's grouping
with a tighter rug and agent-replaceable low shelf. Beacon is 7.5 / 7.5;
campus remains 7.0 / 7.5. Pass 106 clears Beacon's face by moving, angling and
reducing the monitor without moving or posing the character. Pass 107 retains
Clear Path's tighter desk/rug grouping at 7.5 / 7.5; its full-size navigation
checks pass after correcting the deeper table's rear approach. Pass 108's
Wayfinders paired desks are a mixed prototype: the reviewer retains the
staggered direction but rejects their narrow, thick-rimmed proportions at
7.0 / 7.0. Pass 109's broader, thinner desks and real central aisle are retained
at 7.5 / 7.5. Pass 110's lateral daylight is rejected for broad distracting
shadow bands and reverted. Pass 111's restrained satin-clay shells are retained
but nearly tied with 109: characters/room remain 7.5 / 7.5 and campus 7.0 / 7.5.
Pass 112's curved glass and warm-eye contrast raise Wayfinder craft to 8.0;
fidelity stays 7.5. Room/campus scores stay unchanged. The reviewer retains
the glass. Pass 113 quiets the portrait reflection peaks and is retained at
the same grades. Pass 114 narrowly retains a softer cape sweep and correct
cloth coordinates, but its folds remain too subtle; the guide's overlapping
neckline and broad descending folds are the next construction gap. Pass 115's
individual inspection exposes the full guide without ensemble occlusion. The
reviewer retains its shallow belly inlay but rejects the shoulder-wide capelet
at 7.0 / 7.0 guide craft/fidelity; that rejected garment is a checkpoint, not
an accepted production upgrade. The newly visible floating hat emblem is an
existing construction gap. Pass 116 attaches a shallow hood star and narrows
the collar; the reviewer retains both at guide/ensemble/room 7.5 / 7.5. The
cape still needs hanging folds rather than a jacket-like fit. The isolated
production checkpoint now serves pass 116; window, close zoom, both mist
perspectives, exit and reset pass with no console warnings/errors.
Pass 117's stronger rear folds are visible, but the reviewer requires repair
of an intersecting shoulder patch before retention (guide 7.0 craft / 7.5
fidelity; ensemble/room 7.5 / 7.5). Its lower submitted rates, 48.20 campus
and 46.50 close fps, remain in the ledger; no identical-speed claim is made.
Pass 118 repairs the sleeve intersection and is retained at 7.5 / 7.5 for
guide, ensemble and room. A deterministic jitter test reproduces the camera
throttle loss; a separate input deadline restores 60.00 submitted fps in both
fixed workloads without changing the mesh/draw counts, idle behavior or 30 fps
animation cadence. These short samples are not GPU-completion guarantees.
Pass 119's cream hood point, attached navy inset/star and lighter face surround
are retained at unchanged scores. Its new seam is an intermediate construction:
the reviewer sees a drawn/wavy outline rather than the reference's nested rim.
Both fixed camera tests submit 60.00 fps. One initial full-run MCP-client failure
is retained in the validation record; the isolated client suite and unchanged
full rerun passed. Production remains 116 pending the seam revision.
Pass 120 replaces that drawn outline with a modeled open ceramic return. The
reviewer retains its cleaner edge at unchanged scores, but the cream band is
still too flush to read as a distinct nested hood in normal portrait views.
Both fixed workloads submit 60.00 fps; the full suite passes on the first run.
Pass 121 makes the raised rim readable at ordinary portrait/room size, but its
stronger contrast exposes a scalloped outer contour and somewhat heavy return.
It is retained at unchanged scores; curve regularity is the next issue.
Measured camera rates are 59.90 campus / 59.80 close fps. The isolated production
preview now serves pass 120, with window, zoom, both mist views, exit and reset
verified and no console warnings/errors. No live agent activity was injected.
Pass 122 analytically regularizes the rim surface and passes a full-contour
regression check, but the reviewer sees little visual change and leaves the
forehead/cheek concern open. Its next priority is the guide's broad flowing
belly marking. Camera samples remain approximately 60 fps in both workloads;
no visual grade increase is claimed from the numerical surface correction.
Pass 123 replaces the guide's thin angular belly stroke with a fitted,
variable-width flowing ribbon. Attachment checks sample across its full width
in both geometry tiers. Fixed campus/close workloads submit 60.006 / 60.001
fps; these are CPU-side submission samples, not GPU-completion guarantees.
The reviewer retains the visible inlay improvement: guide craft stays 7.5,
fidelity rises to 8.0. Ensemble/room remain 7.5 / 7.5 and campus 7.0 / 7.5.
The next guide correction is the entire bulky compass assembly. A bounded,
room-wide lighting/composition study is the larger overall priority.
Production remains pass 120; no A-level acceptance is claimed.
The user's
October 14 clarification preserves chosen identities; the campus reference
sets rendering quality, not replacement character shapes. The
existing bundle-size warning remains. Pass 49's matched full-face camera check
measured 56.00 submitted scene fps with three dense avatars versus 45.29 baseline; these
are variable same-machine samples, not a GPU-completion or locked-frame-rate
claim. Mobile header mask icons were repaired without removing their labels.

Remaining work includes character primary-shape refinement, paper head/body
transitions, softer feather layers and furnishing/foliage variety. The independent
review acknowledged the clearer neutral orientations, heart-shaped owl face,
bowed book covers, visible seating and localized lantern warmth. Pass 27 adds
rounded tables and softer lantern highlights, but its review caught exposed wing
supports and roots. Pass 31 corrects those, shortens the owl's toes, adds fine leaf
veins and varies tabletop furnishings. Passes 47–52 add matte Wayfinder finishes,
continuous bird cheek planes and thinner exposed paper folds. Targeted reviews
confirm local improvements. The full pass-53 review gives portraits **8.5/10**,
campus **8.2/10** and lighting **8.3/10**. Pass 55's targeted Merchant review
gives **8.6/10**, retaining the taller torso and smaller Scout. Remaining gaps
include thick-looking paper masses, rear feather overlaps and insufficient
furnishing/botanical richness. Pass 57 softens ceramic highlights and varies
connected foliage; pass 58 adds wider tables, a guest chair and wrapped storage.
The targeted campus review remains **8.2/10**, with chair readability and hidden
storage limiting the improvement. Pass 58's matched
[noon](docs/images/surface-campus-noon.jpg) and
[night](docs/images/surface-campus-night.jpg) capture locations now contain pass
109, superseding the older campus evidence below. These refreshed captures do
not establish a new independent campus score.
Live agent actions remain the only source of work gestures and locomotion.

Pass 62 strengthens existing contact shading and lamp pools without adding
passes or lights. The fresh campus reviewer keeps craft **7.0/10** and fidelity
**7.5/10**: contact depth improves, but material richness and staging do not yet
earn another half point. Its noon campus, close Dispatch and night campus samples
submit 51.70, 50.40 and 52.30 scene fps respectively; these are variable samples,
not GPU-completion or locked-frame-rate claims.

Pass 67 wraps and tapers the paper owls' chest sheets after the independent
review rejected pass 66's flat-apron silhouette. The reviewer retains 67 over
65 but leaves Reflection at **7.0 craft / 7.5 fidelity**. Campus and Reflection
close camera samples submit 54.20 and 51.91 fps. The next visible gap is weak
warm lantern spill on neighboring folds, not insufficient triangle count.
Pass 68 strengthens the existing model light, with no extra lights or shadow
passes. Reflection craft rises to **7.5**, while fidelity stays **7.5**. Noon
and night close samples submit 53.10 and 54.40 fps; the same limitations apply.
Pass 69 adds varied storage height using real book tiers, not scaled contents.
Actual shelf anchors and all sixteen walking routes are tested. The independent
campus review retains the change at **7.0 craft / 7.5 fidelity**, identifying
lower-room seating and repeated storage as the largest staging gaps. Matching
campus and Merchant close samples submit 52.61 and 53.20 fps, with unchanged
draw counts but approximately 16,000 additional static triangles.
Pass 70 adds angled guest seating and exposes the Lantern Desk stool, with
full physical footprint and route checks. Campus craft/fidelity remain
**7.0 / 7.5**; the reviewer now prioritizes material depth. Campus and Reflection
close samples submit 50.00 and 52.90 fps. A-level acceptance remains open.

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
