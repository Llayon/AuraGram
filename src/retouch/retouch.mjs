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
 *
 * G1b.1 COMPOSITING CONTRACT (isolation):
 *   Global preset + adjustments are independent of Beauty. Each local pass
 *   touches ONLY its allowed region (contribution = intensity × mask):
 *     Smooth  ⊂ skin mask · Anti-red ⊂ skin mask · Glow ⊂ skin mask
 *     Eyes    ⊂ eye mask  · Blush ⊂ cheeks ∩ skin mask · Sculpt ⊂ skin mask
 *   Soft mask edges allow a feathered falloff inside; outside the mask the
 *   pass contributes zero. No pass uses `destination-in` on the main photo
 *   canvas (only on private layers). G1b.1 audit: Smooth/Antired/Glow/Eyes/
 *   Sculpt already satisfied the contract; Blush was fixed to intersect its
 *   color layer with S.maskSkin before compositing.
 *
 * G1c — natural lash enhancement (separate local pass, Eyes → Lashes):
 *   Upper lashes only, strictly inside per-eye ROI ∩ lash band. Analysis
 *   (ridge detection on the ORIGINAL photo) runs once per photo and is
 *   cached; warm renders only apply. All-zero lashes skip without touching
 *   any canvas (G1b.1 golden identity holds).
 */
