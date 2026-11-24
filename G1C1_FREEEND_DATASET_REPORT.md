# G1c.1 Recovery — real free-ending dataset audit

**LENGTH — HOLD. G1c.1 NOT CLOSED.** This stage adds evidence and a real-photo regression, not a product change. Version remains 0.5.1; PR [#5](https://github.com/Llayon/AuraGram/pull/5) remains Draft. No merge, deployment, model update, gate relaxation or new rendering algorithm.

## A. Baseline and scope

- Branch `feat/g1c1-lash-fidelity`; initial HEAD/origin-feature `b75bbb254b06113cc09fad83169b8ed9cdc5530a`, initially clean.
- Fetched main/origin-main remain `b02fac3c684f2a7e3178933cb66ded925ab8bce8`. Production reference `b883cf5d8cbcc75723b4701e98444fc349db4856`, version 0.5.1.
- Prior terminal/subpixel experiments remain intact. Their budget stops do not certify free tips. See [terminal audit](G1C1_TERMINAL_REPORT.md).
- New scope: seven original licensed photographs, ten main native eye views plus one extra context view, eight sparse provisional upper-ending annotations. Five sources were screened first; two supplemental sources were selected after the first batch revealed eligibility/domain gaps. This is sequential engineering selection, **not an untouched generalization benchmark**.
- Primary and independent source-only assessments were frozen before inference separately for each batch. No manual coordinate, direction or favorable crop entered FaceMesh, geometry or tracing. The independent annotator knew prior project experiments; this exposure is disclosed in the labels.

## B. What this stage establishes

The new photographs do not establish useful natural Length. They identify a distinct limitation: some real upper lashes project downward over the opening or onto skin below the upper arc. An outward-only upper-lid band cannot capture these endings. A higher ROI cap or lower tracing threshold cannot fix that domain mismatch.

| Source | Actual FaceMesh C/W | Sparse frozen upper endings | Posthoc finding |
|---|---|---:|---|
| Ivan Radic Commons macro | no_face / no_face | 0 | Visible row is lower lashes; outside upper-lash scope. |
| Pexels 22032198 | no_face / no_face | 0 | No fabricated geometry or forced positive. |
| Pexels 31215869 | no_face / no_face | 3 | Locally visible endings, but no usable actual face geometry. |
| Pexels 32526448 | ready / ready | 2 | Endings project inside predicted opening, signed distance about −53…−57 native px. Protection must remain. |
| Pexels 4611686 | ready / ready | 1 | Ending outside opening, about −75 px below upper outward band; ownership/overlap provisional. |
| Pexels 16720351 | no_face / no_face | 0 | Defocus/grain/merged shafts; original source does not supply trustworthy individual endpoints. |
| Pexels 21792059 | ready / ready | 2 | Closed-eye upper endings on skin outside predicted opening, about −198…−235 px below upper arc. Current whole-eye crossing gate bypasses processing at224. |

Signed distances use source-native closest-segment geometry, outward normal away from lower-lid centroid. They are not an exact reproduction of the anisotropic working-grid distance. Opening polygons are predicted landmark geometry, not certified semantic skin/iris segmentation. None of these labels licenses painting inside a protected region.

No frozen sparse ending matched an automatic tip within its stated engineering positional radius. **This is not a permissible-target recall score**: no_face cases have no geometry; other labels are below the current band or inside the opening. Unlabelled automatic tips cannot all be called false positives because annotations are deliberately sparse. Uncertainty radii and confidence scores are not calibrated probabilities.

## C. Implementation and reproducibility

Product `src/`, native ROI limits, canonical arcs, measured tracing, Density interpolation/35% cap, cache lifecycle and all existing assertions/goldens are unchanged.

- `lash-freeend{,2}-analysis.cjs`: real app upload/FaceMesh, native original decode, fixed224/320/384 cap sweep, both eyes, actual geometry, traces and rejection diagnostics. Inputs are hash-checked before browser launch. A no_face result never receives manual geometry.
- `lash-freeend{,2}-render.cjs`: replay the frozen real geometry and native analysis; compare pure lash-only production0.5.1 against recovery. Actual canonical ring is reconstructed and round-tripped within1e−12 before applying production geometry. Small floating-point differences are retained, not described as exact zero. No second model inference.
- `lash-freeend-audit.cjs`: posthoc sparse association, nearest upper arc, ROI/opening classification and rejection tables. Coordinates are never used as seeds.
- `lash-freeend-debug.cjs`: separate hash-checked native analysis replay; response/confidence maps, accepted/rejected paths, tips/tangents and actual native Length50 extension diagnostics. Black maps after an early guard mean unexamined, not absent hair.
- `curate-freeend.cjs` / `replay-freeend.cjs`: content-addressed raw-byte evidence with SHA256 and compressed JSON/source snapshots. Restore ignored inputs without overwriting conflicting files. Production module bytes are checked against `git show b883…`.
- New browser regression uses the licensed real lower-lash macro with actual no_face fallback: all lash controls must preserve pixels while a global preset still works. It supplements, rather than substitutes for, real-positive efficacy tests.

Frozen labels:

| Artifact | SHA256 |
|---|---|
| First independent annotations | `97ce307b67ea92e2a4054f25a41d428eaadcbecb352fe840cf6e451e0580f800` |
| Supplemental independent annotations | `3db2c8c999d8e58a324b2c833f00085f9c6c2c330859c12814bbf394281d8810` |
| First input freeze | `9af5be792b3f7ef6f2a783807c21fee0d9458a293603daf1b15ca167050244e6` |
| Supplemental input freeze | `a49f35be1b25e545ca7c91ba10e4eb9de73a6ccbe232e5b5a9792c9e7f1028fd` |
| Independent posthoc critic | `5588cdd60bd2f0feba48356ff76006c9a83bff961b434915c46c1d91fc7d268a` |

Original sources, dimensions, authors, licenses and hashes are retained in `lash-freeend{,2}-sources.json` and download manifests. The Commons original is [Ivan Radic, CC BY2.0](https://commons.wikimedia.org/wiki/File:Close-up_of_human_eyelashes.jpg); other originals use the [Pexels license](https://www.pexels.com/license/). Derivative crops/comparisons are identified and attribution retained; no endorsement implied. Prior editing, mascara/coating, extensions and single-fiber biology are unknown. Titles are not groundtruth. All seven EXIF orientations are1; original decoded dimensions were verified.

## D. Visual evidence and independent verdict

Open [the full comparison gallery](tests/visual/freeend-evidence/index.html). It includes all ready-source full portraits, Original / productionDensity50 / recoveryDensity50 / productionLength50 / recoveryLength50 / Definition50 / combinedD35,L20,Def25, native160px crops at100/200/400% and combined difference×8. Both eyes are retained through geometry/diagnostic maps; sparse crop windows target frozen labels and **all** cap224 automatic tips. Full original JPEGs and native source views remain accessible. Four no_face sources explicitly have no fabricated effect matrix. Redundant overlapping tile PNGs are omitted from the pack; their rectangles/hashes remain in native manifests alongside full unresized views.

Independent critique: [raw report](tests/visual/lash-freeend-posthoc-independent-critic.json), including30 inspected artifact hashes. On WebKit325, two automatic candidates produce a tiny change:37 pixels, maximum channel difference7, in overlapping windows around ambiguous upper-lid texture/creases. That is neither two independent successes nor proof of terminal extension. No obvious opaque block/long needle was found in those patches, but useful natural Length was not established. Chromium325 and both engines461/217 remain Length identity at224. Supplemental217 source endings are visible on skin, but recovery is unchanged. No visual acceptance granted.

All failed comparisons and first-use outputs are retained. None is replaced with a favorable cap, engine or source. Product0.5.1 goldens are unchanged. Skin noise/JPEG/eyeliner false-positive rates and light/bare/mascara subgroups cannot be quantified from this sparse set; those categories remain incompletely covered.

## E. Measurements

First-use pair-analysis milliseconds and accepted tip counts, in fixed cap order (not independent randomized benchmarks):

| Engine/source | 224 ms / tips | 320 ms / tips | 384 ms / tips |
|---|---:|---:|---:|
| Chromium325 | 309.9 /0 | 150.7 /0 | 198.2 /0 |
| Chromium461 | 291.3 /0 | 112.6 /0 | 329.2 /1 |
| Chromium217 | 105.4 /0 | 13.1 /0 | 8.6 /0 |
| WebKit325 | 135 /2 | 135 /1 | 159 /1 |
| WebKit461 | 184 /0 | 140 /1 | 133 /2 |
| WebKit217 | 86 /0 | 55 /0 | 70 /0 |

JIT/cache/order and early gate exits confound timings. More tips are not demonstrated quality; e.g. Chromium461's384 tip has c≈.518, below renderer threshold. No cap increase is adopted. Engine comparisons include separately measured FaceMesh geometry, so divergent candidates do not isolate a Canvas arithmetic defect. Typed buffer estimates, rejection counts, densities and geometry are preserved per eye/cap in the posthoc audit and raw manifests. They are not total-process peak RSS measurements. Full portraits in the gallery are1080 previews of native full-canvas passes; those one-off render timings are not an interaction benchmark.

Fresh warm-render/export and test results are recorded below after verification. Physical iPhone X/11/11ProMax and Android remain **UNVERIFIED**; headless iPhone11 WebKit is not a physical-device claim.

## F. Verification and release

Fresh verification:

| Gate | Result |
|---|---|
| `npm test` | 162 PASS, no skipped/cancelled tests |
| Full `npm run test:e2e -- --workers=1` | 166 PASS / 2 FAIL / 3 dependent NOT RUN (171 total) |
| Original F1 | Length RGB difference0 vs required>10 in both Chromium and WebKit; assertions unchanged |
| New real lower-lash no_face regression | PASS in Chromium and WebKit |
| Isolated `chromium-performance --no-deps --workers=1` | 3 PASS; does not turn dependent NOT RUN into a green full suite |
| Active natural fixture720x1080 D35/L100/Def25 | off15.2ms, active19.1ms, delta+3.9ms; Length RGB227, Density RGB206,2 tips, stable cache key/analysis timestamp |
| Active fixture cold analysis | 104.2ms |
| Legacy L20 | off80.2ms / moderate78.7ms; negative delta is run variability, not evidence of acceleration; legacy fixture does not prove active Length |
| Active full export2400x3600 | render185ms / encode425.6ms / button-to-blob675.2ms;9,225,180bytes |
| Build / package:site / check:site | PASS; Chromium native and iPhone11-WebKit software filters, real face, retouch and PNG smoke |

All raw logs, including original failures and an interrupted first build invocation, are retained in the pack. PowerShell `ErrorActionPreference=Stop` interrupted that invocation on Browserslist's stderr warning; rerun uses native exit codes and completed successfully. No dependency update was introduced. A preliminary curator incorrectly required bit-exact geometry roundtrip0; measured5.55e-17 was within the renderer's existing1e-12 invariant. Only that new curator assertion was corrected, not any product/test threshold.

Density efficacy, L6/L22 and isolation regressions passed in the full run; original Length failures remain mandatory. Goldens were not regenerated. Runtime source modules are unchanged against the stage baseline. Current warm performance passes; prior runs' variability/failures remain in earlier reports and no physical mobile guarantee is inferred.

Critic/fixer verification: initial render harness lacked execution-time JPEG/module/baseline preconditions. NEW12 reruns use the verified wrapper's pre/post hashes, preserving original07 outputs. The curator requires every NEW12 PNG to match its original07 bytes. Debug maps/actual native extension diagnostics are archived; WebKit325's two attempts extend only about1.30/1.26nativepx at Length50, not evidence of a correct terminal. Audit now records its own and `lidFrame` module hashes. See the frozen code-review findings and later final verification artifact. No annotation was edited after inference.

Release decision: **HOLD**, PR stays Draft, production0.5.1 untouched. No partial Density release. New dataset evidence alone cannot make G1c.1 releasable.

Final independent verification: [critic](tests/visual/lash-freeend-final-critic.json), SHA256 `ccbd402024c0109beb5374fe0f76dab6435d4aa0d2cde38d8dde992c58095305`. All455 archived raw-byte mappings,293 local gallery links,138 NEW12/07 identical PNGs,48 debug maps and four pre/post provenance bindings passed. Initial FCR1–5 reproducibility findings were fixed and verified. A missing ignored snapshot was restored from the pack without overwriting any existing bytes. The400% gallery displays native160px crops at640CSSpx and was visually checked. These checks validate evidence integrity, not natural Length. The final critic is a separate tracked artifact outside the already-frozen pack; prior pending code-review and all original outputs remain unchanged. Branch CI is reported separately in PR#5 and is not represented as PASS here.

## G. Next bounded experiment

Freeze a geometry/domain-only comparison across these projected-down upper endings and existing closed/white-liner/hair negatives. Separate (1) predicted opening, (2) skin outside it, (3) current outward-band membership, and (4) crossing-gate evidence. Establish whether a closure-aware skin-only analysis domain can even be specified without admitting hair/folds or protected pixels. Do not simply widen the band symmetrically or lower confidence. Any later domain prototype must remain offline until positive benefit and the existing negative controls pass; actual root ownership and reliable terminal tangent remain unresolved.
