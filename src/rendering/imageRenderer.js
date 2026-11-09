(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.AuraGramRenderer = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function createImageRenderer({
    PRESETS,
    detailBuffer,
    detailCtx,
    grainCanvas,
    runRetouchPasses
  }) {
    // --- Shared render pipeline: identical settings/order for Preview & Export -
    // face: immutable {imageId, regions} snapshot for this render (or null).
    function renderImage(tctx, W, H, src, st, face) {
      tctx.clearRect(0, 0, W, H);

      // Before (compare hold): absolutely raw source, no processing at all.
      if (st.isComparing) {
        tctx.filter = 'none';
        tctx.drawImage(src, 0, 0, W, H);
        return;
      }

      const preset = PRESETS.find(p => p.id === st.activePreset) || PRESETS[0];
      const ratio = st.presetIntensity / 100;
      // Effect radii scale with output size so Export matches Preview (1.3).
      const refK = Math.min(W, H) / 720;

      // Global color grade ONLY. G1b (Phase 6): beauty must not leak into the
      // base filter anymore (old antired hue/brightness and eyes-contrast terms
      // tinted the whole photo). Preset crisp still shapes global contrast.
      const bright = 100 + (preset.config.brightness * ratio) + st.adjustments.brightness;
      const cont = 100 + (preset.config.contrast * ratio) + st.adjustments.contrast + ((preset.config.crisp || 0) * ratio * 0.18);
      const sat = Math.max(0, 100 + (preset.config.saturate * ratio) + st.adjustments.saturate);
      const sep = Math.max(0, (preset.config.sepia * ratio));
      const hue = Math.round(preset.config.hue * ratio);
      const blurPx = (st.adjustments.blur * 0.4 * refK).toFixed(2);
      const gradeFilter = `brightness(${bright}%) contrast(${cont}%) saturate(${sat}%) sepia(${sep}%) hue-rotate(${hue}deg) blur(${blurPx}px)`;

      tctx.save();
      tctx.filter = gradeFilter;
      tctx.drawImage(src, 0, 0, W, H);
      tctx.filter = 'none';

      // Face-aware retouch (G1b). No geometry → all local passes skip (R9);
      // slider 0 → each pass is identity (R7). Immutable face snapshot per render.
      runRetouchPasses(tctx, W, H, src, st, face || null, gradeFilter);

      // G1b.1 COMPOSITING CONTRACT (isolation of Global vs Local):
      // ------------------------------------------------------------------
      // Stage order in renderImage():
      //   1. Base image (drawImage src with gradeFilter).
      //   2. Global preset processing (gradeFilter: brightness/contrast/
      //      saturate/sepia/hue + preset crisp contrast term).
      //   3. Global adjustments (tint, warmth, fade — below).
      //   4. Preset-specific global effects (gloss screen + crisp overlay).
      //      ALWAYS run when the preset asks, INDEPENDENT of st.beauty.*.
      //   5. Face-aware Beauty processing (runRetouchPasses, above): each tool
      //      is strictly masked — Smooth/Antired/Glow/Sculpt ⊂ skin mask,
      //      Eyes ⊂ eye mask, Blush ⊂ cheeks ∩ skin mask. Contribution =
      //      intensity × spatial mask. Beauty NEVER disables/scales Stage 4.
      //   6. Artistic FX.  7. Frame / stamp / caption.
      // Byte-identity note: with all beauty at 0 the output below is
      // pixel-identical to G1b/G1a (same ops, same order, same constants).

      // Preset-driven gloss: GLOBAL screen pass, always applied when the preset
      // asks. Independent of local Glow (G1b.1 P0-A fix: removed the gate that
      // wrongly dropped global gloss whenever local Glow was engaged).
      {
        const totalGloss = ((preset.config.gloss || 0) * ratio * 0.5);
        if (totalGloss > 0) {
          if (detailBuffer.width !== W || detailBuffer.height !== H) {
            detailBuffer.width = W; detailBuffer.height = H;
          }
          detailCtx.clearRect(0, 0, W, H);
          detailCtx.filter = 'brightness(72%) contrast(280%) saturate(85%) blur(1.5px)';
          detailCtx.drawImage(tctx.canvas, 0, 0, W, H);
          detailCtx.filter = 'none';
          tctx.save();
          tctx.globalCompositeOperation = 'screen';
          tctx.globalAlpha = Math.min(0.42, (totalGloss / 140) * 0.34);
          tctx.drawImage(detailBuffer, 0, 0, W, H);
          tctx.restore();
        }
      }

      // Preset-driven micro-contrast: GLOBAL overlay pass, always applied when
      // the preset asks. Independent of local Eyes (G1b.1 P0-A fix: removed
      // the gate that wrongly dropped global crisp whenever Eyes was engaged).
      {
        const totalCrisp = ((preset.config.crisp || 0) * ratio * 0.6);
        if (totalCrisp > 0) {
          if (detailBuffer.width !== W || detailBuffer.height !== H) {
            detailBuffer.width = W; detailBuffer.height = H;
          }
          detailCtx.clearRect(0, 0, W, H);
          detailCtx.filter = 'contrast(155%) brightness(98%) saturate(108%)';
          detailCtx.drawImage(src, 0, 0, W, H);
          detailCtx.filter = 'none';
          const sharpMask = detailCtx.createRadialGradient(W * 0.5, H * 0.42, Math.min(W, H) * 0.08, W * 0.5, H * 0.42, Math.min(W, H) * 0.48);
          sharpMask.addColorStop(0, 'rgba(0,0,0,1)');
          sharpMask.addColorStop(0.75, 'rgba(0,0,0,0.5)');
          sharpMask.addColorStop(1, 'rgba(0,0,0,0)');
          detailCtx.globalCompositeOperation = 'destination-in';
          detailCtx.fillStyle = sharpMask;
          detailCtx.fillRect(0, 0, W, H);
          detailCtx.globalCompositeOperation = 'source-over';
          tctx.save();
          tctx.globalCompositeOperation = 'overlay';
          tctx.globalAlpha = Math.min(0.45, (totalCrisp / 140) * 0.38);
          tctx.drawImage(detailBuffer, 0, 0, W, H);
          tctx.restore();
        }
      }

      // RGB split glitch (draws from source, same in preview & export).
      if (st.activeFX === 'vhs_glitch') {
        tctx.save();
        tctx.globalCompositeOperation = 'screen';
        tctx.globalAlpha = 0.38;
        tctx.filter = 'hue-rotate(120deg) saturate(200%)';
        tctx.drawImage(src, -Math.round(W * 0.012), 0, W, H);
        tctx.filter = 'hue-rotate(240deg) saturate(200%)';
        tctx.drawImage(src, Math.round(W * 0.012), 0, W, H);
        tctx.restore();
      }

      if (preset.config.tint && ratio > 0) {
        tctx.save();
        tctx.globalAlpha = ratio;
        tctx.globalCompositeOperation = 'soft-light';
        tctx.fillStyle = preset.config.tint;
        tctx.fillRect(0, 0, W, H);
        tctx.restore();
      }

      const totalWarmth = (preset.config.warmth * ratio) + st.adjustments.warmth;
      if (Math.abs(totalWarmth) > 1) {
        tctx.save();
        tctx.globalCompositeOperation = 'soft-light';
        const alpha = Math.min(0.45, Math.abs(totalWarmth) / 130);
        tctx.fillStyle = totalWarmth > 0 ? `rgba(255, 145, 40, ${alpha})` : `rgba(56, 189, 248, ${alpha})`;
        tctx.fillRect(0, 0, W, H);
        tctx.restore();
      }

      if (st.adjustments.fade > 0) {
        tctx.save();
        tctx.globalCompositeOperation = 'lighten';
        const fadeVal = Math.round((st.adjustments.fade / 100) * 48);
        tctx.fillStyle = `rgb(${fadeVal}, ${fadeVal}, ${fadeVal + 4})`;
        tctx.fillRect(0, 0, W, H);
        tctx.restore();
      }

      drawArtisticFX(tctx, W, H, st.activeFX);

      if (st.adjustments.vignette > 0) {
        tctx.save();
        const vigAlpha = (st.adjustments.vignette / 100) * 0.75;
        const rad = Math.max(W, H) * 0.72;
        const grad = tctx.createRadialGradient(W / 2, H / 2, rad * 0.35, W / 2, H / 2, rad);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${vigAlpha})`);
        tctx.fillStyle = grad;
        tctx.fillRect(0, 0, W, H);
        tctx.restore();
      }

      if (st.adjustments.grain > 0) {
        tctx.save();
        tctx.globalCompositeOperation = 'overlay';
        tctx.globalAlpha = (st.adjustments.grain / 100) * 0.32;
        const pattern = tctx.createPattern(grainCanvas, 'repeat');
        tctx.fillStyle = pattern;
        tctx.fillRect(0, 0, W, H);
        tctx.restore();
      }

      drawFramesAndStamps(tctx, W, H, st);
      tctx.restore();
    }

    function drawArtisticFX(tctx, W, H, fxId) {
      if (fxId === 'none') return;
      tctx.save();
      if (fxId === 'ring_light') {
        tctx.globalCompositeOperation = 'soft-light';
        const rad = Math.min(W, H) * 0.58;
        const g = tctx.createRadialGradient(W * 0.5, H * 0.42, rad * 0.15, W * 0.5, H * 0.42, rad);
        g.addColorStop(0, 'rgba(255, 248, 244, 0.50)');
        g.addColorStop(0.65, 'rgba(255, 218, 230, 0.25)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
        tctx.fillStyle = g;
        tctx.fillRect(0, 0, W, H);
      } else if (fxId === 'peach_aura') {
        tctx.globalCompositeOperation = 'soft-light';
        const g = tctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, 'rgba(255, 160, 122, 0.48)');
        g.addColorStop(0.5, 'rgba(255, 195, 160, 0.32)');
        g.addColorStop(1, 'rgba(251, 113, 133, 0.42)');
        tctx.fillStyle = g;
        tctx.fillRect(0, 0, W, H);
      } else if (fxId === 'red_burn') {
        tctx.globalCompositeOperation = 'screen';
        const g1 = tctx.createLinearGradient(0, 0, W * 0.55, H * 0.7);
        g1.addColorStop(0, 'rgba(239, 68, 68, 0.68)');
        g1.addColorStop(0.4, 'rgba(244, 63, 94, 0.35)');
        g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        tctx.fillStyle = g1;
        tctx.fillRect(0, 0, W, H);
      } else if (fxId === 'diamond_glow') {
        tctx.globalCompositeOperation = 'screen';
        const stars = [
          { x: 0.28, y: 0.26, size: 0.045 }, { x: 0.72, y: 0.30, size: 0.055 },
          { x: 0.64, y: 0.62, size: 0.040 }, { x: 0.35, y: 0.68, size: 0.050 },
          { x: 0.52, y: 0.20, size: 0.035 }
        ];
        stars.forEach(s => {
          const cx = W * s.x, cy = H * s.y;
          const len = Math.min(W, H) * s.size;
          const glow = tctx.createRadialGradient(cx, cy, 1, cx, cy, len);
          glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
          glow.addColorStop(0.3, 'rgba(253, 224, 71, 0.45)');
          glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
          tctx.fillStyle = glow;
          tctx.beginPath(); tctx.arc(cx, cy, len, 0, Math.PI * 2); tctx.fill();
          tctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          tctx.lineWidth = Math.max(1.5, len * 0.08);
          tctx.beginPath();
          tctx.moveTo(cx - len, cy); tctx.lineTo(cx + len, cy);
          tctx.moveTo(cx, cy - len); tctx.lineTo(cx, cy + len);
          tctx.stroke();
        });
      } else if (fxId === 'leak_warm') {
        tctx.globalCompositeOperation = 'screen';
        const g1 = tctx.createLinearGradient(0, 0, W * 0.65, H * 0.5);
        g1.addColorStop(0, 'rgba(255, 85, 0, 0.62)');
        g1.addColorStop(0.45, 'rgba(255, 180, 40, 0.28)');
        g1.addColorStop(1, 'rgba(255, 0, 128, 0)');
        tctx.fillStyle = g1;
        tctx.fillRect(0, 0, W, H);
      } else if (fxId === 'neon_prism') {
        tctx.globalCompositeOperation = 'overlay';
        const g = tctx.createLinearGradient(0, H, W, 0);
        g.addColorStop(0, 'rgba(6, 182, 212, 0.55)');
        g.addColorStop(0.5, 'rgba(168, 85, 247, 0.35)');
        g.addColorStop(1, 'rgba(244, 63, 94, 0.55)');
        tctx.fillStyle = g;
        tctx.fillRect(0, 0, W, H);
      } else if (fxId === 'bokeh_dust') {
        tctx.globalCompositeOperation = 'screen';
        const orbs = [
          { x: 0.2, y: 0.25, r: 0.09, c: 'rgba(244, 114, 182, 0.28)' },
          { x: 0.78, y: 0.22, r: 0.12, c: 'rgba(167, 139, 250, 0.25)' },
          { x: 0.65, y: 0.72, r: 0.14, c: 'rgba(251, 191, 36, 0.22)' },
          { x: 0.25, y: 0.78, r: 0.08, c: 'rgba(56, 189, 248, 0.24)' }
        ];
        orbs.forEach(o => {
          const rad = Math.min(W, H) * o.r;
          const grad = tctx.createRadialGradient(W * o.x, H * o.y, rad * 0.1, W * o.x, H * o.y, rad);
          grad.addColorStop(0, o.c);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          tctx.fillStyle = grad;
          tctx.beginPath(); tctx.arc(W * o.x, H * o.y, rad, 0, Math.PI * 2); tctx.fill();
        });
      } else if (fxId === 'sunbeams') {
        tctx.globalCompositeOperation = 'screen';
        const g = tctx.createRadialGradient(W * 0.9, H * 0.1, 10, W * 0.9, H * 0.1, Math.max(W, H) * 0.9);
        g.addColorStop(0, 'rgba(255, 235, 160, 0.65)');
        g.addColorStop(0.4, 'rgba(251, 146, 60, 0.25)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        tctx.fillStyle = g;
        tctx.fillRect(0, 0, W, H);
      } else if (fxId === 'halation') {
        tctx.globalCompositeOperation = 'screen';
        const g = tctx.createRadialGradient(W * 0.5, H * 0.4, Math.min(W, H) * 0.1, W * 0.5, H * 0.4, Math.max(W, H) * 0.65);
        g.addColorStop(0, 'rgba(255, 70, 50, 0.28)');
        g.addColorStop(0.5, 'rgba(255, 120, 40, 0.14)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        tctx.fillStyle = g;
        tctx.fillRect(0, 0, W, H);
      }
      tctx.restore();
    }

    function drawFramesAndStamps(tctx, W, H, st) {
      tctx.save();
      if (st.stampMode === 'date98') {
        const fontSize = Math.max(18, Math.round(W * 0.038));
        tctx.font = `700 ${fontSize}px "Space Mono", monospace`;
        tctx.fillStyle = '#ff7b24';
        tctx.shadowColor = 'rgba(255, 90, 0, 0.85)';
        tctx.shadowBlur = 8;
        tctx.textAlign = 'right';
        tctx.fillText("'98 10 24", W - W * 0.06, H - H * 0.05);
      } else if (st.stampMode === 'polaroid') {
        const border = Math.round(Math.min(W, H) * 0.045);
        const bottomBorder = Math.round(H * 0.14);
        tctx.fillStyle = '#fafafa';
        tctx.fillRect(0, 0, W, border);
        tctx.fillRect(0, 0, border, H);
        tctx.fillRect(W - border, 0, border, H);
        tctx.fillRect(0, H - bottomBorder, W, bottomBorder);
        if (st.caption) {
          const fontSize = Math.max(18, Math.round(W * 0.04));
          tctx.font = `600 ${fontSize}px "Inter", sans-serif`;
          tctx.fillStyle = '#18181b';
          tctx.textAlign = 'center';
          tctx.fillText(st.caption, W / 2, H - bottomBorder * 0.42);
        }
      } else if (st.stampMode === 'cinema') {
        const barH = Math.round(H * 0.11);
        tctx.fillStyle = '#000000';
        tctx.fillRect(0, 0, W, barH);
        tctx.fillRect(0, H - barH, W, barH);
        if (st.caption) {
          const fontSize = Math.max(15, Math.round(W * 0.032));
          tctx.font = `500 italic ${fontSize}px "Inter", sans-serif`;
          tctx.fillStyle = '#facc15';
          tctx.shadowColor = 'rgba(0,0,0,0.9)';
          tctx.shadowBlur = 4;
          tctx.textAlign = 'center';
          tctx.fillText(`"${st.caption}"`, W / 2, H - barH - Math.round(H * 0.03));
        }
      } else if (st.caption) {
        const fontSize = Math.max(16, Math.round(W * 0.036));
        tctx.font = `600 ${fontSize}px "Inter", sans-serif`;
        tctx.fillStyle = '#ffffff';
        tctx.shadowColor = 'rgba(0,0,0,0.85)';
        tctx.shadowBlur = 6;
        tctx.textAlign = 'center';
        tctx.fillText(st.caption, W / 2, H - Math.round(H * 0.05));
      }
      tctx.restore();
    }

    // Preview entry point (synchronous; sliders should use requestPreviewRender).

    return {renderImage};
  }
  return {createImageRenderer};
});
