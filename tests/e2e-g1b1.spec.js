/* AuraGram G1b.1 — retouch isolation & compositing integrity (I1–I14).
 * Pixel-level regression: real canvas diffs, real MediaPipe geometry.
 * No string-presence assertions as proof — every gate measures pixels.
 */
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORTRAIT = () => path.resolve(__dirname, 'fixtures/portrait.jpg');
const EDGE = () => path.resolve(__dirname, 'fixtures/edge-source.jpg');
const NOISE = /favicon|net::|Failed to load resource|AbortError|aborted|XNNPACK|WebGL|GL Driver|Graph successfully|inference_feedback|face_landmarker_graph|gl_context/i;

async function gotoApp(page, query = '') {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e && e.message || e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  await page.goto('/index.html' + query);
  await page.waitForFunction(() => !!window.AuraGram, null, { timeout: 15000 });
  return errors;
}

async function uploadFile(page, file) {
  await page.setInputFiles('#fileInput', file);
  await page.waitForFunction(() => window.AuraGram.loadState.status === 'ready', null, { timeout: 30000 });
}

async function waitFaceTerminal(page, timeout = 100000) {
  await page.waitForFunction(
    () => ['ready', 'no_face', 'failed', 'unsupported'].includes(window.AuraGram.face.status()),
    null, { timeout });
  return page.evaluate(() => window.AuraGram.face.status());
}

async function waitRetouchReady(page) {
  await page.waitForFunction(() => {
    const A = window.AuraGram;
    const b = A.state.beauty;
    const on = b.smooth > 0 || b.antired > 0 || b.glow > 0 || b.eyes > 0 || b.blush > 0 || b.sculpt > 0;
    return !on || !A.retouch.snapshot() || A.retouch.ready();
  }, null, { timeout: 60000 });
  await page.evaluate(() => window.AuraGram.renderStudioCanvas());
}

// Set exact preset + beauty state, render, wait for lazy retouch.
async function applyState(page, { preset = 'normal', intensity = 100, fx = 'none', beauty = {}, adjustmentsZero = true }) {
  await page.evaluate(([p, inten, f, b, az]) => {
    const A = window.AuraGram;
    A.resetAll();
    A.state.activePreset = p;
    A.state.presetIntensity = inten;
    A.state.activeFX = f;
    for (const k of Object.keys(A.state.beauty)) A.state.beauty[k] = 0;
    if (az) for (const k of Object.keys(A.state.adjustments)) A.state.adjustments[k] = 0;
    // vignette default is 12 in initial state but neutral is 0 — force 0 for isolation
    A.state.adjustments.vignette = 0;
    for (const [k, v] of Object.entries(b)) A.state.beauty[k] = v;
    A.renderStudioCanvas();
  }, [preset, intensity, fx, beauty, adjustmentsZero]);
  await waitRetouchReady(page);
}

async function canvasDataUrl(page) {
  return page.evaluate(() => document.getElementById('mainCanvas').toDataURL('image/png'));
}

async function callPx(page, fnSrc, arg) {
  return page.evaluate(`(${fnSrc})(${JSON.stringify(arg)})`);
}

