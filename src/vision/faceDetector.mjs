/**
 * AuraGram G1a — face detection orchestrator (browser ESM, lazy).
 *
 * Lifecycle (§3): called ONCE per newly loaded photo, AFTER the photo is
 * already painted. Slider/tab/preset/caption changes NEVER re-trigger
 * inference (F7). The model + WASM are lazy (first photo only), local, and
 * cached as singletons reused across photos (F8).
 *
 * Execution (§4): worker-first with a safe main-thread fallback.
 *   - Module Worker posts an ImageBitmap to faceWorker.mjs (local runtime).
 *   - ANY worker failure (construction, init timeout, detect error,
 *     Safari/WebKit quirks) falls back to one synchronous detect() on the
 *     main thread AFTER paint, with visible status + measured block time.
 *   - If both paths fail, only face detection is disabled ('failed' /
 *     'unsupported') — the editor keeps working (F5).
 *
 * Race handling (§5): single in-flight inference max, latest-wins queue,
 * generation tokens (imageId). A stale result is discarded, never applied
 * to a newer photo (F6). An in-flight detect() cannot be cancelled, so at
 * most ONE outdated inference may finish — and is then dropped.
 */
import {
  createFaceStore,
  setStoreResult,
  clearStore,
  detectionInputSize,
  geometryByteSize
} from './faceGeometry.mjs';

const VENDOR_DIR = new URL('../../vendor/mediapipe/', import.meta.url);
const WASM_URL = new URL('wasm/', VENDOR_DIR).href;
const MODEL_URL = new URL('face_landmarker.task', VENDOR_DIR).href;
// Classic worker (NOT type:module): the vendored Emscripten runtime loads its
// WASM glue via importScripts(), which module workers forbid. Classic workers
// also cover older Safari. See src/vision/faceWorker.js.
const WORKER_URL = new URL('./faceWorker.js', import.meta.url);
const WORKER_INIT_TIMEOUT_MS = 30000;
/**
 * G1b (1.2): detect() has NO implicit timeout in the runtime — a hung worker
 * must never wedge the app. Generous on purpose: cold WASM on iPhone X can
 * take seconds; anything beyond this is genuinely stuck.
 */
const WORKER_DETECT_TIMEOUT_MS = 30000;

/** Race a promise against a timeout. Pure; unit-tested (R14). */
export function withTimeout(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label || 'timeout')), ms);
  });
  return Promise.race([promise, timeout]).then(
    (v) => { clearTimeout(timer); return v; },
    (e) => { clearTimeout(timer); throw e; }
  );
}

/** Yield so the browser can paint status UI before a blocking sync detect. */
function nextPaint() {
  return new Promise((resolve) => {
    try {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    } catch (e) {
      setTimeout(resolve, 0);
    }
  });
}

const DETECTOR_OPTIONS = {
  runningMode: 'IMAGE',
  numFaces: 1,
  outputFaceBlendshapes: false,
  outputFacialTransformationMatrixes: false,
  // Calibrated 2026-10-14 on Chromium-desktop, worker path, off-center face
  // composition + gradient no-face fixture (see tests/e2e-face.spec.js):
  //   0.5/0.5 misses the real JPEG-roundtripped edge face (no_face),
  //   0.3/0.3 hallucinates a face on the no-face fixture (false positive),
  //   0.4/0.4 detects the edge face with zero false positives.
  // Revisit ONLY with new measured evidence, never by guess.
  minFaceDetectionConfidence: 0.4,
  minFacePresenceConfidence: 0.4
};

