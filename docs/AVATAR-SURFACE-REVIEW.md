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

The user's October 14 clarification preserves the agent-chosen identities.
The left-hand campus image is the rendering-quality target, not permission to
replace the book and folded-paper characters with its ceramic cast.

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
| 41 (targeted) | Local form improvements; no new overall grade | Lower paper shoulders and fitted Scout caps help, but thick folds, glossy cap bulges and abrupt tuft/bird joins remain |
| 43 (portraits only) | Modest material cleanup; no new overall grade | Crack-like facial marks removed; lower-right rear feather overlaps and carved-looking paper masses remain |
| 46 | Portraits 8.5/10 — B+; campus 8.1/10 — B; lighting 8.3/10 | Scout soles clearly improve; bird cheek/breast transition, paper edges and lower-right rear feather boundary remain |
| 47 (Intake only) | Net material-fidelity improvement; no new full-set grade | Matte shells and faces are closer; faces could retain more subtle depth and eye warmth |
| 49 (Reflection and Email only) | Modest construction improvements; no new full-set grade | Cleaner broad chest folds and slightly improved bird neck; thick paper edges and lower-right rear feather overlaps remain |
| 50 (Email only) | Clearer bird cheek/throat continuity; no new full-set grade | Eyes stay visible and no new clipping seen; rounded crown and stiff large wing plane still differ from source |
| 52 (Reflection only) | Small edge-construction improvement; no new full-set grade | Thinner free wings and quieter lower jaw retained; broad solid-looking masses and a blade-like wing tip still differ from source |
| 53 | Portraits 8.5/10 — B+; campus 8.2/10 — B; lighting 8.3/10 | Branch attachment improves; repeated horizontal leaf tiers, sparse furnishings, solid-looking paper faces and regular feather overlaps remain |
| 55 (Merchant only) | 8.6/10 — B+; craft 8.5 / fidelity 8.7 / all-angle 8.5 | Better Jarvis/Scout hierarchy; existing dark seam remnants, rigid Keeper silhouette, glossy shoulders and short simplified arms remain |
| 56 (Merchant only) | 8.6/10 — B+; small construction improvement | Seam endpoints join cleanly and lower curve is smoother; thinner bowed cover is intact but Keeper remains comparatively rigid |
| 57 (foliage/materials) | Merchant 8.6/10 — B+; campus approximately 8.2/10 — B | Horizontal leaf tiers substantially reduced; quieter ceramic highlights retained; sparse seating, rigid book/paper forms and simplified facial disks remain |
| 58 (campus furniture) | Campus 8.2/10 — B; craft 8.3 / fidelity 8.1; lighting 8.3 | Wider tables improve room scale; guest chair reads too rectangular and right-hand storage is concealed; floor/material depth remains limited |
| 59 (Dispatch only) | 8.5/10 — B+; mixed modest improvement | Tuft roots join more plausibly; eye-centred facial fibres avoid cracking but look too regularly radial; Swift's long wire-like legs and short breast are the largest silhouette gap |
| 60 (Dispatch continuity review) | 8.4/10 — B+; rejected lower-body prototype | Quieter facial fibres improve; shorter exposed legs help but the extended breast ends as a blunt projecting block |
| 60 (fresh full-set reviewer) | Campus craft 7.0 / fidelity 7.5; characters craft 7.5 / fidelity 8.0 | Sparse staging, uniform campus light/materials, simplified primary forms and mixed paper/plastic construction remain conspicuous |
| 61 (Dispatch continuity review) | 8.5/10 — B+; preferred over 59 and 60 | Tapered underside resolves the blunt peg and shorter legs improve proportions; broad stiff wing and slightly pinched lower keel remain |
| 62 (fresh campus reviewer) | Campus craft 7.0 / fidelity 7.5; modest improvement, unchanged grade | Better contact depth and warm/cool night separation; uniform materials, sparse staging and broad desk shadows remain |
| 63 (Dispatch prototype) | 8.4/10 — B+; rejected coverage regression | Narrower fold shows more breast, but missing-looking teal backing and a culled lower triangle prevent acceptance |
| 64 (Dispatch continuity review) | 8.5/10 — B+; narrowly preferred over 61 | Closed backing restores a visible continuous surface; smaller wing bulk helps, but the stepped central fold remains unlike the source |
| 65 (fresh Reflection and Swift review) | Each craft 7.0 / fidelity 7.5; subtle surface improvement, unchanged tier | Drier paper grain, but solid-looking volumes and short belly facets remain; longer overlapping chest/wing sheets are the priority |
| 66 (Reflection prototype) | Craft 6.5 / fidelity 7.0; rejected silhouette regression | Long creases remove the belly zigzag, but flat apron panels and detached wing tabs make the owls rectangular |
| 67 (fresh Reflection review) | Craft 7.0 / fidelity 7.5; retained over 65, unchanged quality tier | Wrapped and tapered chest restores volume, with closer wings; triangular patchwork, solid thickness and weak lantern spill remain |
| 68 (fresh Reflection review) | Craft 7.5 / fidelity 7.5; retained lighting improvement | Warm spill now models inner cheeks, folds and tabletop; avoid further intensity increases, as the central pane approaches white |
| 69 (fresh campus review) | Craft 7.0 / fidelity 7.5; retained modest staging improvement | Taller real shelf tiers balance upper rooms; repeated storage and sparse lower-room desk/seating relationships remain |
| 70 (fresh campus review) | Craft 7.0 / fidelity 7.5; retained seating improvement | Angled guest chairs and visible foyer stool clarify use; evenly smooth material response and broad empty rug remain |
| 71 (fresh campus review) | Craft 7.0 / fidelity 7.5; retained subtle material refinement | Stronger tabletop grain and mineral pot finish are safe but small; broad light/shadow shaping remains the larger material-depth gap |
| 72 (fresh material review) | Merchant 7.5 craft / 8.0 fidelity; Support 8.0 / 8.5; Email 7.0 / 7.5; retained | Clearer ceramic curvature and brass separation, unchanged quality tier; avoid more gloss and improve Jarvis breast/shoulder construction |
| 73 (fresh Merchant shape review) | Craft 7.5 / fidelity 8.0; retained | Clearer shoulder separation, forward breast volume and tapered waist; small lower seam kink and Keeper's slab/ball-foot silhouette remain |
| 74 (fresh Keeper shape review) | Merchant craft 8.0 / fidelity 8.0; retained | Rounded lower cover, following pages and tucked feet improve proportions; upper cover/spine and turned corner remain rigid |
| 75 (fresh Keeper corner review) | Merchant craft 8.0 / fidelity 8.0; retained | Turned corner joins the cut-away bowed cover without a floating gap; the long sharp flap still needs a shorter, softer curl |
| 76 (fresh Keeper curl review) | Merchant craft 8.0 / fidelity 8.0; retained | Compact curl removes the blade-like tip and keeps the expression clear; bright wedge-like shading remains, with Scout's optical depth the larger character gap |
| 77 (fresh Dispatch face review) | Craft 7.0 / fidelity 7.5; mixed, beak revision required | Eye refinements and matte finish help; broad sharp pyramid-shaped beak is oversized relative to the source, and repeated feathers remain |
| 78 (fresh Dispatch beak review) | Craft 7.0 / fidelity 7.5; retained over 77 | Narrow matte rounded root improves integration; bulb-to-point taper still feels pin-like, while small repeated feathers and lower-breast dark wedges are the larger gap |
| 79 (fresh Dispatch feather review) | Craft 7.5 / fidelity 7.5; retained | Continuous beak taper and broader breast groups improve construction; dark flank-to-wing band and angular upper rear feather boundary remain |
| 80 (fresh Dispatch join review) | Craft 7.5 / fidelity 7.5; retained | Rear roots disappear beneath the head and closer wing overlap reduces separation; no substantial silhouette regression; oversized pouch-like envelope badge remains |
| 81 (fresh Dispatch and Keeper detail review) | Dispatch 7.5 craft / 7.5 fidelity; Merchant 8.0 / 8.0; retained | Envelope reads smaller and flatter, Keeper corner shares the cover's cream; no visible regression; Swift's rounded head/neck and solid breast remain inconsistent with its planar wings |
| 83 (fresh Merchant optical review) | Craft 8.0 / fidelity 8.0; retained | Rounder lens fills its frame and preserves the wink/pupil; mild quarter-view gray veil remains; painted shells still read as smooth plastic rather than the reference's fine satin grain |
| 84 (fresh Merchant satin review) | Craft 8.0 / fidelity 8.0; retained | Reduced plastic-like highlights preserve rounded forms and brass/glass separation; broad shells remain too uniform and slightly rubber-like; hold gloss and add restrained fine surface variation |
| 85 (fresh Merchant grain and broader character review) | Merchant craft 8.0 / fidelity 8.0; broader set approximately 7.5 / 7.5; retained | Grain reduces rubber-like uniformity without visible regression; avoid stronger mottling. Across the cast, Reflection's rounded triangulated paper and Dispatch's broad flat-looking facial mask are the main construction gaps |
| 86 (fresh Dispatch face prototype) | Craft 7.5 / fidelity 7.5; mixed, eye revision required | Deeper socket and narrower cheeks improve the mask; thick projecting gold surrounds regress into mounted buttons. Keep mask shaping, seat thinner eyes deeper, then join the notched heart tip |
| 87 (fresh Dispatch eye correction) | Craft 7.5 / fidelity 7.5; retained over 85 and 86 | Thinner seated eyes and joined heart tip improve construction; the lower gold crescent still appears mounted. Refine cream socket overlap without adding general darkness |
| 88 (fresh Dispatch brow prototype) | Craft 7.0 / fidelity 7.0; rejected, restored 87 | Broad raised brows make the cream mask look pinched and worried. Any future overlap must be localized immediately around the eye, preserving the open expression |
| 89 (fresh Reflection fold review) | Craft 7.5 / fidelity 7.5; retained | Longer coplanar chest folds remove belly patchwork without flattening the body. Narrow hanging outer wings remain the largest gap: the source uses broader overlapping diagonal sheets |
| 90 (fresh Reflection wing review) | Craft 7.5 / fidelity 7.5; retained | Broader diagonal wings improve shoulder/body integration without obvious clipping. Bright raised roots still resemble collars and the quarter-view edge reads wedge-thick; tuck roots behind the cheek and preserve the broader fold |
| 91 (fresh Reflection shoulder review) | Craft 7.5 / fidelity 7.5; narrowly retained | Lower roots clear the cheeks and reduce the collar effect without losing the broad fold. Stop lowering them; the thick polyhedral head and weak distinction between outer paper hood and facial panels are now the larger gap |
| 92 (fresh Reflection head-wrap review) | Craft 7.5 / fidelity 7.5; modestly retained | Fine facial edges and broad panels improve separation and preserve expressions. Side/rear still reads as a solid mass, with a slightly shield-like double cheek edge. Next correction should use long brow/temple folds, not another projecting rim |
| 93 (fresh Reflection temple prototype) | Craft 7.0 / fidelity 7.5; rejected | Longer temple planes improve the quarter view, but the rear converges into a distracting pinched cluster. Keep 92 until the back closes with broad tucked panels |
| 94 (fresh Reflection rear-closure correction) | Craft 7.5 / fidelity 7.5; narrowly retained over 92 | Broad rear closure removes the distracting star and keeps longer temple folds. Stop rearranging small rear panels; establish thin-edge and overlap-shadow hierarchy on visible cheeks, wings and chest |
| 95 (fresh Reflection chest-overlap review) | Craft 7.5 / fidelity 7.5; retained as a visual tie | Shallow ordered overlap removes coincident centre faces without visible regression, but the change is not confidently distinguishable at supplied image size. Prioritize warm-to-shadow material transitions and recover amber lantern detail |
| 96 (fresh Reflection interior-light review) | Craft 7.5 / fidelity 7.5; retained lighting improvement | Moving the emitter inside the glass restores amber colour and expression while keeping warm spill. The panel still looks uniformly luminous; improve controlled internal gradient and restrained glass reflection without restoring the white hotspot |
| 97 (fresh Reflection glass prototype) | Craft 7.0 / fidelity 7.5; revision required | Per-pane gradients create repetitive orange-edged bright bands. Preserve 96's interior emitter, soften the gradient, mute the edges and use broader glow; other sampled teams show no visible regression |
| 98 (fresh Reflection glass correction) | Craft 7.5 / fidelity 7.5; narrowly retained over 96 | Broad muted glow removes orange bands while preserving readable faces. Stop tuning the gradient; paper overlap depth and flat uniformly gold roof/frame are larger remaining material gaps |
| 99 (fresh Reflection structural-metal review) | Craft 7.5 / fidelity 7.5; retained over 98 | Dark roof/frame/base separate from luminous panes and polished fittings without a paper-owl regression. The roof still partly reads as brown material; prioritize localized soft paper-overlap shadows, not more tiny metal adjustments |
| 100 (fresh actual-scene contact review) | Campus craft 7.0 / fidelity 7.5; close craft approximately 7.5; retained | Short-range close AO replaces dirty pot-shadow clouds with compact contacts and improves books/mug grounding without losing owl folds. Campus lighting change is not confidently substantial; room-scale key-light shaping remains the priority |
| 101 (fresh corrected-noon review) | Campus craft 7.0 / fidelity 7.5; retained | Slightly stronger depth beneath desks and around plants, readable faces and tabletop objects; night unchanged. Do not lower fill again: shape the key-light direction and soft cast-shadow transitions |
| 102 (fresh key-light review) | Campus craft 7.0 / fidelity 7.5; narrowly retained | Slightly warmer/better-lit furniture and rugs, compact contacts retained, no clipping. Do not widen the featureless wall shadow further. Hold lighting and address the dense parallel tabletop grain and checker-like textile pattern |
| 103 (fresh wood/textile review) | Campus craft 7.0 / fidelity 7.5; mixed, rug revision required | Quieter broken wood grain retained; fine fibres disappear at campus scale, leaving rugs too smooth and featureless |
| 104 (fresh textile correction review) | Campus craft 7.0 / fidelity 7.5; retained | Irregular tuft groups recover textile variation without 102's checker pattern; wood stays quieter and no lighting regression is seen. Room staging and furniture-character integration are the larger remaining gap |
| 105 (fresh Beacon staging review) | Beacon craft 7.5 / fidelity 7.5; campus 7.0 / 7.5; retained | Tighter rug and low reading shelf improve grouping at campus scale and night without crowding. Do not repeat this exact template everywhere; the monitor partially hiding Beacon's face is the next focal-point problem |
| 106 (fresh Beacon focal-point review) | Beacon craft 7.5 / fidelity 7.5; campus 7.0 / 7.5; retained | Smaller angled screen exposes the full face and both eyes, including at campus scale and night. Its near-edge-on window angle is acceptable; stop adjusting it and address Clear Path's separated desk group and broad foreground rug |
| 107 (fresh Clear Path grouping review) | Clear Path craft 7.5 / fidelity 7.5; campus 7.0 / 7.5; retained | Shorter rug, deeper rounded desk and closer side residents improve cohesion without hiding faces. The group remains symmetric and the front apron is visibly faceted close up; next priority is distinct staggered Wayfinders workstations, not more tiny Clear Path positioning changes |
| 108 (fresh Wayfinders paired-desk prototype) | Wayfinders craft 7.0 / fidelity 7.0; campus 7.0 / 7.5; mixed, proportions not accepted | Stagger creates depth and keeps all four faces readable, but thick narrow desks resemble laptop trays. Broaden usable surfaces and slim their construction while preserving a real central walking aisle |
| 109 (fresh Wayfinders proportion correction) | Wayfinders craft 7.5 / fidelity 7.5; campus 7.0 / 7.5; retained | Broader surfaces, thinner aprons and smoother corners read as real workstations with clear circulation. The larger central gap loosens the grouping, so do not spread it farther. Next priority is directional room-scale lighting and tactile surface modelling, not more furniture placement |
| 110 (fresh lateral-daylight study) | Campus craft 7.0 / fidelity 7.0; rejected, retain 109 lighting | Larger shadow bands divide Wayfinders and cross Reflection's wall, floor and desk without enough character-form improvement. Restore 109 and study local material response instead; night is unchanged |
| 111 (fresh Wayfinder satin-clay study) | Characters/room craft 7.5 / fidelity 7.5; campus 7.0 / 7.5; retained, nearly tied with 109 | Soft matte/satin shells survive front, quarter, rear and night checks without plastic hotspots. The broad highlight difference is subtle. Dark face panels still read as uniform blue-gray plaques; curved optical depth and warm-eye contrast are the next character priority |
| 112 (fresh Wayfinder glass review) | Characters craft 8.0 / fidelity 7.5; room 7.5 / 7.5; campus 7.0 / 7.5; retained | Dark curved inserts and a shallow perimeter replace flat plaques; warm eyes stay legible. Actual-room highlights are restrained, but repeated white/gold portrait forehead blobs exceed the chosen reference. Soften peak reflections without losing dark depth or curvature |
| 113 (fresh subdued-glass review) | Characters craft 8.0 / fidelity 7.5; room 7.5 / 7.5; campus 7.0 / 7.5; retained | Paired bright portrait spots become a quieter broad reflection; dark curved faces and warm eyes remain legible without a visible regression. Further visor tweaks have diminishing value. The central guide's rigid broad shoulder/back cape is the next substantial character gap |
| 114 (fresh wrapped-cape study) | Characters craft 8.0 / fidelity 7.5; campus 7.0 / 7.5; narrowly retained | Shoulders and side sweep soften without visible holes/clipping, but the exposed rear still reads as a broad navy trapezoid. Folds are too subtle. A clear overlapping neckline feeding two broad descending folds matters more than additional grain |
| 115 (isolated guide construction review) | Guide craft 7.0 / fidelity 7.0; ensemble 7.5 / 7.5; campus 7.0 / 7.5; mixed | Retain shallow belly inlay; reject the shoulder-wide armored capelet. Isolated views reveal an existing floating hood emblem, previously hidden by the group composition |
| 116 (guide attachment correction) | Guide, ensemble and room craft 7.5 / fidelity 7.5; retained over 115 | Attached hood star and narrow neck turn remove the largest regressions. Small pointed neckline ends remain; the rear now reads as a fitted jacket. Hanging shoulder-to-hem folds, not further shortening or grain, are the next construction priority |
| 117 (hanging-fold prototype) | Guide craft 7.0 / fidelity 7.5; ensemble/room 7.5 / 7.5; revise before retention | Two descending folds are visibly improved, but an exposed/intersecting round shoulder component interrupts the cloth. Preserve the fold direction while correcting coverage; then prioritize the cream-edged hood point and layered head silhouette |
| 118 (sleeve coverage correction) | Guide, ensemble and room craft 7.5 / fidelity 7.5; retained over 117 and 116 | Side, quarter and night show a continuous shoulder with the oval gone, retaining stronger folds. Further cape polishing has diminishing value; the layered cream hood/head silhouette remains the next normal-view priority |
| 119 (cream hood layers, intermediate) | Guide, ensemble and room 7.5 / 7.5; campus 7.0 / 7.5 | Retain the cream outer point, fitted navy inset/star and lighter surround. Revise the seam: it reads as a drawn tan outline and looks wavy in the actual close scene. A returned cream edge and shallow shadow separation are still needed |
| 120 (modeled ceramic return) | Guide, ensemble and room 7.5 / 7.5; campus 7.0 / 7.5; retained over 119 | The tan outline is gone, with a credible soft visor edge in quarter/night views and no visible new break. The broad cream band still merges into the helmet at normal portrait size; distinct raised profile separation remains missing |
| 121 (readable raised hood frame) | Guide, ensemble and room 7.5 / 7.5; campus 7.0 / 7.5; retained over 120 | The raised cream frame now reads at ordinary portrait and actual-room sizes. Its stronger outer edge reveals scalloping along the forehead and cheek, with a somewhat heavy dark return. Clean the continuous curve without adding more thickness or contrast |
| 122 (continuous rim projection) | Guide, ensemble and room 7.5 / 7.5; campus 7.0 / 7.5; non-regressive, visually near-equivalent to 121 | The mathematical surface correction does not resolve the visible forehead wave; slight cheek cleanup is not a meaningful grade increase. The reviewer prioritizes the thin angular belly route versus the broad flowing source mark over another minute rim adjustment |