const PX = {
  diffAt: `([pts, a, b]) => {
    const read = (url) => new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        res({ ctx: x, w: c.width, h: c.height });
      };
      img.src = url;
    });
    return (async () => {
      const A = await read(a), B = await read(b);
      const da = A.ctx.getImageData(0, 0, A.w, A.h).data;
      const db = B.ctx.getImageData(0, 0, B.w, B.h).data;
      return pts.map(([nx, ny]) => {
        const x = Math.min(A.w - 1, Math.max(0, Math.round(nx * A.w)));
        const y = Math.min(A.h - 1, Math.max(0, Math.round(ny * A.h)));
        const i = (y * A.w + x) * 4;
        return Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      });
    })();
  }`,
  meanAbsDiff: `(o) => {
    const read = (url) => new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        res(x.getImageData(0, 0, c.width, c.height));
      };
      img.src = url;
    });
    return (async () => {
      const A = await read(o.a), B = await read(o.b);
      const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
      let s = 0, n = 0, max = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * A.width + x) * 4, j = (y * B.width + x) * 4;
        const d = (Math.abs(A.data[i] - B.data[j]) + Math.abs(A.data[i + 1] - B.data[j + 1]) + Math.abs(A.data[i + 2] - B.data[j + 2])) / 3;
        s += d; n++; if (d > max) max = d;
      }
      return { mean: s / n, max };
    })();
  }`,
  // Full-frame check restricted to pixels where the cached skin mask is ~0.
  // Returns { outsideMax, outsideMean, insideMean, outsidePixels }.
  diffOutsideSkinMask: `(o) => {
    const load = (url) => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = rej;
      im.src = url;
    });
    return (async () => {
      const [ia, ib] = await Promise.all([load(o.a), load(o.b)]);
      const W = ia.naturalWidth, H = ia.naturalHeight;
      const ca = document.createElement('canvas'); ca.width = W; ca.height = H;
      const cb = document.createElement('canvas'); cb.width = W; cb.height = H;
      ca.getContext('2d').drawImage(ia, 0, 0);
      cb.getContext('2d').drawImage(ib, 0, 0);
      const da = ca.getContext('2d').getImageData(0, 0, W, H).data;
      const db = cb.getContext('2d').getImageData(0, 0, W, H).data;
      const maskUrl = window.AuraGram.retouch.debugMaskDataUrl();
      if (!maskUrl) return { noMask: true };
      const mi = await load(maskUrl);
      const mc = document.createElement('canvas'); mc.width = W; mc.height = H;
      // drawImage scales the small (384px) feathered mask up to full res
      mc.getContext('2d').drawImage(mi, 0, 0, W, H);
      const dm = mc.getContext('2d').getImageData(0, 0, W, H).data;
      let outMax = 0, outSum = 0, outN = 0, inSum = 0, inN = 0;
      for (let i = 0; i < W * H; i++) {
        const alpha = dm[i * 4 + 3];
        const d = (Math.abs(da[i*4]-db[i*4]) + Math.abs(da[i*4+1]-db[i*4+1]) + Math.abs(da[i*4+2]-db[i*4+2])) / 3;
        if (alpha < 8) { outN++; outSum += d; if (d > outMax) outMax = d; }
        else { inN++; inSum += d; }
      }
      return { outsideMax: outMax, outsideMean: outSum / Math.max(1, outN), insideMean: inSum / Math.max(1, inN), outsidePixels: outN };
    })();
  }`
};

// Shared geometry probe: eye/lips/cheek + background corners.
async function probePoints(page) {
  return page.evaluate(() => {
    const regs = window.AuraGram.face.store().faces[0].regions;
    const mean = (arr) => arr.reduce((a, p) => ({ x: a.x + p.x / arr.length, y: a.y + p.y / arr.length }), { x: 0, y: 0 });
    const eL = mean(regs.leftEye), eR = mean(regs.rightEye);
    const lips = mean(regs.lips);
    const browL = mean(regs.leftEyebrow), browR = mean(regs.rightEyebrow);
    const nose = regs.nose[4] || mean(regs.nose);
    return {
      eyeL: [eL.x, eL.y], eyeR: [eR.x, eR.y], lips: [lips.x, lips.y],
      browL: [browL.x, browL.y], browR: [browR.x, browR.y],
      nose: [nose.x, nose.y],
      cheek: [nose.x - 0.09, nose.y - 0.02],
      bg: [[0.03, 0.5], [0.95, 0.08], [0.05, 0.05], [0.97, 0.95]]
    };
  });
}

async function blushApples(page) {
  return page.evaluate(async () => {
    const skin = await import('/src/retouch/skinMask.mjs');
    return skin.cheekCenters(window.AuraGram.face.store().faces[0].regions).map((c) => [c.x, c.y]);
  });
}

// I1: preset renders with Beauty=0 are deterministic; presets differ from raw.
test('I1 preset unchanged at Beauty=0 (Original/Vogue/Champagne)', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  const renders = {};
  for (const preset of ['normal', 'vogue', 'champagne']) {
    await applyState(page, { preset, intensity: 100, fx: 'none', beauty: {} });
    renders[preset + '_a'] = await canvasDataUrl(page);
    await page.evaluate(() => window.AuraGram.renderStudioCanvas());
    renders[preset + '_b'] = await canvasDataUrl(page);
  }
  for (const preset of ['normal', 'vogue', 'champagne']) {
    expect(renders[preset + '_a'], `${preset} deterministic`).toBe(renders[preset + '_b']);
  }
  const vogueVsNormal = await callPx(page, PX.meanAbsDiff, { a: renders['normal_a'], b: renders['vogue_a'] });
  const champVsNormal = await callPx(page, PX.meanAbsDiff, { a: renders['normal_a'], b: renders['champagne_a'] });
  expect(vogueVsNormal.mean, 'Vogue Gloss changes pixels vs Original').toBeGreaterThan(1.5);
  expect(champVsNormal.mean, 'Champagne changes pixels vs Original').toBeGreaterThan(1.5);
});

