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

The Mac companion is a local developer bundle. No login item, notarized installer, Windows/Linux native shell or cloud deployment has been installed. The browser application is portable. Additional decor source deliveries exist but are not automatically enabled in this first app integration. The optional recording-derived voice package is preserved locally and excluded from this public graphics release; asset metadata keeps only generic preset names.

Private selected-chat mappings, tokens, status storage, cross-agent local handoffs and review benches are excluded from the public repository. Public files contain curated character art, code and documentation.
