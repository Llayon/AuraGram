/**
 * AuraGram G1b — local retouch engine (face-aware beauty passes).
 *
 * Core idea (honest frequency separation in the CHROMA domain):
 * large-scale blotchiness/redness lives in low-frequency chroma, while
 * pores, moles, freckles, lashes and folds live mostly in luminance detail.
 * Each pass draws a smoothed target into a small canvas, bakes the cached
 * skin mask into its alpha, and composites with 'color' (keeps destination
 * luminance). Texture is preserved BY CONSTRUCTION: destination luma is
 * never touched by smooth/antired. Protected regions (alpha 0) and the
 * background stay pixel-identical (R3/R4/R5).
 *
 * No pass runs without valid face geometry (R9). Slider 0 skips the pass
 * entirely, so zero strength is identity (R7). Curves are nonlinear and
 * monotonic (R6). Everything is resolution-relative, so Preview and Export
 * share settings and order (R13).
 */
import {
  maskSizeFor,
  faceMetrics,
  cheekCenters,
  noseTipPoint,
  buildSkinAlpha,
  buildEyeAlpha
} from './skinMask.mjs';

/** Nonlinear intensity curves (0..100 → 0..maxK). Monotonic by construction. */
export function smoothCurve(v) { return Math.pow(Math.min(100, Math.max(0, v)) / 100, 1.4) * 0.9; }
export function antiredCurve(v) { return Math.pow(Math.min(100, Math.max(0, v)) / 100, 1.2) * 1.0; }
export function glowCurve(v) { return Math.pow(Math.min(100, Math.max(0, v)) / 100, 1.3) * 0.32; }
export function eyesCurve(v) { return Math.pow(Math.min(100, Math.max(0, v)) / 100, 1.1) * 0.5; }
export function blushCurve(v) { return Math.pow(Math.min(100, Math.max(0, v)) / 100, 1.2) * 0.5; }
export function sculptCurve(v) { return Math.pow(Math.min(100, Math.max(0, v)) / 100, 1.2) * 0.55; }

/** Max relative pull of the red-green axis in the de-red target (0..1). */
export const DERED_MAX_PULL = 0.42;
/** Dead zone: redness below this gets (almost) no correction. */
export const DERED_DEAD = 0.06;
/** Full correction at/above this redness. */
export const DERED_FULL = 0.35;

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function hasFace(face) {
  return !!(face && face.regions && Array.isArray(face.regions.faceOval) && face.regions.faceOval.length >= 10);
}

