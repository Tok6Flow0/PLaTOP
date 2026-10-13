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

The latest independent review still asks for softer short breast feathers versus
long wing vanes, a cape that spreads from its fastening point, more readable
neutral campus orientations, and stronger material distinction. These are open
visual tasks, not passed checks. No staged work was added to obtain the scores.

## Performance observations

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
| Baseline full-face close | 45.29 | 2.61 / 3.40 ms | 46 / 303,944 | 0 |
| Pass 14 full-face close | 50.99 | 2.50 / 4.10 ms | 147 / 2,413,677 | 3 |
| Pass 17 full-face close | 48.99 | 2.54 / 4.20 ms | 147 / 2,417,249 | 3 |

These samples remain in the earlier performance range, but do not prove a speed
increase or an unchanged worst case. The dense tier is deliberately not used for
the distant campus. JavaScript submission time is not GPU completion time.
