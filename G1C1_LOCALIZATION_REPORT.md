# G1c.1 — boundary-context localization follow-up

**LENGTH — HOLD. G1c.1 NOT CLOSED.** Improved endpoint localization does not yet establish useful natural extension. No merge, partial release, version bump or production publication is authorized by these results.

## A. Baseline

Continued `feat/g1c1-lash-fidelity`, Draft [PR#5](https://github.com/Llayon/AuraGram/pull/5), starting clean at `c340ae53ca22c6f955c320201f2c7ff16e6de432`. Fetched origin: feature matched HEAD; main/origin/main were `b02fac3c684f2a7e3178933cb66ded925ab8bce8`. Version remains0.5.1; last verified production `b883cf5d8cbcc75723b4701e98444fc349db4856`.

Previous stage:133unitPASS;158browserPASS,2original Length F1FAIL,3dependent performanceNOTRUN. The current stage preserves that history in [previous report](G1C1_TIP_FOLLOWUP_REPORT.md). Product comparison reference is recovery `b46b2855f3b8cbd4e0fd990c420bfbdf15151557`, not production0.5.1. Earlier production goldens/comparisons are untouched.

## B. Root causes and implementation

The two consensus natural tips are nominally **inside** the original analysis band, close to its1.5analysispx endpoint exclusion. The native ROI contains the necessary adjacent pixels. Expanding the entire band changes root/skin/brow scales and loses accepted structures; that experiment was rejected.

The new optional boundary pass retains those physical scales,224px/no-upscale budgets and frozen Density maps. It measures at most4 additional analysis pixels (directional sampling support2.5 plus existing1.5guard), revisiting only recorded clipped seeds. Four is a conservative tested choice, not a proven minimum. Existing connectivity, measured length/width/coherence/contrast/confidence checks remain. The fitted tip must have actual ridge response≥0.006 and forward1–2px support must fall below the same observation floor. Distal-prefix overlap rejects duplicate recovered chains. No random fan or unseen gap drawing is added.

`lashAnalysis.mjs` now uses `g1c1-recovery-5-boundary-context`; baseline/recovery Length confidence is separated. `lashEnhancement.mjs` keeps baseline geometry/mask/color exact, and gives recovered tips a separate mask plus exact fractional source-ROI mapping. New geometry is bounded by12% observed length,3analysispx and12%eye width. `retouch.mjs` exposes recovered counts. Source/version/photo/dimension/geometry cache remains; sliders do not reanalyse.

An intermediate grayscale probe exposed11colored pixels and5brightened channels from recovered source-color strokes. Fixed by sampling the already graded tip body once per eye before either Length group and using `darken` only for recovery. Both engines then reported zero added color/brightening. Legacy baseline source-over behavior remains unchanged. Fractional mapping removed up to approximately0.38x/0.26y native-pixel rounding drift in the new cohort.

## C. Detection quality

Two sampled provisional annotations contain27 and21 strands, marked on original400% crops with current overlays hidden. Both annotators had historical detector exposure; these are **not certified independent ground truth**. Roots mean visible merged attachment, not follicles. Tip uncertainty1.5–2sourcepx. Disagreement on light strands prevents global precision/recall claims. Edge900 both eyes: **NOT RESOLVABLE**.

Independent natural endpoint error: left INL1 **8.31→1.44sourcepx**, right INR4 **12.69→1.54px**. Right remains slightly outside its declared1.5px tolerance; no tolerance was changed. Primary NL5/NR4 end at1.61/2.26px. Endpoint agreement does not establish tangent agreement: the left sampled distal-direction discrepancy remains about43° for the independent annotation and55° for the primary one. No claim of validated direction improvement.

|Photo|Left accepted before→after|Right before→after|New recovery RGB pixels at100, Chromium/WebKit|
|---|---:|---:|---:|
|light|4→5|2→2|6 /0|
|natural|3→4|7→8|14 /9|
|edge900|0→0|0→0|0 /0|

Counts alone are not useful-effect evidence. Light-right disconnection remains unresolved. Beauty, hair occlusion, glasses, freckles/blonde, closed eye and low-resolution get no new recovery stroke. Rotated is a derived scenario, not an additional independent source. `mascara` remains excluded with explicit `no_face`; filenames do not prove makeup categories. No new real photo/licensing coverage is claimed. Pale eyelashes, controlled mascara/liner and dark-lighting strata remain incompletely covered. Existing provenance is retained in prior dataset reports.

## D. Visual quality and evidence

Final immutable `LASH_RUN=localization-39-final-aligned`:10ready scenarios, one explicit no-face exclusion, Chromium and WebKit. Both use the same cached real Chromium FaceMesh geometry and source analysis contract; decoded/rasterized separately. Real WebKit FaceMesh is checked separately by E2E. No model requests in the frozen comparison harness.

[Gallery](tests/visual/localization-evidence/index.html):336 PNGs include both eyes at100/200/400%, reference/candidate50/100, recovery-only100, difference×8, ridge and accepted/rejected traces, plus450/720 full portrait previews. Full native portraits and all intermediate runs remain locally under `tests/visual/out/`; failed probes are retained. Reference in this gallery is recoveryb46. Production0.5.1 comparisons remain in earlier evidence directories.

Legend: ridge green opacity=response, not probability; accepted cyan=baseline/yellow=recovery; rejected red. Diagnostic strokes do not enter product images. Native outputs show tiny changes: natural recovery-only RGBsum92Chromium/38WebKit; light38/0. At natural450/720 previews the recovery contribution is only6/6changed pixels Chromium,2/2WebKit. A nonzero pixel metric does not establish visual benefit.

[Independent final critique](tests/visual/localization-evidence/CRITIC.md): endpoint localization improves, but useful natural Length is **not proven**. No new needles/strip/halo/double edge observed in inspected pairs. Publication rejected on usefulness. Individual eye differences remain; no template fan was introduced.

## E. Verification

- Unit: **138PASS**, all133previous tests retained;5new boundary/continuing-line/blur-liner-disconnection/color/fractional-geometry checks.
- Final visual controls: **180/180 exact RGBA in each engine**,360total. Density,Definition and baseline-only Length at0/1/25/50/75/100; no golden regeneration. Density bilinear35% cap unchanged. Max new geometry error is machine rounding.
- New real-photo browser gates check active recovered tips, stable cached analysis through sliders, exact repeated100render, and monochrome no-brightening in both engines. Original F1 remains unchanged.
- Full single-worker E2E: **162PASS,2original F1FAIL,3dependent performanceNOTRUN** (167total). Both failures are unchanged Length RGBsum0 versus required>10 on edge900. Density efficacy/L6/L22, protected regions, goldens, occlusion, history/styles/session/cache and all new real-photo checks pass. Thresholds/fixtures unchanged.
- `npm run build`, `npm run package:site`, `npm run check:site`: **PASS**, including packaged Chromium native and WebKit software Canvas, real face detection, retouch and PNG export. Generated utility-CSS churn was restored; no UI changes included.

Working typed analysis budget remains49bytes×ROI pixels and retained5bytes×ROI pixels. Extra recovered-color readback is transient4×integerROI pixels per active recovered eye; no additional persistent canvas/cache slot, no source upscale. These are buffer bounds, not measured process RSS. Physical iPhoneX/11/11ProMax/Android remain **UNVERIFIED**.

## F. Reproduction and measurements

Compressed manifests preserve exact JSON bytes and source/image/geometry hashes. `node tests/visual/replay-lash-localization.cjs <new-directory>` verifies/restores11 frozen source files and manifests without network/browser. `lash-localization-audit.cjs` compares both annotation sets; clipped-tip legacy arrays are reversed from seed→tip before endpoint measurement. Earlier initial21/22 clipped endpoint distances must not be used as final endpoint errors.

The harnesses accept only new output directories. `lash-localization-probe.cjs` records observed response/drop, accepted/rejected reasons and unchanged Density evidence. `lash-localization-render.cjs` preserves exact controls, source positions and actual native/preview differences. Cold comparison timings are nonisolated diagnostics, not release performance claims.

Fresh isolated `chromium-performance --no-deps --workers=1`: **3PASS**, after the full suite, never concurrent with visual browsers. This does not convert the3dependent NOTRUN into full-suite success.

|Desktop Chromium measurement|Off median|Active median|Delta|
|---|---:|---:|---:|
|Legacy L20,864×1080,Density/Definition active|72.5ms|80.4ms|+7.9ms|
|Natural720×1080,Density35/Length100/Definition25|16.7ms|21.9ms|+5.2ms|

Active benchmark explicitly asserts2recovered tips, Length-only RGBsum227 and Density-only206 at the timed strengths. Cold analysis162.5ms; cached analysis/key stable on sliders. Full2400×3600 export: render214ms, encode325.5ms, button→blob612.6ms,9,225,180bytes, actual Length included. Existing memory gate passes; no new RSS/device-memory measurement. WebKit real-face E2E: active Length preview185ms and full PNG render272ms on this software-processing desktop run, not an isolated mobile performance guarantee. Both satisfy actual nonzero Length checks; physical devices remain UNVERIFIED.

## G. Release

**Draft PR#5 / HOLD**. No merge, Pages deploy, new published version/SHA or live-new-release smoke. Mandatory F1 and visual usefulness block release even if individual gates pass. Source commit/CI status are reported with completion. Production0.5.1 remains the release.

## H. Next minimal experiment

Freeze this localization candidate. On matched natural endpoints, independently annotate **local distal tangent**, with uncertainty, instead of extrapolating from merged roots. Explain the large left tangent disagreement before attempting any increase in visible extension. Then test a measured local curve fit at unchanged safety/opacity caps. Light-right disconnection requires its own image-supported connectivity experiment; it must not inherit weak Density evidence. Avoid further opacity-only trials. Safari rasterization, pale strands, clumped mascara, liner, blur and old mobile hardware remain unresolved risks.
