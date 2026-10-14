# Close-up surface refinement

Branch: `codex/avatar-surface-detail`; baseline: `271831b`.
This is an in-progress fidelity pass, not an accepted reference match.

Every one of the sixteen procedural avatars has a close-up mesh with exactly
100 times its authored triangle count. Curved interpolation and material relief
use those vertices; paper creases and fitted layers remain separate. A local
worker builds at most three nearby avatars, uses their existing pose matrices,
and releases dense geometry when it leaves the selected view. No activity,
movement, identity, bridge payload, or agent permission is added by this tier.
The same geometry generates all 28 shipped day/night and individual portraits.

## Independent visual ledger

The read-only reviewer received the actual renders, original six identity
portraits, quarter/rear inspection views, and approved office reference. It was
not asked for a desired score or instructed to approve.

| Surface submission | Independent result | Main gaps |
| --- | --- | --- |
| 1 | 7.9/10 — B | Scalloped bezel, stray feather edges, overly smooth finishes |
| 5 | 8.3/10 — B+ | Projecting owl eyes, solid paper figures, fitted garments |
| 7 | 8.3/10 — B+ | Mechanical feather texture, heavy paper forms, cape/cover transitions |
| 8 | 8.3/10 — B+ | Thin paper silhouettes, fitted cape, limited material variation |
| 11 | Portraits 8.3/10 — B+; campus 7.0/10 — C+ | Intrusive corridor rectangle, orange wash, sparse furnishings |
| 14 | Portraits 8.4/10 — B+; campus 7.5/10 — B | Paper neck transitions, broad feather scales, fitted cape |
| 16 | Portraits 8.4/10 — B+; campus 7.6/10 — B | Notched breast vanes, stiff cape folds, edge-on residents, material variation |
| 20 | Portraits 8.5/10 — B+; campus 7.8/10 — B | Broad feather plates, concealed seating, facial construction, paper joins, material distinction |
| 23 | Portraits 8.4/10 — B+; campus 8.0/10 — B | Broken feather overlaps, lantern-to-paper warmth, paper neck joins, furniture/foliage variety |
| 25 | Portraits 8.5/10 — B+; campus 8.0/10 — B | Regular feather plates, paper neck wedges, overly glossy Beacon glass, repeated furnishings and stiff foliage |
| 27 | Portraits 8.4/10 — B+; campus 8.1/10 — B | Regressed exposed wing supports/roots, tall shiny owl toes, broad feather plates, foliage and furnishing repetition |
| 31 | Portraits 8.5/10 — B+; campus 8.1/10 — B | Wing regression corrected; pointed vanes, smooth felt, thick paper folds, sparse seating and stiff foliage remain |
| 33 | Portraits 8.5/10 — B+; campus 8.0/10 — B | Branching foliage added, but paddle-like leaves, projecting paper faces and rectangular rug patches regress the scene |
| 35 | Portraits 8.5/10 — B+; campus 8.1/10 — B | Rug patches corrected and fuller owl wings; paper jaw/chest joins, regular feather rows, bird breast/crown transition and furnishing variety remain |
| 39 | Portraits 8.5/10 — B+; campus 8.1/10 — B | Shorter paper faces and broader chest planes help locally, but oversized raised wing/shoulder mass makes the owls too stocky |
| 40 (targeted) | Email 8.5 craft / 8.5 fidelity / 8.5 all-angle; campus 8.1/10 — B | More legible shelves and consistent bird shading; coarse facial strokes and narrow rear feather notches need correction |

Passes not listed were internal corrective iterations, not independent approvals.
Pass 17 keeps pass 16's visible forms while reducing five-sided botanical stems
to preserve the original per-plant triangle budget. It is not a new independent
approval.
The requested A-level acceptance remains open. Increased mesh density and passing
tests do not substitute for this visual judgment. The earlier avatar/daylight
ledger is a separate historical series.

## Verification through surface pass 17

- 280 tests pass; production build passes, with the existing large-bundle warning.
- All sixteen exact 100× counts, finite attributes, source preservation, curvature,
  bounded LOD residency, worker failure, pose following, and cleanup are tested.
