# Changelog

- G1c.1 offline proximal-root continuation experiment rejected: all 70 tested candidate observations remained unresolved, including closed/hair negatives. Product v6 unchanged; original Length efficacy failures and HOLD remain. See `G1C1_ROOT_CONTINUATION_REPORT.md`.

## Unreleased - G1c.1 experimental candidate (HOLD)

- Diagnose three exact old endpoint candidates using native/coarse profiles in both decoders. Confirm directional/resampling and localization ambiguity; native-only or floor-only replacement is not justified. Product and mandatory tests unchanged, Length HOLD. See [fixed-case report](G1C1_ENDPOINT_CASE_REPORT.md).
- Freeze independent original-only endpoint annotations on three new licensed portraits; identify preterminal Length strokes and preserve fixed-set/full-rerun endpoint-guard ablations. Neither experiment adopted: remaining artifacts and control-candidate loss keep Length HOLD. Product unchanged. See [positive endpoint report](G1C1_POSITIVE_ENDPOINT_REPORT.md).
- V6 adds conservative Length-only abstention on observed crossing continuations, fixing the new closed-white-liner gate while preserving Density/Definition pixels. Geometry-jitter controls expose possible false vetoes/recall loss; useful Length remains HOLD. See [crossing report](G1C1_CROSSING_REPORT.md).
- Expand QA with eight licensed original photo assets, frozen independent screening and both-engine native comparisons. Add a conservative unresolved-white-liner abstention gate; it reproduces a new Chromium failure. Product unchanged, Length HOLD. See [expanded dataset report](G1C1_EXPANDED_DATASET_REPORT.md).
- Native source-profile audit: preserve measured center profiles, rejected support and fixed/free-anchor sensitivity in both engines. Accurate terminal continuation remains unproven; product unchanged. See [source-center report](G1C1_SOURCE_CENTERS_REPORT.md).
- Local tangent audit: freeze provisional short-window annotations and retain a rejected offline curve-fit comparison. No product changes; exact terminal direction remains uncertain. See [tangent report](G1C1_TANGENT_REPORT.md).
- Boundary-context follow-up: recover selected observed tips with additional native-ROI context; preserve existing Density/Definition and baseline Length pixels. Correct new-tip fractional mapping and graded color. Endpoint localization improved, but useful natural Length remains unproven; original efficacy tests remain red. See [localization report](G1C1_LOCALIZATION_REPORT.md). No release.
- Recovery: separate local Density evidence from strict Length evidence, normalize local contrast and reject observed crossing-hair structures. Preserve bilinear compositing and the35% darkening cap.
- Cache bounded geometry masks; retain all original test thresholds. Density efficacy/L6/L22 recovered; Length visual usefulness and two original efficacy checks remain HOLD. See [Recovery report](G1C1_RECOVERY_REPORT.md).

- Implement native-source capped eye ROI and topology-based lids, directional ridge tracing and measured tip continuation.
- Preserve the 0.5.1 density cap/interpolation; limit definition to measured ridges.
- Initial experimental pass had real-fixture Density/Length efficacy regressions and incomplete visual coverage; Recovery restored Density. Length efficacy, naturalness and the new abstention gate remain HOLD. Historical [G1C1_REPORT.md](G1C1_REPORT.md) is preserved. Version remains 0.5.1.

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
