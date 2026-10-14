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
const GAUNTLET_VERSION = 'gauntlet-0';

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

// --- Pure state helpers (unit-testable, no DOM) ------------------------------
function createInitialState() {
  return {
    currentTab: 'filters',
    activePreset: 'vogue',
    presetIntensity: 100,
    activeFX: 'ring_light',
    activeBeautyKey: 'smooth',
    beauty: { smooth: 30, antired: 25, blush: 25, glow: 38, eyes: 42, sculpt: 28 },
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
  ADJUSTMENTS.forEach(a => { if (st.adjustments[a.key] !== a.default) n += 1; });
  if (st.stampMode && st.stampMode !== 'none') n += 1;
  if (st.caption) n += 1;
  return n;
}

/**
 * True only when the canvas shows the pixel-original:
 * neutral preset + no FX + zero beauty + neutral adjustments + no frame/caption.
 * (presetIntensity is irrelevant when preset is neutral.)
 */
function isStateNeutral(st) {
  return st.activePreset === 'normal'
    && (st.activeFX === 'none')
    && isNeutralBeauty(st.beauty)
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

function isImageReady(img) {
  return !!(img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
}

// --- Browser app -------------------------------------------------------------
const isBrowser = (typeof window !== 'undefined') && (typeof document !== 'undefined');

if (isBrowser) {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) {
    tg.ready();
    try { tg.expand(); } catch (e) { /* older clients */ }
    try {
      tg.setHeaderColor('#0d0d12');
      tg.setBackgroundColor('#09090b');
    } catch (e) { /* ignore */ }
  }

  function triggerHaptic(type) {
    try {
      if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(type || 'light');
    } catch (e) { /* noop */ }
  }

  const state = createInitialState();

  // Explicit loading state (1.2): never pretend a photo is loaded.
  const loadState = { status: 'idle', error: '', token: 0 };
  let sourceImage = null;      // full-resolution decoded image (export source)
  let imageReady = false;

  const mainCanvas = document.getElementById('mainCanvas');
  const ctx = mainCanvas.getContext('2d');

  // Reused offscreen buffers (Phase 2: never recreate per frame needlessly).
  // detailBuffer serves the preset micro-contrast + the Eyes local pass.
  // (The G0 beautyBuffer radial-smoothing scratch is gone with the old engine.)
  const detailBuffer = document.createElement('canvas');
  const detailCtx = detailBuffer.getContext('2d');

  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = 180;
  grainCanvas.height = 180;
  const grainCtx = grainCanvas.getContext('2d');
  (function generateGrainTexture() {
    const imgData = grainCtx.createImageData(180, 180);
    const buf = imgData.data;
    for (let i = 0; i < buf.length; i += 4) {
      const v = Math.random() * 255;
      buf[i] = v; buf[i + 1] = v; buf[i + 2] = v; buf[i + 3] = 255;
    }
    grainCtx.putImageData(imgData, 0, 0);
  })();

  // Render stats (Phase 2: basic measurements, no heavy telemetry).
  const stats = { lastPreviewMs: 0, lastExportMs: 0, previewW: 0, previewH: 0, exportW: 0, exportH: 0, renders: 0,
    faceDetectionStatus: 'not_started', faceCount: 0, faceDetectMs: 0, modelLoadMs: 0, faceBlockMs: 0,
    faceInputWidth: 0, faceInputHeight: 0, faceWorkerMode: 'none', faceGeometryBytes: 0,
    maskBuildMs: 0, retouchMs: 0, retouchRan: '' };

  // rAF-coalesced preview scheduling (Phase 2).
  let previewQueued = false;
  function requestPreviewRender() {
    if (previewQueued) return;
    previewQueued = true;
    requestAnimationFrame(() => {
      previewQueued = false;
      const t0 = performance.now();
      renderStudioCanvas();
      stats.lastPreviewMs = performance.now() - t0;
    });
  }

  // --- G1a: local face detection (geometry only — render pipeline untouched) --
  // Model + WASM are lazy (first photo), local (./vendor/mediapipe/), and
  // cached; inference runs ONCE per photo, never on slider/tab/preset edits.
  let faceEngine = null;
  let faceEngineLoading = null;
  let faceImageId = 0;
  let faceOverlayApi = null;
  const isFaceDebug = (() => {
    try {
      return new URLSearchParams(window.location.search).get('debugFace') === '1';
    } catch (e) {
      return false;
    }
  })();

  function updateFacePill(snap) {
    const pill = document.getElementById('faceStatusPill');
    if (!pill) return;
    const st = (snap && snap.status) || (faceEngine ? faceEngine.status() : 'not_started');
    const transient = st === 'loading_model' || st === 'detecting';
    // G1b: no_face/failed are shown compactly to everyone (they explain why
    // local retouch is inactive). Other terminal states stay debug-only.
    const showTerminal = isFaceDebug || st === 'no_face' || st === 'failed' || st === 'unsupported';
    if (!transient && !showTerminal) {
      pill.classList.add('hidden');
      return;
    }
    pill.classList.remove('hidden');
    const texts = {
      loading_model: 'Загрузка модели лица…',
      detecting: 'Поиск лица…',
      ready: `Лицо: ${snap ? snap.faceCount : 0} · ${snap ? snap.detectMs.toFixed(0) : 0} мс`,
      no_face: 'Лицо не найдено — локальная ретушь недоступна',
      failed: 'Анализ лица недоступен — фильтры работают',
      unsupported: 'Анализ лица недоступен — фильтры работают',
      not_started: ''
    };
    pill.textContent = texts[st] || '';
    if (!pill.textContent) pill.classList.add('hidden');
  }

  function syncFaceOverlaySize() {
    const overlay = document.getElementById('faceOverlay');
    if (!overlay) return;
    if (overlay.width !== mainCanvas.width || overlay.height !== mainCanvas.height) {
      overlay.width = mainCanvas.width || 0;
      overlay.height = mainCanvas.height || 0;
    }
  }

  function refreshFaceOverlay() {
    const overlay = document.getElementById('faceOverlay');
    if (!overlay) return;
    syncFaceOverlaySize();
    const octx = overlay.getContext('2d');
    if (!isFaceDebug || !faceEngine) {
      octx.clearRect(0, 0, overlay.width, overlay.height);
      overlay.classList.add('hidden');
      return;
    }
    overlay.classList.remove('hidden');
    try {
      if (faceOverlayApi) {
        faceOverlayApi.drawFaceOverlay(octx, faceEngine.store, overlay.width, overlay.height);
      }
    } catch (e) { /* overlay must never break the editor */ }
  }

  function onFaceStatus(snap) {
    stats.faceDetectionStatus = snap.status;
    stats.faceCount = snap.faceCount;
    stats.faceDetectMs = snap.detectMs;
    stats.modelLoadMs = snap.modelLoadMs;
    stats.faceBlockMs = snap.blockMs || 0;
    stats.faceInputWidth = snap.inputW;
    stats.faceInputHeight = snap.inputH;
    stats.faceWorkerMode = snap.workerMode;
    stats.faceGeometryBytes = snap.geometryBytes;
    updateFacePill(snap);
    refreshFaceOverlay();
    // G1b (3.4): when geometry lands after the photo was already painted,
    // re-render once so face-aware retouch appears without any user action.
    // (Renders never schedule detection, so this cannot loop.)
    if (snap.status === 'ready' || snap.status === 'no_face' || snap.status === 'failed') {
      requestPreviewRender();
    }
  }

  function ensureFaceEngine() {
    if (faceEngine) return Promise.resolve(faceEngine);
    if (!faceEngineLoading) {
      // NOTE: dynamic import() inside a classic script resolves against the
      // script's own URL (/src/app.js), NOT the document — so resolve against
      // document.baseURI explicitly to stay correct under any Pages subpath.
      const detectorUrl = new URL('src/vision/faceDetector.mjs', document.baseURI).href;
      const overlayUrl = new URL('src/vision/faceOverlay.mjs', document.baseURI).href;
      faceEngineLoading = import(detectorUrl).then((mod) => {
        faceEngine = mod.createFaceEngine({ onStatus: onFaceStatus });
        faceEngine._overlayUrl = overlayUrl;
        return faceEngine;
      }).catch(() => {
        faceEngineLoading = null; // retry on next photo; editor unaffected
        onFaceStatus({ status: 'failed', imageId: faceImageId, faceCount: 0, detectMs: 0, modelLoadMs: 0, blockMs: 0, workerMode: 'none', inputW: 0, inputH: 0, geometryBytes: 0 });
        return null;
      });
    }
    return faceEngineLoading;
  }

  function scheduleFaceDetection(img, imageId) {
    // Fire-and-forget: detection runs after paint, exactly once per photo.
    try {
      ensureFaceEngine().then((engine) => {
        if (!engine || imageId !== faceImageId) return; // stale photo (F6)
        try {
          if (!faceOverlayApi && faceEngine._overlayUrl) {
            import(faceEngine._overlayUrl).then((m) => { faceOverlayApi = m; refreshFaceOverlay(); }).catch(() => {});
          }
          engine.schedule(imageId, img);
        } catch (e) { /* face detection must never break photo loading */ }
      });
    } catch (e) { /* noop */ }
  }

  function resetFaceState() {
    // G1b (1.3): settings Reset preserves the current photo's geometry —
    // the photo did not change, so valid landmarks stay valid (R11).
    // Photo changes invalidate via newPhoto() in adoptImage instead.
    refreshFaceOverlay();
  }

  function setLoadStatus(status, errorText) {
    loadState.status = status;
    loadState.error = errorText || '';
    const overlay = document.getElementById('loadOverlay');
    const overlayText = document.getElementById('loadOverlayText');
    const overlayError = document.getElementById('loadError');
    const spinner = overlay ? overlay.querySelector('.spinner') : null;
    if (!overlay) return;
    if (status === 'ready') {
      overlay.classList.add('hidden');
    } else {
      overlay.classList.remove('hidden');
      if (spinner) spinner.style.display = status === 'loading' ? '' : 'none';
      if (overlayText) {
        overlayText.textContent = status === 'loading'
          ? 'Загрузка фото…'
          : (status === 'error' ? 'Фото не загружено' : 'Загрузка фото…');
      }
      if (overlayError) overlayError.textContent = errorText || '';
    }
    const btnExport = document.getElementById('btnExport');
    if (btnExport) btnExport.disabled = (status !== 'ready');
  }

  function showToast(text) {
    const toast = document.getElementById('toastMsg');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.remove('opacity-0', '-translate-y-2');
    toast.classList.add('opacity-100', 'translate-y-0');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', '-translate-y-2');
    }, 2200);
  }

  // --- G1b: face-aware retouch plumbing --------------------------------------
  const isSkinDebug = (() => {
    try {
      return new URLSearchParams(window.location.search).get('debugSkin') === '1';
    } catch (e) {
      return false;
    }
  })();
  let retouchSession = null;
  let retouchLoading = null;

  function importRetouchModule() {
    // Same classic-script dynamic-import rule as the face engine: resolve
    // against document.baseURI so Pages subpaths keep working.
    const url = new URL('src/retouch/retouch.mjs', document.baseURI).href;
    return import(url);
  }

  /** Immutable face snapshot for one render; null without valid geometry. */
  function currentFaceSnapshot() {
    if (!faceEngine) return null;
    const store = faceEngine.store;
    if (!store || store.status !== 'ready' || store.imageId !== faceImageId) return null;
    const f = store.faces[0];
    if (!f || !f.regions) return null;
    return { imageId: store.imageId, regions: f.regions };
  }

  function runRetouchPasses(tctx, W, H, src, st, face, gradeFilter) {
    const b = st.beauty;
    const anyOn = b.smooth > 0 || b.antired > 0 || b.glow > 0 || b.eyes > 0 || b.blush > 0 || b.sculpt > 0;
    if (!anyOn) return;
    if (!face) return; // R9: no geometry → no local passes, never a fake fallback
    if (!retouchSession) {
      if (!retouchLoading) {
        retouchLoading = importRetouchModule().then((mod) => {
          retouchSession = mod.createRetouchSession();
          requestPreviewRender();
          refreshSkinOverlay();
          return retouchSession;
        }).catch(() => { retouchLoading = null; });
      }
      return; // grade stays; retouch lands on the next tick, never blocks
    }
    try {
      const gradeSig = [st.activePreset, st.presetIntensity,
        st.adjustments.brightness, st.adjustments.contrast,
        st.adjustments.saturate, st.adjustments.blur].join('|');
      const res = retouchSession.applyPasses(tctx, W, H, {
        face, beauty: b, src, gradeFilter, gradeSig,
        buffers: { detailBuffer, detailCtx }
      });
      const t = retouchSession.timings();
      stats.retouchMs = res.ms;
      stats.maskBuildMs = t.maskBuildMs;
      stats.retouchRan = res.ran.join(',');
    } catch (e) { /* local retouch must never break the grade */ }
  }

  function refreshSkinOverlay() {
    const overlay = document.getElementById('skinOverlay');
    if (!overlay) return;
    if (overlay.width !== mainCanvas.width || overlay.height !== mainCanvas.height) {
      overlay.width = mainCanvas.width || 0;
      overlay.height = mainCanvas.height || 0;
    }
    const octx = overlay.getContext('2d');
    const face = currentFaceSnapshot();
    if (!isSkinDebug || !face || !isImageReady(sourceImage)) {
      octx.clearRect(0, 0, overlay.width, overlay.height);
      overlay.classList.add('hidden');
      return;
    }
    if (!retouchSession) {
      if (!retouchLoading) {
        retouchLoading = importRetouchModule().then((mod) => {
          retouchSession = mod.createRetouchSession();
          refreshSkinOverlay();
          return retouchSession;
        }).catch(() => { retouchLoading = null; });
      }
      return;
    }
    overlay.classList.remove('hidden');
    try {
      retouchSession.ensureMasks(face, overlay.width, overlay.height, sourceImage);
      retouchSession.paintDebugSkin(octx, overlay.width, overlay.height);
    } catch (e) { /* overlay must never break the editor */ }
  }

  // --- Shared render pipeline: identical settings/order for Preview & Export -
  // face: immutable {imageId, regions} snapshot for this render (or null).
  function renderImage(tctx, W, H, src, st, face) {
    tctx.clearRect(0, 0, W, H);

    // Before (compare hold): absolutely raw source, no processing at all.
    if (st.isComparing) {
      tctx.filter = 'none';
      tctx.drawImage(src, 0, 0, W, H);
      return;
    }

    const preset = PRESETS.find(p => p.id === st.activePreset) || PRESETS[0];
    const ratio = st.presetIntensity / 100;
    // Effect radii scale with output size so Export matches Preview (1.3).
    const refK = Math.min(W, H) / 720;

    // Global color grade ONLY. G1b (Phase 6): beauty must not leak into the
    // base filter anymore (old antired hue/brightness and eyes-contrast terms
    // tinted the whole photo). Preset crisp still shapes global contrast.
    const bright = 100 + (preset.config.brightness * ratio) + st.adjustments.brightness;
    const cont = 100 + (preset.config.contrast * ratio) + st.adjustments.contrast + ((preset.config.crisp || 0) * ratio * 0.18);
    const sat = 100 + (preset.config.saturate * ratio) + st.adjustments.saturate;
    const sep = Math.max(0, (preset.config.sepia * ratio));
    const hue = Math.round(preset.config.hue * ratio);
    const blurPx = (st.adjustments.blur * 0.4 * refK).toFixed(2);
    const gradeFilter = `brightness(${bright}%) contrast(${cont}%) saturate(${sat}%) sepia(${sep}%) hue-rotate(${hue}deg) blur(${blurPx}px)`;

    tctx.save();
    tctx.filter = gradeFilter;
    tctx.drawImage(src, 0, 0, W, H);
    tctx.filter = 'none';

    // Face-aware retouch (G1b). No geometry → all local passes skip (R9);
    // slider 0 → each pass is identity (R7). Immutable face snapshot per render.
    runRetouchPasses(tctx, W, H, src, st, face || null, gradeFilter);

    // G1b.1 COMPOSITING CONTRACT (isolation of Global vs Local):
    // ------------------------------------------------------------------
    // Stage order in renderImage():
    //   1. Base image (drawImage src with gradeFilter).
    //   2. Global preset processing (gradeFilter: brightness/contrast/
    //      saturate/sepia/hue + preset crisp contrast term).
    //   3. Global adjustments (tint, warmth, fade — below).
    //   4. Preset-specific global effects (gloss screen + crisp overlay).
    //      ALWAYS run when the preset asks, INDEPENDENT of st.beauty.*.
    //   5. Face-aware Beauty processing (runRetouchPasses, above): each tool
    //      is strictly masked — Smooth/Antired/Glow/Sculpt ⊂ skin mask,
    //      Eyes ⊂ eye mask, Blush ⊂ cheeks ∩ skin mask. Contribution =
    //      intensity × spatial mask. Beauty NEVER disables/scales Stage 4.
    //   6. Artistic FX.  7. Frame / stamp / caption.
    // Byte-identity note: with all beauty at 0 the output below is
    // pixel-identical to G1b/G1a (same ops, same order, same constants).

    // Preset-driven gloss: GLOBAL screen pass, always applied when the preset
    // asks. Independent of local Glow (G1b.1 P0-A fix: removed the gate that
    // wrongly dropped global gloss whenever local Glow was engaged).
    {
      const totalGloss = ((preset.config.gloss || 0) * ratio * 0.5);
      if (totalGloss > 0) {
        if (detailBuffer.width !== W || detailBuffer.height !== H) {
          detailBuffer.width = W; detailBuffer.height = H;
        }
        detailCtx.clearRect(0, 0, W, H);
        detailCtx.filter = 'brightness(72%) contrast(280%) saturate(85%) blur(1.5px)';
        detailCtx.drawImage(tctx.canvas, 0, 0, W, H);
        detailCtx.filter = 'none';
        tctx.save();
        tctx.globalCompositeOperation = 'screen';
        tctx.globalAlpha = Math.min(0.42, (totalGloss / 140) * 0.34);
        tctx.drawImage(detailBuffer, 0, 0, W, H);
        tctx.restore();
      }
    }

    // Preset-driven micro-contrast: GLOBAL overlay pass, always applied when
    // the preset asks. Independent of local Eyes (G1b.1 P0-A fix: removed
    // the gate that wrongly dropped global crisp whenever Eyes was engaged).
    {
      const totalCrisp = ((preset.config.crisp || 0) * ratio * 0.6);
      if (totalCrisp > 0) {
        if (detailBuffer.width !== W || detailBuffer.height !== H) {
          detailBuffer.width = W; detailBuffer.height = H;
        }
        detailCtx.clearRect(0, 0, W, H);
        detailCtx.filter = 'contrast(155%) brightness(98%) saturate(108%)';
        detailCtx.drawImage(src, 0, 0, W, H);
        detailCtx.filter = 'none';
        const sharpMask = detailCtx.createRadialGradient(W * 0.5, H * 0.42, Math.min(W, H) * 0.08, W * 0.5, H * 0.42, Math.min(W, H) * 0.48);
        sharpMask.addColorStop(0, 'rgba(0,0,0,1)');
        sharpMask.addColorStop(0.75, 'rgba(0,0,0,0.5)');
        sharpMask.addColorStop(1, 'rgba(0,0,0,0)');
        detailCtx.globalCompositeOperation = 'destination-in';
        detailCtx.fillStyle = sharpMask;
        detailCtx.fillRect(0, 0, W, H);
        detailCtx.globalCompositeOperation = 'source-over';
        tctx.save();
        tctx.globalCompositeOperation = 'overlay';
        tctx.globalAlpha = Math.min(0.45, (totalCrisp / 140) * 0.38);
        tctx.drawImage(detailBuffer, 0, 0, W, H);
        tctx.restore();
      }
    }

    // RGB split glitch (draws from source, same in preview & export).
    if (st.activeFX === 'vhs_glitch') {
      tctx.save();
      tctx.globalCompositeOperation = 'screen';
      tctx.globalAlpha = 0.38;
      tctx.filter = 'hue-rotate(120deg) saturate(200%)';
      tctx.drawImage(src, -Math.round(W * 0.012), 0, W, H);
      tctx.filter = 'hue-rotate(240deg) saturate(200%)';
      tctx.drawImage(src, Math.round(W * 0.012), 0, W, H);
      tctx.restore();
    }

    if (preset.config.tint && ratio > 0) {
      tctx.save();
      tctx.globalAlpha = ratio;
      tctx.globalCompositeOperation = 'soft-light';
      tctx.fillStyle = preset.config.tint;
      tctx.fillRect(0, 0, W, H);
      tctx.restore();
    }

    const totalWarmth = (preset.config.warmth * ratio) + st.adjustments.warmth;
    if (Math.abs(totalWarmth) > 1) {
      tctx.save();
      tctx.globalCompositeOperation = 'soft-light';
      const alpha = Math.min(0.45, Math.abs(totalWarmth) / 130);
      tctx.fillStyle = totalWarmth > 0 ? `rgba(255, 145, 40, ${alpha})` : `rgba(56, 189, 248, ${alpha})`;
      tctx.fillRect(0, 0, W, H);
      tctx.restore();
    }

    if (st.adjustments.fade > 0) {
      tctx.save();
      tctx.globalCompositeOperation = 'lighten';
      const fadeVal = Math.round((st.adjustments.fade / 100) * 48);
      tctx.fillStyle = `rgb(${fadeVal}, ${fadeVal}, ${fadeVal + 4})`;
      tctx.fillRect(0, 0, W, H);
      tctx.restore();
    }

    drawArtisticFX(tctx, W, H, st.activeFX);

    if (st.adjustments.vignette > 0) {
      tctx.save();
      const vigAlpha = (st.adjustments.vignette / 100) * 0.75;
      const rad = Math.max(W, H) * 0.72;
      const grad = tctx.createRadialGradient(W / 2, H / 2, rad * 0.35, W / 2, H / 2, rad);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${vigAlpha})`);
      tctx.fillStyle = grad;
      tctx.fillRect(0, 0, W, H);
      tctx.restore();
    }

    if (st.adjustments.grain > 0) {
      tctx.save();
      tctx.globalCompositeOperation = 'overlay';
      tctx.globalAlpha = (st.adjustments.grain / 100) * 0.32;
      const pattern = tctx.createPattern(grainCanvas, 'repeat');
      tctx.fillStyle = pattern;
      tctx.fillRect(0, 0, W, H);
      tctx.restore();
    }

    drawFramesAndStamps(tctx, W, H, st);
    tctx.restore();
  }

  function drawArtisticFX(tctx, W, H, fxId) {
    if (fxId === 'none') return;
    tctx.save();
    if (fxId === 'ring_light') {
      tctx.globalCompositeOperation = 'soft-light';
      const rad = Math.min(W, H) * 0.58;
      const g = tctx.createRadialGradient(W * 0.5, H * 0.42, rad * 0.15, W * 0.5, H * 0.42, rad);
      g.addColorStop(0, 'rgba(255, 248, 244, 0.50)');
      g.addColorStop(0.65, 'rgba(255, 218, 230, 0.25)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
      tctx.fillStyle = g;
      tctx.fillRect(0, 0, W, H);
    } else if (fxId === 'peach_aura') {
      tctx.globalCompositeOperation = 'soft-light';
      const g = tctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, 'rgba(255, 160, 122, 0.48)');
      g.addColorStop(0.5, 'rgba(255, 195, 160, 0.32)');
      g.addColorStop(1, 'rgba(251, 113, 133, 0.42)');
      tctx.fillStyle = g;
      tctx.fillRect(0, 0, W, H);
    } else if (fxId === 'red_burn') {
      tctx.globalCompositeOperation = 'screen';
      const g1 = tctx.createLinearGradient(0, 0, W * 0.55, H * 0.7);
      g1.addColorStop(0, 'rgba(239, 68, 68, 0.68)');
      g1.addColorStop(0.4, 'rgba(244, 63, 94, 0.35)');
      g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      tctx.fillStyle = g1;
      tctx.fillRect(0, 0, W, H);
    } else if (fxId === 'diamond_glow') {
      tctx.globalCompositeOperation = 'screen';
      const stars = [
        { x: 0.28, y: 0.26, size: 0.045 }, { x: 0.72, y: 0.30, size: 0.055 },
        { x: 0.64, y: 0.62, size: 0.040 }, { x: 0.35, y: 0.68, size: 0.050 },
        { x: 0.52, y: 0.20, size: 0.035 }
      ];
      stars.forEach(s => {
        const cx = W * s.x, cy = H * s.y;
        const len = Math.min(W, H) * s.size;
        const glow = tctx.createRadialGradient(cx, cy, 1, cx, cy, len);
        glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        glow.addColorStop(0.3, 'rgba(253, 224, 71, 0.45)');
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        tctx.fillStyle = glow;
        tctx.beginPath(); tctx.arc(cx, cy, len, 0, Math.PI * 2); tctx.fill();
        tctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        tctx.lineWidth = Math.max(1.5, len * 0.08);
        tctx.beginPath();
        tctx.moveTo(cx - len, cy); tctx.lineTo(cx + len, cy);
        tctx.moveTo(cx, cy - len); tctx.lineTo(cx, cy + len);
        tctx.stroke();
      });
    } else if (fxId === 'leak_warm') {
      tctx.globalCompositeOperation = 'screen';
      const g1 = tctx.createLinearGradient(0, 0, W * 0.65, H * 0.5);
      g1.addColorStop(0, 'rgba(255, 85, 0, 0.62)');
      g1.addColorStop(0.45, 'rgba(255, 180, 40, 0.28)');
      g1.addColorStop(1, 'rgba(255, 0, 128, 0)');
      tctx.fillStyle = g1;
      tctx.fillRect(0, 0, W, H);
    } else if (fxId === 'neon_prism') {
      tctx.globalCompositeOperation = 'overlay';
      const g = tctx.createLinearGradient(0, H, W, 0);
      g.addColorStop(0, 'rgba(6, 182, 212, 0.55)');
      g.addColorStop(0.5, 'rgba(168, 85, 247, 0.35)');
      g.addColorStop(1, 'rgba(244, 63, 94, 0.55)');
      tctx.fillStyle = g;
      tctx.fillRect(0, 0, W, H);
    } else if (fxId === 'bokeh_dust') {
      tctx.globalCompositeOperation = 'screen';
      const orbs = [
        { x: 0.2, y: 0.25, r: 0.09, c: 'rgba(244, 114, 182, 0.28)' },
        { x: 0.78, y: 0.22, r: 0.12, c: 'rgba(167, 139, 250, 0.25)' },
        { x: 0.65, y: 0.72, r: 0.14, c: 'rgba(251, 191, 36, 0.22)' },
        { x: 0.25, y: 0.78, r: 0.08, c: 'rgba(56, 189, 248, 0.24)' }
      ];
      orbs.forEach(o => {
        const rad = Math.min(W, H) * o.r;
        const grad = tctx.createRadialGradient(W * o.x, H * o.y, rad * 0.1, W * o.x, H * o.y, rad);
        grad.addColorStop(0, o.c);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        tctx.fillStyle = grad;
        tctx.beginPath(); tctx.arc(W * o.x, H * o.y, rad, 0, Math.PI * 2); tctx.fill();
      });
    } else if (fxId === 'sunbeams') {
      tctx.globalCompositeOperation = 'screen';
      const g = tctx.createRadialGradient(W * 0.9, H * 0.1, 10, W * 0.9, H * 0.1, Math.max(W, H) * 0.9);
      g.addColorStop(0, 'rgba(255, 235, 160, 0.65)');
      g.addColorStop(0.4, 'rgba(251, 146, 60, 0.25)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      tctx.fillStyle = g;
      tctx.fillRect(0, 0, W, H);
    } else if (fxId === 'halation') {
      tctx.globalCompositeOperation = 'screen';
      const g = tctx.createRadialGradient(W * 0.5, H * 0.4, Math.min(W, H) * 0.1, W * 0.5, H * 0.4, Math.max(W, H) * 0.65);
      g.addColorStop(0, 'rgba(255, 70, 50, 0.28)');
      g.addColorStop(0.5, 'rgba(255, 120, 40, 0.14)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      tctx.fillStyle = g;
      tctx.fillRect(0, 0, W, H);
    }
    tctx.restore();
  }

  function drawFramesAndStamps(tctx, W, H, st) {
    tctx.save();
    if (st.stampMode === 'date98') {
      const fontSize = Math.max(18, Math.round(W * 0.038));
      tctx.font = `700 ${fontSize}px "Space Mono", monospace`;
      tctx.fillStyle = '#ff7b24';
      tctx.shadowColor = 'rgba(255, 90, 0, 0.85)';
      tctx.shadowBlur = 8;
      tctx.textAlign = 'right';
      tctx.fillText("'98 10 24", W - W * 0.06, H - H * 0.05);
    } else if (st.stampMode === 'polaroid') {
      const border = Math.round(Math.min(W, H) * 0.045);
      const bottomBorder = Math.round(H * 0.14);
      tctx.fillStyle = '#fafafa';
      tctx.fillRect(0, 0, W, border);
      tctx.fillRect(0, 0, border, H);
      tctx.fillRect(W - border, 0, border, H);
      tctx.fillRect(0, H - bottomBorder, W, bottomBorder);
      if (st.caption) {
        const fontSize = Math.max(18, Math.round(W * 0.04));
        tctx.font = `600 ${fontSize}px "Inter", sans-serif`;
        tctx.fillStyle = '#18181b';
        tctx.textAlign = 'center';
        tctx.fillText(st.caption, W / 2, H - bottomBorder * 0.42);
      }
    } else if (st.stampMode === 'cinema') {
      const barH = Math.round(H * 0.11);
      tctx.fillStyle = '#000000';
      tctx.fillRect(0, 0, W, barH);
      tctx.fillRect(0, H - barH, W, barH);
      if (st.caption) {
        const fontSize = Math.max(15, Math.round(W * 0.032));
        tctx.font = `500 italic ${fontSize}px "Inter", sans-serif`;
        tctx.fillStyle = '#facc15';
        tctx.shadowColor = 'rgba(0,0,0,0.9)';
        tctx.shadowBlur = 4;
        tctx.textAlign = 'center';
        tctx.fillText(`"${st.caption}"`, W / 2, H - barH - Math.round(H * 0.03));
      }
    } else if (st.caption) {
      const fontSize = Math.max(16, Math.round(W * 0.036));
      tctx.font = `600 ${fontSize}px "Inter", sans-serif`;
      tctx.fillStyle = '#ffffff';
      tctx.shadowColor = 'rgba(0,0,0,0.85)';
      tctx.shadowBlur = 6;
      tctx.textAlign = 'center';
      tctx.fillText(st.caption, W / 2, H - Math.round(H * 0.05));
    }
    tctx.restore();
  }

  // Preview entry point (synchronous; sliders should use requestPreviewRender).
  function renderStudioCanvas() {
    if (!isImageReady(sourceImage)) return;
    if (!mainCanvas.width || !mainCanvas.height) return;
    renderImage(ctx, mainCanvas.width, mainCanvas.height, sourceImage, state, currentFaceSnapshot());
    stats.previewW = mainCanvas.width;
    stats.previewH = mainCanvas.height;
    stats.renders += 1;
    updateCorrectionIndicator();
    refreshFaceOverlay(); // debug overlay mirrors the preview; never touches pixels
    refreshSkinOverlay();
  }

  // --- Correction indicator (1.1): Original preset keeps independent settings
  function updateCorrectionIndicator() {
    const note = document.getElementById('correctionNote');
    const nameEl = document.getElementById('activeFilterName');
    if (!note || !nameEl) return;
    const n = getActiveCorrectionCount(state);
    if (state.activePreset === 'normal' && n > 0) {
      note.classList.remove('hidden');
      note.textContent = `Original-пресет · активны коррекции (${n}) — «Сброс» покажет исходник`;
    } else if (n > 0 && state.activePreset !== 'normal') {
      note.classList.remove('hidden');
      note.textContent = `Активны коррекции (${n}) поверх пресета`;
      note.style.color = '#a1a1aa';
    } else {
      note.classList.add('hidden');
      note.textContent = '';
    }
  }

  // --- Photo loading (1.2) ---------------------------------------------------
  function decodeImage(src, token) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (token !== loadState.token) { reject(new Error('superseded')); return; }
        if (!img.naturalWidth || !img.naturalHeight) { reject(new Error('decode-failed')); return; }
        resolve(img);
      };
      img.onerror = () => reject(new Error('decode-failed'));
      img.src = src;
    });
  }

  async function adoptImage(img, token, label) {
    if (token !== loadState.token) return; // race: newer request already started
    const dims = getPreviewDimensions(img.naturalWidth, img.naturalHeight);
    sourceImage = img;
    imageReady = true;
    mainCanvas.width = dims.w;
    mainCanvas.height = dims.h;
    setLoadStatus('ready');
    renderStudioCanvas();
    renderFilterThumbnails();
    // G1a: photo is already painted — now schedule one-shot face detection.
    // G1b (1.3): a NEW photo drops the previous photo's geometry at once,
    // so it can never be retouched with stale landmarks (R12).
    faceImageId += 1;
    if (faceEngine) {
      try { faceEngine.newPhoto(faceImageId); } catch (e) { /* noop */ }
    }
    syncFaceOverlaySize();
    scheduleFaceDetection(img, faceImageId);
    if (label) showToast(label);
  }

  function failLoad(token, message) {
    if (token !== loadState.token) return;
    imageReady = false;
    setLoadStatus('error', message);
  }

  function loadSampleImage(url) {
    const token = ++loadState.token;
    imageReady = false;
    setLoadStatus('loading');
    decodeImage(url, token).then(
      img => adoptImage(img, token, ''),
      err => {
        if (err && err.message === 'superseded') return;
        // Honest empty state (1.2): no decorative gradient masquerading as a photo.
        failLoad(token, 'Демо-фото недоступно (сеть/CORS). Нажмите «Фото» и загрузите своё изображение.');
      }
    );
  }

  function loadFileImage(file) {
    const check = validateImageFile(file);
    if (!check.ok) {
      const messages = {
        'unsupported-type': 'Неподдерживаемый тип файла. Выберите JPG, PNG, WEBP, GIF или BMP.',
        'too-large': `Файл слишком большой (лимит ${Math.round(MAX_FILE_SIZE / 1048576)} МБ). Выберите файл меньше.`,
        'empty': 'Пустой файл. Выберите другое изображение.'
      };
      setLoadStatus(loadState.status === 'ready' ? loadState.status : 'error', messages[check.reason] || 'Не удалось загрузить изображение.');
      // If we already have a photo, keep it and just toast the error.
      showToast(messages[check.reason] || 'Не удалось загрузить изображение.');
      if (!imageReady) failLoad(++loadState.token, messages[check.reason] || 'Не удалось загрузить изображение.');
      return;
    }
    const token = ++loadState.token;
    imageReady = false;
    setLoadStatus('loading');
    const objectUrl = URL.createObjectURL(file);
    decodeImage(objectUrl, token).then(
      img => { URL.revokeObjectURL(objectUrl); adoptImage(img, token, 'Ваше фото загружено'); },
      err => {
        URL.revokeObjectURL(objectUrl);
        if (err && err.message === 'superseded') return;
        failLoad(token, 'Файл повреждён или не декодируется. Выберите другое изображение.');
        showToast('Файл повреждён или не декодируется.');
      }
    );
  }

  // --- Thumbnails (guarded: never draw an unloaded Image) --------------------
  function renderFilterThumbnails() {
    if (!isImageReady(sourceImage)) return;
    const thumbs = document.querySelectorAll('canvas[data-thumb]');
    thumbs.forEach(tc => {
      try {
        const presetId = tc.getAttribute('data-thumb');
        const preset = PRESETS.find(p => p.id === presetId) || PRESETS[0];
        const tCtx = tc.getContext('2d');
        const size = 64;
        tCtx.clearRect(0, 0, size, size);
        const bright = 100 + preset.config.brightness;
        const cont = 100 + preset.config.contrast;
        const sat = 100 + preset.config.saturate;
        const sep = Math.max(0, preset.config.sepia);
        const hue = preset.config.hue;
        tCtx.filter = `brightness(${bright}%) contrast(${cont}%) saturate(${sat}%) sepia(${sep}%) hue-rotate(${hue}deg)`;
        const nw = sourceImage.naturalWidth, nh = sourceImage.naturalHeight;
        const sMin = Math.min(nw, nh);
        const sx = (nw - sMin) / 2, sy = (nh - sMin) / 2;
        tCtx.drawImage(sourceImage, sx, sy, sMin, sMin, 0, 0, size, size);
        tCtx.filter = 'none';
        if (preset.config.tint) {
          tCtx.globalCompositeOperation = 'soft-light';
          tCtx.fillStyle = preset.config.tint;
          tCtx.fillRect(0, 0, size, size);
          tCtx.globalCompositeOperation = 'source-over';
        }
      } catch (e) { /* thumbnail failure must never break the editor */ }
    });
  }

  // --- Carousels --------------------------------------------------------------
  function buildFilterCarousel() {
    const container = document.getElementById('tab-filters');
    if (!container) return;
    container.innerHTML = '';
    PRESETS.forEach(p => {
      const active = state.activePreset === p.id;
      const btn = document.createElement('button');
      btn.className = 'flex flex-col items-center shrink-0 group transition transform active:scale-95';
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.innerHTML =
        `<div class="relative w-14 h-14 rounded-2xl overflow-hidden border-2 transition ${active ? 'border-pink-500 shadow-lg shadow-pink-500/30 scale-105' : 'border-white/10 opacity-80 group-hover:opacity-100'}">` +
        `<canvas data-thumb="${p.id}" width="64" height="64" class="w-full h-full object-cover block bg-zinc-900"></canvas>` +
        `<span class="absolute bottom-0.5 right-0.5 px-1 py-0.2 text-[7px] font-bold uppercase rounded bg-black/75 text-white">${p.badge}</span></div>` +
        `<span class="text-[10px] mt-1 font-medium ${active ? 'text-pink-400 font-semibold' : 'text-zinc-400'}">${p.name}</span>`;
      btn.addEventListener('click', () => {
        triggerHaptic('light');
        state.activePreset = p.id;
        document.getElementById('activeFilterName').textContent = p.name;
        if (p.id === 'normal') {
          const n = getActiveCorrectionCount(state);
          if (n > 0) showToast(`Original: цвет нейтрален, коррекции (${n}) продолжают действовать`);
        }
        buildFilterCarousel();
        renderFilterThumbnails();
        updateSliderUI();
        requestPreviewRender();
        updateCorrectionIndicator();
      });
      container.appendChild(btn);
    });
  }

  function buildBeautyCarousel() {
    const container = document.getElementById('tab-beauty');
    if (!container) return;
    container.innerHTML = '';
    BEAUTY_TOOLS.forEach(tool => {
      const active = state.activeBeautyKey === tool.key;
      const val = state.beauty[tool.key];
      const isModified = val > 0;
      const btn = document.createElement('button');
      btn.className = `flex flex-col items-center justify-center shrink-0 w-24 py-1.5 rounded-2xl border transition active:scale-95 ${active ? 'bg-pink-500/20 border-pink-500 text-white shadow-lg shadow-pink-500/15' : 'bg-white/5 border-white/10 text-zinc-400'}`;
      btn.innerHTML =
        `<div class="relative"><i class="ph-fill ${tool.icon} text-lg ${active ? 'text-pink-400' : ''}"></i>` +
        `${isModified ? '<span class="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full bg-pink-500"></span>' : ''}</div>` +
        `<span class="text-[10px] font-medium mt-0.5 text-center px-1 truncate w-full">${tool.name}</span>` +
        `<span class="text-[10px] font-bold ${isModified ? 'text-pink-400' : 'text-zinc-500'}">${val}${tool.unit}</span>`;
      btn.addEventListener('click', () => {
        triggerHaptic('light');
        state.activeBeautyKey = tool.key;
        updateSliderUI();
        buildBeautyCarousel();
      });
      container.appendChild(btn);
    });
  }

  function buildFXCarousel() {
    const container = document.getElementById('tab-fx');
    if (!container) return;
    container.innerHTML = '';
    FX_LIST.forEach(fx => {
      const active = state.activeFX === fx.id;
      const btn = document.createElement('button');
      btn.className = `flex flex-col items-center justify-center shrink-0 w-24 py-2 rounded-2xl border transition active:scale-95 ${active ? 'bg-violet-500/20 border-violet-500 text-white shadow-lg shadow-violet-500/15' : 'bg-white/5 border-white/10 text-zinc-400'}`;
      btn.innerHTML = `<i class="ph-fill ${fx.icon} text-xl"></i><span class="text-[10px] font-medium mt-1 text-center px-1 truncate w-full">${fx.name}</span>`;
      btn.addEventListener('click', () => {
        triggerHaptic('light');
        state.activeFX = fx.id;
        buildFXCarousel();
        requestPreviewRender();
        updateCorrectionIndicator();
      });
      container.appendChild(btn);
    });
  }

  function buildAdjustCarousel() {
    const container = document.getElementById('tab-adjust');
    if (!container) return;
    container.innerHTML = '';
    ADJUSTMENTS.forEach(adj => {
      const active = state.activeAdjustKey === adj.key;
      const val = state.adjustments[adj.key];
      const isModified = val !== adj.default;
      const btn = document.createElement('button');
      btn.className = `flex flex-col items-center justify-center shrink-0 w-20 py-1.5 rounded-2xl border transition active:scale-95 ${active ? 'bg-violet-500/20 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-zinc-400'}`;
      btn.innerHTML =
        `<div class="relative"><i class="ph ${adj.icon} text-lg ${active ? 'text-violet-300' : 'text-zinc-400'}"></i>` +
        `${isModified ? '<span class="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full bg-violet-400"></span>' : ''}</div>` +
        `<span class="text-[10px] font-medium mt-0.5 truncate w-full px-1 text-center">${adj.name}</span>` +
        `<span class="text-[9px] font-mono ${isModified ? 'text-violet-300 font-bold' : 'text-zinc-500'}">${val}${adj.unit}</span>`;
      btn.addEventListener('click', () => {
        triggerHaptic('light');
        state.activeAdjustKey = adj.key;
        updateSliderUI();
        buildAdjustCarousel();
      });
      container.appendChild(btn);
    });
  }

  // --- Slider & tabs -----------------------------------------------------------
  const sliderContainer = document.getElementById('sliderContainer');
  const sliderLabel = document.getElementById('sliderLabel');
  const mainSlider = document.getElementById('mainSlider');
  const sliderValue = document.getElementById('sliderValue');

  function updateSliderUI() {
    if (!sliderContainer) return;
    if (state.currentTab === 'filters') {
      sliderContainer.classList.remove('hidden');
      sliderLabel.textContent = 'Сила фильтра';
      mainSlider.min = 0; mainSlider.max = 100;
      mainSlider.value = state.presetIntensity;
      sliderValue.textContent = `${state.presetIntensity}%`;
    } else if (state.currentTab === 'beauty') {
      sliderContainer.classList.remove('hidden');
      const tool = BEAUTY_TOOLS.find(t => t.key === state.activeBeautyKey);
      if (tool) {
        sliderLabel.textContent = tool.name;
        mainSlider.min = tool.min; mainSlider.max = tool.max;
        mainSlider.value = state.beauty[tool.key];
        sliderValue.textContent = `${state.beauty[tool.key]}${tool.unit}`;
      }
    } else if (state.currentTab === 'adjust') {
      sliderContainer.classList.remove('hidden');
      const adj = ADJUSTMENTS.find(a => a.key === state.activeAdjustKey);
      if (adj) {
        sliderLabel.textContent = adj.name;
        mainSlider.min = adj.min; mainSlider.max = adj.max;
        mainSlider.value = state.adjustments[adj.key];
        sliderValue.textContent = `${state.adjustments[adj.key]}${adj.unit}`;
      }
    } else {
      sliderContainer.classList.add('hidden');
    }
  }

  if (mainSlider) {
    mainSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      if (state.currentTab === 'filters') {
        state.presetIntensity = val;
        sliderValue.textContent = `${val}%`;
      } else if (state.currentTab === 'beauty') {
        const tool = BEAUTY_TOOLS.find(t => t.key === state.activeBeautyKey);
        state.beauty[state.activeBeautyKey] = val;
        sliderValue.textContent = `${val}${tool ? tool.unit : '%'}`;
        buildBeautyCarousel();
      } else if (state.currentTab === 'adjust') {
        const adj = ADJUSTMENTS.find(a => a.key === state.activeAdjustKey);
        state.adjustments[state.activeAdjustKey] = val;
        sliderValue.textContent = `${val}${adj ? adj.unit : ''}`;
        buildAdjustCarousel();
      }
      requestPreviewRender(); // rAF-coalesced (Phase 2)
      updateCorrectionIndicator();
    });
  }

  document.querySelectorAll('.nav-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      triggerHaptic('light');
      const target = tabBtn.getAttribute('data-tab');
      state.currentTab = target;
      document.querySelectorAll('.nav-tab').forEach(b => {
        b.classList.remove('text-violet-400', 'font-semibold');
        b.classList.add('text-zinc-400');
      });
      tabBtn.classList.add('text-violet-400', 'font-semibold');
      tabBtn.classList.remove('text-zinc-400');
      ['filters', 'beauty', 'fx', 'adjust', 'extras'].forEach(id => {
        const el = document.getElementById(`tab-${id}`);
        if (!el) return;
        if (id === target) { el.classList.remove('hidden'); el.classList.add('flex'); }
        else { el.classList.add('hidden'); el.classList.remove('flex'); }
      });
      updateSliderUI();
    });
  });

  document.querySelectorAll('.stamp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      triggerHaptic('light');
      state.stampMode = btn.getAttribute('data-stamp');
      document.querySelectorAll('.stamp-btn').forEach(b => {
        b.className = 'stamp-btn px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-zinc-300 shrink-0';
        b.setAttribute('aria-pressed', 'false');
      });
      btn.className = 'stamp-btn px-3 py-2 rounded-xl border border-violet-500 bg-violet-500/20 text-xs font-medium text-white shrink-0';
      btn.setAttribute('aria-pressed', 'true');
      requestPreviewRender();
      updateCorrectionIndicator();
    });
  });

  const captionInput = document.getElementById('customCaption');
  if (captionInput) {
    captionInput.addEventListener('input', (e) => {
      state.caption = e.target.value;
      requestPreviewRender();
      updateCorrectionIndicator();
    });
  }

  // --- Local pixel & skin-tone analyzer (rule-based presets, NOT a neural net)
  function analyzeImagePixels(imgElement) {
    const sampleCanvas = document.createElement('canvas');
    const size = 64;
    sampleCanvas.width = size; sampleCanvas.height = size;
    const sCtx = sampleCanvas.getContext('2d');
    sCtx.drawImage(imgElement, 0, 0, size, size);
    const data = sCtx.getImageData(0, 0, size, size).data;
    let totalLuma = 0;
    const lumaValues = [];
    let totalSat = 0, warmDiff = 0, skinTonePixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      totalLuma += luma;
      lumaValues.push(luma);
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      totalSat += max === 0 ? 0 : ((max - min) / max) * 100;
      warmDiff += (r - b);
      if (r > 95 && g > 40 && b > 20 && r > g && r > b && (max - min) > 15 && Math.abs(r - g) > 12) skinTonePixels++;
    }
    const pixelCount = data.length / 4;
    const avgLuma = totalLuma / pixelCount;
    let variance = 0;
    for (let i = 0; i < lumaValues.length; i++) variance += Math.pow(lumaValues[i] - avgLuma, 2);
    return {
      luma: Math.round((avgLuma / 255) * 100),
      contrast: Math.round(Math.sqrt(variance / pixelCount)),
      saturation: Math.round(totalSat / pixelCount),
      warmth: Math.round(warmDiff / pixelCount),
      skinRatio: Math.round((skinTonePixels / pixelCount) * 100)
    };
  }

  let autoVariantCounter = 0;
  const btnMagicAI = document.getElementById('btnMagicAI');
  if (btnMagicAI) {
    btnMagicAI.addEventListener('click', () => {
      triggerHaptic('heavy');
      if (!isImageReady(sourceImage)) { showToast('Сначала загрузите фото.'); return; }
      const statsPx = analyzeImagePixels(sourceImage);
      autoVariantCounter = (autoVariantCounter + 1) % 3;
      let sceneLabel = '';
      let chosenPreset = 'cleangirl';
      let chosenFX = 'none';
      let autoBright = 0;
      if (statsPx.luma < 38) autoBright = Math.min(28, Math.round((46 - statsPx.luma) * 0.9));
      else if (statsPx.luma > 74) autoBright = -Math.min(20, Math.round((statsPx.luma - 70) * 0.7));
      let autoContrast = 0;
      if (statsPx.contrast < 42) autoContrast = Math.min(25, Math.round((48 - statsPx.contrast) * 0.8));
      else if (statsPx.contrast > 72) autoContrast = -10;
      let autoSat = 0;
      if (statsPx.saturation < 28) autoSat = 16;
      else if (statsPx.saturation > 68) autoSat = -12;
      let autoWarmth = 0;
      if (statsPx.warmth < -15) autoWarmth = 14;
      else if (statsPx.warmth > 35) autoWarmth = -10;

      if (statsPx.skinRatio >= 18) {
        sceneLabel = `Рекламный портрет • Кожа ${statsPx.skinRatio}%`;
        const pool = [
          { preset: 'vogue', fx: 'ring_light', smooth: 28, glow: 45, antired: 22, blush: 15, sculpt: 34, eyes: 52 },
          { preset: 'champagne', fx: 'diamond_glow', smooth: 32, glow: 50, antired: 25, blush: 18, sculpt: 30, eyes: 48 },
          { preset: 'studioflash', fx: 'ring_light', smooth: 25, glow: 42, antired: 20, blush: 10, sculpt: 38, eyes: 55 }
        ];
        const pick = pool[autoVariantCounter % pool.length];
        chosenPreset = pick.preset; chosenFX = pick.fx;
        state.beauty = { smooth: pick.smooth, glow: pick.glow, antired: pick.antired, blush: pick.blush, sculpt: pick.sculpt, eyes: pick.eyes };
        autoContrast = Math.max(8, autoContrast);
      } else if (statsPx.luma < 36) {
        sceneLabel = 'Ночной кадр • Low-Light';
        const pool = [
          { preset: 'tokyo', fx: 'neon_prism' },
          { preset: 'cyberpunk', fx: 'vhs_glitch' },
          { preset: 'cinematic', fx: 'bokeh_dust' }
        ];
        const pick = pool[autoVariantCounter % pool.length];
        chosenPreset = pick.preset; chosenFX = pick.fx;
      } else if (statsPx.warmth > 22) {
        sceneLabel = 'Тёплый свет • Golden Hour';
        const pool = [
          { preset: 'goldentan', fx: 'leak_warm' },
          { preset: 'kodak98', fx: 'sunbeams' },
          { preset: 'velvet', fx: 'bokeh_dust' }
        ];
        const pick = pool[autoVariantCounter % pool.length];
        chosenPreset = pick.preset; chosenFX = pick.fx;
      } else {
        sceneLabel = 'Дневной кадр • Balanced';
        const pool = [
          { preset: 'cleangirl', fx: 'ring_light' },
          { preset: 'cinematic', fx: 'leak_warm' },
          { preset: 'dreamy', fx: 'bokeh_dust' }
        ];
        const pick = pool[autoVariantCounter % pool.length];
        chosenPreset = pick.preset; chosenFX = pick.fx;
      }

      state.activePreset = chosenPreset;
      state.presetIntensity = 88;
      state.activeFX = chosenFX;
      state.adjustments.brightness = autoBright;
      state.adjustments.contrast = autoContrast;
      state.adjustments.saturate = autoSat;
      state.adjustments.warmth = autoWarmth;
      state.adjustments.vignette = statsPx.skinRatio >= 18 ? 10 : 18;
      state.adjustments.grain = statsPx.skinRatio >= 18 ? 0 : (statsPx.luma < 40 ? 15 : 6);
      state.adjustments.fade = statsPx.contrast > 65 ? 12 : 0;

      const presetObj = PRESETS.find(p => p.id === chosenPreset);
      document.getElementById('activeFilterName').textContent = `${presetObj.name} • Авто`;
      const hud = document.getElementById('autoHudBadge');
      document.getElementById('autoSceneType').textContent = sceneLabel;
      document.getElementById('autoMetricsText').textContent = `Свет: ${statsPx.luma}% | Ретушь: ${state.beauty.smooth}% | Тон: ${autoBright >= 0 ? '+' + autoBright : autoBright}`;
      hud.classList.remove('opacity-0');
      hud.classList.add('opacity-100');
      clearTimeout(window.autoHudTimer);
      window.autoHudTimer = setTimeout(() => {
        hud.classList.remove('opacity-100');
        hud.classList.add('opacity-0');
      }, 4500);

      buildFilterCarousel();
      renderFilterThumbnails();
      buildBeautyCarousel();
      buildFXCarousel();
      buildAdjustCarousel();
      updateSliderUI();
      requestPreviewRender();
      updateCorrectionIndicator();
      showToast(`Автостиль: ${sceneLabel} → ${presetObj.name}`);
    });
  }

  // --- Before/After via Pointer Events (1.6) ----------------------------------
  const btnCompare = document.getElementById('btnCompare');
  const compareBadge = document.getElementById('compareBadge');

  function startCompare(e) {
    if (e && e.cancelable) { try { e.preventDefault(); } catch (err) { /* noop */ } }
    triggerHaptic('light');
    state.isComparing = true;
    if (compareBadge) compareBadge.classList.remove('hidden');
    renderStudioCanvas(); // immediate: hold feedback must be instant
  }
  function endCompare() {
    if (!state.isComparing) return; // idempotent: always lands back on edited image
    state.isComparing = false;
    if (compareBadge) compareBadge.classList.add('hidden');
    renderStudioCanvas();
  }

  if (btnCompare) {
    btnCompare.addEventListener('pointerdown', (e) => {
      try { btnCompare.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      startCompare(e);
    });
    btnCompare.addEventListener('pointerup', endCompare);
    btnCompare.addEventListener('pointercancel', endCompare);
    btnCompare.addEventListener('lostpointercapture', endCompare);
    btnCompare.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // Release anywhere (including outside the button) always restores the edit.
  window.addEventListener('pointerup', endCompare);
  window.addEventListener('pointercancel', endCompare);
  window.addEventListener('blur', endCompare);
  document.addEventListener('visibilitychange', () => { if (document.hidden) endCompare(); });

  // --- Upload / demo / reset ---------------------------------------------------
  const btnDemoPhoto = document.getElementById('btnDemoPhoto');
  if (btnDemoPhoto) {
    btnDemoPhoto.addEventListener('click', () => {
      triggerHaptic('light');
      state.demoIndex = (state.demoIndex + 1) % DEMO_PHOTOS.length;
      loadSampleImage(DEMO_PHOTOS[state.demoIndex]);
      showToast(`Демо-портрет #${state.demoIndex + 1}`);
    });
  }

  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ''; // allow re-selecting the same file
      if (!file) return;
      loadFileImage(file);
    });
  }

  function resetAll() {
    const neutral = createNeutralState();
    neutral.demoIndex = state.demoIndex;
    neutral.currentTab = state.currentTab;
    Object.assign(state, neutral);
    state.isComparing = false;
    if (compareBadge) compareBadge.classList.add('hidden');
    const captionEl = document.getElementById('customCaption');
    if (captionEl) captionEl.value = '';
    const nameEl = document.getElementById('activeFilterName');
    if (nameEl) nameEl.textContent = 'Original';
    document.querySelectorAll('.stamp-btn').forEach(b => {
      const isNone = b.getAttribute('data-stamp') === 'none';
      b.className = isNone
        ? 'stamp-btn px-3 py-2 rounded-xl border border-violet-500 bg-violet-500/20 text-xs font-medium text-white shrink-0'
        : 'stamp-btn px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-zinc-300 shrink-0';
      b.setAttribute('aria-pressed', isNone ? 'true' : 'false');
    });
    buildFilterCarousel();
    renderFilterThumbnails();
    buildBeautyCarousel();
    buildFXCarousel();
    buildAdjustCarousel();
    updateSliderUI();
    renderStudioCanvas(); // full reset must paint the true original (T6)
    updateCorrectionIndicator();
    resetFaceState(); // F10: clear detection geometry; model stays cached (F8)
  }

  const btnReset = document.getElementById('btnReset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      triggerHaptic('medium');
      resetAll();
      showToast('Настройки сброшены — показан исходник');
    });
  }

  // --- Honest export (1.3 + 1.4): local PNG via Blob, optional Web Share ------
  const exportModal = document.getElementById('exportModal');
  const exportPreviewImg = document.getElementById('exportPreviewImg');
  const exportMeta = document.getElementById('exportMeta');
  let currentExportUrl = null; // Blob URL hygiene: revoked on every new export
  let currentExportBlob = null;

  function revokeExportUrl() {
    if (currentExportUrl) {
      try { URL.revokeObjectURL(currentExportUrl); } catch (e) { /* noop */ }
      currentExportUrl = null;
    }
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('toBlob-empty'));
        }, 'image/png');
      } catch (e) {
        reject(e);
      }
    });
  }

  function canSystemShare() {
    try {
      if (!('share' in navigator) || !currentExportBlob) return false;
      const file = new File([currentExportBlob], 'auragram.png', { type: 'image/png' });
      if (navigator.canShare) return navigator.canShare({ files: [file] });
      return true;
    } catch (e) {
      return false;
    }
  }

  function refreshShareButton() {
    const btnShare = document.getElementById('btnShareImage');
    if (!btnShare) return;
    btnShare.disabled = !canSystemShare();
    btnShare.classList.toggle('opacity-40', btnShare.disabled);
  }

  async function openExportModal() {
    triggerHaptic('medium');
    if (!isImageReady(sourceImage)) {
      showToast('Сначала загрузите фото — экспортировать нечего.');
      return;
    }
    endCompare();
    renderStudioCanvas();
    const dims = getExportDimensions(sourceImage.naturalWidth, sourceImage.naturalHeight);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = dims.w;
    exportCanvas.height = dims.h;
    const ectx = exportCanvas.getContext('2d');
    const frozen = Object.assign({}, state, {
      beauty: Object.assign({}, state.beauty),
      adjustments: Object.assign({}, state.adjustments),
      isComparing: false
    });
    const t0 = performance.now();
    try {
      renderImage(ectx, dims.w, dims.h, sourceImage, frozen, currentFaceSnapshot());
    } catch (e) {
      showToast('Экспорт не удался: недостаточно памяти. Попробуйте фото меньшего размера.');
      return;
    }
    stats.lastExportMs = performance.now() - t0;
    stats.exportW = dims.w;
    stats.exportH = dims.h;
    let blob;
    try {
      blob = await canvasToBlob(exportCanvas);
    } catch (e) {
      showToast('Экспорт не удался при кодировании PNG.');
      return;
    }
    revokeExportUrl();
    currentExportBlob = blob;
    currentExportUrl = URL.createObjectURL(blob);
    if (exportPreviewImg) exportPreviewImg.src = currentExportUrl;
    if (exportMeta) {
      const kd = (exportCanvas.width * exportCanvas.height / 1e6).toFixed(1);
      exportMeta.textContent =
        `Превью ${mainCanvas.width}×${mainCanvas.height} • Экспорт ${dims.w}×${dims.h} (${kd} Мп)` +
        (dims.capped ? ' • уменьшен для экономии памяти' : '') +
        ` • рендер ${stats.lastExportMs.toFixed(0)} мс. ` +
        `Качество ограничено текущими алгоритмами — это не побитовый оригинал.`;
    }
    if (dims.capped) showToast(`Экспорт уменьшен до ${dims.w}×${dims.h} для экономии памяти.`);
    refreshShareButton();
    if (exportModal) {
      exportModal.classList.remove('hidden');
      exportModal.classList.add('flex');
    }
  }

  const btnExport = document.getElementById('btnExport');
  if (btnExport) btnExport.addEventListener('click', openExportModal);

  const btnCloseModal = document.getElementById('btnCloseModal');
  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      if (exportModal) {
        exportModal.classList.add('hidden');
        exportModal.classList.remove('flex');
      }
    });
  }

  const btnDownload = document.getElementById('btnDownloadImage');
  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      triggerHaptic('heavy');
      if (!currentExportUrl) { showToast('Сначала нажмите «Готово».'); return; }
      const link = document.createElement('a');
      link.download = `auragram-${state.activePreset}-${Date.now()}.png`;
      link.href = currentExportUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('PNG сохранён на устройство.');
    });
  }

  const btnShare = document.getElementById('btnShareImage');
  if (btnShare) {
    btnShare.addEventListener('click', async () => {
      triggerHaptic('heavy');
      if (!currentExportBlob) { showToast('Сначала нажмите «Готово».'); return; }
      try {
        const file = new File([currentExportBlob], `auragram-${state.activePreset}.png`, { type: 'image/png' });
        if (navigator.canShare && !navigator.canShare({ files: [file] })) {
          showToast('Системный Share недоступен — используйте «Скачать PNG».');
          return;
        }
        await navigator.share({ files: [file], title: 'AuraGram' });
      } catch (e) {
        if (e && e.name === 'AbortError') return; // user dismissed share sheet
        showToast('Не удалось поделиться — используйте «Скачать PNG».');
      }
    });
  }

  window.addEventListener('beforeunload', revokeExportUrl);
  window.addEventListener('beforeunload', () => {
    try { if (faceEngine) faceEngine.destroy(); } catch (e) { /* noop */ }
  });

  // --- Init --------------------------------------------------------------------
  window.addEventListener('DOMContentLoaded', () => {
    const nameEl = document.getElementById('activeFilterName');
    if (nameEl) nameEl.textContent = 'Vogue Gloss';
    buildFilterCarousel();
    buildBeautyCarousel();
    buildFXCarousel();
    buildAdjustCarousel();
    updateSliderUI();
    setLoadStatus('loading');
    loadSampleImage(DEMO_PHOTOS[0]);
  });

  // Exposed for automated tests (T1–T14) and debugging.
  window.AuraGram = {
    version: GAUNTLET_VERSION,
    state,
    loadState,
    stats,
    PRESETS,
    BEAUTY_TOOLS,
    FX_LIST,
    ADJUSTMENTS,
    PREVIEW_MAX_DIM,
    EXPORT_MAX_DIM,
    EXPORT_MAX_PIXELS,
    MAX_FILE_SIZE,
    createInitialState,
    createNeutralState,
    isNeutralBeauty,
    isNeutralAdjustments,
    getActiveCorrectionCount,
    isStateNeutral,
    validateImageFile,
    getPreviewDimensions,
    getExportDimensions,
    isImageReady,
    resetAll,
    requestPreviewRender,
    renderStudioCanvas,
    renderImage,
    canSystemShare,
    getExportBlob: () => currentExportBlob,
    // G1a: face detection state (geometry only; null until first photo).
    isFaceDebug,
    face: {
      status: () => (faceEngine ? faceEngine.status() : stats.faceDetectionStatus),
      store: () => (faceEngine ? faceEngine.store : null),
      metrics: () => faceEngine ? faceEngine.metrics : null,
      imageId: () => faceImageId,
      schedule: scheduleFaceDetection,
      refreshOverlay: refreshFaceOverlay,
      reset: resetFaceState
    },
    // G1b: retouch engine (lazy; null until first face-aware render/debug).
    isSkinDebug,
    retouch: {
      ready: () => !!retouchSession,
      timings: () => (retouchSession ? retouchSession.timings() : null),
      cacheKey: () => (retouchSession ? retouchSession.cacheKey() : ''),
      snapshot: currentFaceSnapshot,
      debugMaskDataUrl: () => (retouchSession ? retouchSession.debugMaskDataUrl() : null),
      refreshSkinOverlay
    }
  };
}

// --- Node exports (unit tests without DOM) --------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GAUNTLET_VERSION,
    PREVIEW_MAX_DIM,
    EXPORT_MAX_DIM,
    EXPORT_MAX_PIXELS,
    MAX_FILE_SIZE,
    PRESETS,
    BEAUTY_TOOLS,
    FX_LIST,
    ADJUSTMENTS,
    createInitialState,
    createNeutralState,
    isNeutralBeauty,
    isNeutralAdjustments,
    getActiveCorrectionCount,
    isStateNeutral,
    validateImageFile,
    getPreviewDimensions,
    getExportDimensions
  };
}
