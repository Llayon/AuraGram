# G1c.1: exact graph-break and gate census

**LENGTH HOLD. Diagnostic stage only; no detector, prototype threshold, product guard, renderer, model or version change.** This locates software rejection witnesses on the frozen inputs. It does not establish physical strand continuity or a safe Length effect.

## Baseline and protocol

Starting clean feature HEAD/origin-feature `19775561981e3ca419d7c6250583432e330128da`. Fetched main/origin-main remain `b02fac3c684f2a7e3178933cb66ded925ab8bce8`; PR#5 Draft. Previous [CI43231494076](https://github.com/Llayon/AuraGram/actions/runs/43231494076) completed failure. Previous [downward prototype](G1C1_DOWNWARD_REPORT.md):181unitPASS,166browserPASS/2originalLengthFAIL/3dependentNOTRUN; both V1/V3 rejected on real photos.

Frozen [protocol](tests/visual/lash-break-protocol.json), SHA256 `19d3a58b29d4c7a94ff7d0783815b5c6b37a5a454f45b904ac2766aebf131280`. Same8files/7original photographs,16frozen engine/source cases,32paired eyes and64V1/V3 eye records. Earlier outcomes/annotations were known; not blind generalization.

Protocol wording clarification: “no image analysis rerun” is overly broad. The implementation **numerically replays the old prototype filters on archived browser Float32 grids** to recover hidden state. No new source-photo decode for detection, FaceMesh run, browser analysis, seed or threshold is introduced. Pillow decodes original JPEGs only for scientific illustrations. The frozen protocol is retained unchanged and this execution detail is explicit.

## Implemented instrumentation and safeguards

- `lash-break-instrument.cjs` adds only read-only captures via exact single-occurrence source anchors. It exposes raw direction, anisotropy, depth, pre-thinning masks, parent indices and the actual edge predicates. Source and transformed-module hashes are recorded; transformed hashes include machine-local import linkage, while original source hashes are portable.
- Every original output array, trace and diagnostic is **exactly equal** with and without instrumentation on all64records. Original buffers and source landmarks are not modified.
- BFS is reconstructed from automatic roots in the original deterministic neighbor order. Strict reach masks **and parent arrays match exactly**. The old queue is reused by reverse root censuses, so its final contents are deliberately never interpreted as the original BFS order.
- All frontier pairs are inspected. Pixel failures distinguish unmeasured geometry/kernel limits, response, anisotropy, normal projection and NMS removal. Active-pixel edges retain simultaneous depth, orientation and source/target alignment failures. Counters are pair counts with repeated pixels and co-occurring reasons, not exclusive cause percentages.
- Undirected active components use exactly `active AND loose-root-reached AND NOT strict-reached`. All component summaries are retained; the first3by declared ordering are illustrated. A deterministic shortest observed8-neighbor route is a diagnostic witness, never an identified hair.
- The first failed edge on a route and its first strict-frontier exit are recorded separately. An earlier failed selected edge may enter a vertex reachable through another route. A target already strictly reachable is explicitly flagged rather than called disconnected.
- Sparse labels enter only after the automatic census, as probes of the nearest active source-native pixel. Distance/uncertainty and unavailable routes remain explicit; no label seeds or directions enter the graph. Three no_face references remain unevaluated.

Independent [protocol critic](tests/visual/lash-break-protocol-critic.json) and [code critic](tests/visual/lash-break-code-critic.json) reviewed these distinctions. No orientation floor is relaxed.

## Results

All64numeric replays retain the prior browser outcomes, with maximum discrepancy4.50e−15 at1e−9tolerance. **34,458** frontier pairs match the actual raw edge predicate. Within each version/mask/root set, raw-directed and pruned-directed reach are equal on every eye: **zero pruning reach loss** on this corpus. This does not prove pruning harmless for every possible graph.

| Census | V1 | V3 |
|---|---:|---:|
| Strict-frontier neighbor pairs | 18,902 | 15,556 |
| Active/loose/not-strict components | 293 | 196 |
| Pairs failing orientation agreement | 629 | 249 |
| Frontier pairs targeting an NMS-removed pixel | n/a | 1,655 |

These are graph statistics, not eyelash counts, unique failed pixels or precision/recall. Response, anisotropy and normal-projection failures also frequently co-occur; their global pair counts do not identify a unique physical cause.

### Concrete witnesses near217's frozen endings

