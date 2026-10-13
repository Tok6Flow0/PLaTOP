# Avatar craft and local daylight

Branch: `codex/avatar-craft-local-daylight`. This is an in-progress refinement,
not an accepted claim of matching the original illustrations.

The six original team portraits in `public/portraits` are the identity references.
Actual office models generate every roster icon and team portrait in
`public/avatars`; the manifest hashes both their sources and resulting images.
Night team portraits use the same geometry under a second baked lighting setup.
The illustrated references are not substituted for live 3D models.

## Independent review history

A read-only reviewer compared frozen renders directly with the six references.
The reviewer received no requested score and no instructions to approve.

| Submission | Craft | Identity fidelity | Overall |
| --- | ---: | ---: | --- |
| Starting models | 4.3/10 | 2.7/10 | D+ |
| Pass 1 | 6.0/10 | 7.1/10 | C+ |
| Pass 2 | 6.8/10 | 7.5/10 | B− |
| Pass 3 | 7.4/10 | 7.9/10 | 7.7/10 — B |
| Pass 4 | 7.6/10 | 7.9/10 | 7.8/10 — B |
| Pass 5 | 7.8/10 | 7.9/10 | 7.9/10 — B |
| Pass 6 | 7.8/10 | 8.0/10 | 7.9/10 — B |
| Pass 7 | 7.9/10 | 8.1/10 | 8.0/10 — B+ |
| Pass 8 | 7.5/10 | 8.1/10 | 7.8/10 — B |
| Pass 9 | Pending | Pending | Independent review pending |

These are subjective visual judgments, not a pixel-similarity measurement.
Craft/fidelity columns average the six team scores when no aggregate was supplied.
The requested acceptance threshold has not yet been met. Pass 1 restored the
book keeper, robed guardians, navigator identities and folded bird. Pass 2
addresses silhouette, connected robes, shorter Scout proportions, surface-fitted
emblems, inward-facing paper surfaces, lantern framing and night integration.
The pass-2 review still finds the folded bird and paper owls too coarse, the
cape disconnected, the speech-bubble tail too subtle and several small edge
artifacts. Lighting scores 7.5/10: night is cohesive, but dawn and sunset need
stronger directional distinction. These remain open, not waived by test results.
Pass 3 joins robes and navigator capes, integrates the paper ears and folded
bird's wing, reshapes the owl's facial discs and Beacon's speech-bubble face,
and distinguishes cool dawn from amber sunset. Portrait exports are rendered
at twice their final dimensions then downsampled; this does not affect live
scene cost. All 252 tests and the production build pass for this submission.
Pass 4 reshapes Scout and Keeper, thins the navy owl's feathers, joins the
paper head and body volumes, adds Swift's swept tail, and keeps continuous
robed faces attached during real gestures. All 253 tests and the build pass.
The independent review still finds the paper construction uneven, HR cloaks
too plain, and the intake cape insufficiently dimensional. Nighttime dark
surfaces need more separation. The acceptance threshold remains unmet.
Pass 5 adds modeled hood layers, stronger amber diffusion, finer owl feathers
and facial grain, and simpler paper faces. The independent review recognizes
the illuminated Beacon as the strongest asset, but still finds stiffness in
the bird, broad geometric owl bellies, and insufficient individual posture.
All 253 tests and the production build pass; these do not override that review.
Pass 6 integrates Scout's raised magnifier arm and seated feet, Keeper's
tilted book and face panel, and Beacon's clasped forearms. It adds distinct
head posture, tucked paper feet and a notched bird wing, with a restrained
night fill lift. All 253 tests and the production build pass.
The sixth review found stronger merchant identity, but still identified
separate-looking paper heads and bodies, a rigid bird, and generic companion
clothing. It did not approve the result.
Pass 7 joins Swift's head and torso, integrates the paper owls' facial planes
into their head mesh, adds folded shoulder wings, and brings out the intake
companions' side panels and belly seams. It retains the geometry, clearance,
and gesture constraints. All 253 tests and the production build pass.
The seventh review still found the paper profiles boxy and the robe/cape
construction simplified. Pass 8 adds three-quarter/rear inspection exports,
fixes a cape that was buried inside the torso, closes its lining and rims,
and refines paper depth, inward head posture, cloth folds and ceramic finish.
Two new tests verify the cape's closed winding and clearance around the body.
All 255 tests and the production build pass.
The eighth review lowered the overall score after the added side/rear views
exposed padded book construction, abrupt neck joins, a projecting lantern face,
and feather detail limited to the front. Pass 9 adds thin covers around a page
block, deliberate collars and a shoulder-fitted cape, an actual open lantern
housing, and wrapped plumage on the body and both sides of the wings. It also
refines the bird's wing attachment and the paper heads' rear taper. Three new
tests cover the book layers, open housing and all-around plumage. All 258 tests
and the production build pass. Visual acceptance remains independently judged.