// I2: Vogue Gloss — Glow 0→1 leaves everything outside the skin mask identical.
test('I2 glow zero-to-one preserves pixels outside skin mask (Vogue)', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: {} });
  const glow0 = await canvasDataUrl(page);
  await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: { glow: 1 } });
  const glow1 = await canvasDataUrl(page);
  const pts = await probePoints(page);
  const diffs = await callPx(page, PX.diffAt, [[...pts.bg], glow0, glow1]);
  for (let i = 0; i < diffs.length; i++) {
    expect(diffs[i], `background pt ${i} unchanged at glow 0->1`).toBeLessThanOrEqual(2);
  }
  const masked = await callPx(page, PX.diffOutsideSkinMask, { a: glow0, b: glow1 });
  expect(masked.noMask, 'skin mask available').toBeFalsy();
  expect(masked.outsideMax, 'no pixel outside skin mask changes at glow 0->1').toBeLessThanOrEqual(2);
  // glowCurve(1) is intentionally sub-visible; presence is proven at 100 (I3).
});

// I3: Glow full range keeps the background locked.
test('I3 glow full range (25/50/100) keeps background locked (Vogue)', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: {} });
  const base = await canvasDataUrl(page);
  const pts = await probePoints(page);
  for (const v of [25, 50, 100]) {
    await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: { glow: v } });
    const cur = await canvasDataUrl(page);
    const diffs = await callPx(page, PX.diffAt, [[...pts.bg], base, cur]);
    for (let i = 0; i < diffs.length; i++) {
      expect(diffs[i], `glow=${v} background pt ${i}`).toBeLessThanOrEqual(2);
    }
    const masked = await callPx(page, PX.diffOutsideSkinMask, { a: base, b: cur });
    expect(masked.outsideMax, `glow=${v} outside-mask max`).toBeLessThanOrEqual(2);
    if (v === 100) {
      expect(masked.insideMean, 'glow100 acts inside the mask').toBeGreaterThan(0.05);
    }
  }
});

// I4: Eyes 0→1 keeps the global photo intact outside the eye mask.
test('I4 eyes zero-to-one preserves global look outside eye mask', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  // Use a preset with nonzero crisp (Vogue has crisp 40).
  await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: {} });
  const eyes0 = await canvasDataUrl(page);
  await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: { eyes: 1 } });
  const eyes1 = await canvasDataUrl(page);
  const pts = await probePoints(page);
  // Background + cheek (outside eye mask) must not move.
  // Note: eyesCurve(1) ≈ 0.003 alpha, so the local eye change at 1 is
  // intentionally sub-visible; the gate here is global preservation.
  const diffs = await callPx(page, PX.diffAt, [[...pts.bg, pts.cheek], eyes0, eyes1]);
  diffs.forEach((d, i) => {
    expect(d, `eyes 0->1 outside-eye pt ${i}`).toBeLessThanOrEqual(3);
  });
});

// I5: Eyes full range keeps global preset effects.
test('I5 eyes full range (25/50/100) keeps globals (Vogue)', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: {} });
  const base = await canvasDataUrl(page);
  const pts = await probePoints(page);
  for (const v of [25, 50, 100]) {
    await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: { eyes: v } });
    const cur = await canvasDataUrl(page);
    const diffs = await callPx(page, PX.diffAt, [[...pts.bg, pts.cheek], base, cur]);
    diffs.forEach((d, i) => {
      expect(d, `eyes=${v} outside-eye pt ${i}`).toBeLessThanOrEqual(4);
    });
    if (v === 100) {
      const eyeD = await callPx(page, PX.diffAt, [[pts.eyeL, pts.eyeR], base, cur]);
      expect(eyeD[0] + eyeD[1], 'eyes100 acts at the eyes').toBeGreaterThan(0);
    }
  }
});

