/**
 * AuraGram G1c — natural lash enhancement applicator (browser canvas ops).
 *
 * Three INDEPENDENT params (0..100, nonlinear conservative curves):
 *   density    — darkens DETECTED ridge pixels only (multiply). Gaps between
 *                hairs are never painted, so no solid strip can form.
 *   length     — extends CONFIDENT ridge tips a few px along their stored
 *                direction with a fading taper. Capped, deterministic,
 *                progressively revealed (stable order, existing tips never
 *                move). Auto-skipped on low confidence — never faked by
 *                darkening the lid line (that would be dishonest).
 *   definition — masked local contrast (contrast-filtered copy, overlay) of
 *                the lash band only. Never a raw rect brightness/contrast.
 *
 * Protected BY CONSTRUCTION: every layer is clipped to its Eye ROI rect and
 * masked to the upper-lash band (above the upper lid). Iris, pupil, sclera
 * (below the lid), inner corner, brow, cheek, hair, background cannot be
 * touched — the pixels are never drawn there.
 */

/** Nonlinear conservative strength curves (0..100 → factor). Monotonic. */
export function lashDensityCurve(v) { return Math.pow(Math.min(100, Math.max(0, v)) / 100, 1.3) * 0.5; }
export function lashLengthCurve(v) { return Math.pow(Math.min(100, Math.max(0, v)) / 100, 1.2); }
export function lashDefinitionCurve(v) { return Math.pow(Math.min(100, Math.max(0, v)) / 100, 1.1) * 0.45; }

export function isNeutralLashes(l) {
  return !l || (l.density === 0 && l.length === 0 && l.definition === 0);
}

export function lashCorrectionCount(l) {
  if (!l) return 0;
  return (l.density > 0 ? 1 : 0) + (l.length > 0 ? 1 : 0) + (l.definition > 0 ? 1 : 0);
}

