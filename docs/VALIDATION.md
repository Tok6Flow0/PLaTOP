# Initial build validation — 2026-10-12

## Visual review

An independent critic compared matched 1536 × 1024 screenshots against the supplied starting-office concept through six numbered iterations. Its final subjective resemblance assessment was approximately **84/100**: layout 88, camera 89, materials/lighting 76, props 82, characters 78, chrome 92. This clears the user's requested lower threshold, not pixel identity or a claim of 100% accuracy. Remaining differences include fine textures, foliage variety and more varied seated poses.

The selected ambient light intensity is 1.45. A controlled lighting A/B verified actual scene intensities and different image hashes; the final actual-source render matched the selected image. An earlier byte-identical A/B was rejected and not used for the decision. Local comparison images and detailed critique remain in ignored `art-direction/critique/`.

Reviewed GLBs enabled in `public/assets/approved.json`: `support-beacon`, `email-owl`, `reflection-echo`, `reflection-quill`. Other characters use editable reference models. All sixteen delivered files pass embedded-resource, four-clip and size-ceiling checks. Approved files are 229–298 KB and approximately 8,336–9,260 triangles each: below the 512 KB target, above the initial 2,500-triangle target. The models have not been presented as meeting that geometry target.

## Functional evidence

- 31 Node tests pass: bridge state/auth/origin/closed schema, static path safety, SSE and expiry, private storage, CLI direct argument handling and exit behavior, delivered GLB contracts and approval references.
- Production TypeScript/Vite build passes. Vite reports one approximately 566 KB Three.js chunk warning; it is not a build failure.
- Exact camera reset, all six room selections, drag versus click suppression, focused keyboard controls, bounded pan, 35–65° tilt, bounded dolly zoom and pointer anchoring pass browser runtime checks. Cursor-anchor drift was below 0.001 world units in the test. Real touch input verifies one-finger pan and two-finger pinch/orbit.
- Render probes verify active/input intervals of at least approximately 43 ms and sleep intervals of at least approximately 251 ms. Settled neutral, paused, reduced-motion and hidden states schedule no animation frames. Active pixel ratio is capped at 1.5, static/sleep at 1. These are renderer observations, not device CPU/GPU benchmarks.
- Empty visual approvals request no character models. The final approved set requests only four GLBs. Missing assets retain the reference character; external-resource GLBs and unsafe paths are rejected. Disposal removes canvas, timers, listeners and resource ownership.
- The AppKit bundle compiles and its plist validates. The native WKWebView visibly renders the connected office. Native minimize followed by Open Playground restores the window. Hidden/minimized visibility signaling is covered by the browser runtime probe; native GPU usage was not separately profiled.
- The frontend state reader accepts the bridge's initial null timestamps. Selection and saved decorations work. The Vite development proxy returns both state and SSE data.

## Operating limits

The installed `platop` skill publishes bounded native observations and command heartbeats. It does not install automatic background native chat monitoring, start the six chats, or change their business workflows. Active signals expire without heartbeats; explicit idle snapshots retain their last report time. Preview is simulated.

The Mac companion is a local developer bundle. No login item, notarized installer, Windows/Linux native shell or cloud deployment has been installed. The browser application is portable. Additional decor source deliveries exist but are not automatically enabled in this first app integration. The initial graphics snapshot excluded the optional recording-derived voice package; Claude subsequently published its separate sound/name delivery in `aa78e37`. This follow-up preserves that delivery; asset metadata keeps generic preset names and no audio starts automatically.

Private selected-chat mappings, tokens, status storage, cross-agent local handoffs and review benches are excluded from the public repository. Public files contain curated character art, code and documentation.

## Full screen, navigation, window view and performance follow-up

The follow-up replaces the initial 24/4 fps animation budgets with 48 fps for
active campus animation, 24 fps for an active close-up office and 8 fps for
sleeping scenes. Camera input has a separate 60 fps ceiling. Hidden, paused and
reduced-motion scenes still stop continuous 3D rendering.

A matched Chromium **ANGLE Metal / Apple M4** test used a 992 × 890 scene host,
DPR 1, the same six rooms and approved models, and five-second sample windows.
The baseline was the initial public-main implementation. Fixed-24-fps runs
compare frame cost; a separate 48-fps run measures the new visible cadence.

| Measurement | Initial build | Optimized build |
| --- | ---: | ---: |
| Draw calls per frame | 879 | 211 |
| Triangles per frame | 389,602 | 304,738 |
| Median CPU frame submission, fixed 24 fps | 4.0 ms | 1.7 ms |
| Median renderer CPU submission, fixed 24 fps | 3.8 ms | 1.4 ms |
| Observed active cadence, original/new budgets | 22.60 fps | 45.27 fps |