- Batch tests verify that dense replacements hide only corresponding coarse draws
  and never become part of merged office geometry.
- Existing clearance, surface-fit, agent-neutrality, observer isolation, bridge,
  daylight, and portrait-fingerprint tests remain passing.
- Feather front/back ray coverage catches the concave winding defect; actual
  paper head/body depth prevents the former wafer-like side silhouettes.
- The foyer's isolated window now includes floor beneath its rear furniture.
  The intrusive corridor rug is removed, the drafting board is lowered, and
  unused stools fit wholly inside the existing desk obstacles.
- Each plant retains fewer than 2,600 triangles and its original navigation
  envelope. Fuller canopies spend triangles on leaves instead of tiny stems.
- Device-clock sunset separates cool skylight from warm sunlight. Mobile header
  icons remain visible; the observer buttons retain 44-pixel touch targets.
- The freshly built production bundle loads its local worker under the server's
  CSP: Savor Bridge window reports one detailed avatar, zero pending requests,
  74 draws / 667,361 triangles, then releases the tier on campus return. Its
  isolated bridge remains empty; no live chat activity was created. No console
  warning or error was observed. Initial shader compilation is not instant.

The pass-16 independent review asked for softer short breast feathers versus
long wing vanes, a cape that spreads from its fastening point, more readable
neutral campus orientations, and stronger material distinction. These are open
visual tasks, not passed checks. No staged work was added to obtain the scores.

## Verification through surface pass 23

- 281 tests pass; production build passes with the existing chunk-size warning.
- Keeper has thin bowed covers and a fitted subdivided face. Split rim normals
  remove the sharp lip and triangular shading introduced in internal pass 19.
- Intake's arms sit beneath its mantle; breast plumage uses six staggered rows
  of tapered vanes. The owl's heart-shaped facial shield now clears the breast,
  including a ray-tested lower edge; its eyes are larger and sockets warmer.
- Neutral arrival headings belong to the real motors. They do not schedule a
  turn, work gesture, or path. Agent-chosen work retains its original desk facing.
- Botanical silhouettes use 44 vertices and the same 56 triangles per leaf.
  Floor joins are more legible and whiteboard writing is larger.
- The two upper three-member rooms have visible empty stools with real blockers
  and a shifted front cross aisle. Lower-room stools remain beneath their desks;
  exposing them obstructed decorated routes. All sixteen avatars still reach
  every desk, prop, door, lounge and exit with decorations both on and off.
- The latest campus submissions include identical-viewport noon/night captures
  using the existing development-only clock fixture and the actual App/scene.
  These are fixed-clock visual checks, not production clock overrides or agent
  activity. Pass 23's independent review remains below the requested A.

The pass-23 built bundle loaded the local worker without console warnings or
errors. Savor Bridge reported one detailed avatar, zero pending requests and
74 draws / 822,161 triangles. Mist entry, both perspectives, exit and reset were
checked on the isolated production server; its bridge remained empty. The
390 × 844 night check found pale selected/navigation buttons. Pass 24 supplies
explicit dark-theme backgrounds and readable labels for perspective, navigation,
movement and hints, retaining the 44-pixel touch targets.

## Verification through surface pass 25

- 281 tests and the production build pass. The 100× ratio, route clearance and
  agent-only action tests remain intact.
- A dense-shell regression check now covers the lower owl body. Its hidden
  support retains its fitted contour rather than inflating through plumage;
  vane widths follow angular spacing around the narrowing belly.
- Only the two lantern embodiments add a bounded, shadow-free point light
  (range at most 2.4 units). Their glass is lighter and smoother, and paper
  chest folds are shallower. This is real nearby illumination, not a new action.
- The compiled application opens both Savor Bridge and The Lantern Desk windows
  without observed console errors. No live bridge data or chat was changed.
- Pass 25's independent review acknowledged stronger lantern-to-paper warmth and
  cleaner feather overlaps. It remains below the requested A.

## Verification through surface pass 27

