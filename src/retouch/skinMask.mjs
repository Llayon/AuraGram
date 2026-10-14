/**
 * AuraGram G1b — skin mask engine (pure geometry + canvas rasterization).
 *
 * The mask is built from REAL MediaPipe landmarks (never a fixed radial
 * gradient): filled face oval, minus feathered protected cutouts (eyes,
 * brows, lips, nostrils), conservatively refined against image content.
 *
 * Two API layers:
 *   PURE (Node-testable, no DOM): faceMetrics, protectionEllipses,
 *     eyeMaskEllipses, cheekCenters, noseTipPoint, refineFactorFor,
 *     maskSizeFor. All coordinates NORMALIZED [0,1] so masks map
 *     identically to Preview and Export (R2/R13).
 *   CANVAS (browser): buildSkinAlpha() rasterizes + refines + feathers and
 *     returns a small mask canvas (black RGB, effect strength in ALPHA).
 *
 * Design limits (honest): Face Landmarker gives geometry, NOT skin/hair
 * segmentation. Where hair, glasses or shadows are uncertain, refinement
 * only ever REDUCES alpha — never expands the mask into the background.
 */
import { clampPoint } from '../vision/faceGeometry.mjs';

/** Mask working resolution, long side px (upscaled on apply; feathered). */
export const SKIN_MASK_MAX_DIM = 384;

export function maskSizeFor(W, H) {
  const k = Math.min(1, SKIN_MASK_MAX_DIM / Math.max(W, H));
  return { w: Math.max(8, Math.round(W * k)), h: Math.max(8, Math.round(H * k)) };
}

function mean(points) {
  let x = 0, y = 0;
  for (const p of points) { x += p.x; y += p.y; }
  return { x: x / points.length, y: y / points.length };
}

function boundsOf(points) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const p of points) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/**
 * Face metrics in normalized units: center, oval size, in-plane roll angle
 * (from the eye axis), all face-relative (margins scale with the face).
 */
export function faceMetrics(regions) {
  const oval = regions.faceOval;
  const b = boundsOf(oval.map(clampPoint));
  const eyeL = mean(regions.leftEye);
  const eyeR = mean(regions.rightEye);
  return {
    cx: (b.x0 + b.x1) / 2,
    cy: (b.y0 + b.y1) / 2,
    w: Math.max(0.01, b.w),
    h: Math.max(0.01, b.h),
    angle: Math.atan2(eyeL.y - eyeR.y, eyeL.x - eyeR.x)
  };
}

/**
 * Protected cutouts as normalized ellipses (face-relative margins, NOT fixed
 * pixels): separate ellipses for each eye (incl. lash lines) and each brow
 * (centered on their own feature so the core is deepest at the right place),
 * lips, and both nostrils.
 */
export function protectionEllipses(regions) {
  const m = faceMetrics(regions);
  const fw = m.w;
  const out = [];
  for (const [eye, brow] of [[regions.leftEye, regions.leftEyebrow], [regions.rightEye, regions.rightEyebrow]]) {
    const eb = boundsOf(eye.map(clampPoint));
    const ex = { x: eb.x0, y: (eb.y0 + eb.y1) / 2 };
    const ix = { x: eb.x1, y: (eb.y0 + eb.y1) / 2 };
    out.push({
      kind: 'eye',
      cx: (eb.x0 + eb.x1) / 2,
      cy: (eb.y0 + eb.y1) / 2,
      rx: eb.w / 2 + fw * 0.035,
      ry: eb.h / 2 + fw * 0.04,
      rot: Math.atan2(ex.y - ix.y, ex.x - ix.x)
    });
    const bb = boundsOf(brow.map(clampPoint));
    out.push({
      kind: 'brow',
      cx: (bb.x0 + bb.x1) / 2,
      cy: (bb.y0 + bb.y1) / 2,
      rx: bb.w / 2 + fw * 0.03,
      ry: bb.h / 2 + fw * 0.035,
      rot: 0
    });
  }
  const lips = regions.lips.map(clampPoint);
  const lb = boundsOf(lips);
  const mouthAxis = { x: lips[10].x - lips[0].x, y: lips[10].y - lips[0].y };
  out.push({
    kind: 'lips',
    cx: (lb.x0 + lb.x1) / 2,
    cy: (lb.y0 + lb.y1) / 2,
    rx: lb.w / 2 + fw * 0.02,
    ry: lb.h / 2 + fw * 0.025,
    rot: Math.atan2(mouthAxis.y, mouthAxis.x)
  });
  const nose = regions.nose.map(clampPoint);
  const wings = [nose[nose.length - 2], nose[nose.length - 1]];
  for (const wpt of wings) {
    out.push({ kind: 'nostril', cx: wpt.x, cy: wpt.y, rx: fw * 0.016, ry: fw * 0.016, rot: 0 });
  }
  return out;
}