The cadence increased by approximately 100%; fixed-cadence CPU frame submission
fell by 57.5%. These are local browser renderer measurements, not proof of a
95% whole-application speedup, native WKWebView frame rates, battery savings or
GPU execution time. An earlier software-rendering baseline was retained only
as a diagnostic, not substituted for the hardware test.

Static matte surfaces now share materials using baked linear vertex colors;
repeated character parts share instanced draws. Small environmental details use
lighter geometry. Independently viewed matched environment screenshots retained
the approved appearance: the detail-only pass had a mean RGB difference of
0.021/255 and 99.47% identical pixels. Walls, decorations, lighting and hero
character shapes remain separately controlled.

Window view uses a locked near-eye-level camera in the live scene. It renders
only the selected office, cycles every two hours, and supports manual room
selection. Rain/snow on glass use at most sixteen CSS elements; no additional
JavaScript animation loop is installed. Weather requires a chosen city or
explicit device-location request, refreshes model conditions every fifteen
minutes while visible, and handles provider failure without blocking the office.
Seven new provider/protocol tests bring the Node suite to **38 passing tests**.

Final native runtime checks verify full screen, full screen to desktop background,
and **⌘O** restoration without reloading the page. Selection survives, Next and
Weather controls respond after restoration, and Exit window view returns to the
campus with working Move/Rotate controls. Desktop mode uses a separate borderless
window and transfers the same WKWebView, avoiding AppKit input routing failures
caused by changing a click-through window's style in place.

An independent follow-up review passed ten focused browser checks, including
desktop/mobile layouts, two-hour cycling, locked idle cameras, exact campus
camera restoration, reduced-motion/hidden rendering stops, and weather failure
handling. Weather/rain and native message routing were simulated in those browser
checks; native window transitions were separately exercised on the Mac. Another
27 renderer checks verified camera bounds, all six selections, visibility and
disposal. A laptop naturally obscures one center character in some close-ups;
the fixed idle composition is not presented as a perfect view of every face.

The native device-location flow was exercised against macOS Location Services:
the system permission dialog was accepted, the one-shot fix returned an
approximate area, and real provider weather displayed its update time. The
completed developer app is ad hoc signed with the stable bundle identifier and
both location usage descriptions; this is not notarization. Coordinates are
rounded before the native-to-web response and remain in local browser storage,
not repository files. Permission waiting is bounded at ninety seconds, followed
by a twenty-second fix deadline, with cancellation and visible progress.

## Cinematic motion and local privacy follow-up — 2026-10-12

The renderer now uses display-synchronized `requestAnimationFrame` with a
30 FPS animation target and coalesced input up to 60 FPS. The device's current
display runs at 60 Hz, so it cannot present 102 distinct frames per second.
Sleeping and close-up scenes share the 30 FPS cadence; hidden, paused and
reduced-motion scenes stop continuous rendering. Actors ease into and out of
travel, turn at a bounded rate, and blend procedural joints and authored clips.
Inactive transitions receive a bounded settling period before static rendering.

The production build was exercised in native WKWebView at 1920 × 1080 full
screen on Apple M4. Both the sleeping office and simulated active campus
reported **30.0 FPS**, median render-start interval **33 ms**, p95 **34 ms**,
maximum **35 ms**, and zero intervals above 50.5 ms in the recent 120-interval
sample. Native pause changed the target to zero and cleared timing samples.
These are recent renderer timings, not GPU execution times or a guarantee of
presentation under every workload. The opt-in Control–Option–P overlay holds
only bounded numbers in memory; it saves and sends nothing.

A separate matched Metal browser comparison measured old sleeping cadence
7.87 FPS versus 29.49 FPS. Headless Chromium's own refresh clock was irregular,
so its frame spacing was not used to claim native smoothness. Tested maximum
position jumps fell from 34.5 cm to 3.65 cm, and heading jumps from 77.4° to
4.69°. Those are maxima from the sampled motion windows, not universal bounds.
Nine focused camera/lifecycle checks passed. Matched static renders preserved
the reviewed appearance: mean RGB difference 0.111/255, 99.23% identical pixels.
Seventeen additional targeted assertions verified both deferred-settling
orderings, completion of Idle fades, authored clip phase across pause/resume,
and stopping diagnostic collection when its query-opened panel is closed.

