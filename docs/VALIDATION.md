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
