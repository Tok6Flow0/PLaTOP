# Source comparison and unseen observer review

Current result: the stricter character-level reference pass is implemented and functionally verified. The scene and portraits are closer to the supplied concept, but exact visual equivalence has not been achieved or approved. The earlier qualitative acceptance and 84/100 comparison do not establish an exact match.

## Current surface refinement checkpoint

The independent reviewer retains pass154 over153 and148 as the new working
baseline: Echo7.0 craft/6.5 fidelity, Reflection6.5/6.5, campus7.5/7.5.
Its370 tests and build pass. The tapered rear/hip and closer wing fold reduce
the separate-apron impression without sacrificing enclosed depth. The next
major mismatch is the heavy rear-under-crown and head-to-neck silhouette.
Both154 timing samples submit approximately60fps; earlier matched152/153
samples varied around57–60fps and remain in the ledger. This is neither
reference-matched nor A-level acceptance. Rejected/revision-requested studies
are preserved, and timing is CPU-side submission rather than GPU completion.

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

The pass-148 suite passes **368 tests** and the production build passes.
The pointed depth-returning wing is retained as a local repair;147's blunt
strip was rejected. Scores remain Echo **7.0 / 6.5**, Reflection **6.5 / 6.5**.
The reviewer calls for a coordinated head/torso volume study, not further
wing-tip tweaks. Campus and Reflection close samples both submit60.00fps,
with135 draws each. Earlier variable samples remain in the ledger.

The pass-146 suite passed **368 tests** and the production build passed.
Echo's longer folded torso is retained at **7.0 craft / 6.5 fidelity**;
the Reflection ensemble is **6.5 / 6.5**. The shoulder/wing relationship and
shallow side profile still need work before the design extends to Quill.
Campus/Reflection close samples submit55.70/58.51fps; CPU mean/p95 costs
are1.75/2.80 and1.71/2.80ms. Frame-pacing variability is not hidden by these
low submission costs. This checkpoint does not establish the requested A.

The pass-145 suite passed **367 tests** and the production build passed.
The reviewer retains two fuller Beacon plants at room **8.0 craft / 7.5
fidelity**, campus **7.5 / 7.5**. A fresh character-only assessment is lower:
ensemble about **7.0 craft / 6.5 fidelity**, with Reflection **6.5 / 6.0**.
These scores are retained without substituting the earlier, more favorable
judgments. The next prototype is one Reflection owl's torso/resting wing.
Campus samples varied (53.50–60.00 fps); a matched previous-plant sample
was 57.60 fps and the restored candidate was 60.00 fps. Merchant close was
60.00 fps. This is not proof of completed-GPU timing or zero regression.

The pass-144 suite passed **366 tests** and the production build passed.
The reviewer retains the thicker, rounded shell at campus **7.5 craft /
7.5 fidelity**. An experimental material that caused visible bands was
removed; the accepted finish is unchanged. Campus/close samples submit
59.60/60.00 fps. Minor skirting ticks remain; the next high-impact study is
fuller, vertically varied planting in Beacon. Production serves accepted143,
with window, zoom, both mist views, exit/reset and the empty bridge verified.

The pass-143 suite passed **364 tests** and the production build passed.
The independent reviewer retains the cabinet correction at Lantern Desk and
campus **7.5 craft / 7.5 fidelity**, with visible shelves and credible framed
sides. All three fixed samples submit about 60 fps; the 8,400 additional
triangles add no draw calls in those samples. The architectural shell's thin,
uniform profiles are the next campus-wide study. This is not A-level approval.

The pass-142 suite passed **363 tests** and the production build passed.
The tighter Lantern Desk group is independently retained at **7.5 craft /
7.5 fidelity**, as are Dispatch's softened tabletop corners. The right
bookcase's plain exposed back needs revision; this is a mixed-positive
checkpoint, not full acceptance. Campus and Dispatch stay 7.5/7.5. Campus,
Merchant close and additional Lantern Desk close samples submit about 60 fps;
counts and limits are in the ledger. Production remains accepted pass 141,
whose window/zoom/both mist perspectives/exit/reset smoke passed with an empty
connected bridge, all six teams Awaiting update and no console warnings/errors.