/** Tighter eye ellipses (lash line + iris area) for the Eyes sharpness mask. */
export function eyeMaskEllipses(regions) {
  const m = faceMetrics(regions);
  const out = [];
  for (const eye of [regions.leftEye, regions.rightEye]) {
    const eb = boundsOf(eye.map(clampPoint));
    const ex = { x: eb.x0, y: (eb.y0 + eb.y1) / 2 };
    const ix = { x: eb.x1, y: (eb.y0 + eb.y1) / 2 };
    out.push({
      kind: 'eyeSharp',
      cx: (eb.x0 + eb.x1) / 2,
      cy: (eb.y0 + eb.y1) / 2,
      rx: eb.w / 2 + m.w * 0.02,
      ry: eb.h / 2 + m.w * 0.03,
      rot: Math.atan2(ex.y - ix.y, ex.x - ix.x)
    });
  }
  return out;
}

/**
 * Cheek apples from landmarks (below the outer eye corner, beside the nose
 * wing) — heuristic placement for soft blush, documented as approximate.
 */
export function cheekCenters(regions) {
  const m = faceMetrics(regions);
  const nose = mean(regions.nose.map(clampPoint));
  const out = [];
  for (const eye of [regions.leftEye, regions.rightEye]) {
    const eb = boundsOf(eye.map(clampPoint));
    const isLeft = (eb.x0 + eb.x1) / 2 > m.cx; // image-right = subject-left
    const outerX = isLeft ? eb.x1 : eb.x0;
    out.push({
      x: outerX + (isLeft ? 1 : -1) * m.w * 0.10,
      y: nose.y - m.h * 0.06,
      r: m.w * 0.085
    });
  }
  return out;
}

export function noseTipPoint(regions) {
  const nose = regions.nose.map(clampPoint);
  return { ...(nose[4] || mean(nose)) };
}

/**
 * Conservative content refinement (pure, tested): returns a 0..1 multiplier
 * for mask alpha. Uses luminance/saturation/edge strength — NEVER hue — so
 * all skin tones and color temperatures behave the same. Only ever reduces.
 */
export function refineFactorFor(luma01, sat01, edge01) {
  let f = 1;
  // Very dark + desaturated: hair, deep shadow, nostril interior, glasses,
  // beards (which should keep their own texture, not be smoothed).
  const darkT0 = 0.10, darkT1 = 0.22;
  if (luma01 < darkT1 && sat01 < 0.35) {
    const t = Math.min(1, Math.max(0, (darkT1 - luma01) / (darkT1 - darkT0)));
    f *= 1 - 0.8 * t * (1 - sat01 / 0.35);
  }
  // Strong local edges: glasses frames, hair strands, lip borders leftovers.
  const edgeT0 = 0.18, edgeT1 = 0.45;
  if (edge01 > edgeT0) {
    const t = Math.min(1, (edge01 - edgeT0) / (edgeT1 - edgeT0));
    f *= 1 - 0.65 * t;
  }
  // Near-blown highlights keep almost full strength (specular skin is skin).
  return Math.min(1, Math.max(0.08, f));
}