The public-file review covered 139 tracked files and 160 unique history blobs
without finding personal filesystem paths, private chat IDs, credential patterns
or actual device coordinates. The bridge additionally rejects cross-site browser
requests without Origin headers and hidden build files. Two regression tests
reproduced the old failures before passing with the fixes. The Node suite now
passes **48 tests** and the production TypeScript/Vite build succeeds. Optional
live weather remains an external provider request, explicitly described in
[PRIVACY.md](PRIVACY.md); the playground and activity bridge remain local.

## Renderer efficiency and local activity follow-up — 2026-10-12

The final renderer preserves the cinematic 30 FPS cadence. It caches static
transforms and colors, freezes unbound authored mesh leaves, skips fully
represented render subtrees, and combines compatible moving geometry when
`WEBGL_multi_draw` is available. Actor floor contacts share one draw while
preserving the original transparent painter order. Static furnishings and
cutaway wall fades retain their existing render paths.

The canvas now uses an explicitly created opaque WebGL2 context with native
MSAA. A cached sRGB background reproduces the warm workspace gradient, including
the heading offset; window view keeps its original solid background. Rendering
uses one scene pass without a framebuffer copy or FXAA. The scene pixel-ratio
cap is 1; interface text keeps native density. This reduces Retina backing pixels
but can soften very small in-room details compared with the previous 1.5 cap.

At matched DPR 1, fixed-pose comparisons with committed baseline `bfbcee8`
retained the original colors, shading and lamp glow: campus mean RGB difference
was 0.0175/255; HR and Beacon were 99.985% and 99.990% pixel-identical. Motion,
pause, hidden-window stopping, resize, context recovery and disposal passed.
Context recovery retains a pre-existing transient VSM cleanup warning also
reproduced on the baseline; visible recovery succeeds with no steady GL errors.

Native CPU comparisons used the same full-screen window, 30 FPS target,
diagnostics closed, and three 13-second samples following a 20-second warmup.
The values below sum CPU time for the app, its WebContent process and its GPU
process, expressed as a percentage of one CPU core. They are not GPU execution
time, whole-machine utilization or battery measurements.

| Native view | Baseline median | Final median | Observed reduction |
| --- | ---: | ---: | ---: |
| Simulated active campus | 37.98% | 36.35% | 4.3% |
| Sleeping Beacon window | 25.20% | 23.35% | 7.3% |

Samples varied and overlapped. **The requested additional 20–30% CPU reduction
was not demonstrated.** Changes that altered lamp compositing or increased
sampled CPU work were excluded. Native timing still showed 30.0 FPS, median
33 ms, p95 34 ms, maximum 35 ms and no intervals above 50.5 ms in the recent
120-interval sample; this measures render starts rather than guaranteed display
presentation.

The dependency-free local stdio MCP exposes only status and closed-vocabulary
activity updates through the authenticated loopback bridge. Tests cover
initialization, tool validation, bounded messages/responses, redirect rejection,
private-data rejection and recovery. Six local automations retain their business
instructions and schedules while reporting active/heartbeat/sleeping/waiting
states through the PLaTOP skill, preferring MCP with a CLI fallback. Fresh native
chat observations were published and read back through the registered MCP.
Existing chats have not yet loaded the new registration; the CLI fallback
remains available until the host reloads it. No private chat IDs, token,
coordinates or personal paths are included in the repository.

The launcher now verifies deterministic source and output fingerprints before
reusing frontend files and updates the existing native bundle in place. At that checkpoint, the
Node suite passes **84 tests**, the production TypeScript/Vite build
succeeds, and independent correctness/privacy reviews found no material issue.
The updated ad hoc signed native bundle passes strict signature verification.
The previous app, GPU and WebContent processes exited before relaunch; the new
instance loaded the fingerprint-verified frontend, repeated the 36.35% campus
CPU median and the reported 30 FPS timing, and was left in the live Beacon
desktop-background view with preview and diagnostics off.

## Additional renderer and lifecycle measurements — 2026-10-12

Compatible rigid character surfaces now share merged geometry across offices,
with per-part transform, linear-color and surface-factor palettes. Static
surfaces also share compatible draws: ordinary meshes keep CPU-composed
view/normal matrices, while former instances retain their original Float32
world transforms and normal path. The renderer uses ordinary draws on devices
with or without `WEBGL_multi_draw`. Transparent effects, source picking,
authored animation, and cutaway wall fades retain their existing paths.
Original models retain ownership of their source resources; rebuild and
disposal release only the combined resources.