The pass-141 suite passed **362 tests** and the production build passed.
The joined desk extension is independently retained at campus **7.5 craft /
7.5 fidelity**. Clear Path is 7.5/7.5, Wayfinders 8/8, Beacon 8/7.5, Lantern
Desk 7/7 and Dispatch 7.5/7.5. Dispatch's squared corners need a restrained
softening; Lantern Desk's oversized grouping is the next major study.
Campus/Merchant/Wayfinder close samples submit 60.00/59.60/59.90 fps, with
counts, evidence boundaries and CPU timings in the ledger. This is not A-level
or exact-reference acceptance.

The pass-140 suite passed **361 tests** and its production build passed.
Merchant's thin-top/recessed-rail desk is independently retained at **8.0 craft /
8.0 fidelity**; campus stays **7.0 / 7.5**. Initial campus/close samples of
58.70/59.29 submitted fps and unchanged repeats of 60.00/60.01 are all retained
in the ledger. Draw counts are unchanged and triangle counts fall by 124.
Separate shape/support checks are required before extending the construction.

The pass-139 suite passed **360 tests** and its production build passed. The
independent reviewer retains Beacon's separated cabinet/plant stand and joined
reading nook at **7.5 craft / 7.5 fidelity**; campus remains **7.0 / 7.5**.
Its unchanged neutral character and matched night views show no significant
regression. Campus, Merchant close and additional Beacon close timing samples
each submit about 60 fps, with the added draws and capture limitations recorded
in the ledger. Merchant's heavy desk apron is the next construction study.

The pass-138 suite passed **358 tests** and its production build passed. Close
contact shading now follows the camera selection before worker meshes arrive;
the existing denoiser texture receives deterministic noise at construction.
Two independent fixed Dispatch daylight reload captures are byte-identical.
The independent reviewer retains the consistency fix with no score increase:
Dispatch 7.5 / 7.5 and campus 7.0 / 7.5. Campus, Merchant close and Dispatch
close each submit about 60 fps; CPU timings and limitations are in the ledger.
The isolated production smoke now serves accepted pass 137: office window,
close zoom, third/first-person mist, exit and reset pass without console
warnings/errors. All six teams remain Awaiting update; this is not live-agent
adoption evidence.