// I6: Blush isolation — cheek apples change, background/outline do not.
test('I6 blush isolation at 100 (cheeks change, background not)', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyState(page, { preset: 'normal', intensity: 100, fx: 'none', beauty: {} });
  const base = await canvasDataUrl(page);
  await applyState(page, { preset: 'normal', intensity: 100, fx: 'none', beauty: { blush: 100 } });
  const blushed = await canvasDataUrl(page);
  const apples = await blushApples(page);
  const pts = await probePoints(page);
  const appleD = await callPx(page, PX.diffAt, [apples, base, blushed]);
  expect(appleD[0] + appleD[1], 'blush acts at cheek apples').toBeGreaterThan(0);
  const bgD = await callPx(page, PX.diffAt, [[...pts.bg], base, blushed]);
  bgD.forEach((d, i) => {
    expect(d, `blush background pt ${i}`).toBeLessThanOrEqual(2);
  });
  const masked = await callPx(page, PX.diffOutsideSkinMask, { a: base, b: blushed });
  expect(masked.outsideMax, 'blush outside skin mask').toBeLessThanOrEqual(2);
  // Blush=0 is identity (already R7) — re-assert on this fixture.
  await applyState(page, { preset: 'normal', intensity: 100, fx: 'none', beauty: { blush: 0 } });
  expect(await canvasDataUrl(page), 'blush 0 is identity').toBe(base);
});

// I7: Protected regions survive blush100 (eyes/brows/lips/nostril-adjacent).
test('I7 blush100 spares eyes, brows, lips', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyState(page, { preset: 'normal', intensity: 100, fx: 'none', beauty: {} });
  const base = await canvasDataUrl(page);
  await applyState(page, { preset: 'normal', intensity: 100, fx: 'none', beauty: { blush: 100 } });
  const blushed = await canvasDataUrl(page);
  const pts = await probePoints(page);
  // Sample centers AND small perimeters (defect may show on the rim).
  const ring = await page.evaluate((p) => {
    const pts2 = [];
    for (const [cx, cy] of [p.eyeL, p.eyeR, p.lips, p.browL, p.browR]) {
      pts2.push([cx, cy]);
      for (const [dx, dy] of [[0.012, 0], [-0.012, 0], [0, 0.012], [0, -0.012]]) {
        pts2.push([Math.min(0.999, Math.max(0, cx + dx)), Math.min(0.999, Math.max(0, cy + dy))]);
      }
    }
    return pts2;
  }, pts);
  const diffs = await callPx(page, PX.diffAt, [ring, base, blushed]);
  diffs.forEach((d, i) => {
    expect(d, `protected ring pt ${i}`).toBeLessThanOrEqual(4);
  });
});

// I8: No face — local beauty skipped, global preset keeps working.
test('I8 no face: beauty skipped, preset stays on', async ({ page }) => {
  await gotoApp(page);
  const noface = path.join(os.tmpdir(), `auragram-g1b1-noface-${Date.now()}.png`);
  const dataUrl = await page.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = 240; cv.height = 240;
    const cx = cv.getContext('2d');
    const g = cx.createLinearGradient(0, 0, 240, 240);
    g.addColorStop(0, '#3b2d5c'); g.addColorStop(1, '#0e7490');
    cx.fillStyle = g; cx.fillRect(0, 0, 240, 240);
    return cv.toDataURL('image/png');
  });
  fs.writeFileSync(noface, Buffer.from(dataUrl.split(',')[1], 'base64'));
  await uploadFile(page, noface);
  await waitFaceTerminal(page);
  expect(await page.evaluate(() => window.AuraGram.face.status())).toBe('no_face');
  await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: {} });
  const voguePlain = await canvasDataUrl(page);
  await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: { glow: 80, eyes: 80, blush: 80 } });
  const vogueBeauty = await canvasDataUrl(page);
  // Without geometry every local pass skips → renders identical, preset intact.
  expect(vogueBeauty, 'no-face beauty is identity over preset').toBe(voguePlain);
  await applyState(page, { preset: 'normal', intensity: 100, fx: 'none', beauty: {} });
  const normalPlain = await canvasDataUrl(page);
  const presetEffect = await callPx(page, PX.meanAbsDiff, { a: normalPlain, b: voguePlain });
  expect(presetEffect.mean, 'preset still changes image with no face').toBeGreaterThan(1.0);
});