/** Draw a normalized polygon onto ctx mapped to W×H (clipped to frame). */
function tracePoly(ctx, points, W, H) {
  const pts = points.map(clampPoint);
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = p.x * W, y = p.y * H;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/** Draw a normalized ellipse onto ctx mapped to W×H. */
function traceEllipse(ctx, e, W, H) {
  ctx.beginPath();
  ctx.ellipse(e.cx * W, e.cy * H, Math.max(0.5, e.rx * W), Math.max(0.5, e.ry * H), e.rot || 0, 0, Math.PI * 2);
}

/**
 * Rasterize + refine + feather the skin mask.
 * @param {CanvasRenderingContext2D} mctx context of an mw×mh canvas (output)
 * @param {object} regions face regions (normalized, from G1a store)
 * @param {HTMLImageElement|HTMLCanvasElement} sourceImage ungraded source
 * @returns {{coverage:number, featherPx:number}} quality stats
 * Output: black RGB, mask alpha in A. Protected areas cut to ~0 alpha.
 */
export function buildSkinAlpha(mctx, regions, sourceImage, mw, mh) {
  const m = faceMetrics(regions);
  const featherPx = Math.max(2, Math.min(mw, mh) * 0.035);

  // 1. Hard WHITE oval on a TRANSPARENT canvas — the SHAPE lives in alpha.
  // (Blurring an opaque-black canvas would keep alpha 1 everywhere.)
  const hard = document.createElement('canvas');
  hard.width = mw; hard.height = mh;
  const hctx = hard.getContext('2d');
  hctx.clearRect(0, 0, mw, mh);
  hctx.fillStyle = '#fff';
  tracePoly(hctx, regions.faceOval, mw, mh);
  hctx.fill();

  mctx.clearRect(0, 0, mw, mh);
  mctx.filter = `blur(${featherPx.toFixed(1)}px)`;
  mctx.drawImage(hard, 0, 0);
  mctx.filter = 'none';

  // 2. Punch HARD protection holes (alpha 1 shapes), then feather lightly so
  // cutouts stay tight but soft — no hard retouch contour, no full-frame leak.
  mctx.globalCompositeOperation = 'destination-out';
  mctx.fillStyle = '#000';
  const ells = protectionEllipses(regions);
  for (const e of ells) {
    traceEllipse(mctx, e, mw, mh);
    mctx.fill();
  }
  mctx.globalCompositeOperation = 'source-over';
  const cutBlur = Math.max(1, featherPx * 0.45);
  const soft = document.createElement('canvas');
  soft.width = mw; soft.height = mh;
  const softCtx = soft.getContext('2d');
  softCtx.filter = `blur(${cutBlur.toFixed(1)}px)`;
  softCtx.drawImage(mctx.canvas, 0, 0);
  softCtx.filter = 'none';
  mctx.clearRect(0, 0, mw, mh);
  mctx.drawImage(soft, 0, 0);
  // 3. Guaranteed zero-cores: feathering must never leave residual strength
  // on eyeballs, lips or nostrils. Re-punch shrunken hard cores, micro-feather.
  mctx.globalCompositeOperation = 'destination-out';
  mctx.fillStyle = '#000';
  for (const e of ells) {
    if (e.kind !== 'eye' && e.kind !== 'lips' && e.kind !== 'nostril') continue;
    traceEllipse(mctx, { ...e, rx: e.rx * 0.55, ry: e.ry * 0.55 }, mw, mh);
    mctx.fill();
  }
  mctx.globalCompositeOperation = 'source-over';
  const core = document.createElement('canvas');
  core.width = mw; core.height = mh;
  const coreCtx = core.getContext('2d');
  coreCtx.filter = 'blur(1px)';
  coreCtx.drawImage(mctx.canvas, 0, 0);
  coreCtx.filter = 'none';
  mctx.clearRect(0, 0, mw, mh);
  mctx.drawImage(core, 0, 0);

  // 3. Conservative content refinement on ungraded source pixels.
  const small = document.createElement('canvas');
  small.width = mw; small.height = mh;
  const sctx = small.getContext('2d');
  sctx.drawImage(sourceImage, 0, 0, mw, mh);
  let coverage = 0;
  try {
    const maskData = mctx.getImageData(0, 0, mw, mh);
    const srcData = sctx.getImageData(0, 0, mw, mh);
    const ma = maskData.data, sa = srcData.data;
    const luma = new Float32Array(mw * mh);
    for (let i = 0; i < mw * mh; i++) {
      const r = sa[i * 4], g = sa[i * 4 + 1], b = sa[i * 4 + 2];
      luma[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
    let sum = 0;
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const i = y * mw + x;
        const a = ma[i * 4 + 3] / 255;
        if (a <= 0.003) continue;
        const r = sa[i * 4], g = sa[i * 4 + 1], b = sa[i * 4 + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const sat = mx === 0 ? 0 : (mx - mn) / mx;
        const xl = x > 0 ? luma[i - 1] : luma[i];
        const xr = x < mw - 1 ? luma[i + 1] : luma[i];
        const yu = y > 0 ? luma[i - mw] : luma[i];
        const yd = y < mh - 1 ? luma[i + mw] : luma[i];
        const edge = Math.min(1, Math.hypot(xr - xl, yd - yu) * 2.2);
        const f = refineFactorFor(luma[i], sat, edge);
        const na = a * f;
        ma[i * 4] = 0; ma[i * 4 + 1] = 0; ma[i * 4 + 2] = 0;
        ma[i * 4 + 3] = Math.round(na * 255);
        sum += na;
      }
    }
    mctx.putImageData(maskData, 0, 0);
    coverage = sum / (mw * mh);
  } catch (e) {
    // getImageData can throw on tainted canvases — keep the geometric mask.
    const img = mctx.getImageData(0, 0, mw, mh);
    let sum = 0;
    for (let i = 3; i < img.data.length; i += 4) sum += img.data[i] / 255;
    coverage = sum / (mw * mh);
  }
  return { coverage, featherPx };
}

/**
 * Rasterize an eye-sharpness mask (white RGB, strength in alpha) for the
 * Eyes tool. Same feathering discipline, tighter ellipses.
 */
export function buildEyeAlpha(mctx, regions, mw, mh) {
  const m = faceMetrics(regions);
  mctx.clearRect(0, 0, mw, mh);
  mctx.fillStyle = '#fff';
  for (const e of eyeMaskEllipses(regions)) {
    traceEllipse(mctx, e, mw, mh);
    mctx.fill();
  }
  const blurPx = Math.max(1, Math.min(mw, mh) * 0.02 + m.w * Math.min(mw, mh) * 0.01);
  const soft = document.createElement('canvas');
  soft.width = mw; soft.height = mh;
  const sctx = soft.getContext('2d');
  sctx.filter = `blur(${blurPx.toFixed(1)}px)`;
  sctx.drawImage(mctx.canvas, 0, 0);
  sctx.filter = 'none';
  mctx.clearRect(0, 0, mw, mh);
  mctx.drawImage(soft, 0, 0);
  return { featherPx: blurPx };
}