Passes not listed were internal corrective iterations, not independent approvals.
Pass 17 keeps pass 16's visible forms while reducing five-sided botanical stems
to preserve the original per-plant triangle budget. It is not a new independent
approval.
The requested A-level acceptance remains open. Increased mesh density and passing
tests do not substitute for this visual judgment. The earlier avatar/daylight
ledger is a separate historical series.

Pass 67: 304 tests and the production build pass. Two long breast ridges and
paper-thin matching backs replace the rejected flat-apron prototype. The inner
body and rear sheets taper with the visible breast; resting wings tuck closer
to the flank. Actual dense-mesh rays verify that the inner body remains behind
the sheets and the lower face is not covered. The fresh reviewer prefers 67
over 65 and 66, but keeps craft 7.0 / fidelity 7.5. Localized lantern illumination
is its next priority; this is not an A-level acceptance.

Pass 68 retains the same geometry and two shadow-free character lights. Lumen's
existing emitter is positioned at the upper front glass and its short-range
intensity increases; Beacon is unchanged. The actual model change affects the
live office and all portraits, with no portrait-only renderer adjustment. The
304-test suite and production build pass. The independent reviewer raises
Reflection craft to 7.5 but retains fidelity 7.5: folded-paper construction and
casing variation remain open, and increasing light further is not recommended.

