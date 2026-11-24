# Native source profiles — HOLD

[Report](../../../G1C1_SOURCE_CENTERS_REPORT.md), [gallery](index.html), [critic](CRITIC.md), [summary](summary.json). Full raw profiles/coordinates/hashes are losslessly archived in `chromium.json.gz` and `webkit.json.gz`. Frozen helper bytes are `source-centers.mjs`. Earlier01/02/03 manifests are retained, including the initial cross-engine path confound. No previous evidence is overwritten.

Gallery overlays and profile plots are diagnostics, not product renders. Cyan=raw path, yellow=refined check-accepted points, red=rejected unchanged samples, white=fixed tip. White profile curve=raw normalized luminance; yellow=linear endpoint background. Plot y axes auto-range individually. Free-anchor entries quantify localization bias and never move product tips. `rawDirections` flags are UNTESTED/N/A; only refined flags correspond to profile checks, not physical-tangent validation.

Reproduce sequentially (same new run for both engines):

```powershell
node tests/visual/lash-source-centers.cjs centers-NEW
node tests/visual/lash-source-centers.cjs centers-NEW --webkit
node tests/visual/lash-source-report.cjs tests/visual/out/centers-NEW tests/visual/out/centers-report-NEW
node --test tests/visual/lash-source-centers.test.mjs tests/visual/lash-tangent-fit.test.mjs
```

Requires exact audited JPEG bytes in `tests/visual/out/dataset`; buffers/hashes are checked against committed frozen localization manifests. No network downloads or model requests; inert local page only. Existing provenance/licenses: [localization evidence](../localization-evidence/README.md). No new real-photo categories claimed. No product imports these tools. Earlier full portraits and product comparison matrices remain intact.
