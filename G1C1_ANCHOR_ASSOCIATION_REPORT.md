# G1c.1: fixed-anchor association and bounded continuation

**LENGTH — HOLD. This is an offline diagnostic step, not a product improvement or release.**

Continued clean `feat/g1c1-lash-fidelity` at `1dd24bfcc2846b599c890064b4ed739e8d24f6d7`, equal to fetched origin. Main remains `b02fac3c684f2a7e3178933cb66ded925ab8bce8`; version 0.5.1; [PR #5](https://github.com/Llayon/AuraGram/pull/5) OPEN/Draft. No later branch commits existed. Existing reports, photographs, licenses, goldens and failed experiments are retained.

## Question and fixed procedure

The preceding [native-shaft experiment](G1C1_NATIVE_SHAFT_REPORT.md) measured body axes but left the old-anchor-to-first-center association untested. The new [protocol](tests/visual/lash-anchor-protocol.json), SHA256 `776d424041e7ca78c15fffe5945119ba52dc6c9f5a10116f0ea045589c58aca0`, was saved before these new measurements. It keeps the same three old identities, two margins and three windows; every available automatic axis and every missing axis is reported. No manual angle or annotation is sent to the browser jobs. No new seed, recentering, fit, tip relocation, gap bridging or rendered Length.

- Check every point at spacing <=0.5 native pixel on the straight segment from unchanged old anchor to first observed center (roughly 2 native pixels). Use the fixed automatic axis normal, inherited radii 0.75/1.5, along step 1 and floor 0.006.
- Require previous dense between-center body support separately. Neither check proves biological same-fiber ownership or an 8-connected skeleton.
- Measure forward 0–12 native pixels at 0.5-pixel spacing through the old anchor, along every available axis. Keep every loss and reentry. Do not seek a different axis that produces a preferred ending.
- Return UNKNOWN for unconfirmed association/body or any contrast loss. Fully supported continuation would be `continuing-within-bound`, never an approved endpoint. The tool deliberately has **no endpoint-approval path**: it does not implement an endpoint localizer.

Crop-unavailable samples are separately identified from contrast losses. The frozen cases, source JPEGs, input manifests and native RGBA hashes are checked. External HTTPS is blocked and no model is requested. Both decoders sample the same Chromium-frozen cases; WebKit104's real FaceMesh `no_face` is not overridden.

## Results

| Old identity | Available axes per decoder | Anchor association | Prior body support | First forward contrast loss |
|---|---:|---|---|---|
| C104-right-old16 | 2/6 | 2/2 supported | 2/2 supported | 10px (margin1.5); 8.5px (margin2.5), then reentry9px and loss10px |
| PI729R1 | 6/6 | 6/6 supported | 6/6 supported | 3–3.5px; some axes reenter at11.5/12px |
| PI729R2 | 6/6 | 0/6 supported | 0/6 supported | 0px; one axis has isolated late support |

All 36 configurations, including 8 missing fits across the two decoders, remain UNKNOWN. This is an explicit limitation of the diagnostic, not an accuracy score. C/W measured values agree within 1e-10; native bytes match the preceding experiment. No sample leaves its crop in these cases. Hardened harness repeats preserve all initial numeric results exactly; initial manifests are archived too.

C104/R1 now have **sampled contrast association** over the formerly untested short segment. Their old anchors are still not demonstrated free endpoints. A straight-axis loss can mean lateral departure from a curved hair, width/coating change or background/neighbor contamination. Reentry cannot be connected across a failed interval. R2 remains unresolved, not a demonstration that no hair exists. The inherited floor is an engineering constant, not a calibrated native-endpoint probability.

## Evidence and independent critique

[Gallery](tests/visual/anchor-probe-evidence/index.html): all 36 figures, source-pixel crops with green supported/red unsupported samples and forward/association curves. [CSV](tests/visual/anchor-probe-evidence/summary.csv), compressed complete measurements, tool snapshots, source/input hashes and validation are retained. Cyan marks the old anchor. Charts use plotting pixels; previous native eye crops retain 100/200/400% display. Full portraits, source licenses and exact original/0.5.1/v6 effect/difference comparisons remain in earlier evidence; this QA tool renders **no new product effect**.

Independent critic reviewed code and measurements and requested explicit frozen-case hash checking and separate crop-unavailable diagnostics; both were added before the repeat. Loss along a fixed straight axis cannot establish a tip. Reentry may belong to another structure. No favorable configuration or manual input found. See [critic](tests/visual/anchor-probe-evidence/CRITIC.md).

The critic also inspected six representative source/measurement PNGs: C104's visible oblique shaft appears to continue above the marked loss while the straight axis departs its center; R1 lies at a vertical-structure/dark-crease junction; R2 is another ambiguous junction. These are concrete visual reasons against treating the losses as endings. Chart Y scales differ across cases; labelled values, not raw plotted peak heights, must be compared.

## Verification and release

`npm test`: **147 PASS** (all previous144 plus3 analytic tests). Added tests demonstrate that a known synthetic termination still gets UNKNOWN, reentry cannot bypass a gap, and missing-anchor/cropped kernels cannot approve an endpoint. They test operator mechanics, not natural photographic quality.

Fresh full single-worker browser run: **164 PASS, 2 unchanged original F1 FAIL, 3 dependent NOT RUN**, 169 total,6.4min. Both failures are `e2e-colors.spec.js:106`: Length RGB difference0 versus required>10 in Chromium/WebKit. No assertion or threshold changed. A separately selected Chromium LF16/17/20 check also passed; it is not the active-Length performance project.

Fresh isolated `chromium-performance --no-deps --workers=1`: **3 PASS**. Existing warm L20 fixture64.8ms off ->68.9ms moderate, delta+4.1ms. Separate real active `natural-full-original.jpg`,720x1080,D35/L100/Def25:14.7ms off ->19.5ms active, **delta+4.8ms** versus15ms budget. Length RGB difference227, Density206,2recovered tips, unchanged cache/analysis time. Cold analysis117.8ms. Full2400x3600export render180.6ms,encode324.2ms,button-to-blob592.3ms,9,225,180bytes. This proves active execution of unchanged v6, not prototype integration, endpoint quality or naturalness. The full-suite dependent checks remain NOT RUN in that invocation, not retroactively green.

Product `src`, old mandatory assertions/thresholds/goldens, dependencies and version are unchanged. Physical iPhones/Android remain UNVERIFIED. This diagnostic has no integrated cold/preview/export or peak-memory result.

Fresh `build`, `package:site` and `check:site`: **PASS**, including packaged Chromium native/WebKit software real-face retouch and PNG export. Own generated CSS/vendor churn was restored. Final hardened same-engine repeats reproduce every result exactly in C/W, with the same helper/protocol hashes. Archived logs preserve failed full-suite results as well as isolated successes. Latest-head CI is tracked in PR metadata; queued/incomplete CI is not PASS.

No ready/merge/deploy, no partial Density release, no new published SHA. Original Length efficacy failures remain blockers; body/anchor support alone does not justify drawing. Broader/held-out bare and light lash endpoint coverage remains unverified.

## Next minimal experiment

For every available automatic axis, inspect bounded transverse native profiles around its first contrast loss, keeping all margins/windows and missing cases. Distinguish lateral departure, multiple structures and genuinely observable termination; retain UNKNOWN when ownership or ending is ambiguous. Do not move product tips, connect reentries through gaps or add a rendering rule before image-supported endings and natural benefit are demonstrated.