Pass 69: 306 tests and the production build pass. Storage has varied three-,
four- and five-tier carcasses with unscaled books and plants seated on actual
top planks. Floor footprints, contacts and walking lanes are unchanged; all
sixteen real-layout routes pass with decorations on and off. Agent decoration
anchors follow the physical top surfaces. The campus reviewer retains this
pass but leaves both scores unchanged, prioritizing desk/seating composition.

Pass 70: 307 tests and the production build pass. Beacon's angled empty chair,
Dispatch's new guest chair and the visible Lantern Desk stool are real static
furnishings, not implied agent activity. Their rotated bounds and adjusted front
crossings pass all sixteen routes, including optional decorations. The foyer's
rear homes move with its table and remain floor-height. Two side-standing rooms'
extra plants now sit on their updated shelf top. The reviewer retains the change
at the same scores and prioritizes material depth over another seating addition.

The fresh pass-60 reviewer was not shown prior scores, target scores or ledgers.
It viewed the campus concept, all six chosen identity portraits, two campus
captures and all six front/night/quarter/rear render sets. Its per-team
craft/fidelity scores were Merchant 7.5/8.0, HR 7.5/8.0, Intake 7.5/8.0,
Support 8.0/8.5, Reflection 7.0/7.5 and Email 7.0/7.5. These stricter judgments
are retained alongside the continuity reviewer, not replaced by the more
favourable older grades. Neither reviewer establishes an accepted match.

## Verification through surface pass 17

Latest checkpoint (58): 299 tests and the production build pass. Beacon and
Dispatch have broader default tables, Beacon has an empty guest chair, and
Dispatch has bounded paper-wrapped storage. These are static furnishings, not
activity. A new guest-chair route initially failed for larger avatars; the real
front aisle and lounge stop were repositioned, retaining certified body clearance.
All sixteen residents can reach every interaction, lounge, door and exit with
decorations on and off. Storage meshes stay inside their actual obstacle bounds.
No character construction changed in this submission. The reviewer sees a small
improvement, not a new grade or an A-level reference match.

Pass 59: 300 tests and the production build pass. The owl's facial UVs align
fibres with each eye using one shared opaque texture; new tests check alignment
and bounded cream tones. Tuft roots are inset into the crown while keeping the
existing character envelope. The reviewer recommends keeping the tuft join but
breaking the long coherent facial rays into shorter irregular fibre groups.
Swift's breast/leg proportions, integrated wing folds and the owl's facial depth
remain open. This is not a new full-set or campus acceptance.

Passes 60–61: 301 tests and the production build pass. Pass 60's lower-breast
prototype was rejected after review; pass 61 tapers it to a narrow front keel
with the underside rising toward the tail. Standing feet, certified movement
envelopes and the earlier continuous cheek/eye construction remain tested.
The facial texture now uses shorter irregular fibre groups rather than coherent
sunburst rays. The reviewer prefers 61 over 59 and 60, but flags the broad wing
plate as the largest remaining Swift mismatch. The stricter fresh full-set
scores above remain current; a targeted correction does not replace them.

Pass 62: 301 tests and the production build pass. Stronger soft contact shading
uses the existing half-resolution eight-sample occlusion pass. Two existing
floor lamps cast stronger warm pools while the ambient fill is reduced modestly;
no lights, geometry draws or rendering passes were added. The fresh reviewer
recommends retaining the depth improvement but not further global darkening:
broad desk contact patches risk looking dirty, and material richness still needs
work. This is not a new character grade or accepted reference match.
The isolated compiled pass-62 application loads its local dense worker under
the normal CSP. Its Savor Bridge window reports one detailed avatar, zero
pending requests and 75 draws / 846,565 triangles; no console warning or error
was observed. The window's separate 30-fps target is not the camera benchmark.
The isolated bridge remains empty; no live chat activity was produced.

Pass 64: 302 tests and the production build pass. Swift's swept wing has
matching creased front/back panels with explicit winding. A new bidirectional
ray test caught pass 63's culled triangle before acceptance and now covers both
mirrored wings. The modestly narrower outline preserves standing feet, visible
eyes and all moving clearances. Four extra authored triangles become 400 extra
close-tier triangles; the exact 100-times test still holds for all sixteen.
This is a local repair, not a new full-set acceptance.

Pass 65: 304 tests and the production build pass. Paper's dense normals now
follow the derivative of its geometric relief, retaining split crease normals
and unchanged source meshes. Numerical-gradient tests verify that relationship.
The existing cellulose texture also modulates roughness; a narrowly keyed batch
path preserves that same-map response and rejects independent unapproved maps.
The fresh reviewer sees a slight dry/fibrous improvement with no major regression,
but the unchanged short belly facets and thick side masses still dominate the
Reflection figures. No improved character score is claimed.

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

Pass 46 has 292 passing tests and a passing production build (the existing
bundle-size warning remains). Close-up feather/fabric materials use restrained
physical sheen; glazed parts receive a thin clearcoat. These materials are
owned by the dense tier and released once; shared maps and original materials
are never disposed or mutated. Distant characters keep their batched materials.
Synchronous worker-transfer failures now fall back to the original characters
without leaving pending work or retrying every frame.

The owl's coarse facial strokes and irregular feather overlap introduced in
pass 40 were reverted. The gold bird has a continuous nine-ring breast/crown
profile. Scout's fitted soles are shallower and matte. Internal pass 44 exposed
pale pinholes where dense toe curvature crossed the cap; pass 46 fixes clearance
and ray-tests both actual dense surfaces. Tests now compare against immutable
`271831b` triangle counts as well as the current authored mesh: Scout's previous
99.69× original-count result was corrected with a finer sole contour. All
sixteen now satisfy the original-count minimum.

The compiled pass-46 bundle loaded two dense characters with zero pending
requests and 1,851,237 submitted triangles under the isolated server's CSP.
No console warning/error was observed. Mist entry, both perspectives, exit and
restored orbit controls were checked; no live bridge or chat was modified.
Measurements taken with diagnostics closed are stale and were not treated as
worker-failure evidence. The visual acceptance gate remains open.

Pass 47 retains geometry and adds source-matched matte Ivory shells and fabric
faces to the Wayfinders only. All 293 tests and the production build pass.
Its independent four-view check found less plastic sheen and no new coverage
defect, while noting that the faces now appear slightly too uniform. The full
portrait/campus grades above belong to pass 46, not this targeted submission.

Pass 50 has 295 passing tests and a passing production build. A continuous
diagonal cheek/throat plane improves the bird's profile without adding a
separate connector. Its dense eyes remain visible in a ray test. The paper
owls' inner breast is recessed beneath the actual chest sheets; dense coverage
tests prevent that support from piercing the folds. The independent reviewer
confirmed the bird improvement, while retaining the remaining shape concerns.
Internal pass 51 reduced feather spacing but introduced small dark marks in
the rear render; that experiment was reverted and was not performance-tested
or accepted. Passing geometry tests alone did not catch that visual regression.

Pass 52 narrows the exposed paper-jaw return and resting wing fold. All 295
tests and the production build pass, including the original-count density
minimum, moving clearance, paper coverage and eye visibility. Fresh noon/night
campus captures accompany this revision. The independent targeted review found
improved edges without a definite new defect, but the overall construction still
looks heavier than the source. The last full-set/campus grade remains pass 46's,
not a claim for this revision. The compiled pass-52 bundle loads three dense
Lantern Desk characters with zero pending requests, 123 draws and 829,340
submitted triangles. No console warning/error was observed. This close-up
runtime check uses the device clock and is not a matched performance sample.

Pass 53 corrects botanical rotation order so each leaf's pitch follows its own
branch. The full independent review found a net foliage improvement, but asked
for varied pitch, spacing and curvature instead of horizontal oval tiers.
Pass 54 adds warm, static Wayfinder eye ink and Keeper's fitted face border.
Only that immutable eye finish may share emissive batches; variable lantern
glows remain independent, and different emissive colors/intensities never merge.
All 296 tests and the production build pass after this optimization.
The wide view drops from 117 to 110 draw calls; no browser warning/error was
observed in the isolated close-view check. This is a draw-count reduction, not
a claim of increased frame rate.

Pass 55 corrects Jarvis's torso-to-helmet ratio and Scout's smaller companion
scale without widening the motor envelope. It retains the original standing
height limit and floor contact. All 297 tests and the production build pass.
An initial full-suite run overlapped portrait generation and correctly rejected
the previous manifest; the complete rerun after generation passed.
The compiled pass-55 worker loads dense meshes with zero pending requests and
no observed browser warning/error. A settled zoom frame reports two dense
avatars, 129 draws and 1,878,645 submitted triangles. A clock-driven shadow
refresh also drew dense receivers: 296 draws / 3,810,182 triangles in one
observed frame. These are different workloads, not a matched frame-time result;
the fixed-hour camera benchmark does not measure that occasional refresh cost.

