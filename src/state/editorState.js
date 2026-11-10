(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.AuraGramEditorState = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  /* ============================================================================
   * AuraGram Studio — Gauntlet 0
   * Static frontend, local photo processing only. No backend, no paid APIs,
   * no cloud inference, no MediaPipe in this Gauntlet (hook reserved for G1).
   * ----------------------------------------------------------------------------
   * P0 fixes in this file:
   *  1.1 Original preset vs Before vs Reset All (correction indicator)
   *  1.2 Reliable photo loading (validation, size cap, race guard, load state)
   *  1.3 Preview vs Export (shared pipeline, scaled radii, toBlob, mem cap)
   *  1.4 Honest export (local PNG + Web Share, NO fake Telegram photo send)
   *  1.5 Correct Reset All
   *  1.6 Before/After via Pointer Events
   * Phase 2: rAF scheduling, buffer reuse, Blob URL hygiene, render timing.
   * Phase 3: honest terminology (Photo Studio / Автостиль / Автонастройка).
   * ========================================================================== */

  // --- Constants (also asserted by tests) -------------------------------------
  const PREVIEW_MAX_DIM = 1080;          // preview canvas cap (fast interaction)
  const EXPORT_MAX_DIM = 4096;           // documented export cap (memory safety)
  const EXPORT_MAX_PIXELS = 16777216;    // 4096*4096 — Safari old-iPhone guard
  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB upload cap
  const ACCEPTED_MIME_PREFIX = 'image/';
  const ACCEPTED_MIME_EXACT = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/heic', 'image/heif'
  ]);
  const GAUNTLET_VERSION = '0.3.0';

  // --- Demo photos (remote; failure is explicit, never faked) ------------------
  const DEMO_PHOTOS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=85'
  ];

  // --- Presets / tools (visual design + filters preserved from prototype) ------
  const PRESETS = [
    { id: 'normal', name: 'Original', badge: 'RAW', config: { brightness: 0, contrast: 0, saturate: 0, sepia: 0, hue: 0, warmth: 0, tint: null, gloss: 0, crisp: 0 } },
    { id: 'vogue', name: 'Vogue Gloss', badge: 'AD PRO', config: { brightness: 4, contrast: 18, saturate: 8, sepia: 0, hue: -1, warmth: 4, tint: 'rgba(255, 245, 250, 0.10)', gloss: 45, crisp: 40 } },
    { id: 'champagne', name: 'Champagne', badge: 'LUXE', config: { brightness: 6, contrast: 14, saturate: -4, sepia: 10, hue: -2, warmth: 16, tint: 'rgba(254, 243, 199, 0.14)', gloss: 50, crisp: 35 } },
    { id: 'studioflash', name: 'Studio Flash', badge: 'CRISP', config: { brightness: 7, contrast: 24, saturate: 6, sepia: 0, hue: 0, warmth: -4, tint: 'rgba(240, 249, 255, 0.12)', gloss: 60, crisp: 50 } },
    { id: 'cleangirl', name: 'Clean Girl', badge: 'BEAUTY', config: { brightness: 5, contrast: 8, saturate: 10, sepia: 2, hue: -2, warmth: 8, tint: 'rgba(255, 228, 230, 0.10)', gloss: 30, crisp: 25 } },
    { id: 'peachskin', name: 'Peach Skin', badge: 'SKIN', config: { brightness: 5, contrast: 10, saturate: 16, sepia: 6, hue: -4, warmth: 18, tint: 'rgba(251, 146, 60, 0.12)', gloss: 35, crisp: 30 } },
    { id: 'porcelain', name: 'Porcelain', badge: 'GLOW', config: { brightness: 9, contrast: 12, saturate: -12, sepia: 0, hue: 4, warmth: -10, tint: 'rgba(240, 249, 255, 0.14)', gloss: 40, crisp: 30 } },
    { id: 'goldentan', name: 'Golden Tan', badge: 'BRONZE', config: { brightness: 2, contrast: 18, saturate: 20, sepia: 14, hue: -3, warmth: 28, tint: 'rgba(217, 119, 6, 0.14)', gloss: 45, crisp: 35 } },
    { id: 'dreamy', name: 'Angel Aura', badge: 'SOFT', config: { brightness: 10, contrast: -6, saturate: 14, sepia: 4, hue: 6, warmth: 10, tint: 'rgba(232, 121, 249, 0.15)', gloss: 35, crisp: 10 } },
    { id: 'velvet', name: 'Velvet Sunset', badge: 'WARM', config: { brightness: 4, contrast: 14, saturate: 28, sepia: 14, hue: -12, warmth: 36, tint: 'rgba(244, 63, 94, 0.18)', gloss: 25, crisp: 20 } },
    { id: 'kodak98', name: 'Kodak Gold', badge: 'FILM', config: { brightness: 5, contrast: 16, saturate: 18, sepia: 22, hue: 0, warmth: 30, tint: 'rgba(245, 158, 11, 0.14)', gloss: 20, crisp: 20 } },
    { id: 'cinematic', name: 'Teal & Orange', badge: 'PRO', config: { brightness: -1, contrast: 28, saturate: 16, sepia: 6, hue: -8, warmth: 16, tint: 'rgba(6, 182, 212, 0.16)', gloss: 25, crisp: 35 } },
    { id: 'matcha', name: 'Matcha Film', badge: 'INDIE', config: { brightness: 4, contrast: 10, saturate: -8, sepia: 18, hue: 24, warmth: 12, tint: 'rgba(16, 185, 129, 0.14)', gloss: 15, crisp: 20 } },
    { id: 'tokyo', name: 'Tokyo Night', badge: 'NEON', config: { brightness: -3, contrast: 32, saturate: 26, sepia: 8, hue: 190, warmth: -32, tint: 'rgba(14, 165, 233, 0.20)', gloss: 40, crisp: 35 } },
    { id: 'cyberpunk', name: 'Cyberpunk', badge: 'HIT', config: { brightness: 4, contrast: 30, saturate: 42, sepia: 0, hue: -12, warmth: -20, tint: 'rgba(192, 38, 211, 0.20)', gloss: 35, crisp: 40 } },
    { id: 'noir', name: 'Paris Noir', badge: 'B&W', config: { brightness: -2, contrast: 48, saturate: -100, sepia: 6, hue: 0, warmth: 0, tint: null, gloss: 40, crisp: 45 } }
  ];

  const BEAUTY_TOOLS = [
    { key: 'smooth', name: 'Гладкость кожи', icon: 'ph-magic-wand', min: 0, max: 100, default: 30, unit: '%' },
    { key: 'antired', name: 'Анти-краснота', icon: 'ph-drop-half', min: 0, max: 100, default: 25, unit: '%' },
    { key: 'blush', name: 'Персиковый тон', icon: 'ph-heart', min: 0, max: 100, default: 25, unit: '%' },
    { key: 'glow', name: 'Сияние (Glow)', icon: 'ph-sparkle', min: 0, max: 100, default: 38, unit: '%' },
    { key: 'eyes', name: 'Акцент (Чёткость)', icon: 'ph-eye', min: 0, max: 100, default: 42, unit: '%' },
    { key: 'sculpt', name: '3D Скульптуринг', icon: 'ph-user-focus', min: 0, max: 100, default: 28, unit: '%' }
  ];

  const FX_LIST = [
    { id: 'none', name: 'Без эффекта', icon: 'ph-prohibit' },
    { id: 'ring_light', name: 'Кольцевой свет', icon: 'ph-circle-dashed' },
    { id: 'peach_aura', name: 'Персик (Свечение)', icon: 'ph-sun-dim' },
    { id: 'red_burn', name: 'Красный засвет', icon: 'ph-flame' },
    { id: 'halation', name: 'Красное гало', icon: 'ph-fire' },
    { id: 'diamond_glow', name: 'Люкс блики', icon: 'ph-shooting-star' },
    { id: 'leak_warm', name: 'Засвет пленки', icon: 'ph-sun-horizon' },
    { id: 'neon_prism', name: 'Неон градиент', icon: 'ph-rainbow' },
    { id: 'vhs_glitch', name: 'RGB Сдвиг (3D)', icon: 'ph-television-simple' },
    { id: 'bokeh_dust', name: 'Боке и пыль', icon: 'ph-sparkle' },
    { id: 'sunbeams', name: 'Лучи заката', icon: 'ph-sun' }
  ];

  const ADJUSTMENTS = [
    { key: 'brightness', name: 'Яркость', icon: 'ph-sun', min: -50, max: 50, default: 0, unit: '' },
    { key: 'contrast', name: 'Контраст', icon: 'ph-circle-half', min: -50, max: 50, default: 0, unit: '' },
    { key: 'saturate', name: 'Насыщенность', icon: 'ph-drop', min: -100, max: 100, default: 0, unit: '' },
    { key: 'warmth', name: 'Температура', icon: 'ph-thermometer-simple', min: -60, max: 60, default: 0, unit: '' },
    { key: 'vignette', name: 'Виньетка', icon: 'ph-vignette', min: 0, max: 100, default: 0, unit: '%' },
    { key: 'grain', name: 'Зерно пленки', icon: 'ph-grains', min: 0, max: 100, default: 0, unit: '%' },
    { key: 'fade', name: 'Матовость', icon: 'ph-cloud-fog', min: 0, max: 80, default: 0, unit: '%' },
    { key: 'blur', name: 'Софт-фокус', icon: 'ph-drop-half-bottom', min: 0, max: 20, default: 0, unit: 'px' }
  ];
  // NOTE: vignette default is 0 (neutral). The prototype used 10/12 implicitly;
  // Reset All must be truly neutral, so neutral = 0. Initial demo state below
  // intentionally uses vignette 12 to preserve the original look on first run,
  // while resetState() returns to 0. Tests assert reset neutrality.

  // G1c: lash state lives apart from the single-slider beauty tools:
  // three independent params (density/length/definition), all zero = off.
  const LASH_DEFAULTS = { density: 0, length: 0, definition: 0 };

  function createLashesState() {
    return { density: 0, length: 0, definition: 0 };
  }

  function isNeutralLashes(l) {
    if (!l) return true;
    return l.density === 0 && l.length === 0 && l.definition === 0;
  }

  function lashCorrectionCount(l) {
    if (!l) return 0;
    return (l.density > 0 ? 1 : 0) + (l.length > 0 ? 1 : 0) + (l.definition > 0 ? 1 : 0);
  }

  // --- Pure state helpers (unit-testable, no DOM) ------------------------------
  function createInitialState() {
    return {
      currentTab: 'filters',
      activePreset: 'vogue',
      presetIntensity: 100,
      activeFX: 'ring_light',
      activeBeautyKey: 'smooth',
      beauty: { smooth: 30, antired: 25, blush: 25, glow: 38, eyes: 42, sculpt: 28 },
      lashes: createLashesState(), // G1c: off by default until the user opts in
      activeAdjustKey: 'brightness',
      adjustments: { brightness: 0, contrast: 0, saturate: 0, warmth: 0, vignette: 12, grain: 0, fade: 0, blur: 0 },
      stampMode: 'none',
      caption: '',
      isComparing: false,
      demoIndex: 0
    };
  }

  function createNeutralState() {
    const beauty = {};
    BEAUTY_TOOLS.forEach(t => { beauty[t.key] = 0; });
    const adjustments = {};
    ADJUSTMENTS.forEach(a => { adjustments[a.key] = a.default; });
    return {
      currentTab: 'filters',
      activePreset: 'normal',
      presetIntensity: 100,
      activeFX: 'none',
      activeBeautyKey: 'smooth',
      beauty,
      lashes: createLashesState(),
      activeAdjustKey: 'brightness',
      adjustments,
      stampMode: 'none',
      caption: '',
      isComparing: false,
      demoIndex: 0
    };
  }

  function isNeutralBeauty(beauty) {
    return Object.values(beauty).every(v => v === 0);
  }

  function isNeutralAdjustments(adjustments) {
    return ADJUSTMENTS.every(a => adjustments[a.key] === a.default);
  }

  /** Count of independent corrections on top of the color preset. */
  function getActiveCorrectionCount(st) {
    let n = 0;
    if (st.activeFX && st.activeFX !== 'none') n += 1;
    Object.values(st.beauty).forEach(v => { if (v !== 0) n += 1; });
    n += lashCorrectionCount(st.lashes); // G1c: each nonzero lash param counts
    ADJUSTMENTS.forEach(a => { if (st.adjustments[a.key] !== a.default) n += 1; });
    if (st.stampMode && st.stampMode !== 'none') n += 1;
    if (st.caption) n += 1;
    return n;
  }

  /**
   * True only when the canvas shows the pixel-original:
   * neutral preset + no FX + zero beauty + zero lashes + neutral adjustments
   * + no frame/caption. (presetIntensity is irrelevant when preset is neutral.)
   */
  function isStateNeutral(st) {
    return st.activePreset === 'normal'
      && (st.activeFX === 'none')
      && isNeutralBeauty(st.beauty)
      && isNeutralLashes(st.lashes)
      && isNeutralAdjustments(st.adjustments)
      && st.stampMode === 'none'
      && !st.caption;
  }

  /** Validate an upload before decoding. Returns {ok, reason}. */
  function validateImageFile(file) {
    if (!file) return { ok: false, reason: 'empty' };
    const type = file.type || '';
    const name = file.name || '';
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    const allowedExt = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'heif']);
    const mimeOk = type.startsWith(ACCEPTED_MIME_PREFIX) && (ACCEPTED_MIME_EXACT.has(type) || type.startsWith('image/'));
    if (!mimeOk || (ext && !allowedExt.has(ext))) {
      // Fall back to extension check when MIME is missing (some Android pickers).
      if (!(ext && allowedExt.has(ext) && (!type || type.startsWith('image/') || type === 'application/octet-stream'))) {
        return { ok: false, reason: 'unsupported-type' };
      }
    }
    if (file.size === 0) return { ok: false, reason: 'empty' };
    if (file.size > MAX_FILE_SIZE) return { ok: false, reason: 'too-large' };
    return { ok: true, reason: '' };
  }

  function fitInto(nw, nh, maxDim, maxPixels) {
    let w = nw, h = nh;
    const longest = Math.max(w, h);
    if (longest > maxDim) {
      const k = maxDim / longest;
      w = Math.max(1, Math.round(w * k));
      h = Math.max(1, Math.round(h * k));
    }
    if (maxPixels && w * h > maxPixels) {
      const k = Math.sqrt(maxPixels / (w * h));
      w = Math.max(1, Math.round(w * k));
      h = Math.max(1, Math.round(h * k));
    }
    return { w, h };
  }

  function getPreviewDimensions(nw, nh) {
    return fitInto(nw, nh, PREVIEW_MAX_DIM, null);
  }

  /**
   * Export keeps the original resolution up to a documented cap.
   * Returns {w, h, capped} — capped=true means we downscaled for memory safety
   * and the UI must notify the user (no silent quality claims).
   */
  function getExportDimensions(nw, nh) {
    const cappedFit = fitInto(nw, nh, EXPORT_MAX_DIM, EXPORT_MAX_PIXELS);
    const capped = (cappedFit.w !== nw || cappedFit.h !== nh);
    return { w: cappedFit.w, h: cappedFit.h, capped };
  }

  // Durable settings only: UI selection, loading and geometry never enter a snapshot.
  function settingsSnapshot(input) {
    const fallback = createNeutralState();
    const st = input && typeof input === 'object' ? input : {};
    const number = (v, min, max, def = 0) => typeof v === 'number' && Number.isFinite(v)
      ? Math.min(max, Math.max(min, v)) : def;
    const group = (value, tools) => Object.fromEntries(tools.map(t =>
      [t.key, number(value && value[t.key], t.min, t.max, t.default || 0)]));
    return {
      activePreset: PRESETS.some(p => p.id === st.activePreset) ? st.activePreset : fallback.activePreset,
      presetIntensity: number(st.presetIntensity, 0, 100, 100),
      activeFX: FX_LIST.some(f => f.id === st.activeFX) ? st.activeFX : 'none',
      beauty: group(st.beauty, BEAUTY_TOOLS.map(t => ({...t, default: 0}))),
      lashes: group(st.lashes, Object.keys(LASH_DEFAULTS).map(key => ({key, min: 0, max: 100}))),
      adjustments: group(st.adjustments, ADJUSTMENTS),
      stampMode: ['none', 'date98', 'polaroid', 'cinema'].includes(st.stampMode) ? st.stampMode : 'none',
      caption: typeof st.caption === 'string' ? st.caption.slice(0, 28) : ''
    };
  }

  function applySettings(state, settings) {
    Object.assign(state, settingsSnapshot(settings));
  }

  function sameSettings(a, b) {
    return JSON.stringify(settingsSnapshot(a)) === JSON.stringify(settingsSnapshot(b));
  }

  function isImageReady(img) {
    return !!(img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
  }


  return { settingsSnapshot, applySettings, sameSettings, PREVIEW_MAX_DIM, EXPORT_MAX_DIM, EXPORT_MAX_PIXELS, MAX_FILE_SIZE, ACCEPTED_MIME_PREFIX, ACCEPTED_MIME_EXACT, GAUNTLET_VERSION, DEMO_PHOTOS, PRESETS, BEAUTY_TOOLS, FX_LIST, ADJUSTMENTS, LASH_DEFAULTS, createLashesState, isNeutralLashes, lashCorrectionCount, createInitialState, createNeutralState, isNeutralBeauty, isNeutralAdjustments, getActiveCorrectionCount, isStateNeutral, validateImageFile, fitInto, getPreviewDimensions, getExportDimensions, isImageReady };
});
