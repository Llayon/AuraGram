# Changelog

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
