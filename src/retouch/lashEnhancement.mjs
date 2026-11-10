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
 *   definition — ridge-weighted local contrast (contrast-filtered copy, overlay)
 *                inside the lash band only. Never a raw rect brightness/contrast.
 *
 * Protected BY CONSTRUCTION: every layer is clipped to its Eye ROI rect and
 * masked to the upper-lash band (above the upper lid). Iris, pupil, sclera
 * (below the lid), inner corner, brow, cheek, hair, background cannot be
 * touched — the pixels are never drawn there.
 */

/** Nonlinear conservative strength curves (0..100 → factor). Monotonic. */
import '../rendering/canvasFilters.js';
const {drawFiltered, nativeSupported, applyPixelsFilter} = globalThis.AuraGramCanvasFilters;
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

/** Smooth multiplicative target: retain at least 65% of the source intensity.
 * Bilinear ridge sampling avoids opaque rectangles when ROI pixels are scaled.
 * Weak eye analysis reduces the contribution instead of adding black blocks.
 */
export function fillDensityRGBA(data, W, H, ridge, aw, ah, strength, confidence = 1) {
  data.fill(255);
  if (!ridge || aw < 1 || ah < 1 || ridge.length < aw * ah) return data;
  const gain = 0.7 * lashDensityCurve(strength) * (Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0);
  if (!gain) return data;
  for (let y = 0; y < H; y++) {
    const sy = (y + 0.5) * ah / H - 0.5;
    const y0 = Math.max(0, Math.min(ah - 1, Math.floor(sy))), y1 = Math.min(ah - 1, y0 + 1);
    const fy = Math.max(0, Math.min(1, sy - y0));
    for (let x = 0; x < W; x++) {
      const sx = (x + 0.5) * aw / W - 0.5;
      const x0 = Math.max(0, Math.min(aw - 1, Math.floor(sx))), x1 = Math.min(aw - 1, x0 + 1);
      const fx = Math.max(0, Math.min(1, sx - x0));
      const top = ridge[y0 * aw + x0] * (1 - fx) + ridge[y0 * aw + x1] * fx;
      const bottom = ridge[y1 * aw + x0] * (1 - fx) + ridge[y1 * aw + x1] * fx;
      const signal = Math.max(0, ((top * (1 - fy) + bottom * fy) / 255 - 0.25) / 0.75);
      const value = Math.round(255 * (1 - gain * Math.min(1, signal)));
      const i = (y * W + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
    }
  }
  return data;
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
function buildBandMask(mctx, mw, mh, lidPts, bandUpPx, browPts, innerPoint, lowerPts, scale) {
  mctx.clearRect(0,0,mw,mh);
  if(lidPts.length<2||lowerPts.length<2) return false;
  const low=lowerPts.reduce((a,p)=>({x:a.x+p.x/lowerPts.length,y:a.y+p.y/lowerPts.length}),{x:0,y:0});
  const eyeW=Math.hypot(lidPts.at(-1).x-lidPts[0].x,lidPts.at(-1).y-lidPts[0].y);
  const path=()=>{
    mctx.beginPath();
    lidPts.forEach((p,i)=>{
      const a=lidPts[Math.max(0,i-1)],b=lidPts[Math.min(lidPts.length-1,i+1)];
      const len=Math.hypot(b.x-a.x,b.y-a.y)||1;
      let nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;
      if(nx*(low.x-p.x)+ny*(low.y-p.y)>0){nx=-nx;ny=-ny;}
      if(i===0)mctx.moveTo(p.x+nx*bandUpPx,p.y+ny*bandUpPx);
      else mctx.lineTo(p.x+nx*bandUpPx,p.y+ny*bandUpPx);
    });
    for(let i=lidPts.length-1;i>=0;i--)mctx.lineTo(lidPts[i].x,lidPts[i].y);
    mctx.closePath();
  };
  mctx.save();
  mctx.fillStyle='#fff';path();mctx.fill();
  // Feather only inside the allowed polygon: never blur into iris/sclera.
  applyPixelsFilter(mctx,`blur(${Math.min(1,scale*.5)}px)`);
  mctx.globalCompositeOperation='destination-in';path();mctx.fill();
  mctx.globalCompositeOperation='destination-out';
  mctx.beginPath();mctx.arc(innerPoint.x,innerPoint.y,eyeW*.12,0,Math.PI*2);mctx.fill();
  if(browPts.length){
    mctx.lineWidth=Math.max(2*scale,bandUpPx*.65);mctx.lineCap='round';mctx.beginPath();
    browPts.forEach((p,i)=>i?mctx.lineTo(p.x,p.y):mctx.moveTo(p.x,p.y));mctx.stroke();
  }
  mctx.restore();return true;
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
    if (!desc || !desc.usable || !desc.inner || !desc.lowerLid?.length || !an || an.confidence <= 0) {
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
    const browOut = (desc.browPoints || []).map(toOut);
    const lowerOut = (desc.lowerLid || []).map(toOut);
    const innerOut = toOut(desc.inner);
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
    const bandReady = buildBandMask(mx, rw, rh, lidOut, bandUpPx, browOut, innerOut, lowerOut, scale);
    // Snapshot the graded ROI once (all layers derive from the same base).
    c1x.clearRect(0, 0, rw, rh);
    c1x.drawImage(tctx.canvas, rx0, ry0, rw, rh, 0, 0, rw, rh);
    // --- Definition: masked local contrast, overlay. ---
    if (defK > 0 && an.ridge?.length) {
      c2x.clearRect(0, 0, rw, rh);
      drawFiltered(c2x, scratch.c1, 'contrast(115%)', 0, 0);
      // Definition follows observed fine ridges too, rather than increasing
      // contrast over an entire strip of skin/makeup. Independent of sliders.
      const detailMask = c1x.createImageData(rw,rh);
      fillDensityRGBA(detailMask.data,rw,rh,an.ridge,an.rw,an.rh,100,1);
      for(let i=0;i<detailMask.data.length;i+=4) {
        const alpha=Math.min(255,(255-detailMask.data[i])*255/89);
        detailMask.data[i]=detailMask.data[i+1]=detailMask.data[i+2]=255;
        detailMask.data[i+3]=alpha;
      }
      c1x.putImageData(detailMask,0,0);
      c2x.globalCompositeOperation='destination-in';c2x.drawImage(scratch.c1,0,0);
      c2x.globalCompositeOperation='source-over';
      if (bandReady) {
        c2x.globalCompositeOperation = 'destination-in';
        c2x.drawImage(scratch.mask, 0, 0);
        c2x.globalCompositeOperation = 'source-over';
        tctx.save();
        tctx.globalCompositeOperation = 'overlay';
        tctx.globalAlpha = defK * an.confidence;
        tctx.drawImage(scratch.c2, rx0, ry0);
        tctx.restore();
        eyeRan.push('definition');
      }
    }
    // --- Density: darken detected ridges only (multiply, white = noop). ---
    if (densK > 0 && an.ridge && an.ridge.length) {
      c2x.clearRect(0, 0, rw, rh);
      const density = c2x.createImageData(rw, rh);
      fillDensityRGBA(density.data, rw, rh, an.ridge, an.rw, an.rh, lashes.density, an.confidence);
      c2x.putImageData(density, 0, 0);
      if (bandReady) {
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
    if (lenK > 0 && an.confidence >= .25 && an.tips && an.tips.length) {
      const maxLen = Math.min(3 * pxPerAnPx, (desc.h * H) * .12);
      c2x.clearRect(0,0,rw,rh);c2x.lineCap='round';
      let drew=false;
      for(const tip of an.tips) {
        if(!tip.evidence?.connected || tip.c<.6 || !tip.color) continue;
        const tx=tip.x*rw,ty=tip.y*rh;
        const vx=tip.dx*rw/an.rw,vy=tip.dy*rh/an.rh,vl=Math.hypot(vx,vy);
        const L=Math.min(maxLen,tip.length*vl*.12)*lenK;
        if(L<=0) continue;
        const ex=tx+vx/vl*L,ey=ty+vy/vl*L;
        const [r,g,b]=tip.color;
        // Fixed candidate set; continuous geometry, width and opacity. No
        // slider-dependent seed count or fan, no minimum visible jump.
        for(let k=0;k<6;k++) {
          const a=k/6,beta=(k+1)/6;
          c2x.strokeStyle=`rgba(${r},${g},${b},${.26*tip.c*lenK*(1-a)**2})`;
          c2x.lineWidth=Math.max(.08,tip.width*vl*.65*(1-a));
          c2x.beginPath();c2x.moveTo(tx+(ex-tx)*a,ty+(ey-ty)*a);
          c2x.lineTo(tx+(ex-tx)*beta,ty+(ey-ty)*beta);c2x.stroke();
        }
        drew=true;
      }
      if (drew) {
        // Extension may reach slightly above the band — allow headroom.
        if (buildBandMask(mx, rw, rh, lidOut, bandUpPx + maxLen, browOut, innerOut, lowerOut, scale)) {
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
