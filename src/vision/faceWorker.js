/**
 * AuraGram G1a — Face Landmarker Web Worker (CLASSIC worker, local runtime).
 *
 * Deliberately NOT a module worker: the vendored tasks-vision runtime
 * (Emscripten) loads its WASM glue via importScripts(), which module scripts
 * forbid ("Module scripts don't support importScripts()"). A classic worker
 * supports importScripts on all evergreen browsers AND older Safari, so this
 * path is more compatible than a module worker. The CJS bundle is
 * self-contained (no require(), no window) and is loaded via an exports shim.
 *
 * All URLs are relative to THIS file, so any Pages subpath works.
 * No CDN, no paid APIs — model/WASM come from our own static host.
 *
 * Protocol (main ↔ worker):
 *   → { type: 'init', wasmUrl, modelUrl, options? }
 *   ← { type: 'ready', loadMs } | { type: 'error', stage: 'init', message }
 *   → { type: 'detect', imageId, bitmap } (ImageBitmap transferred)
 *   ← { type: 'result', imageId, faces, detectMs } | { type: 'error', stage, message, imageId }
 * faces: Array of faces; each face is an Array of [x, y, z] normalized triples.
 */
var exports = {};
importScripts('../../vendor/mediapipe/vision_bundle.cjs');

var DEFAULTS = {
  runningMode: 'IMAGE',
  numFaces: 1,
  outputFaceBlendshapes: false,
  outputFacialTransformationMatrixes: false,
  minFaceDetectionConfidence: 0.5,
  minFacePresenceConfidence: 0.5
};

var landmarker = null;

function serializeFaces(result) {
  var out = [];
  var list = (result && result.faceLandmarks) || [];
  for (var i = 0; i < list.length; i++) {
    out.push(list[i].map(function (p) { return [p.x, p.y, typeof p.z === 'number' ? p.z : 0]; }));
  }
  return out;
}

self.onmessage = function (e) {
  var msg = e.data || {};
  var initPromise = null;
  if (msg.type === 'init') {
    var t0 = performance.now();
    // Thresholds are init-time tunable (§2 start config = 0.5/0.5; tuned only
    // on measured evidence — see tests/e2e-face.spec.js edge compositions).
    var o = msg.options || {};
    var cfg = {
      runningMode: 'IMAGE',
      numFaces: o.numFaces || DEFAULTS.numFaces,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
      minFaceDetectionConfidence: (typeof o.minFaceDetectionConfidence === 'number') ? o.minFaceDetectionConfidence : DEFAULTS.minFaceDetectionConfidence,
      minFacePresenceConfidence: (typeof o.minFacePresenceConfidence === 'number') ? o.minFacePresenceConfidence : DEFAULTS.minFacePresenceConfidence
    };
    initPromise = exports.FilesetResolver.forVisionTasks(msg.wasmUrl).then(function (fileset) {
      return exports.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: msg.modelUrl, delegate: 'CPU' },
        runningMode: cfg.runningMode,
        numFaces: cfg.numFaces,
        outputFaceBlendshapes: cfg.outputFaceBlendshapes,
        outputFacialTransformationMatrixes: cfg.outputFacialTransformationMatrixes,
        minFaceDetectionConfidence: cfg.minFaceDetectionConfidence,
        minFacePresenceConfidence: cfg.minFacePresenceConfidence
      });
    }).then(function (lm) {
      landmarker = lm;
      self.postMessage({ type: 'ready', loadMs: performance.now() - t0 });
    }).catch(function (err) {
      self.postMessage({ type: 'error', stage: 'init', message: (err && err.message) || String(err) });
    });
    return;
  }
  if (msg.type === 'detect') {
    if (!landmarker) {
      self.postMessage({ type: 'error', stage: 'detect', imageId: msg.imageId, message: 'landmarker-not-initialized' });
      return;
    }
    var t1 = performance.now();
    var result;
    try {
      result = landmarker.detect(msg.bitmap);
    } catch (err) {
      try { if (msg.bitmap && msg.bitmap.close) msg.bitmap.close(); } catch (closeErr) { /* noop */ }
      self.postMessage({ type: 'error', stage: 'detect', imageId: msg.imageId, message: (err && err.message) || String(err) });
      return;
    }
    try { if (msg.bitmap && msg.bitmap.close) msg.bitmap.close(); } catch (closeErr) { /* noop */ }
    self.postMessage({ type: 'result', imageId: msg.imageId, faces: serializeFaces(result), detectMs: performance.now() - t1 });
  }
};
