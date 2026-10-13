# Avatar craft and local daylight — work in progress

This branch follows the six original agent-supplied portraits in `public/portraits`, rather than replacing those identities with the generic ceramic helpers in the office concept. The portraits remain the reference; the generated roster and team images are renders of the actual runtime models.

## Independent review record

The independent reviewer receives source portraits and frozen actual renders, not a requested score. It does not edit implementation. Scores below are subjective visual judgments, not pixel-accuracy measurements.

Baseline: avatar craft **4.3/10**, reference fidelity **2.7/10**, overall **D+**. The reviewer identified missing book, hood, lighthouse, scroll, folded-paper and feather silhouettes; missing role emblems; generic facial expressions; and lost team staging. The campus composition was assessed separately at approximately 7/10. This is not an acceptance.

Pass 1 restores the distinct identities, fitted visors, magnifier, book, role emblems, feathers, paper folds and warm facial expressions. A shared micrograin texture stays inside the existing transform-palette batching path. All characters remain below 9,000 triangles and within their tested movement clearance. Independent reassessment is pending.

## Local-clock atmosphere

The device clock supplies a continuous, stylized day: dawn around 06:00, warm sunset around 18:00, and a dark blue night with warm occupied-room lighting. These are artistic clock phases, not an astronomical sunrise forecast. No coordinates, location permission, network request or weather response is required. Clock updates occur once per visible minute, sleep while hidden, and reconcile on focus. The same scene and camera are retained. Agent room choices, including lights off, remain authoritative.

The isolated development fixtures in `tools/` exercise fixed hours and a camera-only benchmark. They are not linked from the application, do not send agent commands, and are absent from the production build. Production always uses the device clock. Preview activity remains absent.

## Performance baseline and verification

Baseline commit: `e27b31e`. Same local browser and fixed 1000 × 800 scene, device DPR capped at 1.5, two-second warmup followed by ten seconds of orbit input, offline neutral agents. Baseline cadence was **59.99 fps**, frame-interval p95 **17.6 ms**, CPU submission p95 **2.3 ms**, 80 draw calls and 347,755 rendered triangles. Submission timings are not GPU timings and do not establish native-host or other-device performance.

The first texture experiment increased draw calls to 334 and was rejected. Shared-grain batching brought the measured count to 98 with 322,883 triangles; frame cadence remained approximately 60 fps. Per-pass final timings and the independent acceptance record will be appended after review.

Pass 1: 251 automated tests and the production build pass. Tests cover all character transit footprints, grounded feet, fitted helmet surfaces, no invented work from activity reports, resource reuse/disposal, local-time continuity and hidden-clock suspension, cached dark backdrops, and shared-grain batching. Native installation and the live private chat bridge are unchanged.