Pass 56 makes the fitted torso seam continuous and reduces Keeper's page-block
depth while bowing the thinner covers. A new dense-surface ray test checks more
than fifty seam positions, not just endpoints. All 298 tests and the production
build pass. Independent front/night/quarter/rear review retains both changes;
Keeper's primary silhouette and the ceramic highlights still need refinement.

Pass 57 varies leaf pitch, branch height and spacing, and uses three shared
blade curvatures with the same leaf count and submitted triangle budget.
The plants retain their certified floor envelopes. Glazed character finishes
use a softer eggshell response, keeping a bounded close-up clearcoat. All 298
tests and the production build pass. Independent review retains the foliage and
eggshell finish, with no conspicuous flattening in all six day/night fronts.
This targeted assessment did not re-inspect every non-Merchant quarter/rear
angle; no A-level acceptance is implied.

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
| Pass 43 campus | 54.90 | 1.95 / 2.90 ms | 108 / 351,883 | 0 |
| Pass 46 campus | 53.19 | 1.89 / 2.80 ms | 108 / 352,219 | 0 |
| Pass 47 campus | 49.80 | 2.12 / 3.40 ms | 109 / 352,219 | 0 |
| Pass 49 campus | 49.40 | 2.05 / 3.30 ms | 109 / 352,219 | 0 |
| Pass 50 campus | 58.40 | 1.86 / 2.70 ms | 109 / 352,219 | 0 |
| Pass 52 campus | 57.10 | 2.01 / 3.50 ms | 109 / 352,219 | 0 |
| Pass 53 campus | 53.40 | 2.22 / 4.00 ms | 109 / 352,219 | 0 |
| Pass 54 campus, before eye batching | 52.50 | 2.45 / 4.30 ms | 117 / 352,427 | 0 |
| Pass 54 campus, after eye batching | 52.40 | 2.38 / 4.20 ms | 110 / 352,427 | 0 |
| Pass 55 campus | 53.10 | 1.94 / 3.50 ms | 110 / 352,427 | 0 |
| Pass 56 campus | 49.50 | 2.51 / 4.00 ms | 110 / 352,795 | 0 |
| Pass 57 campus | 53.80 | 1.74 / 3.90 ms | 110 / 352,795 | 0 |
| Pass 58 campus | 53.70 | 2.21 / 3.90 ms | 110 / 354,087 | 0 |
| Pass 59 campus | 51.80 | 2.31 / 4.00 ms | 110 / 354,087 | 0 |
| Pass 60 campus | 53.60 | 1.61 / 3.00 ms | 110 / 354,087 | 0 |
| Pass 61 campus | 55.10 | 1.92 / 2.70 ms | 110 / 354,087 | 0 |
| Pass 62 campus | 51.70 | 1.64 / 2.50 ms | 110 / 354,087 | 0 |
| Pass 64 campus | 55.10 | 1.48 / 2.10 ms | 110 / 354,091 | 0 |
| Pass 65 campus | 56.10 | 1.40 / 2.00 ms | 110 / 354,091 | 0 |
| Pass 66 campus (rejected shape) | 52.60 | 2.18 / 4.50 ms | 110 / 354,107 | 0 |
| Pass 67 campus | 54.20 | 2.08 / 4.10 ms | 110 / 354,155 | 0 |
| Pass 68 campus | 53.31 | 2.31 / 4.10 ms | 110 / 354,155 | 0 |
| Pass 69 campus | 52.61 | 2.25 / 4.20 ms | 110 / 370,367 | 0 |
| Pass 70 campus | 50.00 | 2.25 / 3.90 ms | 109 / 372,303 | 0 |
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
| Pass 43 full-face close | 54.80 | 1.73 / 2.90 ms | 133 / 2,356,965 | 3 |
| Pass 46 full-face close | 53.60 | 2.09 / 3.60 ms | 133 / 2,387,397 | 3 |
| Pass 49 full-face close | 56.00 | 1.81 / 3.20 ms | 134 / 2,387,397 | 3 |
| Pass 53 full-face close | 50.90 | 2.01 / 3.80 ms | 134 / 2,387,397 | 3 |
| Pass 54 full-face close, before eye batching | 50.10 | 2.36 / 4.30 ms | 135 / 2,407,557 | 3 |
| Pass 55 full-face close | 52.30 | 2.00 / 3.80 ms | 135 / 2,379,397 | 3 |
| Pass 56 full-face close | 49.40 | 2.48 / 4.20 ms | 134 / 2,408,197 | 3 |
| Pass 57 full-face close | 53.10 | 2.11 / 4.30 ms | 135 / 2,414,805 | 3 |
| Pass 58 full-face close | 51.89 | 2.40 / 4.40 ms | 135 / 2,416,713 | 3 |
| Pass 65 full-face close | 49.90 | 1.57 / 2.20 ms | 135 / 2,416,717 | 3 |
| Pass 69 full-face close | 53.20 | 2.20 / 4.20 ms | 135 / 2,432,993 | 3 |

The development-only close-room selector translates this same camera by the
actual room-grid offsets, without changing any avatar. Additional material
coverage: pass 43 Dispatch submitted 52.80 fps / 2.03 ms mean / 3.60 ms p95
(two dense avatars, 107 draws, 1,664,690 triangles); Wayfinders submitted 53.50
fps / 1.81 ms / 3.20 ms (three dense avatars, 136 draws, 2,382,652 triangles).
After the bird-profile change, pass 46 Dispatch submitted 57.90 fps / 1.74 ms /
3.10 ms (two dense avatars, 107 draws, 1,668,194 triangles). These are extra
workloads, not matched comparisons with the original baseline.
Pass 47's matte Wayfinders close workload submitted 50.60 fps / 1.91 ms mean /
3.20 ms p95, with three dense avatars, 137 draws and 2,381,932 triangles.
Pass 49's Lantern Desk close workload submitted 54.60 fps / 2.09 ms mean /
3.50 ms p95 (three dense avatars, 122 draws, 810,080 triangles); Dispatch
submitted 55.29 fps / 1.86 ms / 3.30 ms (two dense avatars, 108 draws,
1,668,194 triangles). Pass 48 was an internal untimed geometry iteration.
Pass 50 Dispatch submitted 56.10 fps / 1.94 ms mean / 3.20 ms p95, with two
dense avatars, 108 draws and 1,668,194 triangles.
Pass 52 Lantern Desk submitted 57.50 fps / 1.88 ms mean / 3.50 ms p95, with
three dense avatars, 122 draws and 810,080 triangles.
Pass 54 Wayfinders submitted 51.49 fps / 2.35 ms mean / 4.20 ms p95 before eye
batching (139 draws), and 53.21 fps / 2.18 ms / 4.00 ms afterward (138 draws).
Both submitted 2,381,660 triangles with three dense avatars.
Pass 58 Beacon submitted 55.71 fps / 1.40 ms mean / 3.10 ms p95, with one
dense avatar, 76 draws and 970,912 triangles. It is an additional workload,
not a matched baseline comparison.
Pass 59 Dispatch submitted 50.10 fps / 2.30 ms mean / 4.20 ms p95, with two
dense avatars, 109 draws and 1,670,062 triangles. It remains a variable
same-machine sample rather than proof of unchanged worst-case GPU cost.
Pass 60 Dispatch submitted 51.60 fps / 2.17 ms mean / 4.00 ms p95; pass 61
submitted 51.80 fps / 1.94 ms / 3.20 ms. Both used two dense avatars, 109 draws
and 1,670,062 triangles. The rejected 60 shape still has its measured evidence.
Pass 62 Dispatch submitted 50.40 fps / 2.03 ms mean / 3.40 ms p95, with two
dense avatars, 109 draws and 1,670,062 triangles. Its fixed-night campus sample
submitted 52.30 fps / 2.03 ms / 3.50 ms (110 draws, 354,087 triangles, no dense
avatars). These retain the same sampling limits; no night baseline was measured.
Pass 64 Dispatch submitted 56.30 fps / 1.62 ms mean / 2.30 ms p95, with two
dense avatars, 109 draws and 1,670,462 triangles. The failed pass-63 prototype
was corrected before timing; its rendered comparison remains in the review ledger.
Pass 65 Lantern Desk submitted 54.81 fps / 1.47 ms mean / 2.10 ms p95, with
three dense avatars, 123 draws and 812,568 triangles. The normal construction
runs in the existing worker; this steady-state sample does not time initial mesh
construction or GPU completion.
The original 271831b fixture was re-run after pass 65 at the same 1000 × 800
viewport and 1.5 DPR cap. It submitted 51.30 campus fps / 1.42 ms mean / 2.30 ms
p95 and 50.40 close fps / 1.16 ms / 1.90 ms, retaining 93/329,483 and 46/303,944
draws/triangles respectively. Pass 65's matching close sample is 49.90 fps with
three dense avatars: comparable submitted cadence, but higher CPU submission
cost (1.57 vs 1.16 ms mean), not a speed increase or proof of equal GPU cost.
Pass 66 Lantern Desk submitted 52.10 fps / 2.00 ms mean / 3.80 ms p95, with
three dense avatars, 123 draws and 814,168 triangles. Pass 67 submitted 51.91
fps / 2.21 ms / 4.10 ms, retaining 123 draws with 818,968 triangles. Both are
uninterrupted camera-only samples at the same fixed viewport; the rejected
shape's timing is retained rather than omitted. No agent activity was injected.
Pass 68 Lantern Desk submitted 53.10 fps / 2.11 ms mean / 4.00 ms p95 at noon
and 54.40 fps / 1.98 ms / 4.00 ms at night. Both retained three dense avatars,
123 draws and 818,968 triangles. These bounded samples do not establish unchanged
worst-case GPU completion time.
Pass 70 Lantern Desk submitted 52.90 fps / 1.96 ms mean / 3.80 ms p95, with
three dense avatars, 123 draws and 837,636 triangles. Its camera workload uses
the same room-grid offset, while the real table and homes moved rearward by
0.4 units. That is a changed layout, not an exact pixel-matched close comparison.

