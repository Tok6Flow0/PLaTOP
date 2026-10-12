# Reference-led office design

The supplied `public/reference/office-concept.png` is the starting-space visual target. Its older header spelling is superseded by the user's exact name, **PLaTOP**. The application builds the connected office as actual Three.js geometry; the supplied artwork is used as clipped static UI portraits only.

The connected three-by-two campus has terracotta, sage, navy and forest-green room walls, wooden tables, woven rugs, bookshelves, individual plant leaves, paper and laptop props, a front entry and two benches. The central Lantern Desk office opens into the shared foyer. Front-facing wall roots fade with the camera so interiors stay readable. Original team portraits remain available alongside the revised concept-led identities.

Desktop chrome follows the reference's roughly 16.2% left roster and 19% right inspector, cream background, dark pine typography and muted green controls. Small windows use a horizontal team list and stack the inspector under the scene. Camera pan, perspective orbit/tilt, anchored zoom and keyboard equivalents share a bounded world, with an exact reset to the starting composition.

Warm hemisphere/key lighting, a small static soft-shadow map, contact pads and local lamp glows provide depth. This is a rasterized scene; there is no ray-tracing implementation. Active animation is capped at 24 fps and sleeping animation at 4. Event-driven camera movement can redraw at up to 24 fps; hidden, minimized, paused and reduced-motion states do not schedule animation. These are render-loop budgets, not whole-device CPU/GPU benchmarks.

Visual approval is feature-specific. `public/assets/approved.json` enables the reviewed authored models; unapproved deliveries remain available as source but do not automatically replace the reference models. The independent critic's comparison and numbered observations are local artifacts under ignored `art-direction/critique/`. Subjective resemblance scores do not establish pixel-perfect equivalence or approve unreviewed features.

Activity is reported through a local bridge. The current skill publishes bounded native observations and command heartbeats; it does not install an automatic background native chat monitor. Preview overrides the visible scene only and stays explicitly labeled simulated. Decorations remain on this device and do not imply a business milestone or task completion.