- 282 tests and the production build pass, including exact 100× surface counts,
  all sixteen moving clearances, agent-neutrality and generated portrait freshness.
- Shorter layered wing feathers, a fuller rear owl silhouette, a continuous
  bird crown and thinner rear paper folds improve close and rear construction.
  Frosted lantern roughness removes the sharp white highlights noted in pass 25.
- The shared tables now include rounded and capsule outlines. Their original
  footprint, 0.82-unit top height, contact patches and sub-4,000-triangle budget
  are tested. No navigation blocker or desk-object position changes are needed.
- More relaxed leaf bends remain inside the existing plant envelopes and triangle
  budgets. All shades share one subtle emissive value, preserving static merging.
- Six day/night portraits, quarter/rear views and matched 1536 × 1024 campus
  captures are frozen for independent review. They contain no staged activity.

The pass-27 review found softer Beacon illumination and more varied tabletops,
but also a wing-construction regression. The score drop is retained here. The
next corrective work tucks feather roots into the shoulders, tapers their hidden
supports and shortens the owl's toes. No rejected pass is described as accepted.

## Verification through surface pass 31

- 286 tests and the production build pass. The independent reviewer confirms
  that exposed wing supports and shoulder roots are corrected. A ray-tested
  dense support regression and bounded, squat toe test cover those repairs.
- A shared opaque vein texture preserves the leaves' UVs through static merging;
  its ownership and single disposal are tested. Plant envelopes and triangle
  budgets remain unchanged.
- Closed linen notebooks and varied papers/mugs use the existing desks without
  moving navigation anchors. Contact patches are stronger without new passes.
- [Noon campus](images/surface-campus-noon.jpg) and
  [night campus](images/surface-campus-night.jpg) show the actual app at matched
  1536 × 1024 viewports. These clock-fixture captures contain no invented work.
- The new review remains below A. The reviewer asks for broad soft wing fans,
  fibrous surfaces, more integrated paper forms, and richer botanical/furniture
  shapes. Passing the surface-density requirement does not close those gaps.

## Performance observations

Pass 36 is the tested correction of pass 35, not a new independent approval.
All 287 tests and the production build pass. The deeper leaf bend in pass 35
failed a shared-normal check, and its rug-material access failed TypeScript;
both were corrected before regenerating the shipped portraits. Rug weave now
clears its pile physically and uses polygon offset, retaining shadow reception.
First- and third-person mist, exit and restored orbit controls were checked on
the isolated compiled build. Its local dense worker completed requests without
observed console errors. No live bridge or chat was changed.

Pass 39 has 288 passing tests and a passing production build. Its folded owls
have broader diagonal resting wings and a fuller, tapered breast. The first
internal attempt (37) enlarged a held prop beyond its movement envelope and
occluded the chin; these were corrected, not accepted. A new ray test prevents
the breast from cutting across the lower facial shield. Independent acceptance
remains below A; no reference-match claim is made.

Pass 41 retains the 100× tier, with 290 passing tests and a passing production
build. Fitted Scout toe caps follow the cream foot instead of forming flat
discs. Paper wing shoulders are lower/narrower and their head proportions are
restored. Bound shelf books have separate page blocks, boards and spines; archive
boxes vary shelf contents inside the original envelope and a 6,500-triangle
per-shelf budget. The pass-40 reviewer reservations remain open at this point.

Same-machine isolated camera-only workload, no bridge or agent activity, 1000 ×
800 CSS canvas, 1500 × 1200 backing pixels, two-second warmup and ten-second sample.
Unchanged source was read from `271831b` into a temporary isolated checkout.

| In-app browser run | Browser RAF Hz | Submitted scene fps | JS wall time mean / p95 |
| --- | ---: | ---: | ---: |
| Baseline campus | 60.00 | 52.00 | 2.45 / 4.00 ms |
| New campus | 60.01 | 48.61 | 2.45 / 3.80 ms |
| Baseline close | 59.99 | 46.50 | 2.38 / 3.50 ms |
| New close | 59.81 | 49.61 | 2.25 / 3.70 ms |

