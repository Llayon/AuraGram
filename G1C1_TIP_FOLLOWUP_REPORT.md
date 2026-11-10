# G1c.1 — terminal-appearance follow-up

**HOLD. Experiments11/12/13 rejected. Product CV remains equivalent to b46b285.**

## A. Baseline

Continued `feat/g1c1-lash-fidelity` from `b46b2855f3b8cbd4e0fd990c420bfbdf15151557`; initial tree clean. Fetch completed; no new branch commits. `main`/`origin/main` remain `b02fac3c684f2a7e3178933cb66ded925ab8bce8`. [PR#5](https://github.com/Llayon/AuraGram/pull/5) is open Draft. Production stays0.5.1, published SHA `b883cf5d8cbcc75723b4701e98444fc349db4856`.

Previous133 unit /158 browser PASS,2 F1 FAIL,3 dependent NOT RUN are historical baseline. Previous performance figures are not reused as new measurements. Earlier experiments, goldens and [Recovery report](G1C1_RECOVERY_REPORT.md) are preserved.

## B. Root causes and experiments

Corrected profiler17 sampled frozen09/b46 candidates from their decoded original ROI on an inert Chromium page: exactly11requests (inert document plus10JPEG), no app/model script or FaceMesh work. Hashed bytes, dimensions and decoder engine are recorded. Initial10 could start the demo in the background; it is preserved as superseded. Corrected profiles are numerically identical. Some distal contrasts are only3–7RGB luminance units: the observed endpoint is already mixed with background/PSF. Old `.26*c`, slider alpha, tapers and downsampling suppress it further. Some sampled body colours are even brighter than tip surroundings. This explains attenuation, but does **not** establish that amplifying it improves a portrait.

- **11:** bilateral transverse RGB profiles; match observed contrast instead of fixed opacity; one triangle instead of six overlapping round-capped segments. Profiles lacking a valley on both sides are skipped. Effect weaker; rejected.
- **12:** retain11 geometry, remove repeated Length alpha multiplier (geometry already tends continuously to zero), use linear fade. Slightly more response than11; no useful extension; rejected.
- **13:** transport observed terminal profiles behind the tip at inward distance `L−t` into the existing bounded extension. Relative channel contrast/multiply avoids brightening a graded destination. No useful gain; additional appearance rejection zeroed natural-left; rejected.

Original confidence/length/connectivity thresholds and max12%/3analysis-pixel extension stayed. No fan, random direction, model change, fake difference or test change. **None of the experiments was promoted into application source.**

## C. Detection quality

For both eyes of light/natural, accepted geometry fields `(x,y,dx,dy,c,length,width)` exactly match frozen09 in11/12/13. These were photometry experiments, not improved detection. Appearance rejection is separate from geometry acceptance and drawing attempts; trace reason `ok` does not prove rendering.

Chromium native changed pixels, **Length100 only**:

|Source/eye|b46/frozen09|11|12|13|
|---|---:|---:|---:|---:|
|light left|29|9|10|8|
|light right|14|3|3|1|
|natural left|15|3|3|0|
|natural right|38|20|21|22|

Counts are diagnostic, not quality scores. In13 some individual pixels became more contrasting without convincing length. AtLength50 natural-left also became identity. edge900 has no accepted geometry in baseline/11; photometry cannot recover missing connected candidates. Original F1 assertions/thresholds were not changed.

No new false-positive/false-negative rates can be claimed without independent strand annotation. Extra profile rejection lost efficacy; it does not prove more accurate detection.

## D. Visual evidence and independent critique

Immutable local matrices:

- `tests/visual/out/recovery-final-09-streamed`: b46, production0.5.1 and original references.
- `tests/visual/out/recovery-tip-profile-11`: Chromium/WebKit, light/natural/eyeglasses/edge900.
- `tests/visual/out/recovery-tip-profile-12-linear`: Chromium light/natural. WebKit NOT RUN after rejection; no compatibility claim.
- `tests/visual/out/recovery-tip-transport-13`: Chromium light/natural. First WebKit attempt interrupted during natural; partial files retained, not a completed matrix.
- `tests/visual/out/recovery-tip-transport-18-webkit-isolated`: completed sequential WebKit replay of13, both portraits. All source hashes equal13; all four ROIs equal WebKit09. Length100 changes light9/0pixels and natural1/25pixels (left/right). Useful extension still unproven.

[Tracked evidence](tests/visual/recovery-followup-evidence/README.md) contains exact experimental modules, hashes, cross-sections and manifests. [Gallery](tests/visual/recovery-followup-evidence/comparisons/index.html) displays both-eye100/200/400% at native size;400% width676 was verified, no CSS downscaling. WebKit replay mapping is explicit and source-hash checked. Full native portraits, difference and trace maps stay in local immutable matrices. Production0.5.1 goldens were not replaced.

Full manifests use lossless `.json.gz` with exact decompressed bytes; original raw files remain local. Checkout EOL conversion is disabled for hashed evidence. Replay reconstruction19 verified all source hashes without launching a browser.

Independent critic compared09/11/12/13 real PNG50/100 on light/natural: **no convincing useful extension in any experiment**. No new obvious needles in reviewed crops; absence of artifacts does not compensate for absent benefit. Restore b46 and keep Length HOLD.

## E. Verification

- Restored product: **133 unit PASS**. Temporary134th experiment test is not claimed as an accepted product gate.
- Complete single-worker browser run: **158PASS,2 original F1 FAIL (Chromium/WebKit),3 dependent performance checks NOT RUN**. All mandatory assertions/fixtures/goldens remain unchanged. Density efficacy, L6/L22, protected regions, real hair occlusion, active Preview/Export, cache/history/style/session and golden regressions passed.
- Resource-failure runs retained: concurrent14 **148PASS/12FAIL/3NOT RUN**; default8-worker15 **146PASS/14FAIL/3NOT RUN**. Failures include process closures/timeouts; neither run is green, and not every failure is proven to be a CV regression.
- Read-only process inspection found other workloads on this shared16GB machine. No external process/application was stopped or modified. Final repetition uses `--workers=1`, with all mandatory tests enabled.
- `npm run build`, `npm run package:site`, `npm run check:site`: **PASS**. Packaged Chromium native and WebKit software Canvas both passed real face detection, retouch and PNG export. Build-only unused utility CSS churn was restored; no UI change is committed.

## F. Performance

Rejected11/12/13 have no product performance claim. Visual-harness timings were not isolated release benchmarks. Product ROI, buffers, Density35% cap, cache lifecycle and applicator are unchanged from b46.

Fresh isolated `chromium-performance --no-deps --workers=1`: **3PASS**. This does not make the failed full suite green.

|Measurement|Off median|Active median|Delta|
|---|---:|---:|---:|
|Legacy L20,864×1080, Density/Definition active|72.4ms|71.8ms|−0.6ms (timing noise, no speedup claim)|
|Natural720×1080, Density35/Length100/Definition25|17.1ms|18.5ms|+1.4ms|

Active fixture separately proves Length-only RGB difference200 and Density35-only206, at the timed strengths. Analysis/cache key stable. Cold analysis129.9ms. Full2400×3600 export: render192.3ms, encode329.2ms, button→blob587.3ms,9,225,147bytes; `ran` includes actual Length. Physical iPhone X/11/11 Pro Max/Android stay **UNVERIFIED**; no new RSS/total-memory claim. Existing bounded-memory gate passed.

## G. Release

**HOLD.** PR#5 stays Draft. No version bump, partial release, merge, Pages publication or new published SHA. Final evidence commit/workflow result are supplied at completion. A red mandatory F1 or unproven useful Length prevents release even if other tests pass.

## H. Next minimal experiment and risks

Freeze b46 renderer. Independently mark actual visible root→tip structures, with uncertainty intervals, on both eyes of light/natural/edge900. If a source does not resolve a strand, record NOT RESOLVABLE instead of inventing a label. Compare endpoints/tangents, observed length and rejection reasons. Then test subpixel ridge-center/tangent refinement at unchanged gates, accepting more **matched real** structures without added false positives. Further opacity-only experiments are not justified by this follow-up.

Risks remain pale lashes, clumped mascara, liner/crease contamination, hair/frame occlusion, blur, weak source detail and Safari/older devices. Recovery Density improvements/safety fixes remain. The gauntlet is not closed.
