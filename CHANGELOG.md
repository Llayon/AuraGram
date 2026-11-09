# Changelog

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
