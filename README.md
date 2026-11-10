# AuraGram Studio — local photo editor

Current implementation includes face-aware skin retouch and G1c upper-lash
enhancement (density, length, definition). UI CSS, fonts, icons, MediaPipe
runtime and model are served locally. Telegram SDK is an optional asynchronous
integration; external demo photos show an explicit error when unavailable.
Uploaded photos can be edited and exported with external requests blocked.

Version 0.5 adds user styles and fixes contrast/other Canvas filters on browsers
where assigning `CanvasRenderingContext2D.filter` does not process pixels.
Its checklist is in [`IMPLEMENTATION_PLAN_0_5.md`](IMPLEMENTATION_PLAN_0_5.md).
Undo/Redo and opt-in session recovery from 0.3 remain available;
their journal is in [`IMPLEMENTATION_PLAN_0_3.md`](IMPLEMENTATION_PLAN_0_3.md).

The stabilization checklist and validation journal are in
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).
Release notes are in [`CHANGELOG.md`](CHANGELOG.md); PR checks and deployments
are listed in [GitHub Actions](https://github.com/Llayon/AuraGram/actions/workflows/pages.yml).

Static mobile photo editor. **Local processing only** — no backend or server database,
no accounts, no paid APIs, no cloud inference, no API keys in client code.
Photos never leave the device. G1a adds on-device face geometry (MediaPipe
Face Landmarker, WASM/CPU); G1b turns the beauty tab into real face-aware
retouch with texture preservation — still zero-cost, still fully local.

- Entry point: `index.html` (root, so GitHub Pages serves it at `/`)
- App logic: `src/app.js` · Styles: `src/styles.css`
- Baseline prototype preserved in git history
  (`auragram_telegram_mini_app.html` → `index.html` refactor).

The entry point wires these modules through explicit callbacks:

- `src/state/editorState.js`: presets, tools, state factories, validation and dimensions (also usable from Node).
- `src/state/history.js`: up to 50 settings snapshots; slider gestures form one action.
- `src/state/sessionStore.js`: one opt-in IndexedDB session with serialized writes and deletion.
- `src/state/styleLibrary.js` and `src/ui/styleManager.js`: named local processing styles and their dialog.
- `src/rendering/canvasFilters.js`: pixel-tested native Canvas filters with a software fallback.
- `src/rendering/imageRenderer.js`: shared preview/export pipeline and artistic effects.
- `src/loading/photoLoader.js`: decoding, load tokens and object URL lifetime.
- `src/ui/editorUI.js`: carousels, tabs, sliders, frames and caption controls.
- `src/exporting/exportController.js`: export dialog, PNG lifetime, download and share.
- `src/exporting/prepareExport.mjs`: bounded asynchronous export preparation.
- `src/vision/` and `src/retouch/`: lazy face detection, geometry, masks and local effects.

The browser factories are loaded in deferred script order. Face detection and
retouch remain lazy ESM imports. `src/app.js` coordinates geometry invalidation,
preview scheduling, comparison and auto-tuning.

## History and local recovery

Use ↶ / ↷, Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z to undo and redo. Presets, Beauty,
lashes, adjustments, effects, frames, caption, Auto-style and Reset participate.
Navigation and holding Before do not create actions. Typing in the caption uses
the browser's native text undo. A successful photo replacement starts a fresh
history; a failed upload keeps it. Reloading restores a baseline, not the undo stack.

“Сохранять на устройстве” is off by default. When enabled, one original encoded
photo (up to 15 MB) and its validated settings are saved in this browser's
IndexedDB after approximately 500 ms without changes. Wait for “Сохранено на
устройстве” before closing or reloading. The label appears only after the
transaction commits. The file bytes and settings are stored atomically; landmarks,
render buffers and comparison state are rebuilt rather than persisted. Encoded
bytes are used instead of a persisted Blob for WebKit compatibility, without
re-encoding the image. Face analysis runs once again after recovery.

Unchecking the option or pressing “Удалить” disables saving and deletes the
stored session; the currently open photo stays available for editing. Deletion
follows an in-flight save and invalidates delayed writes. A new upload takes
precedence over a slow restore. Storage denial, quota errors or an invalid record
show a status message and leave editing/export usable. Storage is local to the
browser and origin: another browser/device does not share it, and clearing site
data or browser storage eviction can remove it. Nothing is uploaded.

The status line explains when face-aware Beauty or lash enhancement is unavailable;
selected strengths are retained. Lash availability is shown for each eye after
analysis, including low contrast, blur and insufficient visible lashes.

## My styles

“Мои стили” saves up to 20 named combinations of preset/intensity, Beauty,
lashes, FX, adjustments and frame. Captions and photos are excluded. A style
applies to the current photo as one Undo/Redo action and keeps its caption.
The dialog can rename a style, update it from current settings or delete it;
these library operations do not edit the photo. Names are limited to 32
characters, with duplicate checks after whitespace/case normalization.

Styles are saved only when requested, in `localStorage` under
`auragram.styles.v1`, independently of the photo session. Deleting the saved
session keeps styles. A quota failure keeps the previous library; a corrupt
library requires explicit clearing before replacement. Browser/origin storage
restrictions and site-data clearing also apply to this local library.

## Mobile filter compatibility

The 0.5 investigation reproduced a silent no-op in the tested WebKit engine:
assigning `contrast(200%)` left a gray pixel at 96 instead of changing it to 64.
Checking that a property can be assigned was insufficient. The editor now
probes rendered pixels once and uses software processing if the native filter
does not work. No browser-name or device-name assumption is needed.

The fallback handles brightness, contrast, saturation, sepia, hue rotation and
blur in preview, PNG export, filter thumbnails, detail layers and retouch masks.
Working native filters retain their existing output. Software color transforms
are compared with native results (≤2 channel levels on the test matrix).
Small blur radii use a separable Gaussian; larger radii use a three-box
approximation. Minor blur differences between engines are possible.

Color-only processing uses 128-row pixel chunks. Blur needs a full RGBA pixel
copy plus one scanline scratch buffer; the existing 4096px/16.8MP export cap
still applies. Software processing may be slower than native Canvas filters,
particularly on large photos. Physical-phone timing is not claimed.

Packaged HTML and first-party module URLs carry the release version, so a
refreshed page requests the new processing code rather than cached older files.
The browser checks verify actual pixels for all 16 presets at 0/50/100,
all adjustment controls (including negative ranges), artistic FX, six Beauty
tools and the three lash controls in Chromium and WebKit mobile.

## Run locally

Serve the committed generated resources over HTTP (not `file://`). After
editing the UI or upgrading its dependencies, rebuild the local resources:

```sh
npm ci
npm run build
node tests/static-server.cjs 8137
```

Other static servers also work:

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
npx playwright install chromium webkit
npm run test:e2e    # G0 regression + G1a real inference + G1b retouch (R1–R19)
```

The Chromium project runs functional checks; `webkit-mobile` runs mobile smoke
checks using the iPhone 11 browser profile. All browser tests block external
HTTPS requests and use local fixtures. Export assertions wait for the new PNG
Blob. System Share is tested with a controlled API stub; this does not prove
that a physical phone's share sheet works.
The `chromium-performance` project runs the existing I14/L20 budgets with one
worker after both functional projects finish, so concurrent inference and PNG
encoding do not distort the relative timing checks. The L20 +15ms limit is unchanged.

`npm run package:site` prepares `dist/` for static hosting after `npm run build`.
`npm run check:site` serves that exact artifact and checks local module loading,
real face detection, retouch and PNG export with external requests blocked.
CI builds local resources, runs unit and browser tests, and publishes only the
prepared static site. UI source is `src/utilities.input.css` plus the classes
in HTML/JS; generated `src/utilities.css` is committed for direct static serving.
The npm browser-test runner owns a temporary loopback server on a free port and
closes it after the run. This also avoids shell process-tree shutdown hangs on Windows.

The published-site check also exercises Undo/Redo, committed local saving,
reload recovery and deletion in Chromium and WebKit mobile browser contexts.

Performance and UI inspection can be repeated with:

```sh
node scripts/measure-editor.cjs
```

This writes JSON and desktop/mobile screenshots to `test-results/measurements/`.
On this Windows desktop with headless Chromium 156 and 16 logical processors,
the 3000×2400 fixture with all six beauty tools at 60 and lashes at 50/30/40
produced a 1080×864 preview with median render 126.5 ms (five warm samples) and
a 3000×2400 PNG with render 962.4 ms. Retained canvases accounted for about
46.7 MB of estimated RGBA storage; decoded source and temporary export canvas
each add about 28.8 MB. These are dimensions × 4 estimates, not process RSS;
native MediaPipe/WASM, codec and GPU allocations are excluded. JS heap values
may be rounded by the browser. These desktop observations do not establish
mobile performance or physical-device memory limits.

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

Version **0.2.0** is prepared through a pull request into `main`.
`.github/workflows/pages.yml` runs on pull requests targeting `main`, pushes
to `main`, and manual dispatch. Both `build` and `e2e` must succeed before
publication: clean dependency installation, local assets, unit tests, real
MediaPipe inference, Chromium/WebKit regression checks, isolated performance
budgets and the packaged-site smoke check.

PR runs have read-only repository permissions and cannot deploy. Upload of the
Pages artifact and the `deploy` job are restricted to `main` outside PR events.
Only `deploy` receives Pages/OIDC write permissions. New commits cancel obsolete
checks on the same PR; production deployments are serialized.

Release procedure:

1. Commit the implementation, generated UI resources and documentation on a feature branch.
2. Push the branch, open a PR into `main`, and wait for `build` and `e2e` to pass on its latest commit.
3. Merge the checked PR. The push to `main` repeats the gates and deploys the `dist/` artifact.
4. Verify the published app reports `window.AuraGram.version === '0.2.0'`, then upload a local photo, check face-aware retouch and lashes, and download a valid PNG.

Repeat the production smoke check with installed Chromium and WebKit:

```sh
npm run check:live -- https://llayon.github.io/AuraGram/
```

The check uses a licensed local fixture, verifies HTML/runtime versions, real
face detection, lash controls, compare cancellation and PNG download in both
engines. Requests outside the site's origin are blocked; photos are not uploaded.

Pages Source must be GitHub Actions. Physical-device testing remains outside
the user-approved release scope; the mobile checks use WebKit emulation.
Live: https://llayon.github.io/AuraGram/ ·
Debug: https://llayon.github.io/AuraGram/?debugFace=1

## Processing and export

Face Landmarker provides geometry; skin and lash enhancement use classical
Canvas operations. No second neural network or remote inference is used.
Lash masks protect inner corners separately for each eye, and lash length,
stroke width and feathering scale with output resolution.

Export captures the source and settings at click, waits for face analysis and
the retouch module when required, and bounds preparation to 35 seconds. Changing
the photo cancels the previous export. Repeated clicks during preparation are
ignored. Encoding failures restore the controls and allow retry. If face
analysis is unavailable, filters still work and the UI explains that local
retouch cannot be applied. The 4096px export cap is retained.

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
- Historical G1b measurements on desktop Chromium (864x1080 preview): grade 4.4 ms, smooth100
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

Current stabilization has automated Chromium and iPhone-profile WebKit checks,
including local font loading, the lash panel, 320/375px header layout, caption
focus, compare release, PNG download, Share API arguments and a scrollable
export dialog on 320×568 and 375×667 screens. Native keyboards and share sheets,
Telegram WebView integration and physical iPhone/Android memory behaviour still
require device access. The Share API test uses a stub and never sends a file.

The user accepted Chromium/WebKit emulation as sufficient for this stabilization
on 2026-11-09. Physical-device testing is outside the agreed completion scope;
the implementation plan is complete under that scope.

Optional future physical-device checklist (use the current `dist/` build served over HTTPS):

1. Record model, OS, browser/Telegram version and build revision.
2. Load a camera portrait and a large photo, check face status and local retouch.
3. Check independent lash sliders, Original vs Reset and press/release/cancel of Compare.
4. Type a caption with the native keyboard, close it, rotate the phone and check control reachability.
5. Download PNG, inspect its dimensions, open the native Share sheet and cancel it.
6. Export the large photo repeatedly, change photos during preparation and record hangs, failures and timing.

No physical-device validation is claimed; emulation is not treated as physical validation.