The pass-137 suite passed **356 tests** and its production build passed. Its
corrected Swift placement is retained, with a clearer desk-side pairing and
no conspicuous new overlap. All three fixed camera samples submit about 60 fps.
The earlier
Dispatch prototype's rug, cabinet and planting are retained at **7.5 craft /
7.5 fidelity**, but Swift's side placement requires revision before the whole
grouping is accepted. Campus remains 7.0 / 7.5; its camera sample submits
59.9994 fps, Merchant close 59.80 fps and additional Dispatch close 60.0054 fps.
The earlier pass-135
floor material study is retained: narrower timber modules and quiet relief
improve the exposed margins without a significant night regression. Campus
remains **7.0 craft / 7.5 fidelity**. Fixed campus and close workloads submit
60.0006 and 59.40 fps respectively; CPU cost and additional draws are recorded
in the ledger. The earlier
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
Pass 124 rebuilds the guide compass as a thin bezel, navy dial, shallow rose
and attached clasp. An exact-meridian ray miss found during inspection is
fixed before final capture, with full bezel/dial coverage guarded in both
mesh tiers. Both fixed camera workloads submit 60.00 fps. The reviewer retains
the cleaner pendant at unchanged overall grades, finding no visible fitting
regressions in the five other team portraits. Its next priority is a compact,
asymmetric Wayfinders workstation cluster with genuine circulation around it.
The isolated production preview now serves accepted pass 124, with window,
close zoom, first/third-person mist, exit and reset verified. Its empty local
bridge connects with all six teams Awaiting update; no console warnings or
errors appear and no agent activity is injected.
Pass 125 clusters the two Wayfinder desks and neutral homes on a fitted rug.
The center is genuinely blocked; a full-size visiting owl can use the outer
route. All 32 navigation checks pass. Fixed camera samples remain about 60
submitted fps. The reviewer retains the cluster at 7.5 craft / 8.0 fidelity;
campus remains 7.0 / 7.5. Its next priority is daylight form and material
hierarchy with this layout locked, not further furniture nudging.
Pass 126's warmer noon key and reduced fill are retained as a modest
improvement at unchanged scores, without altered camera/exposure/direction.
Both fixed camera workloads submit 59.9994 fps; night is unchanged. The
reviewer prioritizes coherent cabinet construction and varied recessed storage
over further lighting adjustments. Production remains accepted pass 124.
Pass 127's joined cabinets, recessed contents and framed drawers are retained,
raising Wayfinders room craft to 8.0 with fidelity 8.0; campus remains 7.0 / 7.5.
All 33 navigation checks pass and fixed camera samples remain approximately
60 submitted fps. The next priority is fuller curved foliage at the existing
pots, not more guide details or tiny lighting changes.
Accepted pass 127 now serves the isolated production preview, with window,
zoom, both mist perspectives, exit and reset verified without console errors.
Pass 128's fuller cabinet-top crowns are retained, but its broad foreground
crown is rejected as overpacked and rubbery. This is a mixed prototype,
not an accepted production upgrade. Room stays 8.0 / 8.0 and campus 7.0 / 7.5.
Both fixed camera samples remain about 60 submitted fps. The next correction
is gentler cupping, branching gaps and upward tips on the broad crown.
Pass 129 makes that correction and is retained over 128 and 127. Room remains
8.0 / 8.0; campus remains 7.0 / 7.5. Campus, Wayfinders close and the new
Merchant close baseline each submit 60.00 fps in their fixed samples. A
reviewer's possible Clear Path plant change was checked: all default plant
geometry/transforms are byte-identical across the revision. The next priority
is Merchant's storage, not another dedicated foliage iteration.
Pass 130 retains distinct joined Merchant cabinets at room 7.5 / 7.5 and
campus 7.0 / 7.5. Both matched camera samples submit 59.9994 fps. The next
priority is Merchant workstation integration: an existing chair band obscures
Scout's lower torso, side residents feel detached and the foreground rug is
oversized. This needs inspection without assuming an intersection from pixels.
Pass 131 retains a fitted low Scout chair and tighter Merchant grouping:
room 7.5 craft / 8.0 fidelity, campus 7.0 / 7.5. The first campus sample is
58.90 fps, its unchanged repeat 60.00, and the close sample 60.00; all are
recorded. Pass 132's modeled Merchant wall panels are a mixed prototype.
Their construction gain survives campus scale, but seams look too dark and
occasionally ragged. The reviewer requires correction before extension or
production adoption, with unchanged grades. Campus/close samples submit
60.00/59.90 fps. Production remains accepted 127; no A is claimed.
Pass 133 corrects the crack-like seams with smooth rolled shoulders and is
retained at unchanged grades. Its campus/close samples are 60.00/59.90 fps.
The reviewer approves cautious extension to darker walls, then prioritizes
floor/architectural material identity. Accepted 133 now serves the isolated
preview: window, close zoom, both mist views, exit/reset and an empty connected
bridge pass, with all teams Awaiting update and no console warnings/errors.
Pass 134 extends the accepted joinery to the other four enclosed offices.
The reviewer retains each darker finish with no significant regression;
campus remains 7.0 / 7.5. Fixed camera samples stay about 60 fps. The next
study targets uniform checkerboard-like exposed flooring, holding lighting
and furniture fixed. Production remains accepted 133.
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
