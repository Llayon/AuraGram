# G1c.1 — conservative crossing-evidence abstention

**New negative gate fixed. LENGTH — HOLD; G1c.1 NOT CLOSED.** V6 is a conservative feature-branch candidate, not evidence of accurate occluder classification or improved useful Length. Whole-eye false veto remains a material risk.

## A. Baseline

Continued clean `feat/g1c1-lash-fidelity` at `7cb527659b6f4599e0a11ed9d39042aec08d84ca`, fetched origin; main remained `b02fac3c684f2a7e3178933cb66ded925ab8bce8`. Draft [PR#5](https://github.com/Llayon/AuraGram/pull/5). Version0.5.1; production remains `b883cf5d8cbcc75723b4701e98444fc349db4856` as previously verified.

Baseline:138unitPASS,163browserPASS/3FAIL/3dependentNOTRUN. Two original F1 failures plus the closed-white-liner Chromium abstention failure. Fresh isolated reproduction again1FAIL/1PASS in Chromium/WebKit. Original sources, annotations, tests and thresholds preserved.

## B. Root cause and rejected alternatives

V5 rejected whole-eye analysis only when at least2observed crossing paths covered more than25% of the eye axis. On7123010 right, Chromium coverage0.24892758 missed that cutoff and allowed2Length attempts. The corresponding WebKit pipeline abstained.

Offline sweep uses fixed JPEGs, cloned arcs and actual source-to-analysis scales. Conditions:9translations of both arcs at−1/0/+1native pixel along eye tangent/normal (diagonal displacement√2px), plus2separate lower-normal aperture shifts. Original app landmarks are never changed. Two real closed-eye geometries are crossed with both decoding engines; older control geometry is explicitly labelled. This deterministic grid is not a calibrated model of FaceMesh uncertainty.

Across198samples per engine, path **count/identity** changed as well as span. A proposed span margin from seed spacing and the existing±1analysis-pixel search did not solve this: some conditions had just1path/span0. The scalar-margin hypothesis is preserved and rejected. Its upper estimate is neither a guaranteed bound nor a statistical confidence interval.

A simple local5analysis-pixel exclusion was also insufficient: one nominal closed-eye candidate was≈28.86px from the nearest observed crossing path, and jitter cases remained farther than5px. This measured counterfactual was not implemented. No new magic span/distance cutoff was tuned to make the fixture pass.

## C. V6 implementation

`lashAnalysis.mjs` keeps `crossing.occluded` and its existing0.25whole-eye Density rule unchanged. A separate **Length policy** sets `lengthAbstain` whenever an image-supported crossing continuation is observed. Such a continuation is already required to pass through the predicted opening and continue beyond the lower lid; the scanner itself is unchanged.

If this policy vetoes Length, connected tracing and boundary-tip recovery are skipped, tips/Length confidence are zero, while local Density maps/confidence are retained. This is an interpretation/safety decision, **not proof that every hair is invalid or that an actual scalp hair occludes the whole row**. A single false crossing can veto a valid row.

Analysis cache version becomes `g1c1-recovery-6-crossing-length-abstention`. Cache still keys source identity/dimensions/geometry/version. No runtime jitter, model call, worker or extra image buffer. `retouch.mjs` exposes a debug `lengthAbstention` reason; general eye `reason: ok` or Density confidence1 must not be interpreted as Length confidence. No UI redesign, settings/history schema or applicator change.

## D. Nominal and perturbation evidence

Fresh real FaceMesh corpus:19inputs; Chromium14ready/5excluded, WebKit13ready/6excluded. Additional WebKit no_face=`glasses.jpg` (historical filename, not a verified glasses category). No fake geometry for exclusions. Four extra WebKit checks reuse older stored Chromium geometry as explicit counterfactual controls.

Nominal native v5/v6 comparison at0/1/25/50/75/100:

- **372full-frame RGBA identities for Density/Definition**:168Chromium+156WebKit fresh cases, plus48older-geometry WebKit controls. Density confidence/maps exactly unchanged.
- Unblocked tip objects exactly unchanged. Length differences occur only inside vetoed ROI; outside-veto changed pixels0.
- Only fresh nominal active loss: Chromium7123010 right **2eligible/2attempts→0**. Older stored rotated-right WebKit has1crossing path but already0eligible tips, so no nominal active loss there.
- New real-face closed-white-liner test passes in both engines, without changing any assertion. It checks actual FaceMeshready, two native analyses, zero drawing attempts and exact Length-only identity.

Final perturbation verification:396samples total. All60Chromium/64WebKit samples with observed crossing evidence produced0current tips, with exact v5/v6 Density maps/confidence for those124cases. Both closed geometries and the occluded-hair target eye abstain in all tested±1px conditions. This finite result does not prove universal stability.

**Recall cost is not hidden.** Previously eligible candidates are also removed in four Chromium light-right jitter conditions (2each), six WebKit light-right conditions (2–3each), and one WebKit makeup-right condition (3). Eligibility is not verified physical correctness or useful rendered effect. Nevertheless, the critic observed red crossing paths near inner/lower-eye contrast, spatially separate from several lost cyan upper traces. Whole-row physical occlusion is not established. These are material possible false vetoes; nominal preservation does not erase the perturbation loss.

[Gallery](tests/visual/crossing-evidence/index.html) includes278labelled views: native eye crops100/200/400%, full720px viewing portraits, v5/v6 Length100, difference×8 and every perturbed case that loses previously eligible candidates. Cyan=old eligible traces, red=observed crossing paths, not confirmed occluders. Perturbed diagnostic overlays are not product renders. All prior comparisons, no_face cases and unsuccessful experiments remain available.

Independent critic accepted v6 as a conservative working-branch fix, explicitly **not a release/quality approval**. No new obvious artifacts in reviewed images; remaining micro-Length usefulness unproven. Independent endpoint/axis GT gaps and pale-strand identity issues remain.

## E. Automated verification

- Unit **139PASS**; prior138retained. New single-crossing test verifies Length abstention while distant supported Density remains. Initial test-authoring call passed an invalid brow object; corrected to the required array without weakening assertions, failed log retained.
- Full single-worker E2E **164PASS,2originalF1FAIL,3dependentNOTRUN** (169total). New Chromium failure is fixed; old Length0-versus>10 efficacy failures remain in Chromium/WebKit. No tests skipped/removed/xfail, no threshold or golden regeneration.
- Existing Density/L6/L22, cap/block regressions, protected regions, zero identity, global presets, cache/lifecycle/history/styles/session and preview/export gates pass on their fixtures. Full new-photo protection is not inferred merely from spot checks.
- Build, package:site and check:site **PASS**, including packaged native/software Canvas real-face PNG smoke. PR CI is recorded separately in PR metadata and final response; red gates are not declared green.

## F. Performance

Separate isolated performance: **3PASS**, run after other browsers closed. Active natural720×1080 Density35/Length100/Definition25:15.5ms off→19.7ms active, **+4.2ms** versus+15ms target.2recovered tips, Length-only RGBsum227, Density206, stable source-analysis key/timing are asserted. Thus the budget is not passed through silent Length skipping.

Cold analysis132.6ms.2400×3600 export:render196.1ms,encode312.4ms,button→blob603.6ms,9,225,180bytes, actualLength included. Legacy L20 negative delta is timing noise, not a speedup claim. No new mobile-device performance guarantee; iPhoneX/11/11ProMax/Android **UNVERIFIED**. Native224budget and typed-array/canvas bounds remain unchanged. QA full-frame comparisons limit temporary RGBA readback to64rows.

## G. Release

**Draft PR#5 / HOLD.** No version bump, ready, merge, partial Density release, Pages deploy or new published SHA. Original F1 failures, unproven useful natural Length and false-veto/recall risk block G1c.1 closure. Production unchanged.

## H. Remaining risk and next experiment

Whole-eye abstention is safer on the reproduced unresolved source but can be over-conservative on unrelated inner/lower-eye contrast. Investigate candidate-specific negative evidence and eye-opening interpretability with the preserved closed-eye negative **and** light/makeup recall controls. A simple local5px rule already fails the negative fixture; do not adopt it or a new aperture/span threshold solely from this image. Retain original confidence/render caps and all mandatory gates. Eyeliner Density, unseen crossing structures, bright gaps, blur, partial crops, FaceMesh variation and Safari remain unresolved. Do not claim useful Length or calibrated uncertainty from these experiments.
