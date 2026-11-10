# Changelog

## Unreleased ? G1c.1 experimental candidate (HOLD)

- Implement native-source capped eye ROI and topology-based lids, directional ridge tracing and measured tip continuation.
- Preserve the 0.5.1 density cap/interpolation; limit definition to measured ridges.
- Not release-ready: real-fixture density/length efficacy regressions and incomplete visual dataset. See [G1C1_REPORT.md](G1C1_REPORT.md). Version remains 0.5.1.

## 0.5.1 — 2026-11-10

- Fix overly dark rectangular patches at maximum lash density, found during a magnified visual audit.
- Bilinearly sample the ridge map and cap the density multiplication target at 35% darkening, weighted by eye-analysis confidence. Preserve the existing band/ROI protection and independent length/definition controls.
- Add unit tests for smooth interpolation, strength/confidence scaling and bounded darkening, plus a Chromium/WebKit portrait regression that rejects opaque black density blocks.

## 0.5.0 — 2026-11-10

- Fix silently ignored contrast and other Canvas filters in the tested mobile WebKit engine, affecting iPhone browser/WebView workflows.
- Probe actual filtered pixels and use local software color/blur processing when native Canvas filters do not work.
- Apply the compatible processing path to preview, PNG export, preset thumbnails, detail layers, skin/eye masks and lash definition/feathering; keep native rendering unchanged.
- Add named user styles: save, apply, rename, update and delete up to 20 local styles. Applying a style is one Undo/Redo action; photos and captions are excluded.
- Handle duplicate names, storage quota/denial and corrupt style libraries without blocking photo editing.
- Version packaged first-party assets and module URLs to refresh cached processing code after releases.
- Extend mobile pixel tests to every preset, adjustment control, FX, Beauty tool and lash setting, including an actual contrast-slider-to-PNG regression.

## 0.3.0 — 2026-11-10

- Add settings-only Undo/Redo with 50 actions, grouped slider gestures and keyboard shortcuts.
- Restore all editor controls after undo, including frames and caption; preserve native text undo.
- Add opt-in local recovery of one original photo and its settings in IndexedDB, with a 500 ms debounce and committed-save status.
- Store original encoded bytes atomically with settings for WebKit compatibility; handle stale restores, deletion races, corrupt records, unavailable storage and quota failures.
- Show face and per-eye lash availability while retaining selected strengths.
- Cache the smoothed graded target and its skin-masked layer, invalidating on source, photo, dimensions and grade changes.
- Extend Chromium and WebKit mobile regression coverage for history, recovery and cache equivalence. Preserve existing visual goldens and performance budgets.


## 0.2.0 — 2026-11-09

- Add face-aware upper-lash enhancement with independent density, length and definition controls.
- Fix negative saturation disabling the base grade and stale face geometry on photo changes.
- Wait for local analysis and retouch before export; preserve the chosen source and settings, cancel stale exports and recover from encoding failures.
- Protect lash bands, inner corners and surrounding skin; scale lash geometry with export resolution.
- Serve UI styles, fonts and icons locally; keep Telegram SDK initialization asynchronous and optional.
- Separate editor state, rendering, photo loading, UI and export into modules.
- Fix compact headers and scrollable export dialogs on narrow screens.
- Add Chromium/WebKit regression checks, deterministic local fixtures and isolated performance gates.
- Validate PRs before merging; deploy only checked `main` builds to GitHub Pages.

Mobile validation uses emulation as agreed with the user. Physical iPhone/Android validation is not claimed.
