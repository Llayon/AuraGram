# Original-only endpoint audit — HOLD

[Report](../../../G1C1_POSITIVE_ENDPOINT_REPORT.md), [gallery](index.html), [critic](CRITIC.md), [sources/licenses](sources.json), [summary](summary.json), [annotation freeze](../lash-positive-freeze.json).

Three new licensed original photos, six native manual crops, independently frozen sparse annotations. Coated visible structures are NOT certified bare natural fibers or extension approvals. W104 no_face remains excluded.598 labelled views use374 unique lossless PNGs; eye100/200/400% is pixelated enlargement, not new detail. Portrait720 is a viewing preview. Earlier production goldens and rejected experiments remain.

`v6` means unchanged product; `fixed-endpoint-subset` means an OFFLINE filter on old candidate identities. No new candidate is introduced there. The separately archived full rerun can introduce new candidates through changed used-mask selection. Neither experiment is adopted.

Overlay: primary yellow, independent orange, detected eligible tips/tangents cyan, lids green. Manual radii/sampling footprints are engineering measurements, not calibrated uncertainty. Raw ridge green, Density confidence yellow, accepted traces cyan/rejected red. Difference8x amplifies combined-minus-original RGB. Primary axis-interval correspondence fields are N/A because primary labels provide no absolute independent interval; read the independent table/report instead.

Portable replay (new run names; engines sequential):

```powershell
node tests/visual/validate-lash-positive.cjs
node tests/visual/replay-lash-positive.cjs tests/visual/out/positive-replay-NEW
node tests/visual/lash-positive-reanalyze.cjs tests/visual/out/positive-replay-NEW/geometry-chromium.json positive-ablation-NEW tests/visual/out/positive-replay-NEW/experiment-src
node tests/visual/lash-positive-reanalyze.cjs tests/visual/out/positive-replay-NEW/geometry-webkit.json positive-ablation-NEW tests/visual/out/positive-replay-NEW/experiment-src --webkit
node tests/visual/lash-positive-audit.cjs tests/visual/out/positive-ablation-NEW/manifest-chromium.json tests/visual/out/positive-ablation-audit-NEW.json
node tests/visual/lash-expanded-render.cjs tests/visual/out/positive-replay-NEW/geometry-chromium.json positive-fixed-render-NEW --native-crops-only --fixed-endpoint-subset --source-graph=tests/visual/out/positive-replay-NEW/candidate-src
```

Replay restores exact JPEG/source bytes only if absent or matching; it never overwrites differing files. This replay does not rerun MediaPipe. `lash-positive-analysis.cjs NEW-RUN [--webkit]` explicitly runs fresh real FaceMesh after checking annotation freeze; its output may vary and is distinct from frozen replay. Existing full render defaults remain unchanged; optional native-crops-only avoids storing redundant2x/4x files while gallery preserves those viewing scales.

Raw current source/frozen module bundles, real geometry, audits, fixed/full candidate profiles and identity changes are compressed JSON. Logs retain baseline failures and an accidental missing--webkit command rejected by an existing run marker before any file overwrite; corrected WebKit run is separate. No failed experiment is erased.