export function createRetouchSession() {
  const S = {
    key: '',
    maskSkin: null, // black RGB + mask alpha, maskSizeFor(W,H)
    maskEyes: null, // white RGB + eye alpha
    mw: 0, mh: 0,
    low: null,   // smoothed graded target (per render)
    temp: null,  // rgb+mask combine (per pass)
    dered: null, // de-reddened target (cached per imageId+gradeSig)
    deredKey: '',
    lastMaskMs: 0,
    lastRetouchMs: 0,
    lastDeredMs: 0
  };

  function sizeCanvas(c, w, h) {
    if (!c) {
      c = document.createElement('canvas');
      c.width = w; c.height = h;
      return c;
    }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  function ensureMasks(face, W, H, sourceImage) {
    const key = `${face.imageId}:${W}x${H}`;
    if (S.key === key && S.maskSkin) return;
    const t0 = performance.now();
    const { w: mw, h: mh } = maskSizeFor(W, H);
    S.mw = mw; S.mh = mh;
    S.maskSkin = sizeCanvas(S.maskSkin, mw, mh);
    const mctx = S.maskSkin.getContext('2d');
    buildSkinAlpha(mctx, face.regions, sourceImage, mw, mh);
    S.maskEyes = sizeCanvas(S.maskEyes, mw, mh);
    buildEyeAlpha(S.maskEyes.getContext('2d'), face.regions, mw, mh);
    S.key = key;
    S.deredKey = ''; // mask change invalidates the de-red cache too
    S.lastMaskMs = performance.now() - t0;
  }

  function ensureLow(W, H, src, gradeFilter, face) {
    S.low = sizeCanvas(S.low, S.mw, S.mh);
    const lctx = S.low.getContext('2d');
    const m = faceMetrics(face.regions);
    const facePx = m.w * S.mw;
    const r = Math.min(18, Math.max(1.5, facePx * 0.045));
    lctx.clearRect(0, 0, S.mw, S.mh);
    lctx.filter = `${gradeFilter} blur(${r.toFixed(1)}px)`;
    lctx.drawImage(src, 0, 0, S.mw, S.mh);
    lctx.filter = 'none';
    return r;
  }

  /** Combine rgb source with the cached skin alpha into temp (maskRes). */
  function maskCombine(rgbCanvas) {
    S.temp = sizeCanvas(S.temp, S.mw, S.mh);
    const tctx = S.temp.getContext('2d');
    tctx.clearRect(0, 0, S.mw, S.mh);
    tctx.drawImage(rgbCanvas, 0, 0);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(S.maskSkin, 0, 0);
    tctx.globalCompositeOperation = 'source-over';
    return S.temp;
  }

  function maskedColorOver(tctx, W, H, tempCanvas, strength) {
    tctx.save();
    tctx.globalCompositeOperation = 'color';
    tctx.globalAlpha = strength;
    tctx.drawImage(tempCanvas, 0, 0, W, H);
    tctx.restore();
  }

  function ensureDered(face, gradeSig) {
    const key = `${face.imageId}|${gradeSig}`;
    if (S.deredKey === key && S.dered) return;
    const t0 = performance.now();
    S.dered = sizeCanvas(S.dered, S.mw, S.mh);
    const lctx = S.low.getContext('2d');
    const img = lctx.getImageData(0, 0, S.mw, S.mh);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const redness = ((r - g) + (r - b)) / 510; // ~[-1, 1]
      if (redness <= DERED_DEAD) continue;
      const pull = smoothstep(DERED_DEAD, DERED_FULL, redness) * DERED_MAX_PULL;
      // Pull green/blue toward red (reduces R-G/R-B gaps), luma ~preserved.
      d[i + 1] = Math.min(255, g + (r - g) * pull * 0.5);
      d[i + 2] = Math.min(255, b + (r - b) * pull * 0.25);
    }
    const dctx = S.dered.getContext('2d');
    dctx.putImageData(img, 0, 0);
    S.deredKey = key;
    S.lastDeredMs = performance.now() - t0;
  }

  function applyEyes(tctx, W, H, src, face, strength, buffers) {
    const { detailBuffer, detailCtx } = buffers;
    if (detailBuffer.width !== W || detailBuffer.height !== H) {
      detailBuffer.width = W; detailBuffer.height = H;
    }
    detailCtx.clearRect(0, 0, W, H);
    detailCtx.filter = 'contrast(150%) brightness(99%) saturate(110%)';
    detailCtx.drawImage(src, 0, 0, W, H);
    detailCtx.filter = 'none';
    detailCtx.globalCompositeOperation = 'destination-in';
    detailCtx.drawImage(S.maskEyes, 0, 0, W, H);
    detailCtx.globalCompositeOperation = 'source-over';
    tctx.save();
    tctx.globalCompositeOperation = 'overlay';
    tctx.globalAlpha = strength;
    tctx.drawImage(detailBuffer, 0, 0, W, H);
    tctx.restore();
  }

  function applyBlush(tctx, W, H, face, strength) {
    const cheeks = cheekCenters(face.regions);
    tctx.save();
    tctx.globalCompositeOperation = 'soft-light';
    for (const c of cheeks) {
      const cx = Math.min(W, Math.max(0, c.x * W));
      const cy = Math.min(H, Math.max(0, c.y * H));
      const r = Math.max(8, c.r * Math.min(W, H));
      const g = tctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      g.addColorStop(0, `rgba(255, 138, 101, ${0.5 * strength})`);
      g.addColorStop(0.6, `rgba(251, 113, 133, ${0.3 * strength})`);
      g.addColorStop(1, 'rgba(251, 113, 133, 0)');
      tctx.fillStyle = g;
      tctx.fillRect(0, 0, W, H);
    }
    tctx.restore();
  }

  function applySculpt(tctx, W, H, face, strength, buffers) {
    // Honest limited sculpt: face-anchored dodge & burn, STRICTLY inside the
    // skin mask (no global vignette masquerading as 3D). No geometry change,
    // no thinning, no feature reshaping — light correction only.
    const nose = noseTipPoint(face.regions);
    const m = faceMetrics(face.regions);
    const nx = nose.x * W, ny = nose.y * H;
    const fw = m.w * Math.min(W, H);
    const { detailBuffer, detailCtx } = buffers;
    if (detailBuffer.width !== W || detailBuffer.height !== H) {
      detailBuffer.width = W; detailBuffer.height = H;
    }
    const layer = (paint, composite) => {
      detailCtx.clearRect(0, 0, W, H);
      paint();
      detailCtx.globalCompositeOperation = 'destination-in';
      detailCtx.drawImage(S.maskSkin, 0, 0, W, H);
      detailCtx.globalCompositeOperation = 'source-over';
      tctx.save();
      tctx.globalCompositeOperation = composite;
      tctx.drawImage(detailBuffer, 0, 0, W, H);
      tctx.restore();
    };
    layer(() => {
      const dodge = detailCtx.createRadialGradient(nx, ny, fw * 0.03, nx, ny, fw * 0.34);
      dodge.addColorStop(0, `rgba(255, 252, 248, ${0.5 * strength})`);
      dodge.addColorStop(1, 'rgba(255, 255, 255, 0)');
      detailCtx.fillStyle = dodge;
      detailCtx.fillRect(0, 0, W, H);
    }, 'soft-light');
    layer(() => {
      const burn = detailCtx.createRadialGradient(m.cx * W, m.cy * H, fw * 0.28, m.cx * W, m.cy * H, fw * 0.85);
      burn.addColorStop(0, 'rgba(0, 0, 0, 0)');
      burn.addColorStop(1, `rgba(12, 10, 18, ${0.55 * strength})`);
      detailCtx.fillStyle = burn;
      detailCtx.fillRect(0, 0, W, H);
    }, 'multiply');
  }

  /**
   * Run face-aware beauty passes. Reads the graded image already on tctx.
   * gradeSig identifies the grade for the de-red cache; gradeFilter rebuilds
   * the smoothed target from the ORIGINAL source (same grade as the base).
   */
  function applyPasses(tctx, W, H, opts) {
    const t0 = performance.now();
    const { face, beauty, src, gradeFilter, gradeSig, buffers } = opts;
    if (!hasFace(face)) return { ran: [], ms: 0 };
    ensureMasks(face, W, H, src);
    const ran = [];
    const v = beauty;
    const needLow = v.smooth > 0 || v.glow > 0 || v.antired > 0;
    if (needLow) ensureLow(W, H, src, gradeFilter, face);
    if (v.smooth > 0) {
      maskedColorOver(tctx, W, H, maskCombine(S.low), smoothCurve(v.smooth));
      ran.push('smooth');
    }
    if (v.antired > 0) {
      ensureDered(face, gradeSig);
      maskedColorOver(tctx, W, H, maskCombine(S.dered), antiredCurve(v.antired));
      ran.push('antired');
    }
    if (v.glow > 0) {
      const temp = maskCombine(S.low);
      tctx.save();
      tctx.globalCompositeOperation = 'soft-light';
      tctx.globalAlpha = glowCurve(v.glow);
      tctx.drawImage(temp, 0, 0, W, H);
      tctx.restore();
      ran.push('glow');
    }
    if (v.eyes > 0) {
      applyEyes(tctx, W, H, src, face, eyesCurve(v.eyes), buffers);
      ran.push('eyes');
    }
    if (v.blush > 0) {
      applyBlush(tctx, W, H, face, blushCurve(v.blush));
      ran.push('blush');
    }
    if (v.sculpt > 0) {
      applySculpt(tctx, W, H, face, sculptCurve(v.sculpt), buffers);
      ran.push('sculpt');
    }
    const ms = performance.now() - t0;
    S.lastRetouchMs = ms;
    return { ran, ms };
  }

  /** Green debug visualization of the cached skin mask (never exported). */
  function paintDebugSkin(octx, W, H) {
    octx.clearRect(0, 0, W, H);
    if (!S.maskSkin) return 0;
    octx.save();
    octx.globalAlpha = 0.55;
    octx.drawImage(S.maskSkin, 0, 0, W, H);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = '#22ff88';
    octx.fillRect(0, 0, W, H);
    octx.restore();
    return 1;
  }

  function debugMaskDataUrl() {
    if (!S.maskSkin) return null;
    const c = document.createElement('canvas');
    c.width = S.maskSkin.width; c.height = S.maskSkin.height;
    const x = c.getContext('2d');
    x.drawImage(S.maskSkin, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#22ff88';
    x.fillRect(0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  return {
    applyPasses, ensureMasks, paintDebugSkin, debugMaskDataUrl,
    curves: { smoothCurve, antiredCurve, glowCurve, eyesCurve, blushCurve, sculptCurve },
    timings: () => ({ maskBuildMs: S.lastMaskMs, retouchMs: S.lastRetouchMs, deredMs: S.lastDeredMs }),
    cacheKey: () => S.key
  };
}