| Engine/version/reference | First strict-frontier exit, working pixels | Failed tests |
|---|---|---|
| Chromium V1 L1 | (155,76) → (156,77) | direction dot.707107 <.85; both step alignments pass |
| Chromium V1 L2 | none | no observed undirected root route to nearest active reference pixel |
| Chromium V3 L1/L2 | none | no observed undirected root route |
| WebKit V1 L1/L2 | (155,75) → (154,76) | direction dot0 and target step alignment−.707107 |
| WebKit V3 L1/L2 | (141,79) → (141,80) | direction dot.707107 <.85; both step alignments pass |

The.707107 dot corresponds to a45-degree change between the selected working-pixel directions. Eight directions are quantized in22.5-degree increments; the existing.85agreement admits one-bin changes but not two-bin changes. That is an exact software rejection, **not evidence that the two pixels are one curved physical hair**. The same dot disagreement occurs in ambiguous white-liner/hair controls. The WebKit V1 route even steps against its target tangent, a concrete reason an undirected route is not automatically usable.

### Concrete thinning witnesses

On the selected Chromium V1 L1 route, the first pixel removed in V3 is working(157,79), a path-interior node, not a root seed. Its response.008389 is below both interpolated transverse response-map samples (.022321/.015313). Contributing pixels choose different best directions (e.g. indices1,3,5). This documents response competition at a junction; it does not establish that retaining the weak pixel would preserve a real same-strand route.

For the selected WebKit V1 L1/L2 route, the first removed node is(154,74), also interior, response.006237 versus transverse.013864/.008760. **WebKit V3 still has a different loose route to the reference neighborhood.** Therefore a first removed reference-route pixel is not a unique/global cut. Some NMS contributors were themselves inactive under the original feature tests; all weights, values and direction indices are retained for review, not used as new eligibility.

The previous all-abstaining detector is unchanged. No new real-positive ending, physical root ownership, natural extension or semantic skin boundary is claimed. Controls containing actual upper hairs remain ambiguous contexts, not “no lashes” groundtruth.

## Fixer history and visual evidence

The first01census had a bookkeeping error: a filename-substring check marked all8annotations unavailable. Corrected02uses actual case availability, yielding5ready/3no_face references; a real-source regression test covers it. Initial01census and exact tool sources are preserved. All measured runs/metrics are identical after excluding only corrected availability/tool metadata. Display03adds only hashed read-only sidecar vectors; numerical measurements remain identical to02.

Scientific figures show the original source illustration, archived working luma/masks, measured directions at the selected exit, and numerical gate values. Native160px source crops are provided separately for100/200/400% viewing. Cyan is an observed diagnostic route, not a drawn lash; red marks a route-specific frontier exit; magenta marks a removed V1 reference-route pixel; green is strict graph reach, blue automatic roots. Original pixel data used for numerical decisions remains the frozen browser Float32, not Pillow display colors.

Initial04plots omitted automatic NMS stars because `automatic` did not match stored `auto-0`. Fixed05links the declared V1 reference ID; it does not imply that the reference is the current V3 cyan route. When an old NMS point lies outside the current frontier zoom, the figure explicitly says so; the wide source panel/coordinates retain it. Both initial and corrected figures and the exact initial plot script remain archived. Missing initial stars must not be read as absence of removed pixels.

[Gallery and raw evidence](tests/visual/break-evidence/index.html) links all cases, corrected figures, initial plots, raw frontier/component tables and native crops. Earlier [downward full portraits/source licenses](tests/visual/downward-evidence/index.html) and [production/recovery comparisons](tests/visual/freeend-evidence/index.html) remain untouched. No new source/model/API or photo upload. Bare/coated/makeup history and biological fiber identity remain unverified.

## Tests, performance and release

Fresh **188unitPASS** (181previous+7new). Added tests cover exact instrumentation, anchor drift, co-occurring edge failures, no invented gap/root, alternative valid routes, exact unreached-component definition and real reference availability. Existing assertions/goldens are unchanged.

Full single-worker browser: **166PASS /2originalLengthF1FAIL /3dependentNOTRUN**,171total. Original F1 remains LengthRGB0 vs required>10 in Chromium/WebKit. Isolated active performance **3PASS** after all census/plot/browser jobs closed; this does not relabel dependent NOTRUN.

