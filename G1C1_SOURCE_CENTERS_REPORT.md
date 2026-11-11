# G1c.1 — native source center profiles

**LENGTH — HOLD. Diagnostic accepted; no product fit adopted.**

## A. Baseline

Continued clean `feat/g1c1-lash-fidelity` at `9d7d827da5b502c35b478dfec088c21e990ff256`; fetch confirmed origin feature unchanged and main `b02fac3c684f2a7e3178933cb66ded925ab8bce8`. Draft [PR#5](https://github.com/Llayon/AuraGram/pull/5), version0.5.1, production unchanged. Previous current-head CI43002992514: buildPASS,162browserPASS,2originalF1FAIL,3dependentNOTRUN, deploySKIPPED. See [tangent report](G1C1_TANGENT_REPORT.md).

## B. Experiment

The prior rejected quadratic fitted quantized tracing points. This step inspects **native decoded JPEG pixels**, cropped at integer source coordinates without resizing. Grayscale uses the same0.2126/0.7152/0.0722 coefficients as the product. Frozen observed distal paths, tips, ROI, renderer, confidence and Length limits remain fixed.

Each point receives a transverse profile at radius1.5/2.5sourcepx, with normal perturbations−15/0/+15°. Bilinear0.25px samples estimate a center; **they add no image detail**. A linear endpoint background estimate supplies a local dark-valley deficit. The proposed correction is bounded to0.75sourcepx. Weak valley, search-boundary maximum, one-sided edge, multiple valleys, flat center or crop boundary are rejected. The0.006 observation floor is borrowed from existing evidence; these engineering checks are not calibrated probability or validated new product confidence.

Centers are refined only inside the saved contiguous observed prefix, truncated using analysis-unit `observedLength` before native conversion. No root/wide line is borrowed to fill an absent2/4/6/8px window. The last observed bracket may exceed a window so a chord can be measured; it never creates missing image evidence. Rejected centers stay unchanged and their windows are explicitly marked unsupported.

Critic identified **anchoring bias**: the tip's own profile proposes a shift, but holding that tip fixed while moving its neighbours changes short chords. Final04 therefore includes a separate `freeAnchorDiagnostic`, using the observed tip-profile proposal only to measure this bias. It never moves the product tip, never proposes a release change and does not certify the physical endpoint.

## C. Results

30candidate entries per engine across10existing photo scenarios; these are frozen previously accepted entries, not30new detections or an exhaustive set. Both engines use the **same Chromium frozen traces** to isolate native source sampling. Initial01 used each engine's earlier traces and was confounded; retained, not used for controlled comparison. Final04 records exact JPEG, frozen-manifest, geometry, helper, harness and native-crop hashes. Native RGBA equals in **18/20 eye crops**; both hair-occlusion crops differ. No universal decoder identity claim.

Chromium recovered candidates, radius1.5, normal perturbation0°:

|Photo/eye|Tip-profile proposed shift|2/4/6/8px angles, fixed tip|Free-anchor diagnostic|
|---|---:|---|---|
|Light left|+0.226px|−96.9/−93.7/−92.4/−90.2°|−90.4/−90.4/−90.2/−88.5°|
|Natural left|−0.511px|−122.4/−118.0/−107.7/−95.6°|−137.8/−124.9/−112.0/−98.5°|
|Natural right|−0.097px|−89.3/−103.9/−99.5/−97.3°|−92.1/−105.3/−100.4/−98.0°|

Light's8px support contains rejected profiles. Natural-left radius2.5 contains rejected support, with tip proposal−0.574px at0° and search-boundary rejection at−15°. Natural-right anchor becomes a one-sided edge at+15°. Validating a few scalar profile checks does not resolve the endpoint or select one exact terminal direction. Free-anchor variation makes the localization/axis distinction explicit.

Raw unrefined `rawDirections` retain helper compatibility booleans (`accepted !== false`). Their flags are **N/A / UNTESTED**, not native-profile passes. Only refined variant flags refer to measured profile checks, and even those do not validate a physical tangent. No precision/recall or improved naturalness is inferred.

## D. Visual evidence and critic

[Gallery](tests/visual/source-center-evidence/index.html) includes both-engine native eye crops enlarged400%, measured centers, rejected points, raw intensity plots and fixed/free angle tables. Cyan=old path, yellow=refined path/check-accepted samples, red=rejected unchanged samples, white=fixed tip. Profiles show white raw normalized luminance and yellow linear endpoint background. Y axes auto-range and are labelled separately. These are diagnostic overlays, **not product renders**.

Full portraits, product100/200/400% and production0.5.1 comparisons remain in previous evidence. No new photo source or makeup coverage claimed. Current corpus still cannot certify the ambiguous natural-left exact terminal tangent. JPEG ringing/skin crease false positives are not validated by an experiment restricted to previously selected traces.

Independent critic reviewed source, raw profiles, PNGs, coordinate conventions, native hashes and the corrected free-anchor comparison. Verdict: source-supported centers help explain failure, but unique accurate terminal tangent is not established; **keep product directions and LENGTH HOLD**. The0.75px correction cap does not remove1.5–2px endpoint annotation uncertainty.

## E. Verification

- Fresh `npm test`: **138PASS**, no failures/skips.
- Separate diagnostic tests: **7PASS** (4source-profile checks plus3prior geometric checks). Tests cover ridge centering/fixed tip, flat/step rejection, explicit missing support and unsupported anchor; synthetic checks validate mechanics, not real-photo appearance.
- Product `src/`, package/dependencies, original mandatory fixtures/assertions and goldens unchanged from9d7d827/47e8e9e. No new local full-E2E/build/performance run is claimed for these offline-only tools. Current PR CI reruns required gates; results are recorded in PR metadata and completion.
- No MediaPipe/model requests in either source-profile run; exact JPEG buffers are served locally. No slider processing, upload, service or new model added.

## F. Performance

No product import or runtime cost added. Diagnostic native crop/profile arrays are temporary and do not enter the photo cache. No fresh rendering/memory-performance claim. Last isolated active product benchmark remains+5.2ms; cold162.5ms/native export render214ms at47e8e9e, with scope in the localization report. Physical devices remain **UNVERIFIED**.

## G. Release

Draft PR#5, **HOLD**, no merge, partial release, deploy, version bump or published SHA. Production0.5.1 unchanged. Two original F1 failures and unproven useful natural Length remain mandatory blockers. The source-center experiment does not fix either by generating extra strokes.

## H. Next evidence required

Separate endpoint localization from local shaft orientation before another continuation experiment. Use an independently selected licensed real-photo set with clearly resolved terminal structures and agreement on endpoint uncertainty; preserve all ambiguous/rejected cases. Measure axes between source-supported distal centers separately from an uncertain endpoint. Then compare the original direction and candidate direction against that independent evidence at unchanged rendering caps. Further fitting of this blurred left tip alone cannot prove improvement. Existing edge900 remains explicitly unresolvable; its mandatory test is unchanged, not bypassed. Pale lashes, clumped mascara, liner/crease, hair/glasses occlusion, blur and Safari remain risks.
