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
reusing frontend files and updates the existing native bundle in place. The
final Node suite passes **84 tests**, the production TypeScript/Vite build
succeeds, and independent correctness/privacy reviews found no material issue.
The updated ad hoc signed native bundle passes strict signature verification.
The previous app, GPU and WebContent processes exited before relaunch; the new
instance loaded the fingerprint-verified frontend, repeated the 36.35% campus
CPU median and the reported 30 FPS timing, and was left in the live Beacon
desktop-background view with preview and diagnostics off.
