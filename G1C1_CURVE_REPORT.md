# G1c.1: bounded native curve following — rejected

**LENGTH — HOLD. This prototype does not recover a useful connected continuation or a true endpoint. No runtime adoption, threshold relaxation or product tip move.**

## Baseline

Continued clean `feat/g1c1-lash-fidelity` at `01c10bf992198b093dc4bca83723e54d008b4e1e`, equal to fetched origin. Main remains `b02fac3c684f2a7e3178933cb66ded925ab8bce8`; version0.5.1; [PR#5](https://github.com/Llayon/AuraGram/pull/5) OPEN/Draft. Previous150unitPASS,164browserPASS/2originalF1FAIL/3dependentNOTRUN. All preceding photos/licenses, source-only annotations, production0.5.1/v6 comparisons, reports and rejected experiments remain intact.

## Declared prototype

[Protocol](tests/visual/lash-curve-protocol.json), SHA256 `6685669dd8ca5189547982c3891dc15a44d0adbce44c481bb8b9d101089e7fd8`, saved before curve measurements. Same three old Chromium-frozen identities, every margin/window and missing fit. Both decoders use identical frozen cases; WebKit104 real FaceMesh `no_face` eligibility is not overridden. No manual angle, new candidate/seed, model invocation or upload.

Seed at the **first previously observed native body center**, nominally2px behind the old anchor, only where prior sampled body and anchor association both passed. This is an offline observation seed, not a new product tip. Predict0.5native steps, seek a local transverse center inside +/-0.5nativepx with the original margin1.5/2.5. Reject boundary, weak, one-sided, competing and flat valleys. Require bilateral contrast at every <=0.25native sample linking the preceding center to the proposed center. Do not bridge or restart after failure.

Hold initial direction until accumulated new arc reaches2nativepx, then TLS-fit recent centers within2native arc and reject changes>15degrees per update. Bound total arc12px/48attempts. These are uncalibrated engineering limits. Local competing-valley rejection is **not** a general branch detector; sampled contrast does not prove native8-connectivity or same-fiber ownership. Stopping is always UNKNOWN, never endpoint approval.

## Real-photo results

36configurations,16eligible paths,18accepted sampled links across both decoders. Numeric C/W agreement within1e-10; native RGBA/input/source hashes unchanged.

| Frozen identity | Result per decoder | Interpretation |
|---|---|---|
|C104-right-old16|2eligible paths;3accepted new links each. Accepted arc1.627/1.646px. First proposed TLS changes direction22.39/22.01degrees and is rejected.|Initial-vs-local direction mismatch, **not a verified physical22degree bend**.|
|PI729R1|6eligible paths; margin1.5 accepts one link (~0.508–0.511px), margin2.5 accepts none. All stop at local search boundary.|Search support fails; not an ending.|
|PI729R2|All6paths ineligible under prior body/association gate.|No tracing; no absent-hair or branch-detector validation.|

C104's first TLS is triggered at proposed accumulated arc~2.166px, but actual retained fit span is only~1.623px/count4 because the seed has left the recent-arc window. Its initial axis~−64degrees becomes~−86.5degrees. Accepted prefixes are shorter than the roughly2px seed-to-old-anchor distance. **No path demonstrates continuation past the old anchor**, much less a useful new endpoint. Raising the turn bound to rescue this photo would be unjustified.

## Analytic controls requested by critic

After those results, but before their own measurements, declared [14initial controls](tests/visual/lash-curve-controls.json): known vertical thin lines with initial direction errors0/5/10/15/25degrees and two continuous quadratic centerlines `x=40+k*(34-y)^2`,k0.015/0.03, both margins. Curve protocol unchanged; no tuning.

- Errors0–15 reach the arc budget; error25 stops on turn bound after~1.66px, despite maximum horizontal error~0.011px **over that short accepted prefix only**. This is initial-axis correction on a straight line, not physical curvature. It exposes conservative policy behavior, not necessarily an implementation bug.
- Quadratic controls stop at search boundary after~5.50/4.01px. They contain no branch or ending. Their narrow point-sampled Gaussian sigma0.35px is under-resolved; grid locking/tangent lag and raster sampling require separate investigation.

Therefore declared a further [192variant raster supplement](tests/visual/lash-curve-raster-controls.json), before its measurements: sigmas0.35/0.7/1.2nativepx, horizontal phases0/0.25/0.5/0.75, point sampling versus64midpoint samples integrated across each pixel area, two margins and four shapes (straight0/25degree error, quadratic0.015/0.03). Same controller and thresholds throughout. All variants retained.

| Shape | Stop counts per sampling mode (24variants) |
|---|---|
|Aligned straight|18arc-budget,6search-boundary|
|Straight,25degree initial error|17turn-bound,7search-boundary|
|Quadratic0.015|24search-boundary|
|Quadratic0.03|23search-boundary,1turn-bound|

Stop reasons agree in every one of96paired point/area cases, not merely aggregated counts. All6aligned-straight boundary failures per mode occur at phase0.5, across all widths/both margins, with accepted arc0. Symmetric neighbor pixels produce a bilinear maximum plateau; first-maximum selection reaches the negative search boundary and rejects before interpolation. Narrow point sampling alone is insufficient explanation, but this does **not** make rasterization irrelevant or establish controller logic as the sole cause. The finite8x8integration control has no convergence/optical-PSF validation; horizontal phases/four analytic shapes do not establish real recall or naturalness.

## Visual evidence and independent critic

[Gallery](tests/visual/curve-evidence/index.html): every36real-photo path/configuration,14analytic control panels and complete192variant matrix. Cyan=old anchor; white=measured seed; green=accepted sampled prefix; red/orange=failed prediction/proposed center, **not accepted into the path**. Variable axes are labelled. Source illustrations use Pillow; numerical measurements use verified browser RGBA. Previous full portraits, effects/difference maps, native100/200/400% eye crops and licenses remain linked; no new rendered product effect is claimed.

Full manifests, pathsCSV, all192raster rows, helper/protocol/source hashes and replay evidence retained. [Independent read-only critic](tests/visual/curve-evidence/CRITIC.md) verified the bootstrap mismatch, short first-fit support, PNG labeling, all192counts/96paired reasons and half-pixel plateau mechanism. No evidence supports same-fiber ownership, a general branch detector, natural Length or product adoption. No favorable phase/margin selected; no threshold relaxed.

## Verification and release

`npm test`: **154PASS**, preserving150prior checks plus4analytic mechanism checks: a supported straight shaft remains bounded/UNKNOWN, a specific symmetric fork stops, a gap cannot be bridged, and failed body/association cannot seed a path. These do not establish a general branch classifier or photo quality.

Fresh full single-worker browser: **164PASS,2unchanged originalF1FAIL,3dependentNOTRUN**,169total,6.6min. Both failures remain `e2e-colors.spec.js:106`: LengthRGB0 versus required>10 in Chromium/WebKit. Original Density/L6/L22/negative/golden/history/cache checks remain green. No old assertion, threshold or golden was weakened.

Initial isolated performance: **2PASS/1FAIL**, legacy L20off77.4ms ->moderate94.5ms, **delta+17.1ms FAIL** versus<15ms. Active natural portrait720x1080,D35/L100/Def25 separately passes16.6ms ->24.5ms,delta+7.9ms,LengthRGB227/Density206,2recovered tips/stable cache. Cold185.2ms;2400x3600export render242.1ms,encode377.2ms,button-to-blob700.2ms.

One isolated repeat after closing completed local jobs: **3PASS**, legacy67.5ms ->70.3ms,delta+2.8ms; active natural16ms ->21ms,delta+5ms, same effect/cache evidence. Cold131.3ms; export render195ms,encode315.8ms,button-to-blob597.1ms,9,225,180bytes. Both complete logs retained. The failing first trial is not erased or retroactively PASS; stable performance is not established by selecting the repeat. Attribution of variance remains unresolved. These measure unchanged v6, not integrated prototype overhead or naturalness; the full invocation's dependent NOTRUN remains explicit.

Fresh `build`, `package:site`, `check:site`: **PASS**, including packaged native Chromium/software WebKit real-face retouch and PNG export. Own generated CSS/vendor churn restored before commit. Same-engine real-path replays and both analytic studies reproduce records exactly; both-decoder agreement uses1e-10tolerance. Helper snapshots and11logs preserve successful and failed results. Latest-head CI is recorded in PR metadata; pending/incomplete CI is not PASS.

Product `src`, dependencies/version, MediaPipe, cap224, Density bilinear/35%limit and old assertions/goldens unchanged. No slider analysis, preview/export geometry or cache/lifecycle/settings/history change. Prototype integrated runtime, peak-memory and physical mobile performance are UNVERIFIED. Physical iPhones/Android remain UNVERIFIED. Prototype buffers are bounded on these inputs; real native patch256px and at most48short profiles per eligible path.

PR stays Draft. No merge/deploy/partial Density release or new production SHA. Original two Length efficacy failures, preterminal artifacts, uncertain endpoints and incomplete held-out/bare/light coverage continue to block G1c.1 closure.

## Decision

Reject this follower for product use. First resolve subpixel center/plateau ambiguity and initialization consistency on declared analytic controls, retaining weak/multiple-structure abstention; then validate same-structure continuation on held-out real photographs. Do not turn a controller/search stop into a tip, select a favorable phase or increase limits to make C104 pass.
