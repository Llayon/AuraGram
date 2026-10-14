/**
 * AuraGram G1a — debug face overlay (?debugFace=1).
 *
 * Draws ONLY on a dedicated overlay canvas stacked above the editor canvas.
 * It is never composited into Preview or Export pixels (F9), never intercepts
 * input (pointer-events: none in CSS), and rescales 1:1 with the canvas it
 * mirrors (same attribute size → normalized coords map identically).
 */
import { toPixels } from './faceGeometry.mjs';

export const REGION_COLORS = {
  faceOval: '#22d3ee',
  leftEye: '#f472b6',
  rightEye: '#fb923c',
  leftEyebrow: '#a78bfa',
  rightEyebrow: '#c4b5fd',
  lips: '#fb7185',
  nose: '#facc15'
};

const REGION_ORDER = ['faceOval', 'leftEye', 'rightEye', 'leftEyebrow', 'rightEyebrow', 'lips', 'nose'];

export function clearOverlay(ctx2d, W, H) {
  ctx2d.clearRect(0, 0, W, H);
}

/** Draw every stored face: region polylines + landmark dots. */
export function drawFaceOverlay(ctx2d, store, W, H) {
  clearOverlay(ctx2d, W, H);
  if (!store || !Array.isArray(store.faces) || store.faces.length === 0) return 0;
  let dots = 0;
  ctx2d.save();
  ctx2d.lineWidth = Math.max(1.5, Math.min(W, H) / 300);
  for (const face of store.faces) {
    for (const key of REGION_ORDER) {
      const pts = (face.regions && face.regions[key]) || [];
      if (pts.length === 0) continue;
      ctx2d.strokeStyle = REGION_COLORS[key];
      ctx2d.fillStyle = REGION_COLORS[key];
      ctx2d.globalAlpha = 0.9;
      ctx2d.beginPath();
      pts.forEach((p, i) => {
        const q = toPixels(p, W, H);
        if (i === 0) ctx2d.moveTo(q.x, q.y);
        else ctx2d.lineTo(q.x, q.y);
      });
      ctx2d.closePath();
      ctx2d.stroke();
      ctx2d.globalAlpha = 0.55;
      for (const p of pts) {
        const q = toPixels(p, W, H);
        ctx2d.beginPath();
        ctx2d.arc(q.x, q.y, Math.max(1.2, Math.min(W, H) / 420), 0, Math.PI * 2);
        ctx2d.fill();
        dots += 1;
      }
    }
    ctx2d.globalAlpha = 1;
  }
  ctx2d.restore();
  return dots;
}
