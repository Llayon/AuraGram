# Three fixed endpoint cases — HOLD

[Report](../../../G1C1_ENDPOINT_CASE_REPORT.md), [gallery](index.html), [cases](../lash-endpoint-cases.json), [critic](CRITIC.md), [curves](profiles.csv).

Three exact old Chromium224 identities, sampled in both decoders without MediaPipe. WebKit104 no_face is not overridden. Native crops are integer256×256; analysis images are diagnostic enlargement. Cyan=old anchor/stored24px ray; orange=frozen local shaft points/manual tip radius. No new effect is generated: effect crops replay previous Chromium PNGs with an exact original-overlap check. Existing original JPEGs/credits/licenses remain in[positive evidence](../positive-evidence/sources.json).

Operator pass is NOT true-tip/naturalness approval. Annotation axis is a diagnostic comparison, not a runtime correction or exact endpoint derivative. Native-fine has source-pixel kernels, but endpoint test offsets still use the mapped analysis step. The inherited.006 floor is not calibrated across operators. All nine `phase` probes move the physical measurement anchor: they test localization/operator-offset sensitivity, not pure raster-grid phase.

Reproduce with new run names and sequential engines:

```powershell
node tests/visual/lash-endpoint-probe.cjs tipcase-NEW
node tests/visual/lash-endpoint-probe.cjs tipcase-NEW --webkit
node tests/visual/validate-lash-endpoint.cjs
```

Plots use optional Matplotlib in an isolated QA environment; no app dependency. `lash-endpoint-plot.py INPUT NEW-OUTPUT` makes static PNG/SVG graphs. Integer native/image-scale mapping, source/case/helper/tool hashes and the unchanged operator's24scalar values are checked. Initial partial run02/error and full run03 remain distinct. No failed comparison, old golden or provisional annotation is overwritten. Product v6 and mandatory F1 assertions remain unchanged; Draft PR/HOLD.