function sizeCanvas(c, w, h) {
  if (!c) {
    c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}

/**
 * Build the applicator mask (white band on transparent) for one eye.
 * lidPts: lid polyline in ROI-output px; bandUpPx: band height px;
 * browY: brow y in ROI-output px (null when unknown).
 */
function buildBandMask(mctx, mw, mh, lidPts, bandUpPx, browY, innerIsLeft, scale) {
  mctx.clearRect(0, 0, mw, mh);
  if (lidPts.length < 2) return false;
  // Skip the inner-corner 10% (caruncle guard).
  const pts = lidPts;
  mctx.save();
  const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
  const guard = (maxX - minX) * 0.10;
  mctx.beginPath();
  mctx.rect(innerIsLeft ? minX + guard : minX, 0, maxX - minX - guard, mh);
  mctx.clip();
  mctx.filter = `blur(${scale}px)`;
  mctx.fillStyle = '#fff';
  mctx.beginPath();
  pts.forEach((p, i) => {
    const y = Math.max(0, Math.min(p.y, browY != null ? Math.max(p.y - bandUpPx, browY + 2 * scale) : p.y - bandUpPx));
    if (i === 0) mctx.moveTo(p.x, y);
    else mctx.lineTo(p.x, y);
  });
  for (let i = pts.length - 1; i >= 0; i--) {
    mctx.lineTo(pts[i].x, Math.min(mh, pts[i].y + 1.5 * scale));
  }
  mctx.closePath();
  mctx.fill();
  mctx.filter = 'none';
  mctx.restore();
  return true;
}

/**
 * Run the lash pass. Reads the graded image on tctx, writes locally.
 * @returns {{ran:string[], ms:number, perEye:Array}}
 */
export function applyLashPass(tctx, W, H, eyeDescs, analyses, lashes, scratch) {
  const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const perEye = [];
  if (isNeutralLashes(lashes) || !eyeDescs) {
    return { ran: [], ms: 0, perEye };
  }
  const densK = lashDensityCurve(lashes.density);
  const lenK = lashLengthCurve(lashes.length);
  const defK = lashDefinitionCurve(lashes.definition);
  const ran = [];
  const scale = Math.min(W, H) / 720;
  const eyes = [
    { desc: eyeDescs.left, an: analyses && analyses.left, innerIsLeft: true },
    { desc: eyeDescs.right, an: analyses && analyses.right, innerIsLeft: false }
  ];
  for (const { desc, an, innerIsLeft } of eyes) {
    if (!desc || !desc.usable || !an || an.confidence <= 0) {
      perEye.push({ usable: !!(desc && desc.usable), confidence: an ? an.confidence : 0, reason: an ? an.reason : 'eye-unusable', ran: [] });
      continue;
    }
    const rx0 = Math.max(0, Math.round(desc.roi.x0 * W));
    const ry0 = Math.max(0, Math.round(desc.roi.y0 * H));
    const rx1 = Math.min(W, Math.round(desc.roi.x1 * W));
    const ry1 = Math.min(H, Math.round(desc.roi.y1 * H));
    const rw = rx1 - rx0, rh = ry1 - ry0;
    if (rw < 8 || rh < 6) {
      perEye.push({ usable: true, confidence: an.confidence, reason: 'roi-too-small', ran: [] });
      continue;
    }
    const eyeRan = [];
    const toOut = (p) => ({
      x: (p.x - desc.roi.x0) / (desc.roi.x1 - desc.roi.x0) * rw,
      y: (p.y - desc.roi.y0) / (desc.roi.y1 - desc.roi.y0) * rh
    });
    const lidOut = desc.upperLid.map(toOut);
    const browOut = desc.brow ? toOut(desc.brow).y : null;
    const pxPerAnPx = rw / Math.max(1, an.rw);
    scratch.c1 = sizeCanvas(scratch.c1, rw, rh);
    scratch.c2 = sizeCanvas(scratch.c2, rw, rh);
    scratch.mask = sizeCanvas(scratch.mask, rw, rh);
    const c1x = scratch.c1.getContext('2d');
    const c2x = scratch.c2.getContext('2d');
    const mx = scratch.mask.getContext('2d');
    const bandUpPx = Math.min(rh * 0.5, Math.max(3 * scale, (desc.h * H) * 0.35));
    tctx.save();
    tctx.beginPath();
    tctx.rect(rx0, ry0, rw, rh);
    tctx.clip();
    // Snapshot the graded ROI once (all layers derive from the same base).
    c1x.clearRect(0, 0, rw, rh);
    c1x.drawImage(tctx.canvas, rx0, ry0, rw, rh, 0, 0, rw, rh);
    // --- Definition: masked local contrast, overlay. ---
    if (defK > 0) {
      c2x.clearRect(0, 0, rw, rh);
      c2x.filter = 'contrast(135%) brightness(103%)';
      c2x.drawImage(scratch.c1, 0, 0);
      c2x.filter = 'none';
      if (buildBandMask(mx, rw, rh, lidOut, bandUpPx, browOut, innerIsLeft, scale)) {
        c2x.globalCompositeOperation = 'destination-in';
        c2x.drawImage(scratch.mask, 0, 0);
        c2x.globalCompositeOperation = 'source-over';
        tctx.save();
        tctx.globalCompositeOperation = 'overlay';
        tctx.globalAlpha = defK;
        tctx.drawImage(scratch.c2, rx0, ry0);
        tctx.restore();
        eyeRan.push('definition');
      }
    }
    // --- Density: darken detected ridges only (multiply, white = noop). ---
    if (densK > 0 && an.ridge && an.ridge.length) {
      c2x.clearRect(0, 0, rw, rh);
      c2x.fillStyle = '#fff';
      c2x.fillRect(0, 0, rw, rh);
      const sx = rw / Math.max(1, an.rw), sy = rh / Math.max(1, an.rh);
      c2x.fillStyle = '#000';
      for (let ay = 0; ay < an.rh; ay++) {
        for (let ax = 0; ax < an.rw; ax++) {
          const s = an.ridge[ay * an.rw + ax] / 255;
          if (s > 0.25) {
            c2x.globalAlpha = Math.min(1, s * densK * 2);
            c2x.fillRect(Math.floor(ax * sx), Math.floor(ay * sy), Math.max(1, Math.ceil(sx)), Math.max(1, Math.ceil(sy)));
          }
        }
      }
      c2x.globalAlpha = 1;
      if (buildBandMask(mx, rw, rh, lidOut, bandUpPx, browOut, innerIsLeft, scale)) {
        c2x.globalCompositeOperation = 'destination-in';
        c2x.drawImage(scratch.mask, 0, 0);
        c2x.globalCompositeOperation = 'source-over';
        tctx.save();
        tctx.globalCompositeOperation = 'multiply';
        tctx.drawImage(scratch.c2, rx0, ry0);
        tctx.restore();
        eyeRan.push('density');
      }
    }
    // --- Length: extend confident tips with fading tapers (source-over). ---
    if (lenK > 0 && an.tips && an.tips.length) {
      const n = Math.max(1, Math.round(an.tips.length * (0.25 + 0.75 * lenK)));
      const maxLen = Math.min(10 * scale, Math.max(2 * scale, (desc.h * H) * 0.5));
      c2x.clearRect(0, 0, rw, rh);
      c2x.lineCap = 'round';
      let drew = false;
      for (let i = 0; i < Math.min(n, an.tips.length); i++) {
        const tip = an.tips[i];
        const tx = tip.x * rw, ty = tip.y * rh;
        // Direction stored in analysis-ROI space; ROI aspect is preserved
        // (uniform scale), so reuse directly, adjusted for output scale.
        const L = maxLen * (0.35 + 0.65 * tip.c) * (0.3 + 0.7 * lenK);
        if (L < 0.75 * scale) continue;
        const ex = tx + tip.dx * L, ey = ty + tip.dy * L;
        const alpha = Math.min(0.6, 0.28 * tip.c * (0.4 + 0.6 * lenK) + 0.08);
        const g = c2x.createLinearGradient(tx, ty, ex, ey);
        g.addColorStop(0, `rgba(26,19,24,${alpha.toFixed(3)})`);
        g.addColorStop(1, 'rgba(26,19,24,0)');
        c2x.strokeStyle = g;
        c2x.lineWidth = Math.min(1.6 * scale, Math.max(scale, pxPerAnPx * 0.8));
        c2x.beginPath();
        c2x.moveTo(tx, ty);
        c2x.lineTo(ex, ey);
        c2x.stroke();
        drew = true;
      }
      if (drew) {
        // Extension may reach slightly above the band — allow headroom.
        if (buildBandMask(mx, rw, rh, lidOut, bandUpPx + maxLen, browOut, innerIsLeft, scale)) {
          c2x.globalCompositeOperation = 'destination-in';
          c2x.drawImage(scratch.mask, 0, 0);
          c2x.globalCompositeOperation = 'source-over';
          tctx.save();
          tctx.globalCompositeOperation = 'source-over';
          tctx.drawImage(scratch.c2, rx0, ry0);
          tctx.restore();
          eyeRan.push('length');
        }
      }
    }
    tctx.restore(); // un-clip ROI
    perEye.push({ usable: true, confidence: an.confidence, reason: an.reason, ran: eyeRan });
    eyeRan.forEach((r) => { if (!ran.includes(r)) ran.push(r); });
  }
  const ms = (typeof performance !== 'undefined') ? performance.now() - t0 : 0;
  return { ran, ms, perEye };
}