export function createFaceEngine(callbacks = {}) {
  const onStatus = typeof callbacks.onStatus === 'function' ? callbacks.onStatus : null;
  const store = createFaceStore();
  const metrics = {
    modelLoadMs: 0,
    detectMs: 0,
    blockMs: 0,
    faceCount: 0,
    workerMode: 'none',
    inputW: 0,
    inputH: 0,
    geometryBytes: 0
  };

  let status = 'not_started';
  let worker = null;
  let workerReady = false;
  let mainBundle = null;
  let mainLandmarker = null;
  let initPromise = null;
  let busy = false;
  let pending = null;
  let latestImageId = 0;
  let doneImageId = 0;
  let destroyed = false;

  function snapshot(imageId) {
    return {
      status,
      imageId,
      faceCount: metrics.faceCount,
      detectMs: metrics.detectMs,
      modelLoadMs: metrics.modelLoadMs,
      blockMs: metrics.blockMs,
      workerMode: metrics.workerMode,
      inputW: metrics.inputW,
      inputH: metrics.inputH,
      geometryBytes: metrics.geometryBytes
    };
  }

  function emit(next, imageId) {
    status = next;
    store.status = next;
    if (onStatus) {
      try { onStatus(snapshot(imageId)); } catch (e) { /* status UI must never break detection */ }
    }
  }

  function initWorkerInstance() {
    return new Promise((resolve, reject) => {
      let w;
      try {
        w = new Worker(WORKER_URL); // classic worker — see note at WORKER_URL
      } catch (e) {
        reject(e);
        return;
      }
      const timer = setTimeout(() => {
        try { w.terminate(); } catch (e) { /* noop */ }
        reject(new Error('worker-init-timeout'));
      }, WORKER_INIT_TIMEOUT_MS);
      w.onmessage = (e) => {
        const msg = e.data || {};
        if (msg.type === 'ready') {
          clearTimeout(timer);
          metrics.modelLoadMs = msg.loadMs || 0;
          worker = w;
          workerReady = true;
          resolve();
        } else if (msg.type === 'error') {
          clearTimeout(timer);
          try { w.terminate(); } catch (termErr) { /* noop */ }
          reject(new Error(msg.message || 'worker-init-failed'));
        }
      };
      w.onerror = (e) => {
        clearTimeout(timer);
        try { w.terminate(); } catch (termErr) { /* noop */ }
        reject(e && e.error ? e.error : new Error('worker-error'));
      };
      try {
        // The model stays a same-origin URL: the worker fetches it itself,
        // so no multi-MB buffer is ever cloned across threads.
        w.postMessage({
          type: 'init',
          wasmUrl: WASM_URL,
          modelUrl: MODEL_URL,
          options: {
            numFaces: DETECTOR_OPTIONS.numFaces,
            minFaceDetectionConfidence: DETECTOR_OPTIONS.minFaceDetectionConfidence,
            minFacePresenceConfidence: DETECTOR_OPTIONS.minFacePresenceConfidence
          }
        });
      } catch (e) {
        clearTimeout(timer);
        try { w.terminate(); } catch (termErr) { /* noop */ }
        reject(e);
      }
    });
  }

  async function initMainThread() {
    if (mainLandmarker) return;
    const t0 = performance.now();
    if (!mainBundle) {
      // Lazy: the 137 KB runtime loads only when the worker path is unusable.
      mainBundle = await import('../../vendor/mediapipe/vision_bundle.mjs');
    }
    const fileset = await mainBundle.FilesetResolver.forVisionTasks(WASM_URL);
    mainLandmarker = await mainBundle.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      ...DETECTOR_OPTIONS
    });
    metrics.modelLoadMs = performance.now() - t0;
  }

  /** Resolve backend once; worker-first, main-thread fallback. Never throws. */
  async function ensureBackend() {
    if (workerReady && worker) return 'worker';
    if (mainLandmarker) return 'main';
    if (!initPromise) {
      initPromise = (async () => {
        try {
          await initWorkerInstance();
          return 'worker';
        } catch (workerErr) {
          try {
            await initMainThread();
            return 'main';
          } catch (mainErr) {
            throw mainErr;
          }
        }
      })();
      // A rejected singleton must not poison later photos: allow retry.
      initPromise.catch(() => { initPromise = null; });
    }
    return initPromise;
  }

  function detectOnWorker(imageId, bitmap) {
    const attempt = new Promise((resolve, reject) => {
      const w = worker;
      if (!w) { reject(new Error('worker-gone')); return; }
      const onMsg = (e) => {
        const msg = e.data || {};
        if (msg.type === 'result' && msg.imageId === imageId) {
          cleanup();
          resolve({ faces: msg.faces, detectMs: msg.detectMs });
        } else if (msg.type === 'error' && (msg.imageId === imageId || !msg.imageId)) {
          cleanup();
          reject(new Error(msg.message || 'worker-detect-failed'));
        }
      };
      const onErr = (e) => {
        cleanup();
        reject(e && e.error ? e.error : new Error('worker-error'));
      };
      function cleanup() {
        w.removeEventListener('message', onMsg);
        w.removeEventListener('error', onErr);
      }
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      try {
        w.postMessage({ type: 'detect', imageId, bitmap }, [bitmap]);
      } catch (e) {
        cleanup();
        reject(e);
      }
    });
    // G1b (1.2): bound the wait. On timeout the worker is condemned —
    // terminate it (kills any late result too), drop the listeners, and let
    // the caller fall back in a controlled way. No dangling promises.
    return withTimeout(attempt, WORKER_DETECT_TIMEOUT_MS, 'worker-detect-timeout').catch((e) => {
      const w = worker;
      worker = null;
      workerReady = false;
      initPromise = null; // allow a clean worker to be rebuilt for later photos
      try { if (w) w.terminate(); } catch (termErr) { /* noop */ }
      throw e;
    });
  }

  /** Build the small temporary detection copy (freed right after inference). */
  function makeInputCanvas(image) {
    const nw = image.naturalWidth || image.width;
    const nh = image.naturalHeight || image.height;
    const size = detectionInputSize(nw, nh);
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    const c = canvas.getContext('2d');
    // Same decoded pixels, same orientation as Preview/Export (no mirroring
    // anywhere in the app), so normalized landmarks align with both (F3).
    c.drawImage(image, 0, 0, size.w, size.h);
    return { canvas, w: size.w, h: size.h, origW: nw, origH: nh };
  }

  function freeInput(input) {
    try {
      if (input && input.canvas) {
        input.canvas.width = 0;
        input.canvas.height = 0;
      }
    } catch (e) { /* noop */ }
  }

  function applyResult(imageId, input, faces, detectMs, mode, blockMs) {
    if (destroyed || imageId !== latestImageId) return 'stale'; // F6: never apply to a newer photo
    const triples = (faces || []).map((face) =>
      face.map((t) => ({ x: t[0], y: t[1], z: typeof t[2] === 'number' ? t[2] : 0 }))
    );
    setStoreResult(store, imageId, input.origW, input.origH, triples);
    metrics.detectMs = detectMs;
    metrics.blockMs = blockMs;
    metrics.faceCount = store.faces.length;
    metrics.workerMode = mode;
    metrics.inputW = input.w;
    metrics.inputH = input.h;
    metrics.geometryBytes = geometryByteSize(store);
    doneImageId = imageId;
    emit(store.status, imageId);
    return store.status;
  }

  function fail(imageId, err) {
    if (destroyed || imageId !== latestImageId) return;
    metrics.faceCount = 0;
    emit('failed', imageId);
  }

  async function runJob(imageId, image) {
    busy = true;
    let input = null;
    try {
      emit('loading_model', imageId);
      const mode = await ensureBackend();
      if (destroyed || imageId !== latestImageId) return;
      input = makeInputCanvas(image);
      emit('detecting', imageId);
      if (mode === 'worker') {
        let bitmap = null;
        try {
          bitmap = await createImageBitmap(input.canvas);
        } catch (e) {
          bitmap = null;
        }
        if (bitmap) {
          try {
            const r = await detectOnWorker(imageId, bitmap);
            applyResult(imageId, input, r.faces, r.detectMs, 'worker', 0);
          } catch (e) {
            // Worker detect failed mid-job → one safe main-thread attempt,
            // after giving the browser a chance to paint the status UI.
            try {
              await nextPaint();
              if (destroyed || imageId !== latestImageId) return;
              await initMainThread();
              const t0 = performance.now();
              const res = mainLandmarker.detect(input.canvas);
              const ms = performance.now() - t0;
              applyResult(imageId, input, serializeMainResult(res), ms, 'main-thread', ms);
            } catch (e2) {
              fail(imageId, e2);
            }
          }
        } else {
          // No ImageBitmap (old WebKit) → main-thread detect of the same copy.
          await nextPaint();
          if (destroyed || imageId !== latestImageId) return;
          await initMainThread();
          const t0 = performance.now();
          const res = mainLandmarker.detect(input.canvas);
          const ms = performance.now() - t0;
          applyResult(imageId, input, serializeMainResult(res), ms, 'main-thread', ms);
        }
      } else {
        await nextPaint();
        if (destroyed || imageId !== latestImageId) return;
        const t0 = performance.now();
        const res = mainLandmarker.detect(input.canvas);
        const ms = performance.now() - t0;
        applyResult(imageId, input, serializeMainResult(res), ms, 'main-thread', ms);
      }
    } catch (e) {
      fail(imageId, e);
    } finally {
      freeInput(input);
      busy = false;
      if (pending && !destroyed) {
        const next = pending;
        pending = null;
        runJob(next.imageId, next.image);
      }
    }
  }

  function serializeMainResult(result) {
    const out = [];
    const list = (result && result.faceLandmarks) || [];
    for (const lm of list) {
      out.push(lm.map((p) => [p.x, p.y, typeof p.z === 'number' ? p.z : 0]));
    }
    return out;
  }

  /**
   * Schedule detection for a photo. Safe to call on every adoptImage:
   * same-photo repeats are skipped, concurrent photos collapse latest-wins.
   */
  function schedule(imageId, image) {
    if (destroyed || !image) return;
    if (imageId === doneImageId && (store.status === 'ready' || store.status === 'no_face')) {
      return; // same photo already analysed — no new inference (F7/F8)
    }
    if (typeof WebAssembly === 'undefined') {
      latestImageId = imageId;
      metrics.faceCount = 0;
      emit('unsupported', imageId);
      return;
    }
    latestImageId = imageId;
    if (busy) {
      pending = { imageId, image }; // latest wins; at most one queued (F6)
      return;
    }
    runJob(imageId, image);
  }

  /** Clear geometry for a new/reset photo. Model + runtime stay cached (F8/F10). */
  function reset() {
    pending = null;
    latestImageId = 0;
    doneImageId = 0;
    metrics.faceCount = 0;
    metrics.detectMs = 0;
    metrics.blockMs = 0;
    metrics.inputW = 0;
    metrics.inputH = 0;
    metrics.geometryBytes = 0;
    clearStore(store, 'not_started');
    emit('not_started', 0);
  }

  /**
   * G1b (1.3): a NEW photo arrived. Drop the previous photo's geometry at
   * once (a new photo must never be retouched with old landmarks), invalidate
   * any in-flight job for the old photo, but keep the cached model/runtime.
   * Settings Reset does NOT call this — geometry survives Reset (R11).
   */
  function newPhoto(imageId) {
    pending = null;
    latestImageId = imageId;
    metrics.faceCount = 0;
    metrics.detectMs = 0;
    metrics.blockMs = 0;
    metrics.inputW = 0;
    metrics.inputH = 0;
    metrics.geometryBytes = 0;
    clearStore(store, 'not_started');
    emit('not_started', imageId);
  }

  function destroy() {
    destroyed = true;
    pending = null;
    try { if (worker) worker.terminate(); } catch (e) { /* noop */ }
    worker = null;
    workerReady = false;
    try { if (mainLandmarker && mainLandmarker.close) mainLandmarker.close(); } catch (e) { /* noop */ }
    mainLandmarker = null;
  }

  return { store, metrics, status: () => status, schedule, reset, newPhoto, destroy };
}