## Local-clock atmosphere

The device's local hours and minutes select a smoothly interpolated artistic
day. There is no geolocation, weather dependency or network call. The existing
sun, environment lighting, cached backdrop and bounded room fill lights are
updated, not a second animation loop. One timer waits for the next visible
minute; hidden/native-background views suspend it and reconcile on return.
An agent's explicit lamp-off setting remains authoritative. Local time never
chooses an avatar's action or reports work.

## Rendering evidence

The same isolated browser fixture was measured at 1000 × 800 CSS pixels,
1.5 render DPR (1500 × 1200 backing buffer), sixteen offline avatars, existing
depth-based contact shading, two seconds of warm-up and ten seconds of camera
orbit. No real agent activity or bridge writes are used. Asset generation and
test suites were stopped during the samples.

| Submission | Measured fps | CPU submission p95 | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 59.99 | 2.3 ms | 80 | 347,755 |
| Pass 1 noon | 60.00 | 3.8 ms | 98 | 322,883 |
| Pass 1 night | 60.00 | 3.8 ms | 98 | 322,883 |
| Pass 2 noon | 60.00 | 3.0 ms | 94 | 322,662 |
| Pass 2 night | 60.00 | 3.2 ms | 94 | 322,662 |
| Pass 3 noon | 59.99 | 3.8 ms | 86 | 319,168 |
| Pass 3 night | 60.00 | 3.8 ms | 86 | 319,168 |
| Pass 4 noon | 59.80 | 1.8 ms | 86 | 324,476 |
| Pass 4 night | 60.00 | 1.6 ms | 86 | 324,476 |
| Pass 5 noon | 60.00 | 3.0 ms | 87 | 327,218 |
| Pass 5 night | 60.00 | 2.1 ms | 87 | 327,218 |
| Pass 6 noon | 60.00 | 2.0 ms | 87 | 326,622 |
| Pass 6 night | 60.00 | 2.2 ms | 87 | 326,622 |
| Pass 7 noon | 60.00 | 3.1 ms | 87 | 328,332 |
| Pass 7 night | 60.00 | 3.2 ms | 87 | 328,332 |
| Pass 8 noon | 60.00 | 3.2 ms | 90 | 328,680 |
| Pass 8 night | 60.00 | 3.7 ms | 90 | 328,680 |
| Pass 9 noon | 60.00 | 4.7 ms | 90 | 331,008 |
| Pass 9 night | 59.99 | 4.2 ms | 90 | 331,008 |

The static scene returns to zero scheduled rendering fps. Submission timing is
JavaScript/renderer time, **not GPU time**. The measurements preserve displayed
cadence; sample-to-sample submission variation means they do not establish
identical CPU cost, native WebKit performance, battery
life, or sustained thermal behavior. Those claims would need separate evidence.
The extra portrait-only contact pass is baked offline and adds no live pass.
Optional `PLATOP_AVATAR_REVIEW_DIR` exports three-quarter/rear model views
outside the shipped asset directory; the production manifest stays at 28 images.
Character meshes remain under 9,000 triangles each and within tested motor
clearances. Grain textures and geometry are scene-owned and reused.

At 390 × 844, the dark app has equal client/scroll widths of 390 pixels. Close
zoom reveals the optional mist invitation, and both observer perspectives
switch correctly. The tested desktop console reports no runtime errors.

The dev-only `tools/graphics-lab.html` and `tools/clock-review.html?hour=23`
provide repeatable performance and screenshot fixtures. They are not linked
from the product or included as Vite production entry points. Production has
no time slider, preview activity or onlooker control of agents.
`tools/avatar-review.html` places each original portrait next to its actual
rendered models for direct day/night comparison, without connecting to chats.