Deterministic Metal comparisons against `dceec86` covered 33 views and 76
animation states. Every view was at least 99.95685% pixel-identical; the largest
mean RGB difference was 0.001415/255. Differences were sparse edge/occlusion
pixels, with no reviewed feature regression. Supported and extension-disabled
candidate images matched exactly. All 76 sampled actor matrices and clip states
matched both references; 23 functional and lifecycle checks covered hidden-office
return, individual parts, current colors, picking, pause/hidden states, context
recovery and disposal, with no steady GL errors. The global grouping alone
changed steady campus submissions from 100 to 83; Beacon stayed at 21.
View-change shadow refreshes were measured separately. Against the preceding
mixed batching checkpoint, all views were at least 99.99513% identical.

Ten canonical flat mapped wall planes now use a single transparent pass, retaining
DoubleSide lighting, opacity, depth and painter order. All 33 standard views and
six corrected front/back/grazing views were pixel-exact against the preceding
renderer. Unsegmented, unchanged planes and stock materials are required;
volumes, edited geometry, custom shaders and mixed material users retain the
original path. This removed ten steady campus submissions and two in Beacon.

Twenty-one immutable canvas-textured planes share three sRGB texture arrays.
Their original linear mip filters, anisotropy, UVs, source pixels and alpha tests
are retained in color and VSM shadow shaders. Repeat textures remain separate.
The bounded pool reuses copies across rebuilds and disposes only owned copies;
unavailable pixels or insufficient texture capabilities keep the original draws.
The current arrays retain 21.36 MiB of CPU pixel copies and approximately
28.48 MiB of GPU mipmapped data. The base-copy budget is 24 MiB; this is not a
measurement of whole-process memory or a claim of zero allocation overhead.

Final array comparisons covered 44 views: the original 33, six corrected wall
angles and five surface close-ups. Against the pre-array renderer every view
was at least 99.99672% pixel-identical; maximum mean RGB difference was
0.000014/255, with no reviewed feature regression. Extension-disabled output
matched exactly, and capability-zero fallback matched the reference exactly.
All 76 animation states and 32 functional/resource checks passed. Runtime
compilation exercised color and VSM depth shaders; the distance-shader hook has
source/unit coverage because the scene has no point-light shadow pass.
Steady submissions are now 55 for campus and 18 for Beacon, down from 100 and
21 in the reference build. Texture source-pixel equality, cutouts, hidden-room
return, context recovery, rebuild reuse and owned-resource disposal passed.

An offscreen static-room cache was prototyped and rejected. Plant/shelf edges
showed visible color/occlusion errors despite valid GPU calls. No offscreen room
cache, additional framebuffer allocation, or cache fallback is included.

Native measurements used the same app, GPU-process and WebContent launch
identities, fixed preview activity mix, DPR 1, opaque MSAA and cinematic 30 FPS
budget. Fullscreen campus retained a 1244 × 840 scene buffer; the fullscreen
Beacon office used 1920 × 1080. Diagnostics and QA GPU work were closed during
CPU sampling. Cumulative process counters were converted using the host Mach
timebase, bound to launch identities and exact frontend fingerprints, and
sampled in three 13-second windows after a 26-second warmup per capture.
These are group CPU percentages of one core, not whole-machine CPU, GPU
execution, power or battery measurements.

The restored reference campus medians were 34.32%, 33.67% and 34.12% of one
core. The final renderer's campus medians were 26.29% and 26.98%. Comparing
median capture values gives a 21.9% reduction (34.12% to 26.63%); the two
matched comparisons were 23.4% and 20.9%. Capture-to-capture variation remains. The matched
fullscreen Beacon office median fell from 21.12% to 19.55%, a 7.5% reduction. The campus
measurement meets the additional 20% target; this does **not** establish a
20–30% reduction in every view or a matched desktop-background measurement.

Separate recent-window native diagnostics for both final views reported
30.0 FPS, median 33 ms, p95 34 ms, maximum 35 ms and zero frames above
50.5 ms. These diagnostics measure renderer timing, not guaranteed display
presentation or GPU execution. The local 60 Hz display cannot present 102
unique frames per second.

Two reload races were also reproduced and fixed. A failed initial state request
or late successful initial state request can no longer overwrite a newer
activity stream state; actual stream errors still disconnect and fresh valid
events recover. Native fullscreen state is persisted and reconciled after listeners attach, including an event arriving
between React render and effect setup. Twelve focused regression tests cover both
races, late successful responses, real errors, recovery, unmount cleanup and
browser fullscreen behavior.
The relevant race tests fail against the preceding implementation.

