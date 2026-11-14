# G1c.1: subpixel center and observed initialization

**CENTER/TRACKING QA improves; LENGTH — HOLD. No endpoint, natural extension or product adoption is established.**

## Baseline

Continued clean `feat/g1c1-lash-fidelity` at `112e415e25751c6163e9a1bcb1af37e25d416576`, matching fetched origin. Main remains `b02fac3c684f2a7e3178933cb66ded925ab8bce8`; package0.5.1; Draft [PR#5](https://github.com/Llayon/AuraGram/pull/5). Prior154unitPASS,164browserPASS/2originalF1FAIL/3dependentNOTRUN; isolated L20initial+17.1msFAIL/repeatPASS. Previous portraits/licenses/annotations/goldens/failed experiments are retained.

## Operator and controller changes

The old [curve prototype](G1C1_CURVE_REPORT.md) could choose the first pixel of a flat maximum and reject a half-pixel center. Initial coarse-axis discrepancy was also interpreted as physical curvature. This step changes **both** the center operator and initialization policy; combined gains cannot be attributed to one alone.

Initial [subpixel protocol](tests/visual/lash-subpixel-protocol.json) was declared before new measurements. Use the first intensity-deficit moment rather than a peak/parabolic maximum. Require one connected dominant90%-peak band; compute its interval crossings by interpolation instead of arbitrary first-maximum selection. Keep center/search bound+/-0.5nativepx, inherited0.006contrast floors and original margins1.5/2.5. Reject weak, multiple and one-sided responses. Width/variance is diagnostic, not calibrated confidence.

Measure five fixed-axis profiles at native distances+1,+0.5,0,-0.5,-1 around the same pre-existing body seed. Require every center, every dense bilateral link, and a TLS bootstrap residual<=0.25nativepx. Align to this measured local axis and record discrepancy from the coarse prior separately. The offline seed is refined within the same0.5px search. The old product anchor is unchanged. Initialize rolling history with observed body samples so the15degree subsequent-turn limit applies from the first forward update. Arc12px/48attempts,0.5pxsteps and dense links<=0.25px remain bounded; never bridge/restart after failure.

This replaces the old **initial-prior comparison**, not merely its numeric threshold. Bootstrap adds a new observed-support/residual gate and refines an offline seed; treating this as unchanged acceptance semantics would be incorrect. No manual directions, fan, random angles, new candidates or endpoint-approval path.

## Critic → fix → repeat

Independent critic identified a concrete V1 defect: the moment included every positive profile bin, despite only checking the connected dominant band. A weaker disconnected neighbor could bias the estimate. Preserve V1tools/records; declare [V2component protocol](tests/visual/lash-subpixel-component-protocol.json), SHA256 `11562369b3d4540b5e39d0517bce314d57c7a937917daa84fa1cd8a20eb12057`, before new V2measurements.

V2restricts mass/variance to the contiguous component at or above the **inherited0.006floor** containing the dominant peak. A weaker disconnected component cannot contribute. Added a reproducible unequal-neighbor test, both flat and linear-ramp backgrounds. This does not solve a connected asymmetric shoulder, crease/coating bias or same-fiber ownership. V1initial/real records and exact tool snapshot remain available; no failed comparison removed.

The earliest V0control iteration is also retained: initial25degree cases rejected on discrete band-bound handling; interval-crossing handling then corrected. An incomplete raster attempt exposed a budget assertion; accepted arc now uses a strict12px cap. These engineering corrections were not threshold tuning to pass a portrait. V0recorded14case output and logs remain; no complete V0raster result is claimed.

## Frozen analytic comparison

Reuse **unchanged** prior14analytic controls and192width/phase/sampling variants. No control redefinition, favorable phase/margin or old assertion/golden change. All remain UNKNOWN, not endpoint approvals. Initial14now reach the arc budget; final raster184/192reach budget versus36/192for the rejected old follower:

| Old → new stop | Count |
|---|---:|
|arc-budget → arc-budget|36|
|search-boundary → arc-budget|116|
|turn-bound → arc-budget|32|
|search/turn → bootstrap-search-boundary|8|

No old budget-reaching case is lost. The8remaining cases are straight25degree prior error,sigma0.35,phase0.25/0.75,bothsamplingmodes/margins. Keep abstention; do not widen the bound. Maximum horizontal analytic centerline error is~0.1602nativepx **over accepted prefixes only**; rejected cases have no such error measurement. Budget reach is not naturalness or one-fiber proof. Only four analytic shapes/horizontal phases and finite8x8pixel-area integration were tested; no optical-PSF/general raster guarantee.

## Same real structures

Both decoders sample the same old Chromium-frozen cases, all36configurations; actual WebKit104FaceMesh`no_face` eligibility is not overridden. JPEG/native-RGBA/input hashes checked, no model requests or external HTTPS. No photo upload/new model/source license change.

| Identity | V2per decoder | Interpretation |
|---|---|---|
|C104-right-old16,m1.5,w6|23accepted links,24points,arc11.5377px,initialalignment4.90degrees; arc-budget stop.|Much longer observed sampled path than old1.627px. Still a budget stop on a visible shaft, not a free ending.|
|C104,m2.5,w6|Bootstrap center proposes−0.5595px and is rejected outside0.5bound.|No favorable margin selection. Remaining C104windows lack a complete prior axis.|
|PI729R1,m1.5|All3windows bootstrap-boundary.|Ambiguous crease/junction.|
|PI729R1,m2.5|All3windows accept one~0.591px link then one-sided edge.|Not a terminal; no useful extension.|
|PI729R2|All6ineligible under prior body/association.|No active tracing or branch-classifier validation.|

Across both decoders8bootstrapped paths/52accepted links. Source/geometry positions remain frozen; no landmark modification. C104result strongly depends on margin, makeup/coating can bias a centroid, and dense sampled contrast does not establish biological same-fiber ownership. Renderer receives none of these paths.

## Evidence, checks and release

[Gallery](tests/visual/subpixel-evidence/index.html):every36real configuration,14analytic panels and192variant matrix. Cyan=old anchor; blue=bootstrap observations; white=refined offline seed; green=accepted sampled path; orange/red=unaccepted proposal/reference. Budget stop is not an ending. Source panels use Pillow, measurements verified browser RGBA; variable axes labelled. Previous full portraits/native100/200/400%crops/production0.5.1effect/difference maps/licenses remain linked. No new product effect/difference map is fabricated.

Raw V0/V1/V2records, CSVtransitions, critic, source/protocol/helper hashes and replay/log evidence retained. [Independent critic](tests/visual/subpixel-evidence/CRITIC.md) reviewed code/realPNG and discovered the weak-neighbor defect; final scope and residual risks remain explicit.

Final `npm test`: **159PASS**, preserving154old tests plus5new checks: half-pixel symmetry, measured initialization/subsequent turn bound, multiple/one-sided rejection, fork/gap stops, weaker disconnected neighbor on flat/ramped background. These are mechanism checks, not real naturalness.

Full single-worker E2E: **164PASS/2unchanged originalF1FAIL/3dependentNOTRUN**,169total,6.6min. Both F1failures remain LengthRGB0 versus required>10 in `e2e-colors.spec.js:106`,Chromium/WebKit. Existing Density/L6/L22/negative/golden/history/cache checks remain green. Product source and browser assertions do not use this QAprototype; V2unit checks were repeated after the critic fix. Isolated active-performance and site smoke results follow below after sequential runs; pendingCI/dependentNOTRUN never count asPASS.

Fresh isolated `chromium-performance --no-deps --workers=1`: **3PASS**. Legacy L20off77.4ms ->moderate83.1ms,delta+5.7ms. Active real natural portrait720x1080,D35/L100/Def25:19.3ms off ->21.6ms active,delta+2.3ms versus15ms target,LengthRGB227/Density206,2recovered tips and stable cache/analysis time. Cold122.6ms. Full2400x3600export render222ms,encode351.2ms,button-to-blob665.8ms,9,225,180bytes. This measures unchangedv6, not integrated subpixel overhead/naturalness; prior-stage+17.1msFAIL remains preserved and this trial does not settle variance. Full-suite dependentNOTRUN is not retroactivelyPASS.

Fresh `build`, `package:site`, `check:site`: **PASS**, including packaged Chromium native/WebKit software real-face retouch and PNGexport. Own generated CSS/vendor changes restored. V2same-engine real-path repeats and14/192analytic repeats reproduce records exactly; cross-engine tolerance1e-10. Fifteen logs and36V1views/tool snapshot retained. Latest-head CI is recorded separately in PR metadata; no incomplete CI is called green.

No runtime`src`,dependencies/version,MediaPipe,cap224,Densitybilinear/35%limit,settings/history/cache/preview/export change. No slider analysis/newWorker. Prototype integrated cold/preview/export cost,peakmemory and physical phones remain UNVERIFIED. DraftPR/HOLD; no merge,partialDensityrelease,Pagesdeploy or newproductionSHA. Original efficacy,endpoint/naturalness and held-outbare/lightlash gates remain open.

## Next bounded decision

Keep this as a QAcenter/tracking candidate. Establish same-structure continuity and genuine free endings on appropriate held-out real portraits, with connected-shoulder/eyeliner/branch negatives, before sending any path to Length. Do not turn a budget stop or a selected margin into an endpoint.
