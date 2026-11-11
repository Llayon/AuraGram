# G1c.1: image-derived native pre-tip centers

**LENGTH — HOLD. Automatic body-direction measurement works on limited support; endpoint localization remains unverified. No runtime implementation adopted.**

## A. Baseline and frozen protocol

Continued clean `feat/g1c1-lash-fidelity` at `0bb38cb928bdc6f90ded0af93f87931421439b3b`, matching fetched origin. Main `b02fac3c684f2a7e3178933cb66ded925ab8bce8`; version0.5.1; Draft [PR#5](https://github.com/Llayon/AuraGram/pull/5). Product v6/source unchanged. Prior local139unit/164browserPASS,2originalF1FAIL,3dependentNOTRUN; previous CI browser installation was incomplete, not green.

The same three old Chromium224 identities remain fixed: C104-right-old16, PI729R1/R2. The existing frozen case file and independent annotations are unchanged. WebKit104's real FaceMesh no_face is not overridden: both decoders sample the Chromium-frozen cases for diagnosis only. Source JPEGs/author credits/licenses remain in [positive evidence](tests/visual/positive-evidence/sources.json). No new photo, generated image, AI model, upload or model inference.

[Center protocol](tests/visual/lash-shaft-protocol.json), SHA256`4b5477dca5396bc3c1e986ee2595f817ab7dc4c644ff5479177f199eb85ab514`, was recorded before native center measurement. Existing source images/prior diagnostics were known: this is an exploratory engineering experiment, not blinded validation. Only old contiguous `observedLength` support is mapped to source pixels; no missing prefix is extrapolated. C104 has about14.49native pixels of recorded prefix.

## B. Estimator implementation

New QA-only `lash-native-shaft.mjs` receives luminance, an old observed prefix, source-per-analysis scales and protocol. **No manual annotation, axis or endpoint enters this API.** Browser jobs omit manual fields; annotation comparison occurs in Node only after estimates are complete.

- Probe source distances2/4/6/8/10/12px along the old prefix, excluding the old tip from the fit.
- Transverse search stays inside the normal projection of the original half-pixel box: `.5*(abs(nx)*sx+abs(ny)*sy)`, rounded **down** to the.25native-pixel lattice. This deterministic sampling-cell bound is not calibrated uncertainty.
- Background endpoints lie1.5 or2.5native pixels beyond that search domain. Both margins are always reported. No favorable scale is selected.
- Existing native-center floor.006, boundary/one-sided/multiple-valley rejection, competing-peak ratio.9/separation.75 and bounded parabolic interpolation are retained. No per-case threshold fitting or gap bridging.
- Unweighted total least-squares fits all accepted pre-tip centers in each6/8/12px window. Missing/rejected samples mean no axis; the old tip is never forced onto the fit. Every window/margin remains visible.

`fit.available` means the requested sampled centers support a mathematical axis, **not** one biological fiber, an endpoint, a calibrated probability or permission to render Length. TLS coherence from three near-collinear points can be high with very little support. In particular, window6 uses samples2/4/6: its actual observed span is roughly4px, not6px.

## C. Automatic-axis results

Both decoders produce matching native pixels and matching numeric measurements. Three256px native patches match the preceding fixed-case stage exactly; source/index mapping is unchanged. Main results (all angles in degrees, outward):

| Old identity | Margin | Window6 | Window8 | Window12 |
|---|---:|---:|---:|---:|
|C104-right-old16|1.5|−64.08|UNKNOWN|UNKNOWN|
|C104-right-old16|2.5|−63.80|UNKNOWN|UNKNOWN|
|PI729R1|1.5|−89.30|−86.72|−87.51|
|PI729R1|2.5|−88.99|−86.53|−87.46|
|PI729R2|1.5|−59.28|−44.14|−47.80|
|PI729R2|2.5|−59.12|−44.22|−49.75|

C104's native short segment differs materially from its stored vertical−90° direction. At8/10px, observed peak displacement reaches the−2.25px search boundary;12px is weak/boundary-dependent. The old coarse prefix is leaving the oblique support within the allowed cell. This is **not a hair ending**, and does not justify expanding the search until it finds a desired answer. The short fit is useful directional evidence but only over a small span.

R1 supplies relatively stable body-direction estimates across both margins/windows. R2 is window-dependent; curvature, adjacent structures/coating/background and coarse-path uncertainty remain possible. The short fit's agreement with a provisional manual direction is not authority to choose that window. Manual intervals are broad local-axis engineering annotations, not instantaneous derivative ground truth.

## D. Dense and forward supplement

An [exploratory supplement](tests/visual/lash-shaft-continuity-protocol.json) was declared after center outputs but before its new measurements. It reuses the same native floor.006 and radii.75/1.5, tests **every** available automatic axis, and never changes an anchor, candidate, seed or effect.

1. Between each consecutive pair of measured centers, test bilateral support at intervals no larger than.5native pixels, with no recentering or partial pass. A missing/failed sample remains unresolved.
2. Through the unchanged old anchor, probe all available fitted directions. Forward curves use0…12native pixels every.5px. Endpoint test locations retain the mapped analysis offsets−2/−1/0/.5/1/1.5/2/3; kernels use native units. The inherited floor is not calibrated for this operator or a release classifier.

| Identity | Available axes per decoder | Dense between-center support | Forward from old anchor |
|---|---:|---|---|
|C104-right-old16|2 of6|All samples supported for both|Continuing response for both|
|PI729R1|6 of6|All samples supported for all6|Continuing response for all6|
|PI729R2|6 of6|1–5unsupported samples per configuration|Weak fitted-tip support for all6|

This is a substantive distinction from a high-coherence fit alone: sparse valid centers did not guarantee intermediate contrast for R2. A failed straight inter-center probe can reflect curvature, width/coating or background, not absence of a real lash. Dense samples themselves do **not** establish a native8-connected skeleton or biological same-fiber identity.

Crucially, the dense check starts at the first center2px before the old anchor. The old-anchor0→first-center2 association is **not yet established**. Forward response at R1/C104 also does not prove ownership by the same shaft. It does show that the old anchor has not been demonstrated to be a free endpoint under these checks. No curve/window is chosen because it yields a favorable label. No new Length is drawn.

## E. Evidence and independent critic

[Gallery](tests/visual/native-shaft-evidence/index.html):54labelled views/assets, including18native/source overlays and36PNG/SVG scientific plot files; [72center rows](tests/visual/native-shaft-evidence/centers.csv), [36fit rows](tests/visual/native-shaft-evidence/fits.csv), [all configurations](tests/visual/native-shaft-evidence/summary.json). Full portraits, exact previous effect/difference maps and source licenses remain in the preceding evidence; no originals or failed comparisons are overwritten.

Cyan=old prefix/old anchor, green=observed unique center, red=unresolved position, white=estimated displacement, yellow=fitted segment restricted to measured support. These are diagnostic overlays, never new hairs. Native100/200/400% display is nearest-neighbour enlargement; chart pixels are plotting pixels. All margins, missing fits and weak/dense/continuing responses remain available.

Independent read-only critic verified annotation separation, source mapping/pixel equality, short-span/coherence limits and all-axis supplement results. R1's automatic body direction is useful; no endpoint or same-fiber approval. Critic explicitly identified the untested0→2association. [Critic](tests/visual/native-shaft-evidence/CRITIC.md).

## F. Tests and reproducibility

- `npm test`: **144PASS**, preserving139existing tests and adding5analytic QA tests to the main command. Tests cover a sloped structure without manual input, ambiguous parallel valleys, one-sided edge, a missing sampled center and a gap **between** otherwise valid center rows. Synthetic tests verify mechanics only, not naturalness.
- Full single-worker browser: **164PASS,2unchanged originalF1FAIL,3dependentNOTRUN** (169total,6.4min). Closed-white-liner and real hidden-eye guards remain green in the unchanged product. Those product checks do not validate this estimator as a new negative classifier; prototype-specific broader/held-out negatives remain untested.
- Offline validation verifies frozen hashes/identities,72center measurements,36fits/28available axes,28dense checks, no fitting across rejected centers, all margins/windows, step bounds and source/tool/image bytes. Both-decoder measurements agree within1e−10. Repeat runs reproduce all center, dense and forward records exactly.
- Isolated active v6 performance **3PASS**: off14.8ms→active20.5ms,delta+5.7ms,2recovered tips, LengthRGB227/Density206, stable cache. Cold141.4ms;2400×3600 export render222.6ms/encode331.7ms/button→blob642.2ms. This measures unchanged v6, not prospective native-estimator overhead or naturalness.
- Fresh build/package:site/check:site **PASS**, including packaged Chromium native and software WebKit real-face retouch/PNG export. Generated CSS/vendor churn restored. CI is recorded separately in PR metadata; an incomplete installation or dependent NOTRUN is not PASS. Version stays0.5.1; no existing assertion, threshold, golden or MediaPipe package changed.

## G. Runtime, release and remaining risks

Runtime `src` is untouched. `package.json` only adds the five QA math tests; dependencies/version remain unchanged. The new estimator and supplement are standalone QA tools, not an app-native analysis pass. No cache/lifecycle/settings/history or slider analysis change, no Worker, no new model. Per-case work uses one256px native canvas/luma patch and short bounded profiles on these inputs; peak RAM and prospective integrated cold cost are not measured. Physical iPhones/Android **UNVERIFIED**.

Draft PR#5 remains **HOLD**; no ready/merge/deploy/partial release or new published SHA. Body-axis estimates do not solve true-tip placement, bare/light-lash coverage, structure ownership, effects on folds/clumps/noise or useful natural Length. The two original F1 failures remain explicit. No colored overlay or analytic test is presented as product improvement.

## H. Next bounded experiment

For the same old identities and all automatic axes, explicitly test association from anchor0 to the first native center2px, then bounded observed outward continuation with separate **endpoint / continuing / UNKNOWN** outcomes. Do not force a tip onto a fit, pick the manual-matching window, bridge a failed sample, substitute a new candidate or render from an unconfirmed end. Keep negative guards and all efficacy thresholds until an image-supported ending and natural visual benefit are actually demonstrated.