These samples remain in the earlier performance range, but do not prove a speed
increase or an unchanged worst case. Pass 71 submits 53.90 campus fps (1.89 ms
mean / 3.70 ms p95 CPU, 109 draws, 372,303 triangles) and 51.50 Merchant close
fps (2.21 ms / 4.40 ms, 135 draws, 2,435,449 triangles, three dense avatars).
The 308-test suite and production build pass. No new texture, light or draw is
introduced by the finish changes; material variation uses existing vertex colour
and the existing wood map. Pass 72 also passes 308 tests and the production
build. Its campus sample submits 51.70 fps (2.23 ms mean / 3.90 ms p95 CPU),
while Merchant close submits 53.50 fps (1.59 ms / 3.00 ms); draw and triangle
counts match 71. The glaze/brass update uses the existing environment and stock
material, without extra passes, lights or maps. Pass 73 passes 309 tests and the
production build. Actual geometric checks cover the convex breast, waist,
badge visibility, shoulder intersections and all sixteen walking envelopes.
Its campus sample submits 54.61 fps (1.79 ms mean / 3.50 ms p95 CPU), and
Merchant close submits 53.51 fps (1.77 ms / 3.50 ms), retaining pass 72's draws
and triangles. The reviewer accepts the silhouette change but not an A grade.
Pass 74 passes 310 tests and the production build. Its campus sample submits
51.80 fps (1.72 ms mean / 3.70 ms p95 CPU, 109 draws, 372,431 triangles);
Merchant close submits 52.30 fps (2.12 ms / 4.00 ms, 142 draws, 2,485,049
triangles, three dense avatars). The shape adds work, despite retaining the
earlier sampled cadence. The isolated production server serves build
`index-CXn15XV3.js`; its actual 624 × 416 responsive window, campus transition,
deep-zoom mist invitation, third/first-person modes and exit were checked in
the browser without console warnings/errors. This is isolated build evidence,
not installation or a live-agent action. The dense tier is deliberately not used for
the distant campus. JavaScript submission time is not GPU completion time.
Pass 75 passes 311 tests and the production build. The actual cut-away cover and
three curved hinge points are checked geometrically. Campus submits 54.01 fps
(2.06 ms mean / 3.80 ms p95 CPU, 108 draws, 372,524 triangles); Merchant close
submits 53.10 fps (2.09 ms / 4.00 ms, 141 draws, 2,485,449 triangles, three dense
avatars). The unchanged review score is retained, not rounded up to acceptance.
Pass 76 passes 311 tests and the production build after correcting a curl that
extended below its specified envelope. Campus submits 53.20 fps (2.08 ms mean /
3.80 ms p95 CPU, 108 draws, 372,852 triangles); Merchant close submits 54.60 fps
(1.98 ms / 3.50 ms, 141 draws, 2,505,049 triangles, three dense avatars). The
reviewer retains the compact curl but does not raise the ensemble's score. The
rear view largely obscures Keeper and is not proof of the hidden attachment.
Pass 77 passes 312 tests and the production build. Facial tint follows the final
displaced surface at both mesh tiers. Campus submits 54.40 fps (1.91 ms mean /
3.50 ms p95 CPU, 109 draws, 372,668 triangles); Dispatch close submits 53.80 fps
(2.05 ms / 3.80 ms, 107 draws, 1,670,823 triangles, two dense avatars). The
reviewer requests a narrower, softer beak; this checkpoint is not accepted as an
overall visual improvement and was not installed on the isolated production server.
Pass 78 passes 312 tests and the production build. Campus submits 54.11 fps
(1.97 ms mean / 3.70 ms p95 CPU, 108 draws, 373,172 triangles); Dispatch close
submits 53.31 fps (1.83 ms / 3.40 ms, 107 draws, 1,721,223 triangles, two dense
avatars). The smoother authored horn adds geometry, with no new material pass.
Its reviewer retains the correction but still prioritizes broader, varied feather
groups and continuous lower-breast coverage.
Pass 79 passes 313 tests and the production build. The broader feather groups
cover every sampled front-breast ray and stay outside the actual body, while all
sixteen detailed characters still exceed 100× their original authored triangles.
Campus submits 54.50 fps (1.79 ms mean / 3.50 ms p95 CPU, 108 draws, 371,404
triangles); Dispatch close submits 54.30 fps (1.96 ms / 3.70 ms, 107 draws,
1,544,423 triangles, two dense avatars). Reduced geometry does not replace the
visual review: its craft score rises to 7.5, with remaining joins identified.
Pass 80 passes 314 tests and the production build. Tests cover hidden rear roots,
actual feather/body clearance and every motor envelope; an initial 0.00147-unit
clearance was increased rather than weakening the 0.002 minimum. Campus submits
50.90 fps (1.81 ms mean / 3.00 ms p95 CPU); Dispatch close submits 52.30 fps
(1.85 ms / 3.40 ms), retaining 79's draws and triangles. These samples are in
the earlier same-machine range; they do not establish equal worst-case GPU cost.
An additional pass-25 close run overlapped a production-window change and fell
to 42.60 scene fps / 47.98 RAF Hz. It is retained in local evidence but excluded
from the matched table; the uninterrupted rerun above does not hide that caveat.

Pass 81 passes 315 tests and the production build. Dispatch's smaller, flatter
envelope has four straight folds and sits within 0.035 units of its actual
feather surface. Keeper's curled sheet shares its cover's warm paper colour.
Campus submits 55.61 fps (1.63 ms mean / 3.10 ms p95 CPU, 108 draws, 371,484
triangles); Dispatch close submits 54.00 fps (2.00 ms / 3.60 ms, 110 draws,
1,552,423 triangles, two dense avatars). These remain samples, not a locked
frame-rate claim. The isolated pass-80 production bundle `index-BHMpy-HH.js`
also loaded without console warnings/errors; its idle responsive view is a
smoke check, not an additional fixed-workload performance measurement.

Pass 82 is an internal optical prototype, not an independent approval: its
convex cover obscured Scout's pupil with excessive haze. Its 316 tests/build
passed; campus submitted 55.50 fps (1.81 ms mean / 3.20 ms p95 CPU, 109 draws,
371,724 triangles), and Merchant close 53.40 fps (2.15 ms / 4.10 ms, 142 draws,
2,529,449 triangles, three dense avatars). Pass 83 reduces only that optical
cover's alpha to 0.045, preserving Echo's existing held magnifier material.
Actual geometry tests verify that both pupil and catchlight remain behind the
convex surface. Pass 83 passes 316 tests and the production build. Its campus
sample submits 54.00 fps (1.89 ms / 3.40 ms); Merchant close 54.70 fps (1.91 ms /
3.70 ms), with the same counts as 82. The new lens adds one draw and 24,000 dense
triangles compared with 81; it does not use an additional refraction render pass.

Pass 84 passes 317 tests and the production build. Jarvis and Scout's painted
shells use a separate satin response without the close-tier clearcoat; their
roughness and bump reuse the existing glaze grain texture. Other identities and
brass/optical parts retain their materials. Campus submits 54.70 fps (1.83 ms
mean / 3.50 ms p95 CPU, 111 draws, 371,724 triangles); Merchant close submits
51.70 fps (2.14 ms / 3.90 ms, 142 draws, 2,529,449 triangles, three dense avatars).
The distant material split costs two draws; close geometry is unchanged. No
extra texture or render pass is added, and these measurements do not establish
an unchanged worst-case GPU workload.

Pass 85 passes 317 tests and the production build. The painted shells receive
one shared 512-pixel grain map, distinct from glazed details, used for colour,
bump and roughness. This adds approximately 1.33 MiB including mipmaps; it adds
no light, material draw or rendering pass compared with 84. Campus submits
52.80 fps (2.04 ms mean / 3.90 ms p95 CPU), Merchant close 52.70 fps (2.23 ms /
4.30 ms), retaining 84's draws and triangles. These samples remain in the earlier
range without proving unchanged worst-case timing. Actual 1536 × 1024 noon/night
campus screenshots are preserved alongside the pass-85 portrait and performance
evidence. No live agent events were sent to produce the images.
The isolated server served `index-B5VlfhFI.js`; its responsive window, eleven-step
close zoom invitation, third/first-person mist modes, exit and reset were checked
in the browser without console warnings/errors. This is built-app evidence, not
native-package installation or proof of genuine agent work.

Pass 86 passes 317 tests and the production build. Geometry checks now require
the continuous cream socket to cover part of the iris perimeter while leaving
each pupil visible; the convex eye is no longer warped onto the cream surface.
Campus submits 53.70 fps (1.79 ms mean / 3.00 ms p95 CPU, 110 draws, 371,724
triangles); Dispatch close submits 52.40 fps (2.21 ms / 4.10 ms, 111 draws,
1,552,423 triangles, two dense avatars). The visual reviewer rejects the
projecting eye surrounds despite these tests: 86 is a corrective checkpoint,
not the accepted replacement, and the isolated production server remains at 85.

Pass 87 passes 317 tests and the production build. The cream halves preserve
their exact shared heart tip; thinner eyes retain convex surfaces and visible
pupils beneath the upper brow. Campus submits 54.80 fps (1.90 ms mean / 3.70 ms
p95 CPU); Dispatch close submits 55.11 fps (1.88 ms / 3.60 ms), with 86's draw
and triangle counts. These are fixed-workload submission samples, not equal
worst-case GPU cost. The reviewer retains this correction but not an A-level
match; the isolated production server remains at 85 pending further refinement.

Pass 88's sculpted brow prototype passed 318 tests/build but was rejected on
appearance; its source was restored to 87 before the next submission. Campus
submitted 56.30 fps (1.76 ms mean / 2.90 ms p95 CPU), Dispatch close 54.80 fps
(1.59 ms / 2.80 ms), with 87's counts. Passing tests did not overrule the review.
Pass 89 passes 318 tests/build. Paper chest quads are genuinely coplanar and the
mountain folds reach the tapered lower body. Dense ray tests preserve coverage
over the inner volume. Campus submits 55.70 fps (1.87 ms / 3.50 ms, 110 draws,
371,724 triangles); Reflection close 53.20 fps (1.65 ms / 3.30 ms, 123 draws,
838,489 triangles, three dense avatars). No new light, texture or render pass
is added. These remain timing samples, not a worst-case performance guarantee.

