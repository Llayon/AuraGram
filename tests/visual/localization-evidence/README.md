# Boundary localization — HOLD

[Report](../../../G1C1_LOCALIZATION_REPORT.md), [PNG gallery](index.html), [independent critic](CRITIC.md), [both-eye pixel measurements](eye-pixels.json).

This follow-up does not replace earlier evidence. Gallery reference is recoveryb46, **not production0.5.1**. Original production comparisons remain in [g1c1-evidence](../g1c1-evidence) and [recovery-evidence](../recovery-evidence). Source permissions/provenance: [initial sources](../g1c1-evidence/sources.json), [additional sources](../recovery-evidence/sources.json), [Unsplash license](https://unsplash.com/license). Labels such as `light`/`mascara` are historical filenames, not validated makeup/lash categories. `edge900` is the existing test source derived at900px; both original eye crops are marked NOT RESOLVABLE.

Sources, geometry, native-image hashes, response profiles, actual attempted extensions and rejection counts are in lossless JSON archives. `summary.json` contains per-eye counts; `eye-pixels.json` contains native per-eye actual pixel changes. Neither is a visual approval. Full native portraits and intermediate attempts are retained locally in `../out/localization-39-final-aligned` and preceding immutable runs. Committed full-frame previews450/720 use source analysis and are explicitly smaller than native source export.

Annotations: [baseline primary](annotations/baseline-primary/index.html), [baseline independent](annotations/baseline-independent/index.html), [current primary](annotations/current-primary/index.html), [current independent](annotations/current-independent/index.html). Yellow=sampled provisional visible paths/uncertainty, cyan=accepted detector traces. Annotators had historical exposure to prior detector results. Never infer exhaustive recall/precision from nearest matches. Legacy clipped traces run seed→tip; audit reverses them before endpoint error measurement.

Replay without network or browsers:

```powershell
node tests/visual/replay-lash-localization.cjs tests/visual/out/localization-replay-new
node tests/visual/lash-localization-audit.cjs tests/visual/lash-localization-labels.json tests/visual/out/localization-replay-new/currentAuditInput.json tests/visual/out/localization-audit-new
```

Replay validates11 byte-identical frozen source files. Geometry/manifest paths retain original lineage and image hashes. To rerun image analysis, supply the exact audited JPEG bytes in `tests/visual/out/dataset`, not a fresh arbitrary re-download; use prior dataset preparation/provenance. Frozen geometry avoids repeated MediaPipe during probes.

`lash-localization-probe.cjs <geometry.json> <new-result.json>` accepts `LASH_ANALYSIS_SOURCE`. `lash-localization-render.cjs <geometry.json> <NEW-LASH_RUN>` accepts `LASH_REFERENCE_SOURCE` pointing to b46 source graph, optional comma-separated `LASH_FIXTURE`, and `--webkit`. Run Chromium then WebKit sequentially under the same new run; never overlap E2E/performance. Current working product is snapshotted on first render. `prepare-lash-audit.cjs` can extract the pinned recoveryb46 graph from local git history. New run-name protection prevents overwriting completed engine results.

Archived failed grayscale probe retains the bug before correction. Initial naive band/support probes are experiments, not accepted behavior. Logs retain the two mandatory failures and dependent NOTRUN. Physical phones UNVERIFIED. **No release.**
