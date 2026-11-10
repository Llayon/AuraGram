# G1c.1 follow-up: rejected terminal-appearance experiments

Product base: `b46b2855f3b8cbd4e0fd990c420bfbdf15151557`. **LENGTH — HOLD.**

The three `experimental-src` directories are audit artifacts, NOT application modules. None was promoted into `src/`. Each directory preserves the two changed modules exactly as frozen for its visual run. Other dependencies come from b46; the replay script verifies every byte hash, including checkout line endings, before running.

Full manifests are losslessly stored as `.json.gz` to keep large trace arrays out of the code-review diff. Decompression reproduces the original bytes, not a reserialized JSON object. Original uncompressed run files remain local. Evidence `.gitattributes` prevents checkout newline conversion from invalidating frozen module/manifest hashes. `comparisons/summary.json` stays directly readable. Archive replay reconstruction was separately verified with `--prepare-only`, which launches no browser.

- **11:** bilateral RGB cross-sections of the last three observed samples; measured alpha instead of fixed .26; one taper triangle instead of six overlapping round-capped strokes. Weaker effect; rejected.
- **12:** same candidates/geometry/profile, linear alpha fade and no second Length multiplier on alpha. Still no useful extension; rejected.
- **13:** four observed terminal sections; transport their relative channel contrast along the existing bounded extension; multiply composition avoids brightening a graded destination. No useful gain and additional appearance skips; rejected.

No confidence, candidate, maximum extension, native ROI, test assertion or test threshold was relaxed. The extra bilateral photometry gate is separate from geometry acceptance; it lost useful recall, especially natural-left in13. Pixel counts alone did not establish benefit.

`tip-profile-10.json` is the initial, superseded measurement. Its geometry came from frozen09/b46, but its original audit page could start the app/demo in the background. It is retained as historical evidence, not used to prove absence of FaceMesh work. The corrected profiler uses an inert page and records hashed input bytes/dimensions; decoding is explicitly **Chromium**, even if a different engine's geometry manifest is supplied. Its legacy contrast prediction precedes rasterization and is not a measured output delta or a calibrated probability.

Original full-resolution portraits, all image variants, traces and difference maps remain in `tests/visual/out/recovery-final-09-streamed`, `recovery-tip-profile-11`, `recovery-tip-profile-12-linear` and `recovery-tip-transport-13`. Their files were not overwritten. [Tracked comparisons](comparisons/index.html) show native-size both-eye100/200/400% PNGs; native full matrices remain local because these rejected experiments add no release candidate. WebKit13 was replayed sequentially as `recovery-tip-transport-18-webkit-isolated`: both portraits completed and every source hash matches13. The gallery's explicit replay mapping records the new run without replacing the interrupted13 files.

Reproduction after preparing the existing licensed dataset and baseline modules:

```powershell
npm ci
npm run build
node tests/visual/prepare-lash-audit.cjs
./tests/visual/prepare-recovery-dataset.ps1
node tests/visual/prepare-recovery-variants.cjs
node tests/visual/lash-tip-profile.cjs tests/visual/recovery-evidence/manifest-chromium.json tests/visual/out/NEW-profile.json
node tests/visual/replay-lash-tip-experiment.cjs 13 NEW_RUN --webkit
```

Use a new output path/run every time. Replay reconstructs a frozen graph under the audit directory, never changes application source, then uses the existing visual harness. Default fixtures are `light.jpg,natural.jpg`; `LASH_FIXTURE` can select other prepared real photos. Run visual audits, E2E and performance **sequentially**. Browser closure in a concurrent run is retained as interrupted evidence, never counted as a pass.

Independent critique: no convincing useful Length in11,12 or13; no new obvious needles in reviewed crops. Revert experiments and keep b46. Next experiment: annotate actual visible root-to-tip structures, compare endpoint localization/false negatives, freeze the renderer, and improve subpixel ridge centers/tangent only if matched real structures improve without new false positives. Do not lower thresholds or fabricate labels on unresolved eyes.