All six existing automation prompts still invoke the PLaTOP skill, prefer its
registered local MCP and retain the CLI fallback. Genuine intake and email runs
were observed publishing active and sleeping updates through that fallback.
Registered stdio MCP initialization and status readback succeed; registration
alone does not prove that existing chats have loaded its tools. Schedules,
notification settings and business authority were preserved.

The final local suite passes **118 tests**, the production TypeScript/Vite build
succeeds, and independent visual, renderer-resource and privacy reviews found
no material issue. The existing native app bundle was rebuilt and updated in
place, passed strict ad hoc signature verification, and loaded the final
fingerprint-verified frontend after the preceding processes exited. No duplicate
installed bundle was found.

After matched sampling, the final app was restored to the live Beacon desktop
background with preview and diagnostics off, animation unpaused and the local
status bridge connected. Temporary QA browsers and preview servers were closed;
the live bridge and updated native instance remain running.

## Further hidden-office rendering reduction — 2026-10-12

The reference for this round is `364db94`, including the improvements above.
Hidden actor roots now skip per-surface scans, while individual visible parts
retain their current transforms, colors and visibility. Static and dynamic
palette geometries restrict their draw ranges to the first and last visible
parts. Internal gaps retain shader clipping; authored geometry, transform math,
normal modes, source picking and ownership remain intact.

Cloned, unmapped stock-shader inputs omit unused UV/tangent attributes and
disabled vertex colors. Palette compatibility ignores an unused normal-map
scale, while original mesh grouping retains it to preserve the original normal
mode. Mapped inputs, active vertex colors, custom attributes and unsupported
materials retain their existing paths. This consolidates dynamic palettes from
eight to five groups. Steady campus draws fall from 55 to 52. Beacon keeps 18
draws but submits 36,688 triangles instead of 174,968 (79.0% fewer); its static
palette elements fall from 405,438 to 69,174 (82.9% fewer). These geometry counts
are not CPU or GPU execution-time measurements.

Independent deterministic Metal comparisons covered 44 views: every view was
at least 99.997508% pixel-identical to the reference, with at most 22 changed
pixels and maximum mean RGB difference 0.001316/255. Reviewed differences were
isolated owl eye/beak overlap samples, with no shape, color, shadow, floor or rug
regression. Extension-disabled output matched the candidate exactly. Seven
additional actual production-bundle comparisons corroborated the result.
All 76 sampled actor states matched exactly, and 35 functional/resource checks
passed, including draw-range coverage, hidden-office return, current matrices,
part visibility, picking, context recovery and disposal.

Native CPU comparisons used the same app, GPU-process and WebContent launch
identities, fixed preview activity, DPR 1, opaque MSAA and cinematic 30 FPS.
The window was 1712 × 778 CSS pixels; campus rendered at 1109 × 538 and the
Beacon window at 1712 × 778. Dimensions were checked before and after each
capture. Diagnostics and QA browsers were closed during CPU sampling. Each
capture used a 26-second warmup and three 13-second cumulative-counter windows,
with exact frontend fingerprints. An earlier comparison with uncertain window
size was excluded. CPU values below sum the three processes as a percentage of
one core; they do not measure whole-machine CPU, GPU execution, power or battery.

Initial matched capture medians fell from 29.04% to 27.62% for campus (4.9%)
and from 20.91% to 19.16% for Beacon (8.4%). A subsequent reference repeat was
excluded because the app changed into Desktop Background before its post-capture
view check. These are initial matched results with capture-to-capture uncertainty,
not a matched desktop-background comparison. This round has **not established the
requested
additional 20–30% CPU reduction**. Geometry savings must not be presented as that
CPU result. Broader matrix caches and timer-based frame scheduling were avoided
because earlier trials regressed CPU or fractional-refresh frame pacing.

Recent-window candidate native diagnostics reported 30.0 FPS, median 33 ms,
p95 34 ms, maximum 37 ms for campus and 35 ms for Beacon, with zero intervals
above 50.5 ms. These measure renderer timing, not guaranteed display presentation.
The production build succeeds and all **125 tests** pass.

All six existing automations are active and retain the PLaTOP skill, MCP
preference, CLI fallback, activity heartbeats and final-state updates. Fresh
support and email runs successfully published genuine wake and sleep updates
through the fallback. Local stdio MCP initialization, tool listing and bridge
status readback succeed; existing chats still require a host refresh to load
those registered tools. No business workflow was triggered for testing, and no
schedule, notification preference or business authority was expanded. Private
chat mappings, tokens, raw process measurements and location remain local.

