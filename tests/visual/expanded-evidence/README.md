# Eight new real-photo assets — HOLD

[Report](../../../G1C1_EXPANDED_DATASET_REPORT.md), [full gallery](index.html), [independent critic](CRITIC.md), [sources/authors/licenses](sources.json), [budgets](budgets.csv).

Native JPEGs in `sources/` are unchanged audited upstream bytes with SHA256. [Pexels license](https://www.pexels.com/license/), [Unsplash license](https://unsplash.com/license), original photo pages in metadata. QA use does not imply endorsement. Bare lashes, mascara/extension history and person identity are not certified. No paid or generated images.

`images.json` maps325descriptive views to deduplicated lossless PNG assets. Native100% eye pixels display200/400% with nearest-neighbour CSS; all explicit2x/4x PNGs remain locally in `../out/expanded-09-matrix`. Portrait previews are720px; original JPEGs preserve full native frames. Matrix effects were applied at source resolution. Overlays are diagnostics, not beauty effects. Full prior evidence/goldens remain untouched.

Frozen annotation files live one directory above. `UNTESTED`/`UNSEEN_BEFORE_FREEZE` fields describe annotation time; final FaceMesh statuses are in summary/matrix files. Four no_face sources remain excluded without invented eye geometry; their independent9sampled structures do not validate active Length or detector-only recall. Original-only viewing rectangles are screen-side crops, not anatomical landmarks.

Repro:

```powershell
node tests/visual/validate-lash-expanded.cjs
node tests/visual/replay-lash-expanded.cjs tests/visual/out/expanded-replay-NEW
node tests/visual/lash-expanded-render.cjs tests/visual/out/expanded-replay-NEW/geometry-chromium.json expanded-replay-NEW
node tests/visual/lash-expanded-render.cjs tests/visual/out/expanded-replay-NEW/geometry-webkit.json expanded-replay-NEW --webkit
```

Run engines sequentially. Baseline graph under `out/baseline-src` must be extracted from pinned git history with `prepare-lash-audit.cjs`; its11modules are checked in `baseline-validation.json`. Replay validates originals, restores byte-identical candidate sources and actual frozen geometry, and refuses to overwrite a different dataset file. Matrix has no model requests. Real FaceMesh runs/224–384ablation metadata are in lossless `geometry-*.json.gz`; image/analysis matrices in `matrix-*.json.gz`.

New mandatory real-face abstention test uses closed-white-liner7123010. Its current Chromiumfailure is preserved as a conservative product-policy failure, not a biological ground-truth assertion. No existing mandatory threshold, fixture or golden was relaxed. See report/logs and PR for exact red gates.
