# G1c.1: image-only downward connected-graph prototype

**REJECT ADOPTION / LENGTH HOLD.** This implements and tests an offline detector hypothesis. No product renderer, guard, model, geometry, Density, UI or version change; no effect/extension rendered. Version0.5.1, PR#5 Draft, no merge/deployment/partial release.

## Baseline and frozen scope

Starting branch `feat/g1c1-lash-fidelity`, clean HEAD/origin-feature `4567bc4777c17891136dd0e543f03b3d24f36821`; fetched main/origin-main `b02fac3c684f2a7e3178933cb66ded925ab8bce8`. Previous [CI43224933983](https://github.com/Llayon/AuraGram/actions/runs/43224933983) completed failure. Prior [domain audit](G1C1_DOMAIN_REPORT.md):171unitPASS,166browserPASS/2originalLengthFAIL/3dependentNOTRUN. These are baseline observations, not new checks.

Frozen [protocol](tests/visual/lash-downward-protocol.json) SHA256 `7ff4778a30cc1d7147c34217dc9f04ed3aaa8ebab993e203e4ed7b1cf2661363`, before first real-photo run. Same8files/7original photographs/16engine-source cases/32eyes as the domain audit. One rotated derivative and two engines are not independent sources. Earlier outcomes were known; this is not blind generalization.

Five original-only provisional ending annotations on ready photos are posthoc references; three no_face annotations remain excluded without invented geometry. Detector jobs explicitly whitelist source, dimensions, frozen actual FaceMesh geometry and protocol parameters: **no manual tip, direction or candidate seed enters detection**. No MediaPipe/model requests. All source/module bytes checked before/after; corpus, annotations and original product0.5.1 goldens unchanged.

## Implemented hypothesis

`tests/visual/lash-downward.mjs` is never imported by product code. It observes the decoded source in the existing native-derived224cap ROI without upscale:

1. Eight directional transverse dark-valley filters, radii.75/1.5working pixels, response floor.006, anisotropy and lid-normal projection.
2. Automatic observed ridge seeds within2working pixels of the canonical upper arc. Read-only observations may pass through the predicted opening to investigate connection; this never authorizes painting there.
3. Observed8-neighbor graph with measured direction/coherence and depth progression. No invented gap or procedural fan. Bounded root census and root-to-leaf paths; every explored edge joins actual qualifying ridge pixels.
4. Distal TLS tangent, width estimate, protected-tip clearance, branch/root ambiguity and forward-support checks. Budget/border/unavailable kernels are unknown, not free tips.
5. A later declared subpixel refinement locates only a local threshold-support boundary within1working pixel. This is **not a physical free tip**, same-fiber proof or permission for Length.

Pixel parameters are working-grid units, not source-native units. Native points/length/width are converted with actual ROI x/y scales. A seed near a predicted arc does not establish a follicle. Root attachment/contact span can still merge different shafts or texture. Scores are engineering measures, not probabilities. No skin classifier or closed-eye mode was introduced.

## Builder / critic / fixer history retained

- **V1:** all real observations abstained. Independent [code critic](tests/visual/lash-downward-code-critic.json) reproduced a false multi-root interpretation on a single Gaussian shaft: five samples at different depths inside one root zone have Euclidean span4px. Thick digital ridge routes can also look like branches. The original seven mechanism tests did not require a qualified positive.
- **V2 declared fixes:** transverse response nonmaximum suppression (no added pixels), removal of redundant two-edge graph routes, root-zone contacts projected onto the same upper arc while retaining raw sample count/span. Fixed threshold2.5 unchanged. [Declaration](tests/visual/lash-downward-fixer.json) precedes revised real runs.
- **V2 new positive gate FAIL:** all eight tapered analytic phases were rejected because a pixel-center graph leaf still had real support.5px ahead. Failed test log, every phase/profile and intermediate tool bytes are retained; the gate was not weakened.
- **V3 declared refinement:** observe support on the measured tangent at.25steps up to1grid pixel; require a supported-to-unsupported bracket and bisect6times using unchanged.006floor. Recheck original forward distances, protected regions and borders. No walk beyond1px, gap filling or drawn extension. [Declaration](tests/visual/lash-downward-terminal-refinement.json) precedes revised real runs.
- The final10mechanism tests pass. All8tapered phases produce qualified **analytic observations**; independent [fixer critic](tests/visual/lash-downward-fixer-critic.json) measured up to+.629workingpx bias from analytic generator end to bilinearly interpolated threshold boundary. Six bisections are numerical precision, not extra photographic detail or exact tip localization.

All V1 photo outputs, V2 failed analytic outputs/tools and V3 photo outputs remain archived. This is disclosed sequential engineering selection, not a favorable held-out parameter choice. No frozen threshold was reduced to pass a gate.

## Real-photo results: prototype fails the positive gate

| Version | Chromium hypotheses | WebKit hypotheses | Offline-qualified photo observations |
|---|---:|---:|---:|
| V1 | 632 | 773 | 0 |
| V3 | 532 | 655 | 0 |

These are mostly short graph leaves near root neighborhoods, **not numbers of real eyelashes**. All2592 hypotheses and rejection reasons are retained. V3's synthetic fixes do not establish real-photo usefulness. The revised graph also worsens some sparse ending reach; it is not adopted.

For217's two provisional source endings:

| Engine / version | Local rounded working response L1/L2 | Nearest strictly root-connected pixel, native px L1/L2 |
|---|---|---|
| Chromium V1 | .0212 / .0397 | 156.9 /108.0 |
| Chromium V3 | .0212 / .0397 | 184.3 /167.0 |
| WebKit V1 | .0575 / .0416 | 220.6 /181.2 |
| WebKit V3 | .0575 / .0416 | 222.3 /190.5 |

All four local rounded samples remain active and exceed the unchanged.006floor. This shows local ridge evidence near the frozen source annotations; it does not certify that those responses belong to the exact annotated hair. **The strict graph fails to connect that neighborhood to its automatically observed upper-arc seed zone.** This result must not be reported as absent lashes, missing response or a solved terminal problem.

Most V3 rejections are protected/uncertain tips (531/532 C,655/655 W) and short paths (507C,638W); reasons overlap. Source217 overlays show the real distal fan while root-attached paths stop well before the white annotation circles. Source325 includes protected opening/lower-lash contexts; white-liner and hair inputs seed ambiguous structures. Universal abstention cannot establish negative precision or safe classification.

## Gate-specific connectivity diagnostic

Posthoc, an **undirected8-neighbor diagnostic** traverses only the same active observed ridge pixels and the same automatic seeds, ignoring directional edge gates. It never supplies a candidate to Length.

- V1: this loose diagnostic reaches within annotation uncertainty on3of4engine/ending observations for217 (nearest1.9px C-L1,1.4px W-L1,.7px W-L2; C-L2 remains18.8px away).
- V3: WebKit loose reach remains1.4/.7px, while Chromium deteriorates to157.3/122px.
- All32paired working Float32 inputs are byte-identical across versions; raw response maps agree exactly. V3 active/root masks are subsets of V1; thinning removes active pixels, while some root masks remain equal. Because this loose diagnostic does not use edge pruning or projected-root span, its Chromium connectivity loss is attributable to thinning the active/root mask. This does **not** isolate causes of every strict-graph change or prove an unsafe shortcut is a real same-strand path.

Interpretation: some losses arise at direction/coherence edge policy, while thinning itself can destroy an otherwise connected observed route. Removing those gates wholesale could join crossings, texture or different hairs. Preserve the rejection and investigate concrete break locations, rather than lowering floors, declaring a budget point a tip, or treating any connected path as one physical hair.

## Visual evidence and reproducibility

[Gallery](tests/visual/downward-evidence/index.html): both versions/engines, full original portraits, native eye views at100/200/400%, every trace in whole-eye overlays, ridge/observed/root-connected maps, and original160px contexts for the first6hypotheses per eye by frozen ordering. All other paths remain in raw JSON. Cyan means hypothesis location, **not root seed**; root seeds are blue only in observation maps. Green would mean passed offline filters, never approved lash; no real green observations here. Orange=protected/uncertain, red=other rejection, white circles=posthoc annotation uncertainty.

All raw manifests, hash-bound Float32 working inputs, initial/intermediate tools, failed analytic log and current code are indexed in `files.json`. Earlier licensed source JPEGs/credits are reused by hash; no new source/download/model. Prior production/recovery comparisons and difference maps are preserved; this stage has no effect comparison because no effect was drawn.

`replay-lash-downward.cjs` restores missing ignored raw inputs without overwriting conflicts. `lash-downward-audit.cjs NEW.json` replays64eye/version records against actual C/W results: identical structure, maximum numeric discrepancy4.50e−15 at tolerance1e−9. `lash-downward-mask-isolation.mjs NEW.json` checks32raw response/mask comparisons. `validate-lash-downward.cjs` validates packed bytes, input/tool bounds and gallery links. These are reproducibility checks, not visual acceptance.

## Verification, performance and release

Fresh unit: **181PASS** (171previous+10new). Full browser: **166PASS /2originalLengthF1FAIL /3dependentNOTRUN**,171total. Assertions/goldens are unchanged. Both F1 failures remain LengthRGB0 vs required>10 on edge-source. Independent active performance3PASS; full-suite dependent NOTRUN remains NOTRUN.

| Measurement | Result |
|---|---|
| V3 offline graph per-eye milliseconds, median/max | Chromium33.1/62.6; WebKit31.5/44 |
| V3 tracked working typed arrays, including input | max1,370,432bytes C /1,319,360 W; declared bounded224grid,128traces/128steps |
| Existing app legacyL20 | off79.1ms / moderate90.4ms, delta+11.3ms |
| Existing app active natural720x1080 D35/L100/Def25 | off17ms / active20.9ms, delta+3.9ms; LengthRGB227, DensityRGB206,2tips, stable cache/analysis |
| Existing app cold analysis | 158.2ms |
| Existing app export2400x3600 | render226.2ms / PNG336ms / button-to-blob640.9ms,9,225,180bytes |

Prototype timings are cold/order-dependent observations on bounded eye inputs, not integrated interaction/export performance. App benchmarks measure unchanged v6 with actual active Density/Length; they do not measure this all-abstaining prototype or establish naturalness. No prototype renderer, Worker or slider lifecycle is introduced. Working-array counts exclude JS object overhead, full image decode/canvas/process memory. Physical iPhone/Android remain UNVERIFIED.

Build/package/check-site **PASS**, including native Chromium and software WebKit real face/retouch/PNG smoke. Generated CSS/vendor changes restored. Archive773raw-byte mappings and707gallery links validate; all64eye/version replays and32mask comparisons pass. Gallery400% displays a169native-pixel view at676CSSpx, zero broken loaded images; screenshot visually checked. Final independent integrity verification is recorded separately. Main/production remain unchanged; branch CI is reported separately in PR#5, never inferred as PASS from local checks.

Independent [visual critic](tests/visual/lash-downward-visual-critic.json) inspected40actual V1/V3 C/W PNGs. Separate [final critic](tests/visual/lash-downward-final-critic.json), SHA256 `bb62858e38d32d6b43282339281e65470d6317e7eec411742ec4fe7c6bf934c2`, verifies773raw mappings,670PNG references,707links,32paired geometry/size records, logs and the limited loose-mask causal statement. It confirms REJECT ADOPTION/HOLD, not naturalness or true biological continuity. The final critic is a separately tracked companion outside the already-preserved pack. Actual restoration of one missing ignored Float32 input passed without overwriting existing files.

**REJECT ADOPTION.** This stage establishes that local response can exist at a projected ending while strict root connectivity fails; it does not deliver useful natural Length. Next bounded investigation should localize the first evidence/edge break between automatic root-reachable and distal components, including the controls. No manual seed, invented gap, confidence relaxation or unverified threshold boundary may enter the product applicator.