Pass 90 passes 319 tests/build, including broad diagonal wing proportions,
actual body overlap and all moving motor envelopes. Campus submits 55.60 fps
(1.68 ms mean / 3.20 ms p95 CPU, 110 draws, 371,732 triangles); Reflection close
52.00 fps (1.59 ms / 3.20 ms, 123 draws, 839,289 triangles, three dense avatars).
The two additional wing boundary points add eight overview triangles and 800
close triangles; no extra material draw, light or texture is added. The reviewer
retains the construction change, not an A-level reference match.

Pass 91 passes 319 tests/build. Lower wing roots and reduced forward bulge
preserve the same geometry count, body overlap and walking clearance. Campus
submits 54.50 fps (1.76 ms mean / 3.40 ms p95 CPU), Reflection close 54.80 fps
(1.76 ms / 3.10 ms), with 90's counts. These are same-machine samples rather
than GPU-completion measurements. The independent score remains 7.5 / 7.5.

Pass 92 passes 321 tests/build. The hood is a closed 0.010-unit folded sheet,
with front/rear coverage and open eye-window ray checks. Each lighter cheek has
two coplanar surfaces rather than an apex fan. Expressions move with the same
head joint; no new action, identity or observer authority is introduced.
Campus submits 55.20 fps (1.58 ms mean / 2.30 ms p95 CPU, 110 draws, 371,988
triangles); Reflection close 56.90 fps (1.64 ms / 2.20 ms, 125 draws, 864,889
triangles, three dense avatars). The wrap adds two close-view draws and 25,600
triangles relative to 91; there is no new texture, light or rendering pass.
These variable samples do not establish equal worst-case GPU or startup cost.

The isolated production server serves `index-ClnaTyvZ.js`. Its Reflection window,
eleven-step zoom invitation, third/first-person mist, exit and reset were checked
without console warnings/errors. No live agent events were sent. This proves a
local built-app checkpoint, not native-host adoption. The repository's current
noon/night campus images now show pass 92 at 1536 × 1024; the campus was not
independently rescored in this character-focused submission.

Pass 93 passes 322 tests/build but is rejected visually. Its coplanar temple
returns and fitted rear layers retain identities and geometry counts, yet the
rear closure is worse than 92. Campus submits 51.50 fps (2.08 ms mean / 3.80 ms
p95 CPU, 110 draws, 371,988 triangles); Reflection close 51.10 fps (2.42 ms /
4.00 ms, 125 draws, 864,889 triangles, three dense avatars). These samples do
not override the independent visual rejection. Its evidence is retained, not
published as an accepted checkpoint.

Pass 94 passes 322 tests/build. The long temple planes terminate at a planar
rear closure rather than a shared apex; two shallow fitted overlaps replace
the pinched rear fan. Tests check coplanar temple triangles, outward rear
closure normals, fitted overlap depth, all moving clearances and the immutable
100× baseline. Campus submits 58.70 fps (1.96 ms mean / 2.70 ms p95 CPU,
110 draws, 371,968 triangles); Reflection close 53.79 fps (1.81 ms / 3.00 ms,
125 draws, 862,889 triangles, three dense avatars). This removes 20 overview
and 2,000 close-view triangles relative to 92 without adding textures, lights
or passes. Submission samples remain variable, not GPU-completion guarantees.
The isolated production server and campus capture files still show 92; 94 is
a source/portrait checkpoint, not a new host-installation claim.

Pass 95 passes 323 tests/build. Ray checks verify that the two chest sheets
have a shallow ordered overlap instead of coincident centre faces. Campus
submits 54.90 fps (1.96 ms mean / 3.20 ms p95 CPU), Reflection close 54.30 fps
(1.88 ms / 3.30 ms), with 94's draw/triangle counts. No new geometry, material,
texture or light is allocated. The reviewer treats the visual result as a tie;
the numerical correction is not evidence of a higher appearance score.

Pass 96 passes 323 tests/build. Lumen's existing shadow-free point light moves
from outside its front pane to inside the actual glass bounds; intensity and
range remain unchanged. The front no longer receives extreme near-field light
from its own emitter. Campus submits 56.30 fps (1.75 ms mean / 3.00 ms p95 CPU),
Reflection close 55.50 fps (1.33 ms / 2.40 ms), retaining 95's resource counts.
These are submission samples, not proof of identical worst-case GPU timing.

Pass 97's optical prototype passes 325 tests/build, including per-pane UVs,
bounded glow textures and synchronization of agent-driven emission into the
close-tier material clone. Campus submits 58.00 fps (1.93 ms mean / 3.00 ms
p95 CPU), Reflection close 54.40 fps (1.94 ms / 3.20 ms), with 96's draw and
triangle counts. One shared 128-pixel glow map adds about 0.083 MiB with mipmaps;
the near glass coat adds shader work, not a light or refraction render pass.
The reviewer rejects the strongly striped appearance despite functional checks;
96 remains the retained lighting checkpoint pending correction.

Pass 98 passes 325 tests/build. Broader warm falloff dims all colour channels
toward the glass edge, avoiding 97's saturated red bands. Each pane retains
local UVs and the close coat follows the original agent-driven glow state.
Campus submits 54.40 fps (2.14 ms mean / 3.30 ms p95 CPU), Reflection close
56.30 fps (1.89 ms / 2.70 ms), with 97's resource counts and the same timing
limitations. Its source/portrait checkpoint is independently retained, but
neither the 9/A target nor an unchanged worst-case GPU workload is established.

The isolated production checkpoint was also updated to pass 98's
`index-By6AwSB_.js`. Reflection window view, eleven-step zoom invitation,
third/first-person mist, exit and reset passed with no console warnings/errors.
No live activity was injected; this does not prove adoption by a native host.

Pass 99 passes 326 tests/build after regenerating portraits. An earlier suite
raced the portrait fingerprint write; a subsequent run had one sanitized MCP
fixture failure, which passed in isolation and in the next full suite without
changing protocol code. The aged structural brass shares one 512-pixel map for
colour, bump and roughness (about 1.33 MiB with mipmaps); it adds no model
triangles or lights. Its separate material increases sampled overview draws
from 110 to 112, with 371,968 submitted triangles. Campus submits 53.30 fps
(1.89 ms mean / 2.60 ms p95 CPU). Reflection close first submits 48.00 fps
(1.84 / 3.20 ms), then 56.90 fps (1.92 / 3.30 ms) on repeat, with three dense
avatars, 125 draws and 861,909 submitted triangles. Both samples are retained;
the repeat does not erase the lower sample or establish equal GPU workload.
Pass 99 noon/night campus captures are actual 1536 × 1024 views, not a new
campus grade. The independent character result remains 7.5 / 7.5.

Pass 100 passes 327 tests/build. Close detailed surfaces switch the existing
eight-sample AO to a 0.22-unit radius with a smaller denoising kernel, retaining
the same targets, draw count and fallback. No new frame pass is allocated.
Campus submits 52.30 fps (1.75 ms mean / 3.00 ms p95 CPU); Reflection close
52.60 fps (1.74 / 2.80 ms), with pass 99's sampled draw/triangle counts.
These remain submission samples, not GPU-completion measurements.
Actual noon/night/close captures are in the pass-100 evidence directory.
Inspection then found a pre-existing exact-noon initialization mismatch:
the scene's recorded hour began at noon before the noon light profile was
applied, so the first exact-noon update was skipped. The pass-100 noon image
therefore does not establish its intended new daylight balance. The reviewer
retains the independently visible close-AO cleanup; the initialization fix and
fresh daylight comparison must follow separately.

Pass 101 passes 328 tests/build. The real scene light-setup statements now apply
noon before receiving the first state update; a regression test executes that
initialization and checks the sky, ground, key, position, reflection and backdrop.
Campus submits 55.30 fps (1.95 ms mean / 3.10 ms p95 CPU), Reflection close
56.30 fps (1.99 / 3.30 ms), retaining pass 100's resource counts and timing
limitations. Independent actual-image review retains the corrected noon result
without raising its score. Current repository noon/night screenshots are now
the matched 1536 × 1024 pass-101 captures. Portrait models remain pass 99.

Pass 102 passes 328 tests/build. The existing noon key moves forward with a
smooth third-axis day interpolation and slightly stronger direct illumination;
the shadow blur widens without changing the 2048 map or twelve blur samples.
Campus submits 55.20 fps (2.12 ms mean / 3.50 ms p95 CPU), Reflection close
49.79 fps (2.34 / 4.20 ms), with pass 101's sampled resource counts. The lower
close sample is recorded, not replaced by the prior faster one. GPU completion
and worst-case minute-change shadow cost remain unmeasured. The independent
review narrowly retains 102 but does not raise its grade; material scale is
the next priority. Its actual captures remain in the pass-102 evidence folder.

Pass 103 passes 329 tests/build but its rug result is not accepted. Campus
submits 50.80 fps (2.27 ms mean / 4.10 ms p95 CPU), Reflection close 51.30 fps
(2.20 / 4.00 ms), with 102's resource counts. The rejected smooth-rug evidence
is retained separately; its quieter wood is carried into 104.

Pass 104 passes 329 tests/build. Irregular tuft groups use the same 512-pixel
rug texture, now shared with a shallow bump response; a bounded dry sheen adds
fragment shader work without another draw, texture, light or frame pass.
Campus submits 55.80 fps (1.79 ms mean / 2.50 ms p95 CPU, 112 draws, 371,968
triangles); Reflection close 55.20 fps (1.94 / 2.70 ms, 125 draws, 861,909
triangles, three dense avatars). These same-machine samples are not GPU
completion or worst-case guarantees. Actual 1536 × 1024 day/night campus and
close-room evidence is saved under surface-pass-104. The reviewer retains the
revision at campus craft 7.0 / fidelity 7.5; this is not a fresh full-character
grade or A-level acceptance. The next priority is one room's coherent furniture
grouping, preserving neutral agents and genuine-action-only behavior.

Pass 105 passes 331 tests/build. Only Beacon's starter layout changes: the rug
fits the desk group more closely and a low book shelf with a supported plant
uses the existing reserved floor-recipe footprint. An agent-authored floor
recipe hides this fallback; replacement, invalid data, removal and disposal
are tested. Mutable fallback roots are excluded from static traversal pruning,
so a batch rebuild cannot silently restore hidden starter furniture. All
sixteen routes, body clearances, chosen paces and neutral homes remain valid.

