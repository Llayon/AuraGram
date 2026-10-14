'use strict';
/* AuraGram Gauntlet 0 — unit tests (no browser, no network).
 * Run: node --test tests/unit.test.js
 * Covers T1–T14 at the static/unit level; browser behaviour is in tests/e2e.spec.js.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'src', 'styles.css'), 'utf8');

const api = require('../src/app.js');

// T1: app boots without critical errors (static level: files + parse + exports)
describe('T1 boot', () => {
  test('entry files exist and reference each other with relative paths (T14)', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'index.html')), 'index.html missing');
    assert.ok(fs.existsSync(path.join(ROOT, 'src', 'app.js')), 'src/app.js missing');
    assert.ok(fs.existsSync(path.join(ROOT, 'src', 'styles.css')), 'src/styles.css missing');
    assert.ok(INDEX_HTML.includes('./src/app.js'), 'index.html must load ./src/app.js (relative for Pages subpath)');
    assert.ok(INDEX_HTML.includes('./src/styles.css'), 'index.html must load ./src/styles.css (relative)');
    assert.ok(!INDEX_HTML.includes('"/src/'), 'no absolute /src paths (breaks project subpath)');
  });
  test('no API keys / backend URLs baked in', () => {
    for (const chunk of [APP_JS, INDEX_HTML]) {
      assert.ok(!/api[_-]?key/i.test(chunk), 'API key string found');
      assert.ok(!/localhost:\d+/.test(chunk), 'localhost backend URL found');
    }
  });
});

// T2/T3/T4: reliable loading — validation + race guard + no fake photo
describe('photo loading', () => {
  test('T2 accepts real image files', () => {
    assert.equal(api.validateImageFile({ name: 'a.jpg', type: 'image/jpeg', size: 1024 }).ok, true);
    assert.equal(api.validateImageFile({ name: 'a.png', type: 'image/png', size: 1024 }).ok, true);
    assert.equal(api.validateImageFile({ name: 'a.webp', type: 'image/webp', size: 1024 }).ok, true);
  });
  test('T3 rejects unsupported / empty / corrupt-typed files', () => {
    assert.equal(api.validateImageFile({ name: 'a.pdf', type: 'application/pdf', size: 100 }).ok, false);
    assert.equal(api.validateImageFile({ name: 'a.txt', type: 'text/plain', size: 100 }).ok, false);
    assert.equal(api.validateImageFile({ name: 'a.jpg', type: 'image/jpeg', size: 0 }).ok, false);
    assert.equal(api.validateImageFile(null).ok, false);
  });
  test('T3 oversized files are rejected with reason too-large', () => {
    const r = api.validateImageFile({ name: 'big.jpg', type: 'image/jpeg', size: api.MAX_FILE_SIZE + 1 });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'too-large');
  });
  test('T4 race guard exists (load token, supersede check)', () => {
    assert.ok(APP_JS.includes('loadState.token'), 'missing load token');
    assert.ok(APP_JS.includes('superseded'), 'missing supersede guard');
    assert.ok(/\+\+loadState\.token|loadState\.token \+= 1|\+=\s*1/.test(APP_JS) || (APP_JS.match(/loadState\.token/g) || []).length >= 3, 'token must advance per request');
  });
  test('no decorative gradient masquerading as a loaded photo', () => {
    assert.ok(!/#4f46e5/.test(APP_JS), 'fallback gradient must not fake a photo');
    assert.ok(APP_JS.includes('loadOverlay') || APP_JS.includes('loadState'), 'explicit load state required');
  });
  test('thumbnails guard against undrawn Image', () => {
    assert.ok(APP_JS.includes('isImageReady(sourceImage)'), 'thumbnails must check image readiness');
  });
});

// T5/T6: preset changes image; reset returns original
describe('presets & reset', () => {
  test('T5 Original preset is colour-neutral', () => {
    const normal = api.PRESETS.find(p => p.id === 'normal');
    assert.ok(normal, 'normal preset missing');
    const c = normal.config;
    assert.deepEqual(
      { brightness: c.brightness, contrast: c.contrast, saturate: c.saturate, sepia: c.sepia, hue: c.hue, warmth: c.warmth },
      { brightness: 0, contrast: 0, saturate: 0, sepia: 0, hue: 0, warmth: 0 }
    );
    assert.equal(c.tint, null);
  });
  test('T5 other presets are non-neutral (selection changes the image)', () => {
    const others = api.PRESETS.filter(p => p.id !== 'normal');
    assert.ok(others.length >= 10, 'preset list shrank unexpectedly');
    for (const p of others) {
      const c = p.config;
      const neutral = c.brightness === 0 && c.contrast === 0 && c.saturate === 0 && (c.sepia || 0) === 0 && (c.hue || 0) === 0 && (c.warmth || 0) === 0 && !c.tint && !(c.gloss > 0) && !(c.crisp > 0);
      assert.equal(neutral, false, `preset ${p.id} is neutral — selection would not change the image`);
    }
  });
  test('T6 neutral state is truly original; reset factory is neutral', () => {
    const n = api.createNeutralState();
    assert.equal(api.isStateNeutral(n), true);
    assert.equal(api.getActiveCorrectionCount(n), 0);
    assert.equal(api.isNeutralBeauty(n.beauty), true);
    assert.equal(api.isNeutralAdjustments(n.adjustments), true);
  });
  test('T6 initial demo state is NOT neutral (corrections visible to user)', () => {
    const s = api.createInitialState();
    assert.equal(api.isStateNeutral(s), false);
    assert.ok(api.getActiveCorrectionCount(s) > 0);
  });
  test('correction indicator exists for Original + active corrections', () => {
    assert.ok(APP_JS.includes('correctionNote') || APP_JS.includes('getActiveCorrectionCount'), 'missing correction indicator');
    assert.ok(INDEX_HTML.includes('correctionNote'), 'correction note element missing in HTML');
  });
});

// T7/T8: Before hold model
describe('before/after', () => {
  test('T7/T8 pointer-events model with all release paths', () => {
    for (const token of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      assert.ok(APP_JS.includes(token), `missing ${token} handler`);
    }
    assert.ok(APP_JS.includes("window.addEventListener('blur'") || APP_JS.includes('window.addEventListener("blur"'), 'missing blur release');
    assert.ok(APP_JS.includes('visibilitychange'), 'missing visibilitychange release');
    assert.ok(!APP_JS.includes("addEventListener('mousedown'") && !APP_JS.includes("addEventListener('touchstart'"), 'must use Pointer Events, not mousedown/touchstart');
  });
  test('compare renders the raw source (no filters)', () => {
    const idx = APP_JS.indexOf('if (st.isComparing)');
    assert.ok(idx > 0, 'missing compare branch in pipeline');
    const branch = APP_JS.slice(idx, idx + 400);
    assert.ok(branch.includes("filter = 'none'") && branch.includes('drawImage'), 'compare must draw raw source');
  });
  test('endCompare is idempotent and always restores the edit', () => {
    assert.ok(/if\s*\(!state\.isComparing\)\s*return/.test(APP_JS), 'endCompare must early-return when not comparing');
  });
});

// T9/T10/T11: preview vs export
describe('preview & export', () => {
  test('T9 preview and export share one pipeline with identical order', () => {
    assert.ok(APP_JS.includes('function renderImage'), 'shared renderImage() missing');
    assert.ok(APP_JS.includes('renderImage(ctx, mainCanvas.width'), 'preview must use renderImage');
    assert.ok(APP_JS.includes('renderImage(ectx,'), 'export must use renderImage');
    assert.ok(APP_JS.includes('getExportDimensions(sourceImage.naturalWidth'), 'export must derive from the ORIGINAL image');
  });
  test('T9 effect radii scale with output size', () => {
    assert.ok(APP_JS.includes('refK'), 'missing output-size scale factor for radii/blur');
  });
  test('T10 PNG export via toBlob/Blob URL (no persistent toDataURL export)', () => {
    assert.ok(APP_JS.includes('canvasToBlob') || APP_JS.includes('.toBlob('), 'export must prefer canvas.toBlob()');
    assert.ok(APP_JS.includes('createObjectURL'), 'export preview must use Blob URL');
    assert.ok(APP_JS.includes('revokeObjectURL'), 'Blob URLs must be revoked (no leaks)');
    assert.ok(!APP_JS.includes('toDataURL'), 'toDataURL must not remain in the codebase');
  });
  test('T9 preview capped at 1080; export capped + documented', () => {
    assert.equal(api.PREVIEW_MAX_DIM, 1080);
    assert.equal(api.EXPORT_MAX_DIM, 4096);
    const prev = api.getPreviewDimensions(4000, 3000);
    assert.ok(Math.max(prev.w, prev.h) <= 1080, 'preview exceeds 1080');
    const full = api.getExportDimensions(1200, 800);
    assert.deepEqual([full.w, full.h, full.capped], [1200, 800, false]);
  });
  test('T11 hi-res export never throws unhandled: documented cap + fallback flag', () => {
    const big = api.getExportDimensions(8000, 6000);
    assert.equal(big.capped, true);
    assert.ok(big.w * big.h <= api.EXPORT_MAX_PIXELS, 'export exceeds pixel budget');
    assert.ok(Math.max(big.w, big.h) <= api.EXPORT_MAX_DIM, 'export exceeds dim cap');
    assert.ok(APP_JS.includes('уменьшен для экономии памяти'), 'cap fallback notice missing');
    assert.ok(APP_JS.includes('недостаточно памяти'), 'memory fallback message missing');
  });
  test('no absolute-quality promises', () => {
    assert.ok(!/без потерь|lossless|100% качество/i.test(APP_JS), 'must not promise absolute quality');
    assert.ok(APP_JS.includes('не побитовый оригинал'), 'honest quality disclaimer missing');
  });
});

// T12: honest Telegram terminology
describe('honest product claims', () => {
  test('T12 no fake Telegram photo sending', () => {
    assert.ok(!APP_JS.includes('sendData'), 'must not use Telegram.sendData as a PNG transport');
    assert.ok(!INDEX_HTML.includes('Отправить в бота Telegram'), 'fake send button must be gone');
    assert.ok(!/бот получит фото/i.test(APP_JS + INDEX_HTML), 'fake delivery promise must be gone');
    assert.ok(INDEX_HTML.includes('Отправка фото в Telegram-бота появится в следующем этапе'), 'deferral note missing');
    assert.ok(INDEX_HTML.includes('btnShareImage'), 'Share entry point missing');
    assert.ok(APP_JS.includes('canShare'), 'Web Share capability check missing');
  });
  test('honest automation terminology (no neural-net claims)', () => {
    for (const chunk of [APP_JS, INDEX_HTML]) {
      assert.ok(!chunk.includes('Beauty AI'), 'stale "Beauty AI" label remains');
      assert.ok(!chunk.includes('AI Бьюти-стиль'), 'stale "AI Бьюти-стиль" label remains');
      assert.ok(!/нейросеть|neural network/i.test(chunk), 'neural-net claim without a model');
    }
    assert.ok(INDEX_HTML.includes('Photo Studio'), 'new header badge missing');
    assert.ok(INDEX_HTML.includes('Автостиль'), 'new auto-style label missing');
    assert.ok(INDEX_HTML.includes('Автонастройка') || APP_JS.includes('Автонастройка') || INDEX_HTML.includes('autoHudBadge'), 'auto-tune HUD missing');
    assert.ok(/NOT a neural|rule-based/i.test(APP_JS), 'code must document the rule-based nature');
  });
});

// T13: mobile stability (static level)
describe('mobile', () => {
  test('T13 safe areas, viewport-fit, touch targets', () => {
    assert.ok(INDEX_HTML.includes('viewport-fit=cover'), 'viewport-fit=cover missing');
    assert.ok(CSS.includes('safe-area-inset'), 'safe-area insets missing in CSS');
    assert.ok(CSS.includes('min-height: 28px') || CSS.includes('touch'), 'slider touch target missing');
    assert.ok(CSS.includes('16px') && CSS.includes('customCaption'), 'iOS input zoom guard missing');
    assert.ok(APP_JS.includes('touch-none') || INDEX_HTML.includes('touch-none'), 'compare button should suppress touch scrolling');
  });
});

// T3-reset: reset coverage (1.5)
describe('reset coverage', () => {
  test('resetAll clears preset, FX, beauty, adjustments, stamp, caption', () => {
    const src = APP_JS.slice(APP_JS.indexOf('function resetAll'), APP_JS.indexOf('function resetAll') + 2200);
    for (const token of ['createNeutralState', 'stamp-btn', 'customCaption', 'activeFilterName', 'buildFilterCarousel', 'buildBeautyCarousel', 'buildFXCarousel', 'buildAdjustCarousel', 'updateSliderUI']) {
      assert.ok(src.includes(token), `resetAll misses ${token}`);
    }
    // Functional: the neutral factory resetAll() delegates to is a true original.
    const n = api.createNeutralState();
    assert.equal(n.stampMode, 'none');
    assert.equal(n.caption, '');
    assert.equal(n.activePreset, 'normal');
    assert.equal(n.activeFX, 'none');
    assert.equal(api.isStateNeutral(n), true);
  });
});
