# MediaPipe vendor — attribution & redistribution notes (Gauntlet 1a)

## Library: `@mediapipe/tasks-vision` (pinned `0.10.21`, exact version in `package.json` + lockfile)

- Source: https://www.npmjs.com/package/@mediapipe/tasks-vision
- Homepage: https://mediapipe.dev
- License: **Apache License 2.0** (see `LICENSE.tasks-vision` in this directory,
  copied from the npm package by `scripts/vendor-mediapipe.cjs`).
- Vendored files (byte-identical to the npm package, verified by
  `node scripts/vendor-mediapipe.cjs --check`):
  - `vision_bundle.mjs` — ESM runtime, imported locally (no CDN at runtime).
  - `vision_bundle.worker.js` — byte-identical copy of the npm CJS bundle,
    renamed because GitHub Pages serves `*.cjs` as `application/node`,
    which `importScripts()` inside the classic worker refuses.
    `*.js` is served as JavaScript.
  - `wasm/vision_wasm_internal.{js,wasm}` — SIMD WASM backend (~9.6 MB).
  - `wasm/vision_wasm_nosimd_internal.{js,wasm}` — no-SIMD fallback backend
    (~9.6 MB, used automatically on older browsers, e.g. pre-SIMD Safari).

## Model: `face_landmarker.task` (float16, v1)

- Official source:
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- License for MediaPipe model bundles: distributed by Google under terms
  permitting free use (see the model card:
  https://mediapipe-studio.webapps.google.com/demo/face_landmarker and the
  MediaPipe Model Maker / Tasks documentation, Apache-2.0 licensed code).
  The model runs 100% on-device; no data leaves the browser.
- Size: 3,758,596 bytes (verify after download).
- The file is committed to this repo so GitHub Pages serves it from
  `./vendor/mediapipe/face_landmarker.task` (relative path, subpath-safe).
  It is never fetched from a CDN at runtime.

## Test portrait fixture

- `tests/fixtures/portrait.jpg` and `tests/fixtures/edge-source.jpg` —
  sourced from the app's own Unsplash demo photo set (freely usable Unsplash
  License), downscaled for tests. See `tests/fixtures/README.md`.
  No private individuals' photos are stored in this repository.

## Zero-cost statement

No paid AI APIs, no inference servers, no registration, no API keys.
All inference is local (WASM/CPU). Photos are never uploaded anywhere.