Initial samples submit 51.10 campus, 51.40 Reflection close and 53.20 Beacon
close fps. After the visibility-pruning correction, final samples submit 58.70
campus fps (1.79 ms mean / 2.50 ms p95 CPU) and 58.00 Beacon close fps (1.59 /
2.80 ms). Campus has 113 draws / 376,974 triangles; Beacon close has 78 draws /
994,895 triangles with one dense avatar. The added static furniture costs
5,006 overview triangles and one sampled campus draw, with no new textures or
lights. Both initial and final timing evidence remains saved; variation is not
proof of a speedup or equal GPU-completion cost. The review accepts modest room
grouping, not overall A-level quality or native-host adoption.

Pass 106 passes 331 tests/build. Beacon's monitor moves left, turns toward its
existing home and scales uniformly to 0.86. The neutral home and facing stay
unchanged; only a genuine agent-chosen work interaction uses the corrected
work-facing direction. No mesh, texture, light or render pass is added. Campus
submits 56.70 fps (2.02 ms mean / 3.30 ms p95 CPU), Beacon close 56.70 fps
(1.39 / 2.60 ms), with 105's draw and triangle counts. These are variable
submission samples, not a guaranteed speedup or GPU-completion measurement.

The isolated production checkpoint now serves `index-Cja8CWH_.js`. Beacon
window view, eleven-step zoom invitation, third/first-person mist, exit and
reset pass without console warnings/errors. It remains an isolated empty
bridge: no live agent event or decoration was injected. Its responsive
screenshots are smoke evidence, separate from the full 1536 × 1024 visual
comparison. The reviewer retains the focal-point correction without increasing
the score; overall A-level acceptance remains open.

Pass 107 passes 331 tests/build. Clear Path has a shorter, rear-shifted rug,
a deeper capsule table and closer side homes. The center home and all neutral
facings remain unchanged. Initial route checks caught a visiting paper owl's
pinched rear approach; the actual rear aisle waypoints were moved back to fit
the deeper table. Body radii, physical blockers and clearance assertions were
not reduced. The final complete route suite passes with decorations on/off.

Campus submits 54.30 fps (1.64 ms mean / 2.30 ms p95 CPU, 112 sampled draws,
376,974 triangles); Clear Path close submits 53.70 fps (1.44 / 2.30 ms, 100
draws, 1,853,423 triangles, three dense avatars). The same two-second warm-up,
ten-second sample and fixed viewport apply; GPU completion remains unmeasured.
Actual noon/night campus, full close and window-view captures are saved under
surface-pass-107. The independent reviewer retains the grouping improvement
without increasing the grade. Shipped portrait models remain pass 104, and
the separately smoke-tested production checkpoint remains pass 106.

Pass 108 passes 332 tests/build but its furniture proportions are not accepted.
Two staggered desks carry their actual screens and paper/mug groups; south
residents have low stools, and neutral facings stay unchanged. The desk recipe
anchor follows a real tabletop and its full bounded footprint is tested.
Starter desktop props yield to an agent-authored desk recipe, without hiding
the desk or screen. Full route and body-clearance checks pass unchanged.

Campus initially submits 49.20 fps (1.96 ms mean / 3.50 ms p95 CPU), then
56.50 fps (1.93 / 2.60 ms) on an unchanged repeat. Both samples are retained.
Wayfinders close submits 50.30 fps (1.86 / 3.40 ms) with three dense avatars.
Campus has 113 draws / 376,512 triangles, close 144 draws / 2,330,597 triangles.
One additional 768 × 384 tabletop map replaces one of the removed chair pairs'
geometry costs; no light or frame pass is added. Variable submission timings
do not establish unchanged GPU cost. Pass-108 captures are prototype evidence,
not a finished visual result; production remains the accepted pass 106.

Pass 109 passes 333 tests/build. Paired desks widen to 1.6 units, with 1.6/1.4
depths and a 0.12 apron instead of 0.20. Curved tables use 24 edge subdivisions
instead of eight while each furnishing stays below the existing 4,000-triangle
budget. Top heights, contact patches and textures stay unchanged. The real
central aisle passes the largest visitor's clearance check. The left small pot
moves onto an existing shelf; the floor recipe moves to the front-left corner
and hides its starter plant. An initial stool exit clipped the reserved recipe
envelope; moving its actual egress inward corrected this without smaller
collision bounds. All sixteen full routes and chosen paces pass afterward.

Campus submits 57.60 fps (1.95 ms mean / 3.30 ms p95 CPU), Wayfinders close
58.10 fps (1.99 / 3.30 ms). Campus has 114 sampled draws / 384,190 triangles;
close has 139 draws / 2,237,723 triangles with three dense avatars. Different
character positions alter visibility and which dense geometry is submitted;
the lower close count is not a general optimisation claim. No new light or
frame pass is added. All portraits were regenerated for the shared source
fingerprint, without identity changes. The independent reviewer retains 109,
not an A-level match. Repository noon/night screenshots now contain its actual
1536 × 1024 campus captures. GPU completion remains unmeasured.

The isolated production checkpoint now serves `index-BYbCq47q.js`. Wayfinders
window view, eleven-step zoom invitation, third/first-person mist, exit and
reset pass without console warnings/errors. All teams remain awaiting update;
no genuine agent event was fabricated for the test. The connected empty QA
bridge and responsive smoke captures do not establish live-chat adoption.

Pass 110 passes 334 tests/build as a prototype but is rejected visually. The
more lateral noon key preserves unshadowed front/top irradiance yet creates
distracting broad room shadows. Campus submits 54.30 fps (2.22 ms mean /
4.20 ms p95 CPU), Wayfinders close 53.30 fps (2.31 / 4.60 ms), with 109's
resource counts. Those samples and images remain under surface-pass-110.
The daylight change and its prototype-specific test were removed; no 110
lighting was promoted to the isolated production checkpoint.

Pass 111 passes 334 tests/build. Wayfinder shells use a restrained satin-clay
response with the existing porous clay map; no new texture, light, geometry or
frame pass is added. The close tier retains an opaque standard material, not
an added clearcoat. Chosen identities and their accessories remain unchanged.
Campus submits 57.20 fps (1.91 ms mean / 2.80 ms p95 CPU, 115 sampled draws,
384,190 triangles). Wayfinders close submits 56.80 fps (1.83 / 2.90 ms, 140
draws, 2,229,707 triangles, three dense avatars). These use the same two-second
warm-up and ten-second fixed-viewport sample; CPU submission is not GPU
completion. Actual campus, close, window and regenerated multi-angle portraits
remain under surface-pass-111. The independent review retains the finish as
a nearly tied variation, not an A-level result. Production remains pass 109.

Pass 112 passes 335 tests/build. Dark-backed Wayfinder glass replaces the
cloth-like face finish, retaining the existing analytic curved surface. Its
shallow lip is an open annulus, not a raised filled panel that could obscure
the eyes. Coarse/dense ray tests verify the aperture, visible eyes and original
helmet-fit bounds. The first prototype failed the original-count minimum and
rim fit; a seven-ring frame and closer surface offsets correct both without
weakening the tests. The close glass uses a restrained stock clearcoat, with
no transmission, transparent duplicate, new texture, light or render pass.

Campus submits 57.60 fps (2.01 ms mean / 3.10 ms p95 CPU, 115 sampled draws,
384,318 triangles). Wayfinders close submits 53.40 fps (2.14 / 3.90 ms, 139
draws, 2,236,235 triangles); an unchanged repeat submits 54.90 fps (1.70 /
3.10 ms, 140 draws, 2,239,435 triangles). Both close samples retain three
dense avatars; orbit timing changes sampled visibility. Both results are kept,
not averaged into an identical-speed claim. The same fixed viewport, two-second
warm-up and ten-second workload apply. CPU submission is not GPU completion.
Actual full campus/window/close captures and model-generated front/night/group
quarter/rear portraits remain under surface-pass-112. Occluded characters in
group views do not establish hidden all-angle fit.
The independent reviewer retains the change, raising character craft to 8.0
while fidelity stays 7.5. Room and campus scores do not rise. Peak portrait
reflections remain the next targeted correction; A-level acceptance is open.

Pass 113 passes 335 tests/build. Only visor roughness, environment response and
close clearcoat strength/roughness change; the open lip, dark base tone, warm
eyes, shell finish, lights and geometry are unchanged. The actual captured
campus submits 58.50 fps (1.62 ms mean / 2.40 ms p95 CPU, 114 sampled draws,
384,318 triangles). Wayfinders close submits 50.50 fps (1.50 / 2.90 ms, 139
draws, 2,240,491 triangles, three dense avatars). The lower close submission
rate coexists with lower CPU time; these variable samples do not establish a
fixed frame rate or GPU completion. Evidence uses the same fixed-viewport
two-second warm-up and ten-second orbit, with actual full-size scene captures
and regenerated multi-angle portraits under surface-pass-113.
The independent reviewer retains 113 without increasing the grade. No further
visor adjustment is prioritized. The central guide's wrapped-garment shoulder,
neck overlap and broad cape folds now matter more than optical fine-tuning.

The isolated production checkpoint now serves pass 113, `index-DCRU-cKU.js`.
Its Wayfinders window, eleven-step zoom invitation, third/first-person mist,
exit and reset pass with no console warning/error. The empty QA bridge
connects while every team remains awaiting update; no agent event was injected.
Responsive production smoke captures are separate from the full-size visual
comparison and do not establish live-chat adoption.

Pass 114 passes 336 tests/build. The guide's cape now has continuous front/
lining UVs for its existing cloth map, a closer neck release, asymmetric broad
folds and bounded near-surface interpolation. Its topology, shader, texture
allocation, lights and motion joints are unchanged. Closed winding, actual
torso clearance, source density and all sixteen physical routes remain tested.
A new asymmetric-fold check samples the rear contour rather than requiring
one arbitrary mirrored point pair to differ.