The existing native bundle retains its current executable and passes strict
signature verification. The final frontend was updated in place and its served
fingerprint matches the current source and build. One installed PLaTOP bundle
was found, with one running app instance. After sampling, the final build was
restored to the live Beacon desktop background with preview and diagnostics
off and animation unpaused. Temporary GPU QA browsers and preview servers were
closed; the live bridge and updated native app remain running.

## Shared moving matrices and sleep resources — 2026-10-12

This round uses `5a3ba0d` as its reference. Compatible moving palettes now share
one matrix texture with disjoint integer offsets; geometry and color IDs remain
local. Color, depth and distance shaders use the same offsets. Static camera
and normal palettes retain their original math. The shared texture has one
owner and is released once on rebuild or disposal. Sleep sprites now lazily
share one immutable material and canvas texture within each scene, preserving
their individual transforms, centers, visibility, ordering and cleanup.

Actual moving-matrix uploads fall from five to one per campus frame and three
to one in Beacon. Corresponding matrix bytes fall from 32,768 to 25,600 and
29,440 to 25,600. All-sleeping campus label texture binds fall from twelve to
one; sprite draw counts remain twelve. Beacon uses an authored sleep effect,
so it gains no sprite reduction. These counts are not CPU measurements.

The matrix change matched all 44 deterministic views exactly, including the
extension-disabled path, seven production views and forced depth/distance
shadow probes with actual offset-uniform readback. The isolated shared-label
change matched 48 views exactly. All 76 sampled actor states remained exact.
Fourteen final production views matched the atlas reference exactly, covering
campus and all six offices in neutral and sleeping states. Context recovery,
pause/hidden/resume, resource disposal and renderer-error checks passed. All
**128 tests** pass, and the production build and independent source/output
fingerprint checks succeed.

Native CPU captures used the same app, GPU-process and WebContent launch
identities, fixed preview activity, 1712 × 778 window viewport, 1109 × 538
scene buffer, DPR 1, opaque MSAA and 30 FPS. Dimensions and view were checked
before and after captures. Diagnostics and QA browsers were closed. Each
capture used a 26-second warmup and three 13-second cumulative-counter windows
bound to its exact build fingerprint. CPU percentages sum those three
processes as a percentage of one core; they exclude whole-machine CPU, GPU
execution time, power and battery.

The initial reference/atlas medians were 28.88% and 28.57%. The final candidate
measured 30.25%; an immediate reference repeat measured 30.59%, approximately
1.1% higher. Reference drift and overlapping sample ranges make this a small
preliminary result. **The requested additional 20–30% CPU reduction is not
established.** A pixel-exact ordered-wall experiment reduced campus draws by
ten but showed no reliable native CPU benefit, so it remains private. An
occlusion-paused fullscreen capture was excluded.

Recent final native timing reported 30.0 FPS, median 33 ms, p95 34 ms and maximum
35 ms, with zero intervals above 50.5 ms. These are recent renderer timings,
not guaranteed display presentation. The existing signed native bundle is
updated in place through its fingerprint-verified frontend; only one installed
bundle and one running instance were found.

All six automations remain active and invoke the PLaTOP skill, prefer local
MCP, retain the working CLI fallback, and report heartbeats and final states.
Local stdio initialization, tool listing and bridge status readback succeed.
Existing chats still need a host refresh to load the registered MCP tools;
computer-use access to Codex settings was blocked. No business workflow was
triggered for testing, and no schedule, notification or authority was changed.
Private mappings, tokens, raw captures and location remain local. Temporary QA
browsers and servers are closed; the live bridge remains running.

## Native CPU follow-up and local frame diagnostics — 2026-10-12

This round uses `64102e2` as its reference. The final renderer, actor animation,
matrix publication and sleep-label paths retain that reference's behavior. The
only shipped code change expands the existing optional motion panel with recent
actor, batch, contact, renderer submission and total JavaScript wall times,
draw/triangle counts and authored/proxy model counts. Fixed buffers hold at most
120 animated frames. Stage clocks, collection and summaries run only when the
panel is enabled; buffers and fields clear on disable, visibility/cadence reset
and disposal. Nothing is persisted, sent to the bridge or transmitted externally.
These wall times include command submission and are not process CPU or GPU
completion measurements.

Native captures used the same app, GPU-process and WebContent launch identities,
fixed preview activity, a 1712 × 778 window, 1109 × 538 scene buffer, DPR 1,
opaque MSAA and the cinematic 30 FPS cadence. Diagnostics were closed during CPU
sampling. Each capture used a 26-second warmup followed by three 13-second
cumulative CPU-counter windows, bound to its exact source/output fingerprint.
Views and dimensions were checked before and after sampling. QA browsers,
builds and other owned heavy jobs were stopped during captures. Values sum the
three app processes as a percentage of one CPU core, excluding whole-machine
CPU, WindowServer, GPU execution time, power and battery.