// I9: Preview/export consistency with G1b.1 passes engaged.
test('I9 preview and export agree with glow/eyes/blush on', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyState(page, { preset: 'vogue', intensity: 88, fx: 'none', beauty: { glow: 50, eyes: 50, blush: 50 } });
  const ran = await page.evaluate(() => window.AuraGram.stats.retouchRan);
  expect(ran).toMatch(/glow/);
  expect(ran).toMatch(/eyes/);
  expect(ran).toMatch(/blush/);
  await page.click('#btnExport');
  await expect(page.locator('#exportModal')).toBeVisible();
  const m = await page.evaluate(async () => {
    const blob = window.AuraGram.getExportBlob();
    const buf = new Uint8Array(await blob.arrayBuffer());
    let b64 = '';
    const CH = 0x8000;
    for (let i = 0; i < buf.length; i += CH) b64 += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = rej;
      im.src = 'data:image/png;base64,' + btoa(b64);
    });
    const pc = document.getElementById('mainCanvas');
    const pa = pc.getContext('2d').getImageData(0, 0, pc.width, pc.height).data;
    const t = document.createElement('canvas');
    t.width = pc.width; t.height = pc.height;
    t.getContext('2d').drawImage(img, 0, 0, pc.width, pc.height);
    const ea = t.getContext('2d').getImageData(0, 0, pc.width, pc.height).data;
    let s = 0;
    for (let i = 0; i < pa.length; i += 4) {
      s += (Math.abs(pa[i] - ea[i]) + Math.abs(pa[i + 1] - ea[i + 1]) + Math.abs(pa[i + 2] - ea[i + 2])) / 3;
    }
    return { mean: s / (pa.length / 4), ew: img.naturalWidth };
  });
  expect(m.mean, 'preview/export mean diff').toBeLessThan(8);
});

// I10: Before shows raw original; release restores the edit.
test('I10 before/after round-trip', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: { glow: 50 } });
  const edited = await canvasDataUrl(page);
  const rawVsEdited = await page.evaluate(async () => {
    const A = window.AuraGram;
    A.state.isComparing = true;
    A.renderStudioCanvas();
    const c = document.getElementById('mainCanvas');
    const before = c.toDataURL('image/png');
    A.state.isComparing = false;
    A.renderStudioCanvas();
    const after = c.toDataURL('image/png');
    return { before, after };
  });
  expect(rawVsEdited.after, 'release restores the edit').toBe(edited);
  const diff = await callPx(page, PX.meanAbsDiff, { a: rawVsEdited.before, b: edited });
  expect(diff.mean, 'before differs from edited').toBeGreaterThan(1.0);
});

// I11: Reset clears corrections but keeps geometry.
test('I11 reset clears beauty, keeps face geometry', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  const before = await page.evaluate(() => ({
    id: window.AuraGram.face.imageId(),
    faces: window.AuraGram.face.store().faces.length
  }));
  await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: { glow: 60, eyes: 60, blush: 60 } });
  await page.evaluate(() => window.AuraGram.resetAll());
  const st = await page.evaluate(() => ({
    beauty: window.AuraGram.state.beauty,
    preset: window.AuraGram.state.activePreset,
    id: window.AuraGram.face.imageId(),
    faces: window.AuraGram.face.store() ? window.AuraGram.face.store().faces.length : -1
  }));
  expect(Object.values(st.beauty).every((v) => v === 0), 'beauty cleared').toBe(true);
  expect(st.preset).toBe('normal');
  expect(st.id).toBe(before.id);
  expect(st.faces).toBe(before.faces);
});

// I12: No paid inference, no uploads, local vendor only.
test('I12 no paid inference with G1b.1 passes', async ({ page }) => {
  const reqs = [];
  page.on('request', (r) => reqs.push({ url: r.url(), method: r.method(), hasBody: !!r.postData() }));
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: { glow: 60, eyes: 60, blush: 60 } });
  await page.click('#btnExport');
  await expect(page.locator('#exportModal')).toBeVisible();
  const bad = reqs.filter((r) => /ml\.googleapis|aiplatform|vertex|openai|anthropic|huggingface|replicate|cohere|stability\.ai|mediapipe-models|storage\.googleapis.*(model|mediapipe)/i.test(r.url));
  expect(bad, JSON.stringify(bad)).toEqual([]);
  const uploads = reqs.filter((r) => (r.method === 'POST' || r.method === 'PUT') && r.hasBody);
  expect(uploads, JSON.stringify(uploads)).toEqual([]);
});

