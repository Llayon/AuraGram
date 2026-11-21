# Local distal tangent — HOLD

[Report](../../../G1C1_TANGENT_REPORT.md), [SVG/JSON gallery](index.html), [independent critic](CRITIC.md).

Actual PNG overlays: [primary left](primary-left.png), [primary right](primary-right.png), [independent left](independent-left.png), [independent right](independent-right.png). These are diagnostics on the original images, **not processed product output**. Yellow=provisional local center samples/endpoint uncertainty, cyan=existing measured path/direction, dashed magenta=rejected quadratic direction. Display vectors are6nativepx for legibility, not the actual Length extension. SVGs preserve native400% display dimensions.

Independent/primary annotations were frozen before this pass's result comparison, with historical detector exposure disclosed. No hard exact terminal-tangent labels are claimed. Broad interval membership never establishes true direction. Nearest candidates outside positional uncertainty remain unmatched. Old labels and old1.5px tolerance remain intact; the new independent right1.75px uncertainty is a separate provisional observation, not a retroactive change.

`audit.json` records source/image/input hashes, actual fit supports, residuals and window sensitivity. Archived01 contains the initial measuredCount-prefix diagnostic mistake;02 fixes contiguous observedLength;05 adds diagnostic hashes; final06 clarifies interval membership and actual support wording. Original artifacts remain in `../out/`; gzip histories are lossless.

Reproduce without network, models, browser or product rendering:

```powershell
node --test tests/visual/lash-tangent-fit.test.mjs
node tests/visual/lash-tangent-audit.cjs tests/visual/out/tangent-audit-NEW
```

Consumes the committed frozen localization manifests and original crops; it does not rerun FaceMesh or modify existing evidence. Source graph is the same product as47e8e9e. The quadratic helper is imported only by the diagnostic/test, never by the app. Three mathematical checks do not certify real-photo naturalness.

Portraits/provenance/license: [previous evidence](../localization-evidence/README.md). No new photo sources or coverage claimed. Full portrait, 100/200/400% product images, both-engine differences and failed mandatory gates remain there. Current product code, sliders/history/cache, Density35% cap, original goldens and renderer are unchanged.
