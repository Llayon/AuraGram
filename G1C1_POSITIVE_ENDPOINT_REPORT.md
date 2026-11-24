# G1c.1: original-only endpoint correspondence and endpoint-guard ablation

**LENGTH — HOLD. No product change or release.** New evidence identifies preterminal Length artifacts. The tested endpoint filter reduces some artifacts but does not establish naturalness or preserve every previously supported candidate. It is not adopted.

## A. Baseline and freeze

Continued clean `feat/g1c1-lash-fidelity` at `44420129460f9c719e1bb47f1fb7161c297d714c`; fetch confirmed origin feature equal and main `b02fac3c684f2a7e3178933cb66ded925ab8bce8`. Draft [PR #5](https://github.com/Llayon/AuraGram/pull/5). Product remains v6/0.5.1; production unchanged. Prior CI build PASS, 164 browser PASS / 2 original F1 FAIL / 3 dependent NOT RUN.

Three genuinely new original JPEGs were selected from official photo pages before detector results: [Henry de Guzman / 10460940](https://www.pexels.com/photo/close-up-photo-of-a-beautiful-woman-s-face-10460940/), [Kindel Media / 7298680](https://www.pexels.com/photo/close-up-photo-of-a-woman-s-face-7298680/), [Andrea Piacquadio / 3763152](https://www.pexels.com/photo/brown-freckles-on-face-3763152/). QA use under the [Pexels license](https://www.pexels.com/license/) does not imply endorsement. Original bytes, authors, page/download URLs, dimensions and SHA256 are preserved in [source inventory](tests/visual/positive-evidence/sources.json).

Native dimensions: 3648×5472, 5184×2920, 6812×4450. Six integer native eye crops and three portrait previews were viewed without detector overlays or sharpening. Nearest-neighbour enlargement adds no detail. Earlier project/algorithm exposure is disclosed; the three new photos were unseen before this stage.

Primary original-only screen: 3 provisional distal-structure labels. Independent source-only annotator: **10 provisional endpoint/local-axis labels**, 6 on 10460940 and 4 on 7298680; 3763152 endpoints remain unresolved. Both files were frozen before new-source FaceMesh/analysis. Independent SHA256 `468daac3073d159cfd006e97e72a966e65de64d6928a6992dea233d8195c8462`; primary `b151428e1a9ec48beb0e6f5f4b4d01c4276b2af74d02c381159d9f39fafda105`. [Freeze](tests/visual/lash-positive-freeze.json), [independent labels](tests/visual/lash-positive-independent-labels.json), [primary labels](tests/visual/lash-positive-primary-labels.json).

These are sparse engineering annotations of **visible coated structures**, not certified biological bare lashes, whole-eye recall, exact terminal derivatives or safe extension approvals. Roots merge into makeup/lid and are not labelled. 10460940 has substantial liner/glitter and patterned contact lenses. True bare/light-lash endpoint coverage is still NOT COVERED; prior pale8727422 remains unresolved. Most annotators sampled different hairs. Their one close shared endpoint, primary104-right-a / PI104R2, differs by ≈2.24 native pixels within combined manual radii; both references remain missed under the corner guard.

## B. Real analysis and F1 diagnosis

Fresh real FaceMesh once per image/engine: 7 inputs (three new and four existing controls), Chromium **7 ready**; WebKit **6 ready, 10460940 no_face**. No geometry invented for the exclusion. New sources alone: Chromium3/3, WebKit2/3. Fixed geometry is then reused for offline ablations/rendering without a model call. Actual budgets224/320/384 retain source-native no-upscale semantics.

F1 uses byte-identical `edge-source.jpg` / `edge900.jpg`, SHA256 `c43db5cf32c49064e30cabc8eb80a109159d7dc43d1e7b50ae9d74aa2587a0f0`,900×1126. New original review cannot resolve useful individual upper tips plus connected local shafts without inventing detail. This is not proof lashes are absent. At all three budgets, native ROIs stay **98×69 / 113×67**: a larger cap cannot create missing resolution. Subject-left has 5 Chromium / 6 WebKit `short-measured` rejections; subject-right has one crossing continuation and v6 Length veto. Both engines return zero tips/Length confidence. The actual 450×563 browser render again has Length difference0 against the unchanged >10 requirement. The negative closed-eye test passes both engines. We do not weaken, replace or remove F1.

## C. Correspondence and limits

Eligible tip = original renderer gates c≥.6 and Length confidence≥.25. Nearest tip source location is compared to each frozen manual engineering radius; a separate column includes half the actual analysis-pixel diagonal. This deterministic sampling footprint is not a calibrated confidence interval. Proximity alone can match a neighboring coated shaft; visual identity must still be checked. Angle intervals are broad visible local-axis intervals, not exact derivatives.

| Engine | Cap | Independent labels eligible for analysis | Within manual radius | Within radius + sampling and local-axis interval |
|---|---:|---:|---:|---:|
| Chromium |224|10|2|2|
| Chromium |320|10|0|1|
| Chromium |384|10|1|1|
| WebKit |224|4|1|2|
| WebKit |320|4|1|2|
| WebKit |384|4|3|3|

WebKit denominators exclude six labels on no_face104; they are not comparable whole-dataset rates. All3 primary labels are unmatched in Chromium at every cap. WebKit has one primary label on the usable729 source, within its radius at all caps before ablation. Primary `withinWithSamplingAndAxis:0` helper fields are **N/A**, since primary labels do not provide independent absolute angle intervals; do not interpret these zeros as measured axis failures.

At Chromium224 the two independent nearby cases are PI729R1/R2, ≈3.62/3.17 source px respectively. Shared primary104-right-a / PI104R2 has eye-axis parameter≈1.12; PI104R3≈1.24, PI729L1≈−.28. They are outside the current non-extrapolated corner interval [0,1]. This explains a spatial exclusion but does not justify expanding the mask: biological roots/false-lash history and safe continuation there are unresolved. Some other nearest recorded traces are `clipped-tip` or `short-measured`; nearest trace is not proven identical to the labelled fiber. Trace storage is capped, so nearest-recorded-trace diagnosis is not exhaustive.

## D. New visual defect and two counterfactuals

Native original/v6 pairs show short additional dark strokes **inside still-visible longer shafts** in10460940. They are not demonstrated true-tip extension. The existing fitted transverse endpoint profile is applied only to boundary-recovered candidates; baseline tracing can stop at an orientation/continuity failure without the same terminal check. This is a concrete mechanism worth testing, not a claim all mismatches have one cause.

The offline experimental source copies the **existing** profile positions −2/−1/0/.5/1/1.5/2/3, radii .75/1.5 and floor .006 onto baseline candidates too. No threshold fitting or procedural direction. Exact experimental module graph is frozen; product/cache version unchanged.

1. **Fixed old eligible set:** evaluate every old candidate's profile, then render only retained old candidates, with no tracing rerun/new seeds. Existing boundary candidates were already checked and remain. Chromium104 eligible47→18. Some additional strokes disappear, but some preterminal changes remain. Passing this short profile is not proof of a genuine physical tip.
2. **Full copied-source rerun:** gate during tracing. Rejection changes `used`, enabling different later seeds. Chromium104 tips50→32, including **15 new geometric candidate identities**. The records retain every new/removed identity. This cannot be described as purely removing bad candidates.

Control cost matters: the old Chromium candidate near PI729R1 survives the fixed subset; the one near **PI729R2 is rejected** (`weak-fitted-tip-direction`). Full-rerun proximity around R2 comes from changed selection, so its 2/10 correspondence is not retention of both old positives. WebKit old candidate near PI729L2 is also rejected (`continuing-transverse-ridge`); R1 survives. These are potential useful-structure losses, not proof the removed tips are false. The independent critic rejects adoption of either result now.

All **78 eye/budget Density map/confidence comparisons** in the full counterfactual are exact; all **28 saved native Density/Definition PNG comparisons** between v6 and fixed subset are exact. Fixed-subset candidate identities are verified subsets of v6, with no introduced identity. Closed and hidden-hair target eyes retain zero tips in all tested budgets. This is finite fixture evidence, not a whole-photo protection or universal robustness proof.

## E. Visual evidence and critic

[Gallery](tests/visual/positive-evidence/index.html): **598 labelled views / 374 unique lossless PNGs**, native crops with CSS100/200/400%, full portrait previews720px, original / production0.5.1 / unchangedv6 / labelled fixed-subset counterfactual, Density/Length/combined/differences, ridge/confidence maps and accepted/rejected traces. Source JPEGs are the full-resolution originals. No failed/no_face comparison is hidden. `fixed-endpoint-subset` is explicitly an offline experiment, never labelled a product fix. Original annotated crops retain exact source/crop hashes.

Overlay legend: primary yellow, independent orange, eligible tips/tangent cyan, canonical lids green. Label circles are manual radii; tip circles are sampling footprints. These are diagnostic overlays, not beauty effects. Difference8x is amplified combined-minus-original RGB. Early root/proximal, tangent and source-profile evidence remains unchanged.

Independent critic confirms concrete mid-shaft additions and partial suppression, but also remaining artifacts, positive/control cost and changed-seed selection. No release/naturalness approval. [Critic](tests/visual/positive-evidence/CRITIC.md).

## F. Tests, timing and memory

- Fresh baseline/final unit: **139 PASS**, no failures/skips. Product source and mandatory test assertions unchanged.
- Fresh targeted browser reproduction: **2 original F1 FAIL, 2 closed-white-liner PASS**, actual FaceMesh, both engines. These are not a full-suite PASS.
- New real analysis: Chromium7ready, WebKit6ready/1no_face. Offline reanalysis/rendering requests no model files. Frozen labels and input hashes are verified before analysis.
- Fresh build, package:site and check:site **PASS**, including packaged native Chromium and software WebKit real-face PNG smoke. Generated CSS/vendor line-ending churn restored; product source unchanged.
- Exact source graphs and outputs, annotation freeze, fixed-subset identity, map and PNG invariants are checked by the offline validator. It does not approve naturalness or replace browser tests.
- Portable replay in both engines exactly reproduces all recorded ablation tip/trace/budget and fixed/new-candidate records. A separate replay of729's fixed native render reproduces39PNG files per engine byte-for-byte. Exact QA tools, including the pre-source-graph-CLI renderer used for the archived matrix, are retained in the bundle.
- Prior full local/CI164PASS/2FAIL/3dependentNOTRUN remains prior evidence; latest-head full CI is recorded separately in PR metadata. No baseline golden regeneration or mandatory test removal.
- No new warm-render, export-performance or physical-device claims for the unadopted experiment. Previous v6 active benchmark +4.2ms belongs to the prior stage. Physical iPhone/Android **UNVERIFIED**.
- Diagnostic analysis pair medians (five uncached analysis invocations per cap; not slider/warm-pass time), desktop Chromium:104=127.2/197.9/236.1ms,729=70.5/139.4/171.5ms,376=67.4/103.8/137.1ms at224/320/384. Quality correspondence does not improve consistently, so cap remains224. These observations are not mobile budgets or a controlled speed comparison.
- Product memory/caches unchanged. QA processes one native canvas/portrait at a time and releases temporary canvases. No claim of measured peak memory this stage.

## G. Release

Draft PR#5 remains **HOLD**. No product commit, threshold/ROI/selection change, version bump, ready/merge, Pages deploy, partial release or new production SHA. Only QA tooling, source annotations, evidence and this report change. Two original F1 failures, visible preterminal additions, missing bare/light positives and unproven natural usefulness prevent closure.

## H. Next bounded experiment

Inspect a **fixed named remaining mid-shaft artifact and PI729R1/R2** against the native shaft, actual visible tip, fitted direction and downsampled ROI profile. Establish why a visible continuing shaft passes the short terminal check, while a supported old R2 candidate fails it. Preserve old identities so changed seed selection cannot impersonate retention. Do not widen corners, raise cap, bridge gaps or tune the endpoint floor before resolving those contradictions. F1's valid-FaceMesh requirement alone does not establish lash resolvability; its zero effect remains an explicit unresolved test/specification tension, not permission to synthesize pixels.
