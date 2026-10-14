# AuraGram Studio — Gauntlet 0 + 1a + 1b

Static mobile photo editor. **Local processing only** — no backend, no database,
no accounts, no paid APIs, no cloud inference, no API keys in client code.
Photos never leave the device. G1a adds on-device face geometry (MediaPipe
Face Landmarker, WASM/CPU); G1b turns the beauty tab into real face-aware
retouch with texture preservation — still zero-cost, still fully local.


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
npm test            # G0 + G1a vision + G1b retouch unit suites
node --check src/app.js
```

Browser E2E (Playwright, Chromium; local static server auto-starts because
ESM modules, module/classic Workers and WASM require http, not file://):

```sh
npm install
npx playwright install chromium
npm run test:e2e    # G0 regression + G1a real inference + G1b retouch (R1–R19)
```

Visual matrices (exact-pixel renders for critic review + report):

```sh
node tests/visual/make-synthetic.cjs     # deterministic skin-tone fixtures
node tests/visual/render-matrix.cjs --out tests/visual/g1b --mask
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
  (single-shot after load). Export buffers unchanged from G0 (4096² RGBA -
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
4. G1b implements the retouch itself (below) — no second neural network was
   added; segmentation stays geometric + classical.
5. Next: **G1c — Natural Lash Enhancement & Fine Eye Retouch** (subtle,
   structure-preserving lash/eye refinement). Nothing from G1c is implemented
   here.

## Gauntlet 1b — skin-aware retouch (what / how / limits)

New modules: `src/retouch/skinMask.mjs` (landmark-driven mask: face oval,
separate eye/brow/lip/nostril cutouts with guaranteed zero-cores, soft
feather, conservative luminance/saturation/edge refinement — hue-blind, so
all skin tones behave alike) and `src/retouch/retouch.mjs` (nonlinear
intensity curves, per-photo mask cache, GPU chroma-domain passes).

- **Smooth**: masked chroma-domain low-frequency smoothing (`color`
  composite — destination luminance untouched, so pores, moles, freckles,
  lashes and folds survive by construction). Replaces the old radial blur.
- **Anti-red**: red-selective chroma pull with dead zone (low redness - no
  effect), capped pull, luminance kept; lips/background masked out. Replaces
  the old global hue wash + full-frame tint.
- **Glow**: soft-light sheen from the smoothed layer, skin-masked, capped.
- **Eyes**: micro-contrast (`overlay`) strictly inside eye ellipses.
- **Blush**: soft-light rose at landmark-derived cheek apples.
- **Sculpt**: honest limited face-anchored dodge & burn inside the mask
  (no thinning, no reshaping — documented limitation, not 3D morphing).
- Pipeline: `renderImage(..., face)` takes an immutable per-render snapshot;
  base grade no longer leaks beauty into global brightness/contrast/hue;
  preset-only renders are **byte-identical** to G1a (`neutral`/`vogue`
  matrix hashes match); debug overlays (`?debugFace=1`, `?debugSkin=1`)
  never touch export pixels (byte-equality E2E-proven).
- Without a face every local pass skips (pill explains why); Reset preserves
  the photo's geometry; photo change invalidates it at once; sliders never
  re-run inference; worker detect has a 30 s bound with controlled fallback.
- Measured on desktop Chromium (864x1080 preview): grade 4.4 ms, smooth100
  6.3 ms, all-six 60 ms; mask build 11–19 ms one-time; 900x1125 export with
  all six 71 ms; JS heap ~21 MB. Full-res scratch stays limited to the two
  pre-existing reused buffers; masks live ≤384px. iPhone timings UNVERIFIED.
- Memory budget: worst case - main + export + one reused full-res buffer
  (+tiny mask/scratch canvases); documented 4096px/16.8MP cap + fallback
  retained; R16 exports a 3000x2400 retouched photo cleanly in CI/Chromium.
- Reference visuals: `tests/visual/baseline/` (G1a anchors),
  `tests/visual/reference/` (mask, old-vs-new, eye/cheek zooms),
  `tests/visual/synthetic/` (deterministic tone fixtures + generator).

## Physical devices

Not tested on physical iPhones in Gauntlets 0/1a/1b — do not claim otherwise.
Safari/WebKit + Telegram WebView paths are code-reviewed (classic worker,
no-SIMD WASM fallback, main-thread fallback, graceful disable) but
UNVERIFIED on real iPhone X/11 hardware. Target floor: iPhone X; baseline:
iPhone 11; plus modern Android and desktop Chrome (dev, measured).