| Existing application measurement | Fresh result |
|---|---|
| LegacyL20 | off76.7ms / moderate83.3ms, delta+6.6ms |
| Active natural720x1080 D35/L100/Def25 | off16.8ms / active20.6ms, delta+3.8ms; LengthRGB227/DensityRGB206,2tips, stable analysis/cache |
| Active fixture cold analysis | 147.8ms |
| Active export2400x3600 | render226.3ms / PNG323.4ms / button-to-blob629.6ms,9,225,180bytes |
| Build/package/check-site | PASS; Chromium native and WebKit software real face/retouch/PNG smoke |

These measure the unchanged active app, not an adopted break-census algorithm. No benchmark gain from skipping Length is claimed. Build-generated CSS/vendor churn was restored. Archive validation passes559raw-byte mappings,336PNG references and423local links; initial and corrected data/displays remain available. Native160px gallery crop displays640CSSpx at400%, with no broken loaded images. Final independent integrity review is a separate companion artifact; branch CI is reported separately in PR#5 and is not represented as PASS here.

Independent [visual review](tests/visual/lash-break-visual-critic.json) records22actually inspected initial figures/crops and the display findings. Separate [final critic](tests/visual/lash-break-final-critic.json), SHA256 `957af8925db21e2df733cd90c9d98f271abba13b9eabe358cd071c3d59a46b50`, verifies the559mapping/336PNG/423link archive, corrected05automatic markers and outside-zoom note,64replays/34,458checks and fresh logs. It confirms HOLD and no source/prototype/old-test/golden change, not physical strand continuity. Actual restoration of a missing ignored mask sidecar passed without overwriting any existing file. The final critic remains a separately tracked companion outside the preserved pack.

### CI compatibility follow-up

The first pushed census head8351ffe had an additional [CI build failure](https://github.com/Llayon/AuraGram/actions/runs/43246135530/job/131279157071):187unitPASS/1FAIL, not a green build. The new availability unit called legacy `loadInputs()`, whose exact live-source replay hashes represent the authored Windows CRLF checkout. Linux Git blobs use LF; `eyeGeometry.mjs` differs only by128line endings, with identical canonical content. This byte coupling is unrelated to frozen photo availability.

The unit now reads the **same hash-bound actual FaceMesh manifests and label identities** using `lash-break-references.cjs`, without checking live application checkout bytes for this metadata property. All5ready/3no_face/ID assertions and the other six new tests are byte-identical. No real-portrait browser test, threshold, golden, image/model fixture or strict CV source/hash replay guard was changed. Legacy `loadInputs()` remains strict; cross-platform source replay is not silently normalized.

The original559-entry packet/test source and critics remain immutable. An additive [CI compatibility record](tests/visual/break-evidence/ci-compatibility/README.md) pins exact old/new test SHA, reader SHA, identical assertion suffix, equal8reference IDs/16availability records, line-ending proof and raw logs. Validator/replay adapters accept only this declared test-source revision and never overwrite it with the historical copy; all original raw hashes and CV module/source checks remain enforced.

After the fix, Windows `npm test`:188PASS. An isolated dependency fixture with exact LF Git blobs:7PASS (Node on Windows, not a physical Linux result). Its first incomplete-import probe is preserved alongside the completed probe. New-head GitHub CI must be checked separately; this follow-up does not turn original Length F1 failures or dependent NOTRUN into PASS.

Independent [CI-fix critic](tests/visual/break-evidence/ci-compatibility/critic.json), SHA256 `a611aee283e0e9dee96a1bb3a426c633485a1770b8dbd7d8eaea33b620718826`, approves the narrow fixture dependency correction and exact declared test revision, verifies identical assertions/fixture identities, raw log hashes and preserved packet bytes. Actual new-head Ubuntu CI remains a separate verification.

All new code is QA/diagnostics; `src/` and the rejected downward prototype are unchanged. `package.json` changes only the test command. Version/production remain unchanged, PR#5 Draft. The scientific plotting/instrumentation cost is not a mobile or application render benchmark; physical phones and peak-process-memory guarantees remain UNVERIFIED.

**LENGTH HOLD.** The identified software gates are reproducible, but the current evidence does not justify lowering orientation/coherence floors or joining missing pixels. The next bounded implementation decision needs local image-supported direction/continuity evidence at these fixed transitions, tested against the same crossing/liner/hair controls. A successful diagnostic route or weaker gate alone cannot authorize Length.
