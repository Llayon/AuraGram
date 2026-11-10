(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.AuraGramPhotoLoader = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function createPhotoLoader({
    loadState,
    validateImageFile,
    MAX_FILE_SIZE,
    setLoadStatus,
    showToast,
    adoptImage,
    failLoad,
    onLoading,
    isReady
  }) {
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

    async function loadSampleImage(url) {
      const token = ++loadState.token;
      onLoading();
      setLoadStatus('loading');
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('demo-fetch-failed');
        const blob = await response.blob();
        if (blob.size > MAX_FILE_SIZE) throw new Error('demo-too-large');
        await loadBlob(blob, token, '', 'demo');
      } catch (err) {
          if (token !== loadState.token || (err && err.message === 'superseded')) return;
          // Honest empty state (1.2): no decorative gradient masquerading as a photo.
          failLoad(token, 'Демо-фото недоступно (сеть/CORS). Нажмите «Фото» и загрузите своё изображение.');
      }
    }

    async function loadBlob(blob, token, label, name) {
      const objectUrl = URL.createObjectURL(blob);
      try {
        const img = await decodeImage(objectUrl, token);
        await adoptImage(img, token, label, blob, name);
      } finally { URL.revokeObjectURL(objectUrl); }
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
        if (!isReady()) failLoad(++loadState.token, messages[check.reason] || 'Не удалось загрузить изображение.');
        return;
      }
      const token = ++loadState.token;
      onLoading();
      setLoadStatus('loading');
      return loadBlob(file, token, 'Ваше фото загружено', file.name).then(
        () => {},
        err => {
          if (err && err.message === 'superseded') return;
          failLoad(token, 'Файл повреждён или не декодируется. Выберите другое изображение.');
          showToast('Файл повреждён или не декодируется.');
        }
      );
    }


    return {loadSampleImage,loadFileImage,loadBlob};
  }
  return {createPhotoLoader};
});
