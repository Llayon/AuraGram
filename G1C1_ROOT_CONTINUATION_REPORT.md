# G1c.1: proximal-root continuation counterfactual

**Experiment REJECTED. LENGTH — HOLD. Product unchanged.** Continued clean feature branch `feat/g1c1-lash-fidelity` from `a4f07895d8c4cc3bbe07e5ce0031bb52971aacf0`, matching origin after fetch. Main remains `b02fac3c684f2a7e3178933cb66ded925ab8bce8`. Version 0.5.1; draft PR #5 stays draft. No merge/deploy/version bump.

## Question and protocol

Could candidate-specific observed continuation replace v6's conservative whole-eye crossing veto? The earlier local 5px exclusion already failed. This experiment starts from each previously eligible v5 candidate's proximal endpoint, using the chord of its last at most five connected path pixels as an inward direction. **These pixels are not necessarily thin-ridge samples of a single fiber**: rootSupport may include a merged broad lid line. This limitation is part of the result.

No threshold tuning or direction fan. Reuse the crossing scanner's contrast floor .006, radii 1.5/3/5 analysis pixels, offsets −1/0/+1, offset penalty .002, corner interval .1–.9, 64-step limit and lower clearance max(4, opening×.35). A candidate is associated with crossing only if an observed transverse valley continues through the predicted opening and beyond the lower arc. At most five proximal points is a tested chord estimator, not an assertion of a real hair tangent.

The deliberately unsafe counterfactual would permit a candidate whenever it cannot demonstrate crossing. That hypothesis is evaluated, **not installed**. The correct interpretation of missing continuation is UNKNOWN. All product code, confidence gates, applicator and caches remain unchanged.

Inputs: frozen crossing sweeps for both decoders, 396 total geometry samples. The sweeps contain 124 observed-crossing samples, but only **30 eye/geometry conditions contain previously eligible candidates**; those conditions supply 70 repeated candidate observations. This is a conditional audit of vetoed candidates, not a new detector recall study or 70 distinct hairs. Sources, geometry hashes and exact frozen module bundle are checked. Four older geometry controls are labelled as such; two closed-eye geometries are cross-decoded. No MediaPipe rerun, online inference or image upload.

## Results

| Engine / source | Conditions | Candidate observations | Demonstrated crossing | Unresolved / counterfactual would permit |
|---|---:|---:|---:|---:|
| Chromium light-right | 4 | 8 | 0 | 8 |
| Chromium occluded-hair-left | 1 | 1 | 0 | 1 |
| Chromium closed source, Chromium geometry/right | 4 | 8 | 0 | 8 |
| Chromium closed source, WebKit geometry/right | 9 | 27 | 0 | 27 |
| WebKit light-right | 6 | 13 | 0 | 13 |
| WebKit makeup-right | 1 | 3 | 0 | 3 |
| WebKit occluded-hair-left | 1 | 1 | 0 | 1 |
| WebKit closed source, Chromium geometry/left | 1 | 2 | 0 | 2 |
| WebKit closed source, Chromium geometry/right | 1 | 2 | 0 | 2 |
| WebKit closed source, WebKit geometry/right | 2 | 5 | 0 | 5 |

All 70 stop at `no-observed-valley`; all are **unresolved**, not approved positives. In Chromium the light candidates stop before taking any step, closed-source paths take 0–11 steps, and the hair candidate takes 39 steps without satisfying crossing clearance. Thus a simple step-count reinterpretation is not justified either. The counterfactual would permit the two nominal Chromium closed-source attempts already shown to violate the mandatory negative gate. It also permits the candidate in the actually hidden hair-occluded eye. Any benefit to light/makeup recall is therefore inseparable from negative-fixture regressions under this rule.

The source `pexels-7123010.jpg` has unresolved independently annotated endpoints; this is a conservative policy negative, not ground truth of absent lashes or a rule against all closed eyes. Light/makeup old eligibility is also not independent proof of true natural strands. These repeated observations are not calibrated false-positive/false-negative rates.

## Visual critique

[Gallery](tests/visual/root-evidence/index.html): 30 native diagnostic eye crops, CSS 100/200/400%. Red = existing broad crossing paths; cyan = v5 candidate that the counterfactual would permit; purple = tested proximal-chord continuation. These are overlays, **not rendered Length improvements**. Amber would indicate a demonstrated candidate crossing; there are none. Prior [full portraits, source JPEGs, v5/v6 renders and difference maps](tests/visual/crossing-evidence/index.html), and [production 0.5.1 comparisons](tests/visual/expanded-evidence/index.html), remain unchanged.

Independent read-only critic reviewed closed/hair/light and WebKit makeup PNGs and code. Verdict: reject as replacement for v6. Root chord is not certified fiber direction; no observed valley means UNKNOWN. No useful natural extension or release quality is established. [Critic](tests/visual/root-evidence/CRITIC.md).

## Checks and scope

- Fresh unit: **139 PASS**, zero failures/skips.
- Fresh actual FaceMesh closed-white-liner browser gate: **2 PASS**, Chromium and WebKit; v6 attempts=0, Length difference=0. No fixture/assertion changes.
- Offline Chromium and WebKit experiment: completed; hypothesis **fails**, all 70 observations unresolved. Completion of a harness is not a quality PASS.
- Offline evidence integrity: image/source/bundle/geometry hashes and saved outcomes validated. Final immutable run `root-05-final`; exploratory `root-01-measured` and hash-checked `root-04-final` preserved locally without overwriting previous evidence. Math/outcomes unchanged between runs; final records distinguish unresolved from permission explicitly.
- Product source unchanged, so no new performance or build claims. Previous full local/CI baseline remains **164 PASS, 2 original F1 FAIL, 3 dependent NOT RUN**; isolated active performance +4.2ms and build/package/smoke PASS belong to the prior v6 run, not this new experiment. New-head CI is recorded in PR metadata when completed. No old test, threshold or golden changed.
- No device test this stage. Physical iPhone/Android **UNVERIFIED**.

## Next minimum evidence

Before weakening v6, identify and independently check actual thin-ridge samples before they merge into the eyelid. Retain separate outcomes: observed crossing, independently supported structure, unresolved. A policy must preserve closed/hair abstention and recover a confirmed positive simultaneously. More arbitrary root-distance, aperture, brightness or step-count cutoffs from this fixture would not supply that evidence. Useful Length and the two original F1 failures remain unresolved; production stays 0.5.1.
