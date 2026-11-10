'use strict';
// Entry point: wire editor state, processing and browser interactions.
const { PREVIEW_MAX_DIM, EXPORT_MAX_DIM, EXPORT_MAX_PIXELS, MAX_FILE_SIZE, ACCEPTED_MIME_PREFIX, ACCEPTED_MIME_EXACT, GAUNTLET_VERSION, DEMO_PHOTOS, PRESETS, BEAUTY_TOOLS, FX_LIST, ADJUSTMENTS, LASH_DEFAULTS, createLashesState, isNeutralLashes, lashCorrectionCount, createInitialState, createNeutralState, isNeutralBeauty, isNeutralAdjustments, getActiveCorrectionCount, isStateNeutral, validateImageFile, fitInto, getPreviewDimensions, getExportDimensions, isImageReady } = typeof module !== 'undefined' && module.exports
  ? require('./state/editorState.js') : window.AuraGramEditorState;

// --- Browser app -------------------------------------------------------------
const isBrowser = (typeof window !== 'undefined') && (typeof document !== 'undefined');

if (isBrowser) {
  let tg = null;
  function initializeTelegram() {
    tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
    if (!tg) return;
    try { tg.ready(); } catch (e) { /* optional SDK */ }
    try { tg.expand(); } catch (e) { /* older clients */ }
    try {
      tg.setHeaderColor('#0d0d12');
      tg.setBackgroundColor('#09090b');
    } catch (e) { /* ignore */ }
  }
  initializeTelegram();
  const telegramScript = document.querySelector('script[src*="telegram.org/js/telegram-web-app.js"]');
  if (telegramScript) telegramScript.addEventListener('load', initializeTelegram, { once: true });

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
  let sourceBlob = null;
  let sourceName = '';
  let editRevision = 0;
  const {settingsSnapshot, applySettings} = window.AuraGramEditorState;
  const sessionCheckbox = document.getElementById('saveSession');
  const session = window.AuraGramSession.createSessionController({
    store: window.AuraGramSession.createIndexedDBStore((() => {
      try { return window.indexedDB; } catch (error) { return null; }
    })()),
    snapshot: settingsSnapshot,
    onStatus(status) {
      const texts = {off:'Сохранение выключено', waiting:'Загрузите фото для сохранения',
        pending:'Изменения не сохранены…', saving:'Сохраняется…', saved:'Сохранено на устройстве',
        restoring:'Восстановление…', clearing:'Удаление…', invalid:'Сохранённая сессия повреждена',
        error:'Не удалось сохранить или прочитать сессию. Можно повторить.'};
      document.getElementById('sessionStatus').textContent = texts[status] || '';
      sessionCheckbox.checked = session.enabled();
    }
  });
  function saveCurrentSession() { session.update(sourceBlob, state, sourceName); }
  const history = window.AuraGramHistory.createHistory({
    read: () => settingsSnapshot(state),
    write: value => { applySettings(state, value); syncEditor(); },
    onChange(info) {
      document.getElementById('btnUndo').disabled = !info.canUndo;
      document.getElementById('btnRedo').disabled = !info.canRedo;
      saveCurrentSession();
    }
  });
  function syncEditor() {
    buildFilterCarousel(); buildBeautyCarousel(); buildFXCarousel(); buildAdjustCarousel();
    updateSliderUI(); renderFilterThumbnails();
    document.getElementById('activeFilterName').textContent = PRESETS.find(p => p.id === state.activePreset).name;
    document.getElementById('customCaption').value = state.caption;
    document.querySelectorAll('.stamp-btn').forEach(button => {
      const active = button.dataset.stamp === state.stampMode;
      button.setAttribute('aria-pressed', String(active));
      button.className = active
        ? 'stamp-btn px-3 py-2 rounded-xl border border-violet-500 bg-violet-500/20 text-xs font-medium text-white shrink-0'
        : 'stamp-btn px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-zinc-300 shrink-0';
    });
    document.getElementById('autoHudBadge').classList.remove('opacity-100');
    document.getElementById('autoHudBadge').classList.add('opacity-0');
    requestPreviewRender(); updateCorrectionIndicator();
  }
  document.getElementById('btnUndo').addEventListener('click', () => history.undo());
  document.getElementById('btnRedo').addEventListener('click', () => history.redo());
  sessionCheckbox.addEventListener('change', () => {
    session.cancelRestore();
    session.update(sourceBlob, state, sourceName);
    session.enable(sessionCheckbox.checked);
  });
  document.getElementById('btnClearSession').addEventListener('click', () => session.clear());
  const actionEvents = new WeakSet();
  const editControl = target => target.closest('#mainSlider, #lashDensity, #lashLength, #lashDefinition, #customCaption');
  const editAction = target => target.closest('#tab-filters button, #tab-fx button, .stamp-btn, #btnReset, #btnMagicAI');
  document.addEventListener('input', e => {
    if (editControl(e.target)) { editRevision++; session.cancelRestore(); history.begin(); }
  }, true);
  document.addEventListener('input', e => { if (editControl(e.target)) saveCurrentSession(); });
  document.addEventListener('click', e => {
    if (e.target.closest('button, .nav-tab')) history.commit();
    if (editAction(e.target)) {
      editRevision++; session.cancelRestore(); history.begin(); actionEvents.add(e);
    }
  }, true);
  document.addEventListener('click', e => { if (actionEvents.has(e)) history.commit(); });
  document.addEventListener('change', e => { if (editControl(e.target)) history.commit(); }, true);
  document.addEventListener('focusout', e => { if (editControl(e.target)) history.commit(); });
  window.addEventListener('pointerup', () => history.commit());
  window.addEventListener('pointercancel', () => history.commit());
  window.addEventListener('blur', () => history.commit());
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'z') return;
    if (e.target.closest('input, textarea, [contenteditable="true"], [role="textbox"]') && e.target.type !== 'range') return;
    e.preventDefault();
    if (e.shiftKey) history.redo(); else history.undo();
  });

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

  function updateToolStatus() {
    const el = document.getElementById('toolStatus');
    if (!el) return;
    const status = stats.faceDetectionStatus;
    const messages = {
      not_started:'Загрузите фото для анализа ретуши',
      loading_model:'Загружается анализ лица. Фильтры и цветокоррекция доступны.',
      detecting:'Поиск лица. Фильтры и цветокоррекция доступны.',
      no_face:'Лицо не найдено: Бьюти и ресницы не применяются. Фильтры доступны.',
      failed:'Анализ лица недоступен: Бьюти и ресницы не применяются. Фильтры доступны.',
      unsupported:'Анализ лица недоступен: Бьюти и ресницы не применяются. Фильтры доступны.'
    };
    if (status !== 'ready') { el.textContent = messages[status] || messages.not_started; return; }
    if (retouchFailed) { el.textContent = 'Ретушь не загрузилась. Фильтры доступны; значения сохранены.'; return; }
    if (!retouchSession) {
      el.textContent = retouchLoading ? 'Лицо найдено. Бьюти готовится; значения сохранены.' : 'Лицо найдено. Бьюти доступно; включите инструмент.';
      return;
    }
    const info = retouchSession.lashInfo();
    if (!info || info.key !== String(faceImageId)) { el.textContent = 'Бьюти доступно. Включите ресницы для анализа глаз.'; return; }
    const reason = {ok:'доступно', weak:'слабый сигнал', blurry:'глаз размыт', sparse:'мало видимых ресниц',
      'low-contrast':'низкий контраст', 'eye-unusable':'глаз слишком мал или закрыт'};
    el.textContent = `Бьюти доступно. Ресницы: слева — ${reason[info.left.reason] || 'недоступно'}, справа — ${reason[info.right.reason] || 'недоступно'}.`;
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
    updateToolStatus();
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
  // G1c: lash debug overlay (?debugLashes=1). Separate canvas, never exported.
  const isLashDebug = (() => {
    try {
      return new URLSearchParams(window.location.search).get('debugLashes') === '1';
    } catch (e) {
      return false;
    }
  })();
  let retouchSession = null;
  let retouchLoading = null;
  let retouchFailed = false;

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
    const l = st.lashes;
    const lashOn = l && (l.density > 0 || l.length > 0 || l.definition > 0);
    const anyOn = b.smooth > 0 || b.antired > 0 || b.glow > 0 || b.eyes > 0 || b.blush > 0 || b.sculpt > 0 || lashOn;
    if (!anyOn) return;
    if (!face) return; // R9: no geometry → no local passes, never a fake fallback
    if (!retouchSession) {
      if (!retouchLoading) {
        retouchLoading = importRetouchModule().then((mod) => {
          retouchSession = mod.createRetouchSession();
          retouchFailed = false;
          requestPreviewRender();
          refreshSkinOverlay();
          return retouchSession;
        }).catch(() => { retouchLoading = null; retouchFailed = true; updateToolStatus(); });
      }
      return; // grade stays; retouch lands on the next tick, never blocks
    }
    try {
      const gradeSig = [st.activePreset, st.presetIntensity,
        st.adjustments.brightness, st.adjustments.contrast,
        st.adjustments.saturate, st.adjustments.blur].join('|');
      const res = retouchSession.applyPasses(tctx, W, H, {
        face, beauty: b, lashes: l, src, gradeFilter, gradeSig,
        buffers: { detailBuffer, detailCtx }
      });
      const t = retouchSession.timings();
      stats.retouchMs = res.ms;
      stats.maskBuildMs = t.maskBuildMs;
      stats.retouchRan = res.ran.join(',');
      stats.lashAnalyseMs = t.lashAnalyseMs || 0;
      stats.lashEnhanceMs = t.lashEnhanceMs || 0;
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

  // G1c: lash debug overlay. Lash analysis needs no masks, only the source
  // photo; paintDebugLashes no-ops (returns null) until analysis ran.
  function refreshLashOverlay() {
    const overlay = document.getElementById('lashOverlay');
    if (!overlay) return;
    if (overlay.width !== mainCanvas.width || overlay.height !== mainCanvas.height) {
      overlay.width = mainCanvas.width || 0;
      overlay.height = mainCanvas.height || 0;
    }
    const octx = overlay.getContext('2d');
    const face = currentFaceSnapshot();
    if (!isLashDebug || !face || !isImageReady(sourceImage)) {
      octx.clearRect(0, 0, overlay.width, overlay.height);
      overlay.classList.add('hidden');
      return;
    }
    if (!retouchSession) {
      if (!retouchLoading) {
        retouchLoading = importRetouchModule().then((mod) => {
          retouchSession = mod.createRetouchSession();
          refreshLashOverlay();
          return retouchSession;
        }).catch(() => { retouchLoading = null; });
      }
      return;
    }
    overlay.classList.remove('hidden');
    try {
      retouchSession.ensureLashAnalysis(face, sourceImage);
      retouchSession.paintDebugLashes(octx, overlay.width, overlay.height);
    } catch (e) { /* overlay must never break the editor */ }
  }

  const {renderImage} = window.AuraGramRenderer.createImageRenderer({
    PRESETS, detailBuffer, detailCtx, grainCanvas, runRetouchPasses
  });

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
    refreshLashOverlay();
    updateToolStatus();
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
  const {loadSampleImage,loadFileImage,loadBlob} = window.AuraGramPhotoLoader.createPhotoLoader({
    loadState, validateImageFile, MAX_FILE_SIZE, setLoadStatus, showToast, adoptImage, failLoad,
    onLoading: () => { session.cancelRestore(); imageReady = false; }, isReady: () => imageReady
  });

  async function restoredLoader(record, token) {
    const start = editRevision;
    await loadBlob(record.blob, token, '', record.name);
    if (token !== loadState.token) return;
    if (start === editRevision) { applySettings(state, record.settings); syncEditor(); }
    history.clear();
  }

  async function adoptImage(img, token, label, blob, name) {
    if (token !== loadState.token) return; // race: newer request already started
    const dims = getPreviewDimensions(img.naturalWidth, img.naturalHeight);
    sourceImage = img;
    sourceBlob = blob || null;
    sourceName = name || '';
    history.clear();
    imageReady = true;
    mainCanvas.width = dims.w;
    mainCanvas.height = dims.h;
    setLoadStatus('ready');
    // G1a: photo is already painted — now schedule one-shot face detection.
    // G1b (1.3): a NEW photo drops the previous photo's geometry at once,
    // so it can never be retouched with stale landmarks (R12).
    faceImageId += 1;
    stats.faceDetectionStatus = 'detecting';
    stats.retouchRan = '';
    updateToolStatus();
    if (faceEngine) {
      try { faceEngine.newPhoto(faceImageId); } catch (e) { /* noop */ }
    }
    renderStudioCanvas();
    renderFilterThumbnails();
    syncFaceOverlaySize();
    scheduleFaceDetection(img, faceImageId);
    if (label) showToast(label);
  }

  function failLoad(token, message) {
    if (token !== loadState.token) return;
    imageReady = false;
    setLoadStatus('error', message);
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

  const {buildFilterCarousel,buildBeautyCarousel,buildFXCarousel,buildAdjustCarousel,updateSliderUI}
    = window.AuraGramEditorUI.createEditorUI({state, PRESETS, BEAUTY_TOOLS, FX_LIST, ADJUSTMENTS, createLashesState, getActiveCorrectionCount, triggerHaptic, showToast, renderFilterThumbnails, requestPreviewRender, updateCorrectionIndicator});

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
    history.begin();
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
    history.commit();
  }

  const btnReset = document.getElementById('btnReset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      triggerHaptic('medium');
      resetAll();
      showToast('Настройки сброшены — показан исходник');
    });
  }

  async function ensureRetouchLoaded() {
    if (retouchSession) return;
    if (retouchLoading) await retouchLoading;
    if (!retouchSession) {
      const mod = await importRetouchModule();
      retouchSession = mod.createRetouchSession();
    }
  }
  const {canSystemShare,getExportBlob} = window.AuraGramExport.createExportController({
    state, loadState, mainCanvas, stats, triggerHaptic, showToast, isImageReady,
    getSourceImage: () => sourceImage, getFaceImageId: () => faceImageId,
    getFaceStatus: () => faceEngine ? faceEngine.status() : stats.faceDetectionStatus,
    getExportDimensions, endCompare, renderStudioCanvas, isNeutralBeauty, isNeutralLashes,
    currentFaceSnapshot, ensureRetouchLoaded, renderImage
  });

  window.addEventListener('beforeunload', () => {
    try { if (faceEngine) faceEngine.destroy(); } catch (e) { /* noop */ }
  });

  // --- Init --------------------------------------------------------------------
  window.addEventListener('DOMContentLoaded', async () => {
    const nameEl = document.getElementById('activeFilterName');
    if (nameEl) nameEl.textContent = 'Vogue Gloss';
    buildFilterCarousel();
    buildBeautyCarousel();
    buildFXCarousel();
    buildAdjustCarousel();
    updateSliderUI();
    setLoadStatus('loading');
    const initialToken = loadState.token;
    const record = await session.restore();
    // An upload or edit made while IndexedDB was opening takes precedence.
    if (loadState.token !== initialToken) return;
    if (record) {
      const token = ++loadState.token;
      try {
        await restoredLoader(record, token);
        return;
      } catch (error) {
        document.getElementById('sessionStatus').textContent = 'Сохранённое фото не читается. Загрузите другое.';
      }
    }
    loadSampleImage(DEMO_PHOTOS[0]);
  });

  // Exposed for automated tests (T1–T14) and debugging.
  window.AuraGram = {
    version: GAUNTLET_VERSION,
    state,
    history,
    session,
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
    createLashesState,
    isNeutralBeauty,
    isNeutralLashes,
    lashCorrectionCount,
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
    getExportBlob,
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
    },
    // G1c: lash enhancement (same lazy session; analysis cached per photo).
    isLashDebug,
    lash: {
      info: () => (retouchSession ? retouchSession.lashInfo() : null),
      buffers: () => (retouchSession ? retouchSession.lashBufferInfo() : null),
      refreshOverlay: refreshLashOverlay
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
    createLashesState,
    isNeutralBeauty,
    isNeutralLashes,
    lashCorrectionCount,
    isNeutralAdjustments,
    getActiveCorrectionCount,
    isStateNeutral,
    validateImageFile,
    getPreviewDimensions,
    getExportDimensions
  };
}