The close sample submitted 1,841,319 triangles with three dense avatars, versus
309,758 baseline triangles. The campus retains zero dense avatars. These runs
show comparable submission cost and variable event-driven frame pacing, not a
proven locked 60 fps or GPU-completion guarantee. Browser RAF frequency is not
reported as scene frame rate. Later fixture framing moved the close camera from
the table front to complete faces; that workload must be remeasured separately.

The subsequent full-face fixture uses the same `pan(-6.4, -7)` and `zoom(5)` on
both checkouts. Its close benchmark now sets that camera itself. One pass-16 run
labelled close without first moving the camera was rejected (zero dense avatars)
and is not treated as close-up evidence.

| Later matched framing | Submitted scene fps | JS wall time mean / p95 | Draws / triangles | Dense avatars |
| --- | ---: | ---: | ---: | ---: |
| Baseline campus | 49.81 | 2.54 / 4.10 ms | 93 / 329,483 | 0 |
| Pass 14 campus | 56.70 | 1.24 / 2.90 ms | 100 / 336,131 | 0 |
| Pass 17 campus | 46.90 | 2.90 / 4.20 ms | 100 / 339,703 | 0 |
| Pass 23 campus | 49.11 | 2.53 / 4.20 ms | 101 / 341,251 | 0 |
| Pass 24 campus | 50.70 | 2.50 / 4.30 ms | 101 / 341,251 | 0 |
| Pass 25 campus | 51.20 | 2.19 / 4.00 ms | 101 / 341,251 | 0 |
| Pass 27 campus | 55.11 | 1.68 / 2.90 ms | 107 / 342,315 | 0 |
| Pass 31 campus | 55.71 | 2.02 / 2.90 ms | 108 / 341,711 | 0 |
| Pass 36 campus | 55.90 | 1.92 / 2.60 ms | 108 / 341,723 | 0 |
| Pass 39 campus | 56.50 | 2.03 / 3.00 ms | 108 / 341,739 | 0 |
| Pass 40 campus | 54.70 | 1.96 / 2.80 ms | 108 / 351,883 | 0 |
| Pass 41 campus | 50.40 | 1.96 / 2.90 ms | 108 / 351,883 | 0 |
| Baseline full-face close | 45.29 | 2.61 / 3.40 ms | 46 / 303,944 | 0 |
| Pass 14 full-face close | 50.99 | 2.50 / 4.10 ms | 147 / 2,413,677 | 3 |
| Pass 17 full-face close | 48.99 | 2.54 / 4.20 ms | 147 / 2,417,249 | 3 |
| Pass 23 full-face close | 49.50 | 2.33 / 4.10 ms | 132 / 2,381,349 | 3 |
| Pass 24 full-face close | 49.49 | 2.55 / 4.30 ms | 132 / 2,381,349 | 3 |
| Pass 25 full-face close | 54.20 | 2.07 / 4.00 ms | 132 / 2,381,349 | 3 |
| Pass 27 full-face close | 56.10 | 1.74 / 2.70 ms | 133 / 2,347,917 | 3 |
| Pass 31 full-face close | 52.30 | 1.82 / 3.20 ms | 133 / 2,346,793 | 3 |
| Pass 36 full-face close | 52.40 | 2.08 / 3.60 ms | 133 / 2,346,805 | 3 |
| Pass 39 full-face close | 54.40 | 2.26 / 3.70 ms | 133 / 2,346,821 | 3 |
| Pass 40 full-face close | 55.80 | 1.79 / 3.20 ms | 133 / 2,356,965 | 3 |
| Pass 41 full-face close | 52.81 | 1.91 / 3.40 ms | 133 / 2,356,965 | 3 |

These samples remain in the earlier performance range, but do not prove a speed
increase or an unchanged worst case. The dense tier is deliberately not used for
the distant campus. JavaScript submission time is not GPU completion time.
An additional pass-25 close run overlapped a production-window change and fell
to 42.60 scene fps / 47.98 RAF Hz. It is retained in local evidence but excluded
from the matched table; the uninterrupted rerun above does not hide that caveat.
