# G1c.1 Recovery: closed-eye geometry/domain audit

**LENGTH HOLD; G1c.1 NOT CLOSED.** Offline measurement and QA only. Product `src/`, native ROI limits, model/dependencies, all lash guards, Density35% cap and renderer remain unchanged. Version0.5.1; PR#5 stays Draft, no merge/deploy/partial release.

## Baseline

Branch `feat/g1c1-lash-fidelity`, starting HEAD/origin-feature `0204810ed9e3319e0de5783127ec4df4b5429859`, clean. Fetch confirmed main/origin-main `b02fac3c684f2a7e3178933cb66ded925ab8bce8`. Previous [CI43219923729](https://github.com/Llayon/AuraGram/actions/runs/43219923729) completed **failure**, not PASS. Previous full suite162unitPASS,166browserPASS/2originalLengthFAIL/3dependentNOTRUN remains historical baseline. See [source-frozen ending study](G1C1_FREEEND_DATASET_REPORT.md).

## Question and fixed experiment

Can geometry describe a downward-projected upper-lash domain outside the predicted opening without treating it as semantic skin or bypassing existing abstention? This stage measures that question; it does not detect new tips or draw an effect.

Frozen [protocol](tests/visual/lash-domain-protocol.json) SHA256 `e0207ae13fdb0072edb52705f3a77c50c81352cd600c0a8f9032d662e40719df`. Inputs/outcomes from previous stages were already known. This is a posthoc engineering audit, not a newly blinded benchmark. Source-only labels remain untouched.

- Eight source files, seven original photographs: three ready-source free-ending portraits325/461/217, older natural/light portraits, hair-covered-eye context, closed-white-liner context, and a rotated derivative of light. Sixteen actual frozen engine/source cases,32 eyes. Rotated/C/W cases are not independent photos.
- Reuse actual Chromium/WebKit FaceMesh geometries and v6 observed crossing paths. No MediaPipe inference or landmark modification. Full source JPEGs and modules are hash-bound; actual native analysis replays verify path/flag/grid equivalence separately.
- Reuse five provisional source endings on ready photos (ten engine/label observations). Three earlier P312 annotations remain explicitly unevaluated because FaceMesh was no_face. No oracle seeds or favorable endpoints added.
- Measure the polygon formed by canonical upper/lower arcs; native closest-arc signed distance; axial position; boundary clearance `max(2px, .005*eyeWidth, annotationUncertainty)`; descriptive aperture at25/50/75% **landmark-index**, not arc-length, positions.
- Fixed diagnostic below-arc slabs: axial10–90%, depth.25/.5 eye-axis widths, outside predicted opening plus clearance. Fixed descriptive aperture cutoffs .04/.08/.12/.16/.24. All configurations retained; none adopted.

Numerical polygon area, proper segment crossings, nonadjacent touches/collinear overlaps, gap-sign changes and canonical endpoint alignment are checked separately. These detect some degenerate geometry, not correct semantic eyelid localization. Aperture uses absolute projected gaps; signed gaps are also retained. Neither gap nor numerical validity certifies an open/closed eye, skin, root ownership, terminal tangent or safe effect destination. Low-aperture outward normals remain sensitive to predicted arcs.

Probe membership is **center-only**. Annotation uncertainty clears the opening boundary but does not guarantee that the whole position disk stays inside axial/depth/slab limits. The independent critic supplied a counterexample near the10% axis boundary; this limitation is explicit rather than presented as a safe mask.

## Results

| Observation | Chromium | WebKit | Meaning |
|---|---:|---:|---|
|217 labeled eye descriptive aperture | .06420 | .08471 | .08 cutoff accepts one engine, rejects the other; these are separately measured geometries. |
|217 ending centers in depth.25 probe | 0/2 | 0/2 | Narrow slab does not reach the selected source endings. |
|217 ending centers in depth.5 probe | 2/2 | 2/2 | Source endpoints lie well below upper arc on visible skin, but this is only a geometric match. |
|White712 crossing paths intersecting depth.5 probe | 8 across2eyes | 11 across2eyes | The same geometric admission overlaps unresolved negative-control structures. Not8/11 certified false eyelashes. |
|Hair-covered eye crossing paths in depth.5 probe | 3 | 4 | At aperture.24 this context also passes the descriptive opening cutoff; no guard relaxation justified. |
|325 provisional endings inside predicted opening | 2/2 | 2/2 | Remain protected; cannot recover these by painting across the opening. |
|461 provisional ending axial coordinate | −.03263 | −.03503 | Outside frozen10–90% axis range, so excluded even though outside opening. No favorable corner exception introduced. |

At cutoff.04 no frozen217 ending center enters. At.08 Chromium217 enters but WebKit217 does not, while the white-liner control's paths already overlap in both engines. At.12/.16 both217 label centers enter in both engines, with the unresolved white-liner paths still admitted. At.24 hair-control paths also overlap. These are geometry/path-intersection observations, **not precision/recall or a calibrated classifier score**. Observed paths may be real lashes, skin folds, liner texture or foreign hair. A closed eye containing real lashes does not invalidate an ambiguity guard.

All32 measured eye polygons pass the declared numerical checks; this does not certify their semantic boundary. Neither simple widening nor the tested scalar aperture cutoffs establish a safe, useful extension policy. The source-visible ending/domain mismatch is real, but resolving it requires evidence about the particular structure and root rather than interpreting every outside-opening point as skin or a lash.

Independent source/overlay critique also identifies a concrete contamination risk: below an open eye325, the geometric probe includes lower-lash rows. On the hair-covered eye, a numerically valid predicted polygon lies over hair. On closed217, observed crossing paths can follow real upper lashes inside the merged dark fan. Geometry alone neither identifies upper-lash ownership nor decides whether an existing crossing veto is a true occluder. No blanket relaxation is justified by these images.

## Implementation and evidence

- `lash-domain.mjs`: pure native-coordinate geometry measurements and numerical validity checks; no lash/render API or dependency from product code.
- `lash-domain-inputs.cjs`, `prepare.cjs`, `audit.cjs`: hash-bound existing source/geometry/labels, frozen protocol, all32 eye records and CSV. Audit records its own and helper hashes.
- `lash-domain-overlays.cjs`: actual native crossing replay in each engine, then original/native eye crops, canonical arcs, observed paths, source-only circles and coarse geometric probe diagrams. Labels enter only the separate drawing call, never actual analysis.
- Nine new meaningful unit checks added to `npm test`. `package.json` changes only that command; no version or dependency update. Synthetic invariants test geometry mechanics, not photographic naturalness.
- Previous Original/0.5.1/Recovery effect comparisons and difference maps remain unchanged. There is no new effect/difference map from this geometry-only audit because no product pixels or effect policy changed.

Open [the domain gallery](tests/visual/domain-evidence/index.html):112 original/diagram PNG references across both engines, full-portrait previews and native eye crops at100/200/400%. Masks use a separate coarse geometric diagram grid of maximum96 columns, not increased analysis resolution. Cyan/magenta are canonical arcs, red paths are observed crossings, white circles are provisional source annotations; red/amber/blue/purple probe maps have explicit legends. These are diagnostic figures, not retouch results. Full originals/authors/licenses remain in the earlier [free-ending](tests/visual/freeend-evidence/index.html), [recovery provenance](tests/visual/recovery-evidence/sources.json) and [expanded dataset](tests/visual/expanded-evidence/sources.json) evidence. No new image source or model. File titles do not establish bare/makeup/mascara categories.

## Verification and release

Fresh verification:

| Gate | Result |
|---|---|
| `npm test` after fixer | 171 PASS (162 previous +9 new), zero skipped/cancelled |
| Full single-worker browser | 166 PASS /2 original Length F1 FAIL /3 dependent NOT RUN,171 total |
| Native crossing replay | 16/16 engine/source cases; exact recorded paths, flags and224 ROI dimensions; no model requests |
| Isolated performance | 3 PASS, after all overlay/browser jobs closed |
| Legacy L20 | lash-off71.2ms / moderate73.1ms, delta+1.9ms; does not establish active Length |
| Active natural720x1080 D35/L100/Def25 | off14.7ms / active18.9ms, delta+4.2ms; LengthRGB227 / DensityRGB206,2tips, stable cache/analysis timestamp |
| Active fixture cold analysis | 140.2ms |
| Active export2400x3600 | render196.8ms / PNG323.8ms / button-to-blob586.3ms,9,225,180bytes |
| Build / package / check:site | PASS; native Chromium and software WebKit real face/retouch/PNG smoke |

Original F1 remains LengthRGB0 vs required>10 in Chromium/WebKit. No existing assertion, golden or threshold changed. Full-suite dependent NOT RUN remains NOT RUN despite a separately successful performance run. All timings measure unchanged productv6, not adopted domain processing. No new mobile/per-process peak-memory guarantee.

Initial unit run before the ninth regression recorded170unitPASS; that log is retained alongside the final171PASS. Critic found the initial diagnostic polygon check missed collinear retracing/touching. The fixed helper rejects its explicit synthetic counterexample; new regression preserves input coordinates. Initial audit/helper and fixed audit are both archived; all real measurements remain identical after excluding the added self-contact flag and helper hash. An early crossed-arc test fixture was corrected because its original arcs were merely inverted, not crossing. No product failure or existing threshold was concealed. Build-generated CSS/vendor churn was restored.

Independent [visual critique](tests/visual/lash-domain-visual-critic.json) records25 inspected C/W PNG hashes. The separate [final critic](tests/visual/lash-domain-final-critic.json), SHA256 `0f926da7fc0b2fd02b19eb894618e0452ba1f7ff58d1825b921e9dfc9a5d7d25`, verifies112 archived PNG hashes,135 local gallery links,16 replay cases/32 eyes, stored logs and absence of product/existing-test/golden changes. Native169px gallery crop displays676CSSpx at400%; screenshot was visually checked. Final critic remains separate from the already-preserved pack. Evidence integrity does not grant naturalness or a semantic mask. Branch CI status is reported separately in PR#5, never inferred from these local checks.

**HOLD.** No product-domain widening, guard bypass, confidence reduction or procedural fan. Next implementation decision must preserve protected opening and ambiguity guards while demanding local structure/root evidence. This audit alone cannot approve a closed-eye Length effect or close the original efficacy failures. Physical iPhone/Android testing remains UNVERIFIED; no new semantic skin/closure coverage is claimed.

Next bounded implementation experiment: image-only ridge/connected-trace hypotheses below the upper arc on this same frozen corpus, with the current crossing veto retained as diagnostic evidence and the product applicator untouched. Detect across the full allowed diagnostic region; never use the five annotated endings as seeds/directions. Compare root association, terminal continuation and contamination on217, white-liner, hair and lower-lash controls before considering any candidate for rendering. This is a new offline detector hypothesis, not permission to use the geometric probe as an effect mask.
