# G1c.1 — local distal tangent audit

**LENGTH — HOLD. Quadratic correction rejected. No product source changes.**

## A. Baseline

Continued `feat/g1c1-lash-fidelity`, Draft [PR#5](https://github.com/Llayon/AuraGram/pull/5), clean HEAD `47e8e9e571f025585e5909a006de02cf4fb86b9b`. Fetch confirmed unchanged origin feature and main `b02fac3c684f2a7e3178933cb66ded925ab8bce8`. Version stays0.5.1. Prior [localization report](G1C1_LOCALIZATION_REPORT.md) and evidence remain intact. Its PR CI43000230507: buildPASS,162browserPASS,2originalF1FAIL,3dependentNOTRUN, deploySKIPPED.

## B. Measurement issue

The previous left43°/55° discrepancy compared a traced terminal direction with a manually selected distal chord. The independent chord is approximately5.22sourcepx long: **not a biological-root chord, and not a measured exact endpoint derivative**. The terminal region is blurred and apparently curved. That discrepancy alone cannot establish the direction of the actual terminal continuation.

Two new provisional annotation snapshots were frozen on original400% crops with detector overlays hidden during the pass. Historical detector exposure is explicitly disclosed; neither is certified human ground truth. Primary6selected structures; independent8, including ambiguous/excluded cases. The independent reviewer states **zero hard terminal-tangent labels**. Engineering uncertainty intervals are not statistical confidence.

Frozen labels SHA256:

- Primary: `d63098509812d6c39e11566975a61515442dfbaea89a05b1681ea31bf0ac3e32`.
- Independent: `88a7faf86a9c5ed8b8f9922f1476287222291e618d891f771812d5854169cbc0`.

Old annotations/tolerances are unchanged. New independent right anchor uses1.75px endpoint uncertainty instead of the old snapshot's1.5px; this is a separate measurement, not a retroactive PASS. Earlier1.54px error remains outside the old1.5px tolerance. Position-unmatched structures remain unmatched; their nearest directions cannot validate a hair's direction.

## C. Offline experiment

`tests/visual/lash-tangent-fit.mjs` fits a weighted quadratic to the **existing connected observed distal path**, parameterized by arc length. It does not add candidates, bridge gaps, inspect Density evidence or enter product imports. Up-to8sourcepx window; actual accepted sample support is recorded. Existing direction and2/4/6px chords remain visible for comparison. Fits use quantized observed points, not new independent image evidence.

An audit correction uses saved `observedLength` to truncate the contiguous distal prefix in analysis units before native conversion. `measuredCount` counts all observed pixels, so it must not define a contiguous prefix. The initial01artifact remains preserved. Fit endpoints, residuals, anisotropic native-coordinate scaling and exact source/image/annotation hashes are recorded. Preview/Export/render/cache/confidence/opacity/length caps are untouched.

|Consensus natural tip|Product direction|Quadratic direction|Actual fit support|Max residual|Visual uncertainty|
|---|---:|---:|---:|---:|---|
|Left|−116.5°|−143.7°|6.87sourcepx|0.25px|Primary−125…−70°, independent−135…−60°; terminal tangent ambiguous|
|Right|−104.0°|−108.9°|7.44sourcepx|0.41px|Primary−116…−92°, independent−120…−75°; provisional shaft axis|

Left traced chord varies **−134.9° /−122.3° /−111.2°** at2/4/6sourcepx. This is substantial support-window sensitivity. Small fit residual does not validate an extrapolated derivative. Left quadratic lies outside both broad new visual intervals; right offers no demonstrated advantage. Product membership in those intervals also does **not** establish exact tangent correctness.

## D. Visual critique

[Gallery and exact audit](tests/visual/tangent-evidence/index.html) contains original images with local annotations, existing directions and rejected diagnostic vectors. Yellow=provisional local path/uncertainty; cyan=existing trace/direction; dashed magenta=quadratic diagnostic. Display vectors are6sourcepx for comparison, **not actual product strokes**. Original eye shape/pixels are unmodified below diagnostic overlays. Full portrait/product comparisons remain in preceding localization evidence; this experiment created no new product render.

Independent critic reviewed originals, units, scripts, matching, final audit05 and PNGs; final06 clarifies membership-only fields and actual window wording without changing geometry. **Reject quadratic correction; keep LENGTH HOLD.** Wide uncertainty is not evidence for stronger Length. No claim of improved recall, false-positive rate, efficacy or naturalness.

## E. Tests

- Fresh `npm test`: **138PASS**, no skips/failures.
- Separate diagnostic mathematical sanity: **3PASS** — rotation of straight observed structures, refusal of insufficient/repeated observations, exclusion of a diverging proximal root beyond the fit window. These do not prove real-photo tangent accuracy and are not counted as new product tests.
- Existing product `src/`, dependencies, original F1 assertions, fixtures and goldens are byte-identical in git to47e8e9e. Full local browser run was **not repeated** for this diagnostic-only change. Prior results remain162PASS/2F1FAIL/3dependentNOTRUN, not a fresh green claim.
- New PR CI will rerun mandatory checks; its exact result is recorded in PR metadata and completion. No weakening, skipped mandatory gates or golden replacement.

## F. Performance

No runtime code imports the offline diagnostic; no new buffers, source sampling or analysis is performed by the product. No fresh product performance claim. Last isolated active benchmark at47e8e9e remains+5.2ms, cold162.5ms and native export render214ms; refer to the prior report for scope. Physical iPhoneX/11/11ProMax/Android remain **UNVERIFIED**.

## G. Release

PR#5 remains **Draft / HOLD**. No merge, deploy, partial release, version increment or published SHA. Production0.5.1 remains unchanged. CI failure and unproven natural Length still block release.

## H. Next minimal experiment

Keep tips, renderer, confidence and Length caps frozen. Refine distal centers from transverse intensity profiles of the **original decoded pixels**. Compare orientation stability over2/4/6/8sourcepx with positional uncertainty. Distinguish genuine curvature from a quantized trace following one ridge edge. If direction remains unstable or unresolvable, keep that candidate ambiguous rather than forcing an extension. New original-only evidence will be required before adopting a fit. Light-right disconnection, pale lashes, mascara/liner, blur and WebKit rasterization remain separate unresolved risks.
