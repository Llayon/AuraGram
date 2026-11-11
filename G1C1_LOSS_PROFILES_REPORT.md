# G1c.1: transverse native profiles near fixed-axis losses

**LENGTH — HOLD. The C104 loss is consistent with lateral escape from a continuing structure, not a verified ending. No runtime algorithm adopted.**

## Baseline and scope

Continued clean `feat/g1c1-lash-fidelity` at `fd622864e94337cf29606938a37227bcc3c1d5fb`, matching fetched origin. Main remains `b02fac3c684f2a7e3178933cb66ded925ab8bce8`; package version0.5.1; [PR#5](https://github.com/Llayon/AuraGram/pull/5) OPEN/Draft. Previous stage147unitPASS,164browserPASS/2originalF1FAIL/3dependentNOTRUN. Its CI run43097439725 was still queued at this stage's precheck, not PASS.

This continues the [anchor experiment](G1C1_ANCHOR_ASSOCIATION_REPORT.md), retaining the same three old Chromium-frozen identities and every automatic axis/missing fit. No new source photographs, AI model, MediaPipe invocation, upload, paid service or generated portrait. Source JPEG provenance/licenses, full portraits, originals/0.5.1/v6 comparisons and failed experiments remain intact in preceding evidence. WebKit104 real FaceMesh `no_face` is not overridden by sampling the frozen Chromium cases in both decoders.

## Measurement

[Protocol](tests/visual/lash-loss-protocol.json) was saved before the new loss-neighborhood measurements. Existing photos/prior results were already known; this is exploratory engineering, not blinded validation.

Protocol SHA256: `cd9a19e57cb8229c143227395d01bf09a939da1f566d46a37529be6e60c4cd94`. At each previously recorded first contrast loss, measure transverse profiles at native along-axis offsets -1,-0.5,0,0.5,1px. Keep the previously fitted axis fixed. Reuse the unchanged native-center operator, mapped half-analysis-cell search bound, original margin1.5/2.5 and every6/8/12window. Missing axis/loss means no new search.

The center operator measures background-subtracted deficits and rejects boundary/weak/one-sided/multiple/flat responses. A unique center is **not** automatically a thin ridge. Separately measure existing bilateral response at the fixed line and the observed transverse center using native radii0.75/1.5 and along step1. Record lateral support only where shift exceeds the inherited0.25px profile lattice, fixed-line response is below0.006 and observed-center bilateral response reaches0.006. These inherited engineering numbers are not calibrated probabilities or a release classifier.

All individual profiles, proposed shifts, rejection reasons, on-axis/at-center values and configurations remain available. No tracing between proposed centers, seed change, favorable-window selection, tip relocation or product rendering. Spatial search remains bounded; a larger search was not tried to obtain a desired answer. The mapped cell footprint is an engineering bound around the tested line, not calibrated uncertainty of an extrapolated shaft. No endpoint-approval path exists in this diagnostic.

## Results

Both decoders agree within1e-10 and native pixels match previous stages. Across36configurations:28available,8missing;140profiles;60unique-center responses,76one-sided rejections,4multiple-valley rejections. Only8profiles have the defined displaced bilateral support, all on C104 (4per decoder). These are repeated/configuration-correlated measurements of the same photo, not8independent hairs or an efficacy rate.

| Identity | Observations per decoder | Interpretation |
|---|---|---|
|C104-right-old16|10profiles/2available axes; all unique centers. At first losses, shifts -0.956px (margin1.5) and -0.588px (margin2.5). Bilateral fixed/center response0/0.140 and0.00533/0.212 respectively. Three/one rows meet lateral-support rule.|Strong nearby image structure explains why the fixed-line loss must not be treated as an ending. Same-fiber ownership/continuity still not established.|
|PI729R1|30profiles/6axes;16unique centers,14one-sided edges. Near losses, small shifts do not restore sufficient bilateral response.|The dark crease/junction remains ambiguous. No verified isolated tip.|
|PI729R2|30profiles/6axes;4unique centers without bilateral ridge support,24one-sided edges,2multiple valleys.|Unresolved junction; neither absent-hair evidence nor a valid endpoint.|

All36configurations retain UNKNOWN, deliberately. This is not product accuracy or naturalness validation. The distinction between deficit-center acceptance and bilateral ridge support is especially important for R1/R2; accepting the former alone would manufacture confidence.

C104's three versus one lateral-support rows are **not** a same-distance margin comparison: first loss10px produces profiles9–11px, while loss8.5px produces7.5–9.5px. At overlapping9/9.5px both variants are lateral=false because their fixed-line response already exceeds the inherited floor. These counts cannot select a better margin; half-pixel steps/bilinear kernels create strongly correlated observations.

## Visual evidence and critic

[Gallery](tests/visual/loss-profile-evidence/index.html):36figures, all variants/missing axes, each with source-pixel context and five transverse profiles. Cyan=old anchor; gray=profile line; green=unique observed center; red=unresolved reference. Shading=bounded search; dashed red=inherited floor; vertical line=proposed displacement. Chart Y scales differ and must be read numerically. Source panels use Pillow for illustration; measurements use verified browser-decoded RGBA. Previous eye crops retain100/200/400% display. No new product effect/difference map is claimed because this diagnostic renders none.

Complete measurements,140-rowCSV, helper snapshots, input/source/protocol hashes and validation are archived. Original stage inputs and initial measurements are retained; no failed variant is removed.

Independent read-only critique is saved with the evidence. Product adoption requires image-supported endings and useful natural visual results, not green math tests or higher local responses.

## Verification and release

`npm test`: **150PASS**, preserving147previous tests plus3analytic checks: off-axis support stays UNKNOWN, a one-sided step cannot become a thin strand, and absent axis/loss starts no search. Synthetic checks verify mechanics only.

Fresh full single-worker browser: **164PASS,2unchanged originalF1FAIL,3dependentNOTRUN**,169total,6.5min. Both failures remain LengthRGB difference0 versus required>10 in `e2e-colors.spec.js:106`, Chromium andWebKit. Existing Density/L6/L22/golden/negative/history/cache gates remain green. No threshold or golden changed.

Separate isolated `chromium-performance --no-deps --workers=1`: **3PASS**. Legacy L20warm66.2ms off ->74.5ms moderate,delta+8.3ms. Real active natural portrait720x1080,D35/L100/Def25:15.4ms off ->18.2ms active, **delta+2.8ms** versus15msbudget, LengthRGB227/Density206,2recovered tips, stable cache/analysis time. Cold121.7ms. Full2400x3600export render190.2ms,encode346.1ms,button-to-blob607.7ms,9,225,180bytes. These are unchanged v6 measurements, not prospective curve/prototype overhead or naturalness proof. Full-suite dependent NOTRUN is not retroactively PASS.

Final CLI-hardened repeat exactly reproduces all initial and hardened C/W result records; final harness/helper/protocol hashes and original initial manifests are retained. Fresh site build/package smoke results and latest-head CI are tracked separately; queued or incomplete CI is not PASS.

Fresh `npm run build`, `package:site`, `check:site`: **PASS**, including packaged Chromium native/WebKit software real-face analysis, retouch and PNG export. Own generated CSS/vendor churn restored before commit. [Independent critic](tests/visual/loss-profile-evidence/CRITIC.md) found no substantive measurement bug; CLI prior-input help/guard was fixed before the final repeat.

Product `src`, dependencies/version, cap224, bilinear Density/35%limit, existing E2E thresholds/goldens/history/cache/settings remain unchanged. No prototype analysis runs on sliders or preview/export. Therefore this step has no integrated overhead, peak-memory or mobile-device validation; physical iPhones/Android remain UNVERIFIED.

PR stays Draft; no merge, release, Pages deployment or new production SHA. Original mandatory Length efficacy failures and visual/preterminal/held-out coverage blockers remain. No partial Density release.

## Next decision

Do not tune these straight-axis losses into endpoint detections. A future bounded curve-following experiment must preserve same-structure association and refuse crease/branch ambiguity, with held-out endpoint-positive/negative photographs before any rendering change. C104 may supply a continuing-structure control, while R1/R2 remain ambiguity controls; this does not replace the original mandatory fixture or weaken its thresholds.