| Build or private trial | Median CPU, one core | Decision |
| --- | ---: | --- |
| Reference, initial / repeated | 27.88% / 28.10% | Retain renderer |
| Matrix publication and actor-loop cleanup | 28.91% | Reject |
| Cleanup plus sleep-sprite instancing | 29.12% | Reject |
| Isolated sleep-sprite instancing | 29.22% | Reject |
| Static translation uniforms | 27.95% | No reliable reduction; reject |
| Selective actor TRS/world updates | 29.38% | Reject |
| MSAA disabled | 28.28% | No reduction; reject |
| Final, diagnostics disabled | 28.20% | CPU effectively unchanged |

**The requested additional 20–30% CPU reduction is not established.** A 20% cut
from the repeated reference would require at most 22.48% of one core. Lower
draw counts and fewer matrix operations were not accepted as CPU savings.
All rendering experiments remain private and are absent from the final source.

Several rejected trials passed extensive visual checks: sleep-sprite instancing
and selective transforms matched 44 deterministic views and 76 actor states
exactly; the static-uniform trial changed at most 67 edge pixels out of 882,880.
Their rendering or operation-count reductions did not establish a practical
native CPU benefit. Final native timing reported 30.0 FPS, median 33 ms, p95
34 ms, maximum 35 ms and zero intervals above 50.5 ms. These are recent renderer
intervals, not guaranteed display-presentation timings. All 128 tests and the
production build pass.

Final diagnostics-only QA matched 14 neutral/sleeping campus and office images
pixel-for-pixel against `64102e2`, with all 76 deterministic actor states and
draw counts unchanged. Eighteen focused checks passed, including finite enabled
metrics, reset after pause/visibility changes, field removal on disable,
no metric-attribute writes while disabled animation progresses, fresh buffers
on reenable and disposal cleanup. No GL or runtime errors occurred. Temporary
QA browsers and preview servers were closed afterward.

All six existing automations remain active, invoke `$platop`, prefer the local
MCP tools and retain the working CLI fallback with active heartbeats and final
states. Fresh native chat observations were published through that fallback;
unloaded chats were marked unknown. The native app visibly confirms its local
status bridge connection with preview off. Local stdio MCP initialization,
tool listing and status readback succeed, but the registered tools are still
absent from existing chat tool inventories. A host refresh is still needed;
registration alone is not evidence that those chats loaded MCP. No business
workflow, message, schedule, authority or notification setting was changed.

One installed PLaTOP bundle and one running app instance were found. The existing
native executable passes strict signature verification and is updated in place
through its local frontend. Private mappings, credentials, raw measurements and
location remain outside version control.

## Connected office, agent motor skills and desktop isolation — 2026-10-13

The interactive native window no longer opts into every macOS Space, and floating
is off by default. The existing bundle was rebuilt in place, relaunched and
assigned to a dedicated desktop; metadata confirmed that its window belonged to
that Space alone and the original desktop was restored. The click-through desktop
background retains its intended all-desktop behavior. Native occlusion can now
pause rendering while the interactive office is on another Space.

The circular chair orbit has been replaced by event-driven floor routing and
small visual motors. Characters have assigned desk headings, explicit chair
egress, bounded speed/acceleration/turning, distance-driven steps, and connected
door/corridor/entry paths. The largest authored models and folded swift transit
pose determine clearance. Preview has separate motors; offline preserves live
position and presence. Departures stay absent until an arrival intent. Activity
signals still govern wake/rest transitions after a completed ordinary intent.
The viewer's Plant/Lamp/Art controls have been removed. Empty rooms turn their
owned lamp lights and glow off; returning characters and visitors restore them
on an occupancy edge, without clocks, extra render loops or shared-material edits.

Two local MCP tools add bounded visual intents and primitive decoration recipes.
They share existing loopback, token, Origin and body limits. Current sanitized
state is atomically persisted privately with no history. Asset geometry is
shared and low-poly; materials are rough with optional emission, no extra lights.
Updates rebuild scene batches only on actual recipe changes. Replacement/removal
releases materials, final disposal releases shared geometry, and desk/shelf/floor
recipes align their bottoms with their support surface. Shared validators also
run in the browser and are included in frontend build fingerprints.

