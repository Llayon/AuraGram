# AuraGram Studio — Gauntlet 0 + 1a

Static mobile photo editor. **Local processing only** — no backend, no database,
no accounts, no paid APIs, no cloud inference, no API keys in client code.
Photos never leave the device. G1a adds on-device face geometry (MediaPipe
Face Landmarker, WASM/CPU) — still zero-cost, still fully local.

Static mobile photo editor. **Local processing only** — no backend, no database,
no accounts, no paid APIs, no cloud inference, no API keys in client code.
Photos never leave the device.

- Entry point: `index.html` (root, so GitHub Pages serves it at `/`)
- App logic: `src/app.js` · Styles: `src/styles.css`
- Baseline prototype preserved in git history
  (`auragram_telegram_mini_app.html` → `index.html` refactor).

## Run locally

No build step. Serve the folder statically (any static server) or open
`index.html` directly:

```sh
npx serve .
# or
python3 -m http.server 8080
```

Unit tests (no browser, no network):

```sh
npm test            # G0 (tests/unit.test.js) + G1a (tests/vision.test.mjs)
node --check src/app.js
```

Browser E2E (Playwright, Chromium; local static server auto-starts because
ESM modules, module/classic Workers and WASM require http, not file://):

```sh
npm install
npx playwright install chromium
npm run test:e2e    # G0 regression (e2e.spec.js) + G1a real inference (e2e-face.spec.js)
```

E2E uses only tiny programmatically-generated PNG fixtures in the OS temp dir —
no personal photos in the repo — plus two committed Unsplash-licensed fixtures
(`tests/fixtures/portrait.jpg`, `edge-source.jpg`, see
`tests/fixtures/README.md`) for REAL on-device MediaPipe inference tests.

## Gauntlet 1a — local face detection (geometry only)

- **Runtime**: `@mediapipe/tasks-vision` pinned `0.10.21` (exact + lockfile),
  vendored to `vendor/mediapipe/` (`vision_bundle.{mjs,cjs}`, both WASM
  backends incl. no-SIMD for old Safari) by `scripts/vendor-mediapipe.cjs`
  (`--check` gate in CI). Model `face_landmarker.task` (float16, 3,758,596
  bytes, Apache-2.0 — see `vendor/mediapipe/ATTRIBUTION.md`) served from our
  own static host. No CDN at runtime, no external AI calls (asserted by F11).
- **Execution**: CLASSIC Web Worker first (`src/vision/faceWorker.js` — module
  workers are impossible here because the Emscripten runtime loads WASM glue
  via `importScripts()`; classic workers additionally cover older Safari).
  Any worker failure falls back to one main-thread `detect()` after paint,
  with visible status and measured block time. If both fail, only face
  detection disables — the editor is unaffected.
- **Lifecycle**: lazy (first photo only), IMAGE mode, 1 face, CPU delegate,
  thresholds 0.4/0.4 (calibrated: 0.5 misses a real JPEG edge face in the
  worker path, 0.3 hallucinates on the no-face fixture — measured, not
  guessed). Detection input ≤640px long side; the original photo and export
  path are untouched. One inference per photo — sliders/tabs/presets never
  re-trigger (F7). Singleton model/worker reused across photos (F8).
  Stale results are discarded by generation token (F6).
- **Geometry**: `src/vision/faceGeometry.mjs` — normalized [0,1] landmarks
  (478/face), bounds + regions (oval, eyes, brows, lips, nose; canonical
  FaceMesh indices, documented in-file), identical mapping to Preview/Export.
- **Debug**: `?debugFace=1` draws a separate overlay canvas (never exported —
  byte-identical PNG proven by E2E) + status pill (`not_started` /
  `loading_model` / `detecting` / `ready` / `no_face` / `failed` /
  `unsupported`). Metrics in `window.AuraGram.stats` (`modelLoadMs`,
  `faceDetectMs`, `faceBlockMs`, `faceCount`, `faceWorkerMode`, input size,
  geometry bytes). Measured on desktop Chromium: cold init a few seconds
  (local 13 MB download + compile), warm detect ~50–200 ms at ≤640px.
  iPhone timings UNVERIFIED (no physical devices).
- **Non-regression**: render/export code paths contain zero face references;
  G0 suite fully kept; E2E proves identical export bytes with debug on/off.
- **Memory**: detection uses one transient ≤640px RGBA copy (~1–2 MB) +
  ImageBitmap, both freed right after inference; never concurrent with export
  (single-shot after load). Export buffers unchanged from G0 (4096² RGBA ≈
  64 MB peak per buffer — pre-existing G0 characteristic, documented cap +
  notice).

## Behaviour contract (Gauntlet 0)

- **Original preset** = neutral colour preset. Independent Beauty / FX /
  Adjustments keep applying on top; the UI says so explicitly
  (`#correctionNote`, e.g. `Original-пресет · активны коррекции (3)`).
- **Before (hold «До/После»)** = absolutely raw source image, Pointer Events
  (`pointerdown/up/cancel`, `lostpointercapture`, window `blur`,
  `visibilitychange`). Release always restores the edit.
- **Reset All** = neutral preset + no FX + zero beauty + neutral adjustments +
  no frame + empty caption + synced sliders/highlights. Paints the true original.
- **Photo loading** is explicit (`#loadOverlay`: loading / ready / error).
  Uploads are validated (type, 15 MB cap, decode check), race-guarded by a load
  token, and thumbnails never draw an unready `Image`. A failed demo photo shows
  an error — never a decorative gradient pretending to be a photo.
- **Preview vs Export** share one pipeline (`renderImage`) in the same order.
  - Preview: capped at **1080 px** (long side) for fast interaction.
  - Export: re-rendered from the **original** image up to **4096 px /
    16.8 Мп**; larger sources are downscaled with an on-screen notice
    («уменьшен для экономии памяти», old-iPhone Safari guard). Effect radii and
    blur scale with output size. Export goes through `canvas.toBlob()` + Blob
    URL (revoked after each export); PNG magic bytes are E2E-verified.
  - Honest disclaimer in the export modal: current algorithms may alter detail
    and colour — this is not a bitwise-original guarantee.
- **Export honesty**: local **«Скачать PNG»** + optional system **«Поделиться…»**
  (Web Share API with `navigator.canShare` check, download fallback). There is
  **no** «send photo to Telegram bot» — `Telegram.WebApp.sendData()` is never
  used as a PNG transport, and the modal states bot delivery arrives in a later
  stage.
- **Terminology**: `Photo Studio` (header), `Автостиль` (button), `Автонастройка`
  (HUD). The auto-tune is documented in code as **rule-based pixel statistics**,
  not a neural network. No model was added or removed in this Gauntlet.
- **Performance**: rAF-coalesced slider rendering, reused offscreen buffers,
  Blob-URL hygiene, basic render timing in `window.AuraGram.stats`.
  Mobile: `viewport-fit=cover`, safe-area insets, Telegram bottom-area padding,
  ≥16 px caption field (iOS zoom guard), larger slider touch targets.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` — official Pages actions, minimal permissions,
runs on `push` to `main` + `workflow_dispatch`. Gates before deploy: unit
tests (`build` job) AND full Playwright E2E incl. real MediaPipe inference
(`e2e` job). Pages Source = GitHub Actions (one-time owner action, done).
Live: https://llayon.github.io/AuraGram/ ·
Debug: https://llayon.github.io/AuraGram/?debugFace=1

## Technical debt (accepted for G0, tracked for later)

1. **Tailwind via runtime CDN** kept to avoid visual regressions in the first
   release. Follow-up: vendor or locally build CSS for zero runtime CDN
   dependency.
2. External demo photos (Unsplash) + fonts/icons CDNs require network; the app
   degrades explicitly (error overlay) when offline.
3. No MediaPipe in G0 by design — hook reserved for **G1 (Local Face Detection
   & Skin-Aware Retouch)**: Face Landmarker, local segmentation, WebGL2,
   guided/bilateral filters. Nothing from G1 is implemented here.
4. G1a does NOT use the geometry for retouch yet — overlays/masks for G1b.
   Next: **G1b — Skin-Aware Retouch** (local skin masks from G1a geometry,
   pore-preserving smoothing, redness correction). Nothing from G1b is
   implemented here.

## Physical devices

Not tested on physical iPhones in Gauntlet 0/1a — do not claim otherwise.
Safari/WebKit + Telegram WebView paths are code-reviewed (classic worker,
no-SIMD WASM fallback, main-thread fallback, graceful disable) but
UNVERIFIED on real iPhone X/11 hardware. Target floor: iPhone X; baseline:
iPhone 11; plus modern Android and desktop Chrome (dev, measured).
