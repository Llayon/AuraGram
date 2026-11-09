(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.AuraGramExport = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function createExportController({
    state,
    loadState,
    mainCanvas,
    stats,
    triggerHaptic,
    showToast,
    isImageReady,
    getSourceImage,
    getFaceImageId,
    getFaceStatus,
    getExportDimensions,
    endCompare,
    renderStudioCanvas,
    isNeutralBeauty,
    isNeutralLashes,
    currentFaceSnapshot,
    ensureRetouchLoaded,
    renderImage
  }) {
    // --- Honest export (1.3 + 1.4): local PNG via Blob, optional Web Share ------
    const exportModal = document.getElementById('exportModal');
    const exportPreviewImg = document.getElementById('exportPreviewImg');
    const exportMeta = document.getElementById('exportMeta');
    let currentExportUrl = null; // Blob URL hygiene: revoked on every new export
    let currentExportBlob = null;
    let exportBusy = false;
    let currentExportPreset = 'normal';

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
      if (exportBusy) return;
      triggerHaptic('medium');
      const sourceImage = getSourceImage();
      if (!isImageReady(sourceImage)) {
        showToast('Сначала загрузите фото — экспортировать нечего.');
        return;
      }
      exportBusy = true;
      const exportSource = sourceImage;
      const exportImageId = getFaceImageId();
      const exportLoadToken = loadState.token;
      const exportButton = document.getElementById('btnExport');
      exportButton.disabled = true;
      exportButton.setAttribute('aria-busy', 'true');
      if (exportModal) {
        exportModal.classList.add('hidden');
        exportModal.classList.remove('flex');
      }
      revokeExportUrl();
      currentExportBlob = null;
      showToast('Подготовка фото…');
      let exportCanvas;
      try {
        endCompare();
        renderStudioCanvas();
        const dims = getExportDimensions(sourceImage.naturalWidth, sourceImage.naturalHeight);
        exportCanvas = document.createElement('canvas');
        exportCanvas.width = dims.w;
        exportCanvas.height = dims.h;
        const ectx = exportCanvas.getContext('2d');
        const frozen = Object.assign({}, state, {
          beauty: Object.assign({}, state.beauty),
          lashes: Object.assign({}, state.lashes), // G1c: export honors lashes
          adjustments: Object.assign({}, state.adjustments),
          isComparing: false
        });
        const isCurrent = () => getSourceImage() === exportSource && getFaceImageId() === exportImageId && loadState.token === exportLoadToken;
        const { prepareExport } = await import(new URL('src/exporting/prepareExport.mjs', document.baseURI).href);
        await prepareExport({
          isCurrent,
          needsRetouch: !isNeutralBeauty(frozen.beauty) || !isNeutralLashes(frozen.lashes),
          faceStatus: getFaceStatus,
          loadRetouch: ensureRetouchLoaded
        });
        if (!isCurrent()) return;
        const retouchUnavailable = (!isNeutralBeauty(frozen.beauty) || !isNeutralLashes(frozen.lashes)) && !currentFaceSnapshot();
        if (retouchUnavailable) {
          showToast('Локальная ретушь недоступна — сохраняются фильтры и настройки.');
        }
        const t0 = performance.now();
        try {
          renderImage(ectx, dims.w, dims.h, exportSource, frozen, currentFaceSnapshot());
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
        if (!isCurrent()) return;
        revokeExportUrl();
        currentExportBlob = blob;
        currentExportPreset = frozen.activePreset;
        currentExportUrl = URL.createObjectURL(blob);
        if (exportPreviewImg) exportPreviewImg.src = currentExportUrl;
        if (exportMeta) {
          const kd = (exportCanvas.width * exportCanvas.height / 1e6).toFixed(1);
          exportMeta.textContent =
            `Превью ${mainCanvas.width}×${mainCanvas.height} • Экспорт ${dims.w}×${dims.h} (${kd} Мп)` +
            (dims.capped ? ' • уменьшен для экономии памяти' : '') +
            (retouchUnavailable ? ' • локальная ретушь недоступна' : '') +
            ` • рендер ${stats.lastExportMs.toFixed(0)} мс. ` +
            `Качество ограничено текущими алгоритмами — это не побитовый оригинал.`;
        }
        if (dims.capped) showToast(`Экспорт уменьшен до ${dims.w}×${dims.h} для экономии памяти.`);
        else showToast('Фото готово к сохранению.');
        refreshShareButton();
        if (exportModal) {
          exportModal.classList.remove('hidden');
          exportModal.classList.add('flex');
        }
      } catch (e) {
        if (e.message !== 'export-superseded') {
          showToast(e.message === 'export-prepare-timeout'
            ? 'Подготовка фото заняла слишком много времени. Попробуйте ещё раз.'
            : 'Не удалось подготовить экспорт. Попробуйте ещё раз.');
        }
      } finally {
        if (exportCanvas) { exportCanvas.width = 0; exportCanvas.height = 0; }
        exportBusy = false;
        exportButton.removeAttribute('aria-busy');
        exportButton.disabled = loadState.status !== 'ready';
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
        link.download = `auragram-${currentExportPreset}-${Date.now()}.png`;
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
          const file = new File([currentExportBlob], `auragram-${currentExportPreset}.png`, { type: 'image/png' });
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

    return {canSystemShare,getExportBlob:()=>currentExportBlob,openExportModal};
  }
  return {createExportController};
});
