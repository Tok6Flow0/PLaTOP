# Agent studio graphics comparison

Final result: passed.

Scope: the default desktop space, model-generated portrait icons and one isolated agent-designed room. This is qualitative visual acceptance, not a pixel-perfect score, ray-tracing claim or live-chat adoption check.

## Evidence

- Reference: `public/reference/office-concept.png` (1536 × 1024).
- Baseline: `docs/images/studio-campus-before.png`, from `bbd4404`.
- Current: `docs/images/studio-campus-after.png`.
- Side-by-side source/current: `docs/images/studio-source-comparison.png`.
- Side-by-side baseline/current: `docs/images/studio-before-after.png`.
- Paired model portraits: `docs/images/studio-portraits-comparison.png`.
- Agent-owned practice: `docs/images/studio-agent-practice.png` (synthetic fixture, not a real team's design).

Desktop captures use a verified 1536 × 1024 CSS viewport and 1× screenshot density, with native-density interface text and a bounded 1.5× scene backing density. The in-app browser could not supply the matched desktop viewport, so the comparison used Chrome. Source and render were viewed together, not scored from memory. A subsequent narrow-viewport override did not actually resize the browser; that capture was excluded. Mobile rendering is not newly verified by this review.

## Iteration history

1. Baseline review found faceted face rims, weak identity differentiation, blotchy portrait contact ellipses, narrow foliage, flat chair backs/rug corners and washed-out room depth.
2. Refined the actual models, fitted smooth curved face geometry, preserved intentional paper folds, tuned glaze/brass/paper/feather response and regenerated all 22 portraits. Replaced portrait contact ellipses with baked studio shadows; enlarged and staggered the lineups.
3. Compared the real scene with the source again. Added rounded woven rugs/chair backs, broader leaves, warmer timber and coherent interior sidewall colour. Kept travel openings and routes unchanged.
4. Independent review identified two remaining P2 issues: angular rug/corridor cast shadows and Keeper's pale book outline. Increased static shadow softness and warmed Keeper's binding/crease; recaptured and reviewed. No P1/P2 visual blocker remained in the final reviewed desktop state.
5. An independent agent read the revised skill, chose its own palette and four object recipes, published them through real stdio MCP into an isolated bridge, inspected the render and revised its undersized floor lamp. Corrected the engine's discovered wall attachment defect and verified physical mounting/cutaway metadata across all rooms.

## Intentional differences and remaining limits

The name is PLaTOP, not the source's old spelling. There are no onlooker action/decorating controls or preview-activity choreography. The adopted avatars are distinct, and origami facets remain deliberate. Doorways and the open foyer serve genuine agent-selected travel. The original image remains richer in organic detail and photographic portrait depth; this pass is substantially closer and more cohesive, not identical. No subjective fidelity percentage is asserted.

Renderer changes are bounded but not free: the 1.5× scene density cap permits up to 2.25× backing pixels, and the 2048-square static shadow map uses four times the prior map area. No whole-device energy or native frame-time claim is made. Room/object design remains data-only and local; it grants no business authority or access to other chats.
