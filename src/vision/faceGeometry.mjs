/**
 * AuraGram G1a — face geometry data model (pure, no DOM, Node-importable).
 *
 * Stores Face Landmarker results keyed to a concrete loaded photo (imageId).
 * Coordinates are NORMALIZED [0,1] relative to the ORIGINAL image dimensions,
 * so the same geometry maps to Preview and Export without shifts (F3):
 *   pixel = normalized * canvasDimension (aspect is preserved 1:1 in both).
 *
 * Region index tables follow the canonical MediaPipe FaceMesh topology
 * (@mediapipe/tasks-vision 0.10.21 exports no FACE_LANDMARKS_* constants,
 * so the standard topology indices are used directly and documented here).
 * G1a only stores geometry — no retouch, no masks, no pixel changes.
 */

/** Landmarks per face returned by the Face Landmarker model. */
export const FACE_POINT_COUNT = 478;

/** Detection input cap: long side, px (spec range 512–640; F12). */
export const FACE_DETECT_MAX_DIM = 640;

/** Canonical FaceMesh region index tables. */
export const FACE_REGIONS = {
  faceOval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  leftEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  rightEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 161, 160, 159, 158, 157, 173],
  leftEyebrow: [336, 296, 334, 293, 300, 276, 283, 282, 295, 285],
  rightEyebrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  lips: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146],
  nose: [168, 197, 5, 4, 1, 2, 98, 327]
};

export const FACE_STATUSES = [
  'not_started', 'loading_model', 'detecting', 'ready', 'no_face', 'failed', 'unsupported'
];

/**
 * Detection input size for an original image (long side capped, aspect kept).
 * The ORIGINAL photo is never downscaled for editing/export — this size is
 * only for the temporary detection copy (freed right after inference).
 */
export function detectionInputSize(nw, nh) {
  const k = Math.min(1, FACE_DETECT_MAX_DIM / Math.max(nw, nh));
  return { w: Math.max(1, Math.round(nw * k)), h: Math.max(1, Math.round(nh * k)) };
}

/** Empty store bound to no photo yet. */
export function createFaceStore() {
  return { imageId: 0, width: 0, height: 0, status: 'not_started', faces: [] };
}

export function clearStore(store, status = 'not_started') {
  store.imageId = 0;
  store.width = 0;
  store.height = 0;
  store.status = status;
  store.faces = [];
  return store;
}

function isFiniteLandmark(p) {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y)
    && (p.z === undefined || Number.isFinite(p.z));
}

/**
 * G1b (1.1): reasonable geometric limits. MediaPipe may legitimately return
 * finite points slightly outside the frame (cropped faces) — those must NOT
 * kill the whole face. Anything clearly broken (NaN/Infinity/far outside)
 * is still rejected.
 */
const BOUND_MARGIN = 0.15;

export function isPlausibleLandmark(p) {
  return isFiniteLandmark(p)
    && p.x >= -BOUND_MARGIN && p.x <= 1 + BOUND_MARGIN
    && p.y >= -BOUND_MARGIN && p.y <= 1 + BOUND_MARGIN;
}

/** Clip to the frame for RASTERIZATION only — stored landmarks stay original. */
export function clampPoint(p) {
  return {
    x: Math.min(1, Math.max(0, p.x)),
    y: Math.min(1, Math.max(0, p.y)),
    z: p.z === undefined ? 0 : p.z
  };
}

/** A usable face needs the full landmark set with finite, plausible coords. */
export function isValidLandmarkSet(landmarks) {
  return Array.isArray(landmarks)
    && landmarks.length === FACE_POINT_COUNT
    && landmarks.every(isPlausibleLandmark);
}

function pickRegion(landmarks, indices) {
  const out = [];
  for (const i of indices) {
    if (i < landmarks.length) out.push(landmarks[i]);
  }
  return out;
}

/** Split one landmark set into named regions for overlay / future G1b masks. */
export function buildRegions(landmarks) {
  const regions = {};
  for (const key of Object.keys(FACE_REGIONS)) {
    regions[key] = pickRegion(landmarks, FACE_REGIONS[key]);
  }
  return regions;
}

/** Normalized bounding box of a landmark set (null when empty). */
export function computeBounds(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length === 0) return null;
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const p of landmarks) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

/** Normalized point → canvas pixels (same formula for Preview and Export). */
export function toPixels(pt, W, H) {
  return { x: pt.x * W, y: pt.y * H };
}

/**
 * Record a detection result. Invalid landmark sets are dropped (face skipped),
 * so a malformed model output can never poison the editor (F4).
 */
export function setStoreResult(store, imageId, width, height, rawFaces) {
  store.imageId = imageId;
  store.width = width;
  store.height = height;
  store.faces = [];
  const list = Array.isArray(rawFaces) ? rawFaces : [];
  for (const landmarks of list) {
    if (!isValidLandmarkSet(landmarks)) continue;
    store.faces.push({ landmarks, bounds: computeBounds(landmarks), regions: buildRegions(landmarks) });
  }
  store.status = store.faces.length > 0 ? 'ready' : 'no_face';
  return store;
}

/** Approximate serialized size of the stored geometry (stats, no exfiltration). */
export function geometryByteSize(store) {
  try {
    return JSON.stringify(store.faces).length;
  } catch (e) {
    return 0;
  }
}
