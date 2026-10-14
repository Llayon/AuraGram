# AuraGram Studio — Gauntlet 0

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
npm test            # node --test tests/unit.test.js
node --check src/app.js
```

Browser E2E (Playwright, Chromium):

```sh
npm install
npx playwright install chromium
npm run test:e2e
```

E2E uses only tiny programmatically-generated PNG fixtures in the OS temp dir —
no personal photos in the repo.

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
runs on `push` to `main` + `workflow_dispatch`. After pushing, set the repo's
**Settings → Pages → Source = GitHub Actions** (one-time owner action), then
verify the workflow, the deployment URL, and the T1–T14 checklist in this README.

## Technical debt (accepted for G0, tracked for later)

1. **Tailwind via runtime CDN** kept to avoid visual regressions in the first
   release. Follow-up: vendor or locally build CSS for zero runtime CDN
   dependency.
2. External demo photos (Unsplash) + fonts/icons CDNs require network; the app
   degrades explicitly (error overlay) when offline.
3. No MediaPipe in G0 by design — hook reserved for **G1 (Local Face Detection
   & Skin-Aware Retouch)**: Face Landmarker, local segmentation, WebGL2,
   guided/bilateral filters. Nothing from G1 is implemented here.

## Physical devices

Not tested on physical iPhones in Gauntlet 0 — do not claim otherwise.
Target floor: iPhone X; baseline: iPhone 11; plus modern Android and desktop
Chrome (dev).