import '../rendering/canvasFilters.js';
const {drawFiltered} = globalThis.AuraGramCanvasFilters;
import {
  maskSizeFor,
  faceMetrics,
  cheekCenters,
  noseTipPoint,
  buildSkinAlpha,
  buildEyeAlpha
} from './skinMask.mjs';
import { describeEyes } from './eyeGeometry.mjs';
import { analyzeEye } from './lashAnalysis.mjs';
import { applyLashPass, isNeutralLashes } from './lashEnhancement.mjs';

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
    low: null,   // smoothed graded target, cached by source/mask/filter
    lowKey: '', lowSource: null, lowRadius: 0,
    lowMasked: null,
    temp: null,  // rgb+mask combine (per pass)
    dered: null, // de-reddened target (cached per imageId+gradeSig)
    deredKey: '',
    // G1c lash state: analysis cached per photo (grade/resolution independent),
    // three small ROI scratch buffers reused across renders (never per tick).
    lashKey: '',
    lashEyes: null,  // {left,right} eye descriptions (normalized)
    lashAn: null,    // {left,right} serializable analysis results
    lashC1: null, lashC2: null, lashMask: null,
    lastMaskMs: 0,
    lastRetouchMs: 0,
    lastDeredMs: 0,
    lastLashAnalyseMs: 0,
    lastLashEnhanceMs: 0
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
    S.lowKey = '';
    S.lastMaskMs = performance.now() - t0;
  }

  function ensureLow(W, H, src, gradeFilter, face) {
    const key = `${S.key}|${gradeFilter}`;
    if (S.lowKey === key && S.lowSource && S.lowSource.deref() === src) return S.lowRadius;
    S.low = sizeCanvas(S.low, S.mw, S.mh);
    const lctx = S.low.getContext('2d');
    const m = faceMetrics(face.regions);
    const facePx = m.w * S.mw;
    const r = Math.min(18, Math.max(1.5, facePx * 0.045));
    lctx.clearRect(0, 0, S.mw, S.mh);
    drawFiltered(lctx, src, `${gradeFilter} blur(${r.toFixed(1)}px)`, 0, 0, S.mw, S.mh);
    S.lowKey = key; S.lowSource = new WeakRef(src); S.lowRadius = r;
    S.lowMasked = sizeCanvas(S.lowMasked, S.mw, S.mh);
    const masked = S.lowMasked.getContext('2d');
    masked.clearRect(0, 0, S.mw, S.mh);
    masked.drawImage(S.low, 0, 0);
    masked.globalCompositeOperation = 'destination-in';
    masked.drawImage(S.maskSkin, 0, 0);
    masked.globalCompositeOperation = 'source-over';
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

  /**
   * G1c: lash analysis, once per photo. Grade- and resolution-independent by
   * design (normalized geometry + fixed-size ROI bitmaps from the ORIGINAL),
   * so slider moves and Preview/Export never re-run it. Returns true when
   * fresh analysis ran, false on warm cache hit.
   */
  function ensureLashAnalysis(face, src) {
    const key = `${face.imageId}`;
    if (S.lashKey === key && S.lashAn) return false;
    const t0 = performance.now();
    const m = faceMetrics(face.regions);
    const eyes = describeEyes(face.regions, m.w);
    let an = null;
    try {
      an = {
        left: analyzeEye(src, eyes.left, 'left'),
        right: analyzeEye(src, eyes.right, 'right')
      };
    } catch (e) {
      an = null; // analysis must never break the editor; pass skips below
    }
    S.lashEyes = eyes;
    S.lashAn = an;
    S.lashKey = key;
    S.lastLashAnalyseMs = performance.now() - t0;
    return true;
  }

  function applyEyes(tctx, W, H, src, face, strength, buffers) {    const { detailBuffer, detailCtx } = buffers;
    if (detailBuffer.width !== W || detailBuffer.height !== H) {
      detailBuffer.width = W; detailBuffer.height = H;
    }
    detailCtx.clearRect(0, 0, W, H);
    drawFiltered(detailCtx, src, 'contrast(150%) brightness(99%) saturate(110%)', 0, 0, W, H);
    detailCtx.globalCompositeOperation = 'destination-in';
    detailCtx.drawImage(S.maskEyes, 0, 0, W, H);
    detailCtx.globalCompositeOperation = 'source-over';
    tctx.save();
    tctx.globalCompositeOperation = 'overlay';
    tctx.globalAlpha = strength;
    tctx.drawImage(detailBuffer, 0, 0, W, H);
    tctx.restore();
  }

  function applyBlush(tctx, W, H, face, strength, buffers) {
    // G1b.1 P0-B fix: blush is painted on a separate transparent layer and
    // then masked by S.maskSkin (skin ∩ ¬eyes/brows/lips/nostrils) via
    // `destination-in` BEFORE touching the photo. Never apply
    // `destination-in` to the main canvas — that would destroy pixels
    // outside the mask. Reuses the shared detailBuffer (no new fullscreen
    // canvas per slider tick); same cheek geometry and soft-light look as
    // before, now strictly with contribution = intensity × skin mask.
    // G1c (Phase 1.1): the unmasked fallback is REMOVED. Without a valid
    // buffer layer there is no masked path, so the pass safely skips (the
    // photo is left untouched) instead of painting unmasked color.
    const { detailBuffer, detailCtx } = buffers || {};
    if (!detailBuffer || !detailCtx) return;
    const cheeks = cheekCenters(face.regions);
    if (detailBuffer.width !== W || detailBuffer.height !== H) {
      detailBuffer.width = W; detailBuffer.height = H;
    }
    detailCtx.save();
    detailCtx.globalCompositeOperation = 'source-over';
    detailCtx.globalAlpha = 1;
    detailCtx.filter = 'none';
    detailCtx.clearRect(0, 0, W, H);
    for (const c of cheeks) {
      const cx = Math.min(W, Math.max(0, c.x * W));
      const cy = Math.min(H, Math.max(0, c.y * H));
      const r = Math.max(8, c.r * Math.min(W, H));
      const g = detailCtx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      g.addColorStop(0, `rgba(255, 138, 101, ${0.5 * strength})`);
      g.addColorStop(0.6, `rgba(251, 113, 133, ${0.3 * strength})`);
      g.addColorStop(1, 'rgba(251, 113, 133, 0)');
      detailCtx.fillStyle = g;
      detailCtx.fillRect(0, 0, W, H);
    }
    // Intersect with the cached skin mask (upscaled, feathered).
    detailCtx.globalCompositeOperation = 'destination-in';
    detailCtx.drawImage(S.maskSkin, 0, 0, W, H);
    detailCtx.globalCompositeOperation = 'source-over';
    detailCtx.restore();
    tctx.save();
    tctx.globalCompositeOperation = 'soft-light';
    tctx.globalAlpha = 1;
    tctx.drawImage(detailBuffer, 0, 0, W, H);
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
    const { face, beauty, lashes, src, gradeFilter, gradeSig, buffers } = opts;
    if (!hasFace(face)) return { ran: [], ms: 0 };
    ensureMasks(face, W, H, src);
    const ran = [];
    const v = beauty;
    const needLow = v.smooth > 0 || v.glow > 0 || v.antired > 0;
    if (needLow) ensureLow(W, H, src, gradeFilter, face);
    if (v.smooth > 0) {
      maskedColorOver(tctx, W, H, S.lowMasked, smoothCurve(v.smooth));
      ran.push('smooth');
    }
    if (v.antired > 0) {
      ensureDered(face, gradeSig);
      maskedColorOver(tctx, W, H, maskCombine(S.dered), antiredCurve(v.antired));
      ran.push('antired');
    }
    if (v.glow > 0) {
      const temp = S.lowMasked;
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
    // G1c: separate local lash pass (upper lashes only, ROI-clipped).
    // Documented order: Eyes → Lashes → Blush → Sculpt. No intensity
    // coupling with Eyes: both may sharpen nearby pixels, each stays small.
    if (!isNeutralLashes(lashes)) {
      ensureLashAnalysis(face, src);
      if (S.lashEyes && S.lashAn) {
        const t1 = performance.now();
        // Three small ROI scratch buffers, reused across renders (L21).
        const scratch = { c1: S.lashC1, c2: S.lashC2, mask: S.lashMask };
        const res = applyLashPass(tctx, W, H, S.lashEyes, S.lashAn, lashes, scratch);
        S.lashC1 = scratch.c1; S.lashC2 = scratch.c2; S.lashMask = scratch.mask;
        S.lastLashEnhanceMs = performance.now() - t1;
        res.ran.forEach((r) => { if (!ran.includes(r)) ran.push(r); });
        if (!ran.includes('lashes') && res.ran.length) ran.push('lashes');
      }
    }
    if (v.blush > 0) {
      applyBlush(tctx, W, H, face, blushCurve(v.blush), buffers);
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

  /** Lash debug overlay (separate canvas, never exported): ROI, lid, tips. */
  function paintDebugLashes(octx, W, H) {
    octx.clearRect(0, 0, W, H);
    if (!S.lashEyes || !S.lashAn) return null;
    const info = [];
    for (const side of ['left', 'right']) {
      const desc = S.lashEyes[side], an = S.lashAn[side];
      if (!desc || !desc.usable || !an) continue;
      const rx0 = desc.roi.x0 * W, ry0 = desc.roi.y0 * H;
      const rx1 = desc.roi.x1 * W, ry1 = desc.roi.y1 * H;
      octx.save();
      octx.strokeStyle = '#22d3ee';
      octx.lineWidth = Math.max(1, W * 0.002);
      octx.strokeRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
      // Upper lid line (pink).
      octx.strokeStyle = '#f472b6';
      octx.beginPath();
      desc.upperLid.forEach((p, i) => {
        const x = p.x * W, y = p.y * H;
        if (i === 0) octx.moveTo(x, y);
        else octx.lineTo(x, y);
      });
      octx.stroke();
      // Confident tips (yellow) + directions (green).
      octx.fillStyle = '#facc15';
      octx.strokeStyle = '#4ade80';
      for (const t of (an.tips || []).slice(0, 32)) {
        const tx = (desc.roi.x0 + t.x * (desc.roi.x1 - desc.roi.x0)) * W;
        const ty = (desc.roi.y0 + t.y * (desc.roi.y1 - desc.roi.y0)) * H;
        octx.fillRect(tx - 1, ty - 1, 2, 2);
        octx.beginPath();
        octx.moveTo(tx, ty);
        octx.lineTo(tx + t.dx * 8, ty + t.dy * 8);
        octx.stroke();
      }
      octx.fillStyle = '#fff';
      octx.font = `${Math.max(10, Math.round(W * 0.018))}px monospace`;
      octx.fillText(`${side} c=${an.confidence.toFixed(2)} ${an.reason} n=${(an.tips || []).length}`, rx0 + 2, ry0 + 12);
      octx.restore();
      info.push({ side, confidence: an.confidence, reason: an.reason, tips: (an.tips || []).length });
    }
    return info;
  }

  /** Bounded buffer inventory for the L21 memory audit. */
  function lashBufferInfo() {
    const canvases = [S.maskSkin, S.maskEyes, S.low, S.lowMasked, S.temp, S.dered, S.lashC1, S.lashC2, S.lashMask].filter(Boolean);
    let bytes = 0;
    for (const c of canvases) bytes += (c.width || 0) * (c.height || 0) * 4;
    return { count: canvases.length, bytes };
  }

  return {
    applyPasses, ensureMasks, paintDebugSkin, debugMaskDataUrl,
    paintDebugLashes, lashBufferInfo,
    ensureLashAnalysis,
    lashInfo: () => (S.lashAn ? {
      key: S.lashKey,
      left: { confidence: S.lashAn.left.confidence, reason: S.lashAn.left.reason, tips: S.lashAn.left.tips.length },
      right: { confidence: S.lashAn.right.confidence, reason: S.lashAn.right.reason, tips: S.lashAn.right.tips.length }
    } : null),
    curves: { smoothCurve, antiredCurve, glowCurve, eyesCurve, blushCurve, sculptCurve },
    timings: () => ({ maskBuildMs: S.lastMaskMs, retouchMs: S.lastRetouchMs, deredMs: S.lastDeredMs, lashAnalyseMs: S.lastLashAnalyseMs, lashEnhanceMs: S.lastLashEnhanceMs }),
    cacheKey: () => S.key
  };
}