Campus submits 51.81 fps (2.43 ms mean / 4.30 ms p95 CPU, 114 sampled draws,
384,318 triangles). Wayfinders close submits 52.31 fps (2.04 / 3.90 ms, 139
draws, 2,240,491 triangles, three dense avatars). These variable same-machine
samples do not establish locked fps or GPU completion. Full scene captures and
regenerated portraits are retained under surface-pass-114. Production remains
the separately smoke-tested pass 113 while this visual study is reviewed.
The reviewer narrowly retains the non-regressive result at unchanged grades.
It does not resolve the shell-like reading. Normal-view neckline overlap and
two legible descending folds remain the required next construction correction.

Pass 115 is a mixed, rejected-cape checkpoint, not a production promotion.
The complete suite passes 339 tests/build. A development-only static individual
inspector renders the actual dense models from front, quarter, side and rear
without a bridge, action API or animation loop. Its separate strict TypeScript
check passes. This removes group occlusion as a hidden-fit blind spot, but its
plain studio light is not a matched comparison with the earlier portraits.

The independent reviewer retains the shallower belly-route inlay and rejects
the new shoulder-wide cape overlay: it reads as an armored capelet with pointed
ledges. Guide craft/fidelity are 7.0 / 7.0, Intake ensemble 7.5 / 7.5, campus
7.0 / 7.5. A narrow neck overlap with continuous descending fabric is required.
The isolated side also reveals the existing floating hat emblem; its geometry
was unchanged in this pass. No A-level or all-angle acceptance is claimed.

Campus submits 58.70 fps (1.88 ms mean / 2.60 ms p95 CPU, 114 sampled draws,
384,226 triangles). Wayfinders close submits 57.70 fps (1.90 / 3.30 ms, 139
draws, 2,240,399 triangles, three dense avatars). These are the same fixed-size
two-second warm-up and ten-second orbit samples, not GPU-completion measures
or a locked-rate claim. Actual scene, regenerated group portraits and isolated
guide views remain under surface-pass-115. Production remains pass 113.

Pass 116 passes 340 tests/build. The shoulder overlay is reduced to a narrow
neck turn; the lower cape releases closer to the body and its side hems rise.
The floating hat medallion becomes a shallow star fitted to the actual hood,
matching the chosen identity's crest. Coarse and dense attachment tests probe
real front-triangle interiors, avoiding edge-on rays at narrow star points.
The original per-character triangle minimum and route envelopes still pass;
the guide has 818,400 near triangles, above its immutable 777,600 minimum.

Campus submits 55.71 fps (2.03 ms mean / 3.60 ms p95 CPU, 114 sampled draws,
383,602 triangles). Wayfinders close submits 54.60 fps (2.26 / 4.00 ms, 139
draws, 2,239,775 triangles, three dense avatars). No new texture, light or
render pass is added. Timing uses the same fixed workload and is not a GPU
completion or locked-speed claim. The actual campus, room, close scene, group
portraits and isolated guide angles are retained under surface-pass-116.
The reviewer retains the correction at guide/ensemble/room craft and fidelity
7.5 / 7.5. The hat star is visibly attached and the broad neckline ledge is
gone; small stepped neckline ends remain. The cape still hugs the body like a
jacket. Hanging fold structure remains unfinished, and no A is granted.

The isolated production checkpoint now serves pass 116, `index-BqkTfWng.js`.
Wayfinders window, eleven-step zoom invitation, third/first-person mist, exit
and reset pass without console warnings/errors. The empty QA bridge connects;
all teams remain awaiting update, with no injected event or live-chat claim.

Pass 117 passes 340 tests/build after correcting a collar-clearance failure.
The cape's limits now bound actual Cartesian coordinates, not an over-restrictive
radial control value. Two narrower rear fold paths depart from the lower torso;
32 columns resolve them without increasing material, texture or draw-pass count.
The guide has 843,600 close triangles, still inside its original coarse budget.
Geometry checks retain lining clearance, closed winding and distinct hanging
ridge/valley depth. These checks do not constitute visual acceptance.

Campus submits 48.20 fps (1.90 ms mean / 3.30 ms p95 CPU, 114 sampled draws,
383,854 triangles). Wayfinders close submits 46.50 fps (1.90 / 3.30 ms, 139
draws, 2,240,027 triangles, three dense avatars). RAF remains approximately
60 fps. These lower submission rates are retained, not replaced by a faster
repeat; CPU time is lower than pass 116, but neither measure proves GPU time
or identical responsiveness. Same-size actual scene and isolated/group portrait
evidence remains under surface-pass-117. Production remains pass 116.
The independent reviewer rejects retention unchanged: a conspicuous shoulder
oval breaks the otherwise improved cloth. The rear folds are visibly stronger,
not merely a test-only change; they should be preserved while coverage is
repaired. Guide craft is 7.0, fidelity 7.5; ensemble/room remain 7.5 / 7.5.
After that repair, the separate navy cone/plain helmet is the largest remaining
normal-view mismatch against the cream-edged point and layered reference hood.

Pass 118 passes 345 tests/build. The guide's hidden upper sleeves are tucked
inside the cape; coarse/dense ray checks guard actual coverage across both
sleeves. The independent reviewer sees the oval disappear in side, quarter
and night views, retaining the folds and narrower shoulders at 7.5 / 7.5 for
guide, ensemble and room. No visible regression is reported; no A is granted.

Performance investigation reproduces the camera scheduling loss without any
WebGL work: sinusoidal 1.2 ms timestamp jitter lowers the old input throttle
from 60 to 43.8 fps at 60 Hz and 45.6 fps at 120 Hz. Input now tracks its own
60 fps deadline grid with bounded jitter tolerance and a no-burst guard. It
does not add a loop or change the 30 fps animation clock. Tests cover jitter
at 60/120/144/240 Hz, late recovery, coalescing, idle and reset behavior.

The unchanged fixed camera workload now submits 60.00 fps for campus (1.30 ms
mean / 1.90 ms p95 CPU) and 60.00 fps for Wayfinders close (1.76 / 3.10 ms).
Sampled draws/triangles remain 114 / 383,854 and 139 / 2,240,027, with three
dense close avatars. This is a scheduling correction, not a reduced graphics
workload or guaranteed GPU-completion rate. Both ten-second measurements and
full visual evidence remain under surface-pass-118. Production remains 116.

Pass 119 adds the guide's cream outer point, a single fitted navy front patch,
and a light ceramic face surround. The initial closed inset produced overlapping
surfaces and was replaced before final capture. A narrow seam samples both arcs
and straight spans and is fitted to the real helmet. New coarse/dense checks
guard its open aperture, positive shell clearance, and the star's clearance
above the inset. Guide density is 889,200 close-up triangles.

The independent reviewer retains the cream point/inset and lighter surround,
but requires replacing the drawn-looking, slightly wavy seam with a shallow
returned edge. Guide/ensemble/room remain 7.5 / 7.5, campus 7.0 / 7.5. This is
an intermediate checkpoint, not A-level acceptance or a production promotion.

The initial full suite had one unconfirmed MCP-client activity failure under
load. No protocol or timeout was changed: the isolated 17-test client suite
passed, followed by all 346 tests and the production build. Both runs are
retained in the temporary validation logs. Campus submits 60.00 fps (1.48 ms
mean / 2.00 ms p95 CPU, 115 draws, 384,310 triangles); Wayfinders close submits
60.00 fps (1.73 / 2.70 ms, 140 draws, 2,240,483 triangles, three dense avatars).
These fixed ten-second samples are not GPU-completion guarantees. Full visual
and timing evidence is in surface-pass-119. Isolated production remains 116.

Pass 120 replaces the separate tan seam and original lip with one open fitted
ceramic frame. Six radial samples shape the inward return and outer slope;
only the narrow inward return has a warm ceramic tint. The guide contains
897,200 close-up triangles, still inside the existing distant mesh budget.
All 346 tests and the production build pass on the first full run.

The independent reviewer retains 120 over 119 as cleaner construction, with
no new hole, exposed join, shoulder breakthrough or expression/glare regression.
Scores remain unchanged: the broad, nearly flush band merges into the helmet
in the normal portrait and actual-room view. A visibly raised nested profile,
not more grain or hidden subdivision, remains the next source-match priority.

Campus submits 60.00 fps (1.60 ms mean / 2.20 ms p95 CPU, 116 sampled draws,
384,390 triangles). Wayfinders close submits 60.00 fps (1.87 / 3.20 ms,
141 draws, 2,240,563 triangles, three detailed avatars). Fixed-size evidence is
under surface-pass-120. No GPU-completion or A-level visual claim is made.

Pass 120 is now served by the isolated production preview (bundle
index-OFALvFWY.js). Window view, eleven zoom-in steps to mist invitation,
third/first-person mist, exit and reset pass. The isolated bridge connects,
all six teams remain Awaiting update, and no console warnings/errors appear.
Responsive production smoke captures are retained in surface-pass-120; they
are not a replacement for the full-size reference comparison.

Pass 121 flattens the raised cream face and gives its outer return a steeper
profile, a recessed ceramic tint and real shadow casting. Triangle counts
remain unchanged. All 346 tests and the production build pass. The independent
reviewer now sees the nested hood at ordinary portrait and actual-room size,
retaining 121 over 120 without raising the scores. That contrast exposes a
scalloped contour at the forehead/cheek and a heavy return. The next requirement
is a cleaner curve, not more thickness or darker edging.

Campus submits 59.90 fps (2.11 ms mean / 3.60 ms p95 CPU); close submits 59.80
fps (1.98 / 3.30 ms). Counts remain 116 / 384,390 and 141 / 2,240,563, with
three dense close avatars. These measured results are retained unchanged under
surface-pass-121. Isolated production remains the smoke-tested pass 120.

Pass 122 evaluates the rim on a continuous elliptical helmet envelope rather
than its coarse triangle facets, welds coincident normal seams and tests the
outer contour in both mesh tiers. All 347 tests and the production build pass.
The independent review permits retention as non-regressive but sees no clear
normal-view improvement: the forehead wave and small cheek irregularities
remain. The contour issue is not closed. The next prioritized source mismatch
is the guide's thin angular belly route, not further minute rim work.

Campus submits 59.9946 fps (1.52 ms mean / 2.10 ms p95 CPU); Wayfinders close
submits 60.00 fps (1.96 / 3.20 ms). Draw/triangle counts remain unchanged from
121, including three dense close avatars. Evidence remains under
surface-pass-122; production remains the smoke-tested pass 120.
