/**
 * AuraGram G1c — lash analysis (real pixel structures near the lash line).
 *
 * MediaPipe gives eyelids, NOT individual lashes. This module looks for REAL
 * thin dark structures (ridges) in a small Eye ROI bitmap taken from the
 * ORIGINAL photo: luminance ridge detection + local contrast vs. a per-column
 * skin reference + Laplacian sharpness. No `Math.random`, no invented hairs.
 *
 * Two layers:
 *   PURE (Node-testable): lumaOf, lidYAt, scoreConfidence, hash-free math.
 *   BROWSER: analyzeEye() extracts the ROI bitmap and returns small
 *     SERIALIZABLE data (tips ≤ 64, no canvases retained).
 *
 * Low quality never invents lashes: confidence gates weaken or skip the
 * enhancement (reasons: 'eye-unusable', 'blurry', 'sparse', 'low-contrast').
 */
import { lashRoiSize } from './eyeGeometry.mjs';

export function lumaOf(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Interpolate a lid polyline (ROI px coords [{x,y}...] sorted by x) at column x. */
export function lidYAt(lidRoi, x) {
  if (!lidRoi.length) return 0;
  if (x <= lidRoi[0].x) return lidRoi[0].y;
  for (let i = 1; i < lidRoi.length; i++) {
    if (x <= lidRoi[i].x) {
      const a = lidRoi[i - 1], b = lidRoi[i];
      const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }
  return lidRoi[lidRoi.length - 1].y;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Combine quality signals into a 0..1 confidence + machine reason.
 * Pure — fully unit-testable.
 */
export function scoreConfidence({ sharp01, coverage, contrast01, usable }) {
  if (!usable) return { confidence: 0, reason: 'eye-unusable' };
  const sharpGate = smoothstep(0.008, 0.030, sharp01);
  if (sharpGate <= 0.01) return { confidence: 0, reason: 'blurry' };
  const coverGate = smoothstep(0.06, 0.30, coverage);
  if (coverGate <= 0.01) return { confidence: 0, reason: 'sparse' };
  const contrastGate = smoothstep(0.025, 0.10, contrast01);
  const confidence = Math.min(1, coverGate) * sharpGate * (0.35 + 0.65 * contrastGate);
  if (contrastGate <= 0.01) return { confidence, reason: 'low-contrast' };
  return { confidence, reason: confidence < 0.25 ? 'weak' : 'ok' };
}

/**
 * Analyze one eye. Browser-only (needs canvas); returns serializable data.
 * @param {HTMLImageElement|HTMLCanvasElement} src original photo
 * @param {object} eyeDesc from describeEye()
 * @param {'left'|'right'} side region key (never mirrored)
 */
export function analyzeEye(src, eyeDesc, side) {
  const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const empty = (reason) => ({
    side, confidence: 0, reason, sharp01: 0, coverage: 0, contrast01: 0,
    tips: [], lidRoi: [], bandH: 0, rw: 0, rh: 0,
    ms: (typeof performance !== 'undefined') ? performance.now() - t0 : 0
  });
  if (!eyeDesc || !eyeDesc.usable) return empty('eye-unusable');
  const { w: rw, h: rh } = lashRoiSize(eyeDesc.roi);
  const natW = src.naturalWidth || src.width, natH = src.naturalHeight || src.height;
  if (!natW || !natH) return empty('eye-unusable');
  const c = document.createElement('canvas');
  c.width = rw; c.height = rh;
  const x = c.getContext('2d');
  x.drawImage(src,
    eyeDesc.roi.x0 * natW, eyeDesc.roi.y0 * natH,
    (eyeDesc.roi.x1 - eyeDesc.roi.x0) * natW, (eyeDesc.roi.y1 - eyeDesc.roi.y0) * natH,
    0, 0, rw, rh);
  let data;
  try {
    data = x.getImageData(0, 0, rw, rh).data;
  } catch (e) {
    return empty('eye-unusable'); // tainted canvas: never guess, skip honestly
  }
  const luma = new Float32Array(rw * rh);
  for (let i = 0; i < rw * rh; i++) {
    luma[i] = lumaOf(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) / 255;
  }
  const toRoi = (p) => ({
    x: (p.x - eyeDesc.roi.x0) / (eyeDesc.roi.x1 - eyeDesc.roi.x0) * rw,
    y: (p.y - eyeDesc.roi.y0) / (eyeDesc.roi.y1 - eyeDesc.roi.y0) * rh
  });
  const lidRoi = eyeDesc.upperLid.map(toRoi);
  const lowRoi = eyeDesc.lowerLid.map(toRoi);
  const eyeHPx = Math.max(2, eyeDesc.h / (eyeDesc.roi.y1 - eyeDesc.roi.y0) * rh);
  const bandH = Math.min(16, Math.max(3, eyeHPx * 0.6));
  const browRoi = eyeDesc.brow ? toRoi(eyeDesc.brow) : null;
  // Inner-corner guard: caruncle must never grow lashes. Subject-left eye
  // sits image-right: its inner corner is the LEFT side of its ROI.
  const innerIsLeft = side === 'left';

  const ridge = new Float32Array(rw * rh); // 0..1 ridge strength
  const ridgeBytes = new Uint8Array(rw * rh); // retained for density (0..255)
  const inBand = new Uint8Array(rw * rh);
  let lapSum = 0, lapN = 0;
  const colSkin = new Float32Array(rw);
  // Pass 1: band membership + per-column skin reference (mean of brightest
  // third in the band — robust to the dark lashes themselves).
  for (let cx = 1; cx < rw - 1; cx++) {
    const lidY = lidYAt(lidRoi, cx);
    const lowY = lidYAt(lowRoi, cx);
    const y0 = Math.max(1, Math.floor(lidY - bandH)), y1 = Math.min(rh - 2, Math.ceil(lidY + 1));
    const vals = [];
    for (let cy = y0; cy <= y1; cy++) {
      const i = cy * rw + cx;
      // Eye-interior guard: between open lids lives iris/sclera — never lashes.
      if (lowY - lidY > 2 && cy > lidY + 1.5) continue;
      // Brow guard.
      if (browRoi && cy < browRoi.y + 4) continue;
      // Inner-corner guard (caruncle).
      const edgeX = innerIsLeft ? cx : (rw - 1 - cx);
      if (edgeX < rw * 0.10) continue;
      inBand[i] = 1;
      vals.push(luma[i]);
    }
    if (vals.length > 2) {
      vals.sort((a, b) => a - b);
      const top = vals.slice(Math.floor(vals.length * 0.66));
      colSkin[cx] = top.reduce((a, b) => a + b, 0) / top.length;
    } else {
      colSkin[cx] = -1;
    }
  }
  // Pass 2: thin-dark ridge centers + Laplacian sharpness, band only.
  let ridgeSum = 0, ridgeN = 0, colsWithRidge = 0;
  for (let cx = 1; cx < rw - 1; cx++) {
    if (colSkin[cx] < 0) continue;
    const skin = colSkin[cx];
    let colHit = false;
    for (let cy = 1; cy < rh - 1; cy++) {
      const i = cy * rw + cx;
      if (!inBand[i]) continue;
      const v = luma[i];
      const lap = Math.abs(4 * v - luma[i - 1] - luma[i + 1] - luma[i - rw] - luma[i + rw]);
      lapSum += lap; lapN++;
      const dark = skin - v;
      if (dark > 0.07) {
        const vertAvg = (luma[i - rw] + luma[i + rw]) / 2;
        if (v < vertAvg - 0.02) { // thinner than its vertical neighbours
          const s = Math.min(1, (dark - 0.07) / 0.16);
          ridge[i] = s;
          ridgeBytes[i] = Math.round(s * 255);
          ridgeSum += dark; ridgeN++;
          if (s > 0.3) colHit = true;
        }
      }
    }
    if (colHit) colsWithRidge++;
  }
  const sharp01 = lapN ? Math.min(1, (lapSum / lapN) / 0.11) : 0;
  const coverage = colsWithRidge / Math.max(1, rw - 2);
  const contrast01 = ridgeN ? (ridgeSum / ridgeN) : 0;
  const scored = scoreConfidence({ sharp01, coverage, contrast01, usable: true });
  // Tips: topmost confident ridge pixel per column (where lashes visually
  // END). Direction fans deterministically from the lid normal toward the
  // outer corner — per-eye, asymmetric, no mirroring.
  const tips = [];
  if (scored.confidence > 0) {
    const nX = eyeDesc.lidNormal.x, nY = eyeDesc.lidNormal.y;
    const outward = (side === 'left' ? 1 : -1); // image-right vs image-left
    for (let cx = 1; cx < rw - 1 && tips.length < 64; cx++) {
      for (let cy = 1; cy < rh - 1; cy++) {
        const i = cy * rw + cx;
        if (ridge[i] > 0.35) {
          const fan = (((cx * 37 + (side === 'left' ? 11 : 53)) % 100) / 100 - 0.5) * 0.9;
          const ca = Math.cos(fan), sa = Math.sin(fan);
          let dx = nX * ca - nY * sa, dy = nX * sa + nY * ca;
          dx += outward * 0.25; // lashes sweep toward the outer corner
          const len = Math.hypot(dx, dy) || 1;
          tips.push({ x: cx / rw, y: cy / rh, dx: dx / len, dy: dy / len, c: ridge[i] });
          break; // topmost only — one tip per column
        }
      }
    }
    tips.sort((a, b) => b.c - a.c);
  }
  return {
    side, confidence: scored.confidence, reason: scored.reason,
    sharp01, coverage, contrast01,
    tips, ridge: ridgeBytes,
    lidRoi: lidRoi.map((p) => ({ x: p.x / rw, y: p.y / rh })),
    bandH: bandH / rh, rw, rh,
    ms: (typeof performance !== 'undefined') ? performance.now() - t0 : 0
  };
}