The bounded local stdio MCP client performs initialize, discovery and invocation,
then validates the public acknowledgement and process exit. It rejects private
arguments, arbitrary tools/programs/paths, malformed replies and oversized streams;
its fixed deadline terminates stalled children. It inherits only existing local
bridge settings, discards stderr and never retries an unconfirmed write. All six
existing automations were updated to use this actual MCP fallback when host tools
are absent. Readback preserved their schedules, targets, names, status,
notifications and business authority. Fresh native observations were published as
skill-source states without running or prompting the business workflows. This
proves integration and local protocol use, not that every future scheduled run
will execute successfully or that old chat hosts have loaded native MCP tools.

The additional visible-rendering CPU target remains unproven. A private exact
static-indexing trial matched images, actor states and shadow maps while reducing
unique static vertices by 68%, but the matched native capture increased median
CPU from 27.64% to 28.77% of one core. It was rejected. A private WebGPU prototype
was not adopted: output shading differed and no matched native CPU result was
completed. Neither experiment is included in the shipped renderer. These results
must not be described as an overall 20–30% CPU improvement. Cinematic 30 FPS
pacing remains the supported visible-animation target.


Final source validation passes all 172 tests and the production build. Real-layout
checks cover all 16 characters, assigned desk egress, every office door/lounge and
the exterior exit with legacy decorations on and off. Authored owl feet preserve
standing world positions through all runtime clips and reversible seated offsets;
the folded swift silhouette fits its measured transit radius. A separate security
review found no additional blocker in the bounded office/transport changes.
Twenty-five rendered checks pass with no runtime or GL errors, including visitors
entering a selected window, paused reveal/contact coherence, action precedence,
departure/arrival lamp edges, preview isolation, offline presence, all six office
windows, recipe visibility, pause and disposal. These are functional and rendering
checks, not a guarantee of display-presentation FPS on every device.


A separate native background capture kept the interactive app on its dedicated
Space while the original desktop remained active. With unchanged process launch
identities, diagnostics off, a 26-second warmup and three 13-second cumulative
counter windows, app + GPU-process + WebContent CPU measured 0.016% of one core
at the median (about 0.02% rounded). The served index/build fingerprint matched
the captured production build. This verifies the offscreen pause; it is a
background measurement, not a matched visible-rendering improvement or a GPU,
whole-machine, power or battery measurement.

Independent screenshot critique identified close-up framing blockers: monitors and
near seated heads hid faces, and the window mullion crossed the email owl. A
bounded higher diagonal camera now fits the seated head-to-foot and desk-depth
volume. All six revised windows passed the independent qualitative review and
the same 25 rendered checks were repeated successfully. This does not establish
95% fidelity to the concept or display frame pacing; lighting remains a possible
future polish area. Temporary QA browsers and servers were closed.

## Agent-chosen expression — 2026-10-13

The current expression path supersedes the status-driven wake/rest behavior
described in earlier checkpoints. Explicit intents choose movement and poses;
activity heartbeats do not. Unknown, stale or idle reports quiet ongoing
interaction gestures, while current confirmed routes can move independently of
an activity report. Initial load restores the last chosen place and presence
without replaying a journey or proving an earlier arrival.
The default approved GLB set remains empty; optional authored models retain only
their shipped Idle, Move, Work and Sleep clips.

The Skill Creator `quick_validate.py` check passes for `skills/platop`. PyYAML
was supplied from a temporary dependency directory; project and host Python
environments were not changed. An independent read-only skill scenario covered
document review followed by a real team dependency. It led to narrower guidance
for dependency waiting and actual coordination, with no prescribed action
sequence. Documentation whitespace checks pass. These checks do not exercise
live chat adoption or a rendered scene.

The completed branch passes all 217 Node tests and the production TypeScript /
Vite build. The existing large-chunk advisory remains. All sixteen avatars can
reach every named place in all six rooms with decorations on or off. The
portrait studio regenerated its fingerprint; the portrait pixels are unchanged.

An isolated Chromium fixture at desktop (1440 × 1000) and mobile (390 × 844)
verified page identity, meaningful rendering, no framework overlay or app
errors, and camera/window controls. The fixture exercised an agent-selected
waiting pose, unchanged position across a heartbeat, travel and final facing
at the whiteboard, pause/resume, and restoration without replayed travel. It
also verified that idle reports and same-place intents settle old gestures, and
that reduced motion adopts departure and informative static gestures. Test-only
read access to scene/motor objects was injected into the served module; no QA
hooks were added to product source. Fixture data, screenshots and the runner
stayed outside the repository. These checks did not send intents to live teams
or establish that existing chats have loaded the updated skill.