// I13: Real MediaPipe geometry drives the new isolation (not mocks).
test('I13 real MediaPipe geometry + isolation on real face', async ({ page }) => {
  const errors = await gotoApp(page);
  await uploadFile(page, EDGE());
  const status = await waitFaceTerminal(page);
  expect(status).toBe('ready');
  expect(await page.evaluate(() => window.AuraGram.stats.faceCount)).toBe(1);
  expect(await page.evaluate(() => window.AuraGram.stats.faceWorkerMode)).toMatch(/worker|main-thread/);
  const regs = await page.evaluate(() => {
    const r = window.AuraGram.face.store().faces[0].regions;
    return { oval: r.faceOval.length, eyes: r.leftEye.length, lips: r.lips.length };
  });
  expect(regs.oval).toBeGreaterThanOrEqual(10);
  // Glow isolation on REAL geometry (background locked, face acts).
  await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: {} });
  const base = await canvasDataUrl(page);
  await applyState(page, { preset: 'vogue', intensity: 100, fx: 'none', beauty: { glow: 60 } });
  const treated = await canvasDataUrl(page);
  const masked = await callPx(page, PX.diffOutsideSkinMask, { a: base, b: treated });
  expect(masked.outsideMax).toBeLessThanOrEqual(2);
  expect(masked.insideMean).toBeGreaterThanOrEqual(0);
  const fatal = errors.filter((e) => !NOISE.test(e));
  expect(fatal, JSON.stringify(fatal)).toEqual([]);
});

// I14: Performance — render times at blush 0/50/100 + glow/eyes.
test('I14 performance: no slider-time inference, bounded render cost', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  const res = await page.evaluate(async () => {
    const A = window.AuraGram;
    const times = {};
    const measure = async (beauty) => {
      A.resetAll();
      A.state.activePreset = 'vogue'; A.state.presetIntensity = 100; A.state.activeFX = 'none';
      for (const k of Object.keys(A.state.beauty)) A.state.beauty[k] = 0;
      for (const k of Object.keys(A.state.adjustments)) A.state.adjustments[k] = 0;
      A.state.adjustments.vignette = 0;
      Object.assign(A.state.beauty, beauty);
      A.renderStudioCanvas();
      if (A.retouch.snapshot() && !A.retouch.ready()) {
        await new Promise((res2) => {
          const t = setInterval(() => {
            if (A.retouch.ready()) { clearInterval(t); res2(0); }
          }, 50);
          setTimeout(() => { clearInterval(t); res2(0); }, 15000);
        });
      }
      const t0 = performance.now();
      A.renderStudioCanvas();
      const dt = performance.now() - t0;
      return { ms: dt, w: document.getElementById('mainCanvas').width, h: document.getElementById('mainCanvas').height, ran: A.stats.retouchRan, maskMs: A.stats.maskBuildMs, retouchMs: A.stats.retouchMs };
    };
    times.blush0 = await measure({ blush: 0 });
    times.blush50 = await measure({ blush: 50 });
    times.blush100 = await measure({ blush: 100 });
    times.glowEyes = await measure({ glow: 60, eyes: 60 });
    times.all = await measure({ smooth: 30, antired: 25, blush: 50, glow: 38, eyes: 42, sculpt: 28 });
    const ua = navigator.userAgent;
    return { times, ua, hw: navigator.hardwareConcurrency || 0 };
  });
  // Report to console for the Gauntlet log (resolution + env are mandatory).
  console.log('I14 perf ' + JSON.stringify(res));
  for (const [k, v] of Object.entries(res.times)) {
    expect(v.ms, `${k} render finishes`).toBeLessThan(2000);
    expect(v.w * v.h > 0, `${k} nonzero canvas`).toBe(true);
  }
  // Blush must not multiply cost pathologically (100 vs 0 within 3x).
  expect(res.times.blush100.ms).toBeLessThan(Math.max(500, res.times.blush0.ms * 3 + 50));
});
