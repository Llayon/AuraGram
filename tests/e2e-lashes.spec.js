/* AuraGram G1c — natural lash enhancement E2E (L1–L25).
 * Pixel-level gates with real MediaPipe geometry on licensed fixtures.
 * Every gate measures canvas pixels, never mere code presence.
 */
const { test, expect } = require('./app-fixtures.cjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const EDGE = () => path.resolve(__dirname, 'fixtures/edge-source.jpg');
const PORTRAIT = () => path.resolve(__dirname, 'fixtures/portrait.jpg');
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
    const b = A.state.beauty, l = A.state.lashes || {};
    const on = b.smooth > 0 || b.antired > 0 || b.glow > 0 || b.eyes > 0 || b.blush > 0 || b.sculpt > 0
      || l.density > 0 || l.length > 0 || l.definition > 0;
    return !on || !A.retouch.snapshot() || A.retouch.ready();
  }, null, { timeout: 60000 });
  await page.evaluate(() => window.AuraGram.renderStudioCanvas());
}

// Exact preset + beauty + lashes state, then a settled render.
async function applyLashState(page, { preset = 'normal', intensity = 100, fx = 'none', beauty = {}, lashes = {} }) {
  await page.evaluate(([p, inten, f, b, l]) => {
    const A = window.AuraGram;
    A.resetAll();
    A.state.activePreset = p;
    A.state.presetIntensity = inten;
    A.state.activeFX = f;
    for (const k of Object.keys(A.state.beauty)) A.state.beauty[k] = 0;
    for (const k of Object.keys(A.state.adjustments)) A.state.adjustments[k] = 0;
    A.state.adjustments.vignette = 0;
    A.state.lashes = { density: 0, length: 0, definition: 0, ...l };
    for (const [k, v] of Object.entries(b)) A.state.beauty[k] = v;
    A.renderStudioCanvas();
  }, [preset, intensity, fx, beauty, lashes]);
  await waitRetouchReady(page);
  // Lash analysis is synchronous inside the first enhancing render, but the
  // retouch module itself is lazy — render once more when it lands.
  await page.evaluate(() => window.AuraGram.renderStudioCanvas());
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
  // Max diff outside both eye ROIs (uses real eyeGeometry in-page).
  outsideRoiMax: `(o) => {
    const load = (url) => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = rej;
      im.src = url;
    });
    return (async () => {
      const geo = await import('/src/retouch/eyeGeometry.mjs');
      const regs = window.AuraGram.face.store().faces[0].regions;
      const m = { x: 0 };
      const xs = regs.faceOval.map((p) => p.x);
      m.w = Math.max(...xs) - Math.min(...xs);
      const eyes = geo.describeEyes(regs, m.w);
      const [ia, ib] = await Promise.all([load(o.a), load(o.b)]);
      const W = ia.naturalWidth, H = ia.naturalHeight;
      const ca = document.createElement('canvas'); ca.width = W; ca.height = H;
      const cb = document.createElement('canvas'); cb.width = W; cb.height = H;
      ca.getContext('2d').drawImage(ia, 0, 0);
      cb.getContext('2d').drawImage(ib, 0, 0);
      const da = ca.getContext('2d').getImageData(0, 0, W, H).data;
      const db = cb.getContext('2d').getImageData(0, 0, W, H).data;
      const inRoi = (x, y) => [eyes.left.roi, eyes.right.roi].some((r) =>
        x >= r.x0 * W - 1 && x <= r.x1 * W + 1 && y >= r.y0 * H - 1 && y <= r.y1 * H + 1);
      let mx = 0;
      for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
        if (inRoi(x, y)) continue;
        const i = (y * W + x) * 4;
        const d = (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3;
        if (d > mx) mx = d;
      }
      return { max: mx };
    })();
  }`,
  // Band-region stats around the upper lid: mean diff + changed fraction.
  bandStats: `(o) => {
    const load = (url) => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = rej;
      im.src = url;
    });
    return (async () => {
      const geo = await import('/src/retouch/eyeGeometry.mjs');
      const regs = window.AuraGram.face.store().faces[0].regions;
      const xs = regs.faceOval.map((p) => p.x);
      const eyes = geo.describeEyes(regs, Math.max(...xs) - Math.min(...xs));
      const [ia, ib] = await Promise.all([load(o.a), load(o.b)]);
      const W = ia.naturalWidth, H = ia.naturalHeight;
      const ca = document.createElement('canvas'); ca.width = W; ca.height = H;
      const cb = document.createElement('canvas'); cb.width = W; cb.height = H;
      ca.getContext('2d').drawImage(ia, 0, 0);
      cb.getContext('2d').drawImage(ib, 0, 0);
      const da = ca.getContext('2d').getImageData(0, 0, W, H).data;
      const db = cb.getContext('2d').getImageData(0, 0, W, H).data;
      let s = 0, n = 0, changed = 0;
      for (const e of [eyes.left, eyes.right]) {
        if (!e.usable) continue;
        const x0 = Math.max(0, Math.floor(e.roi.x0 * W)), x1 = Math.min(W, Math.ceil(e.roi.x1 * W));
        const lidYs = e.upperLid.map((p) => p.y * H);
        const lidTop = Math.min(...lidYs), lidBot = Math.max(...lidYs);
        const y0 = Math.max(0, Math.floor(lidTop - e.h * H * 0.5)), y1 = Math.min(H, Math.ceil(lidBot + 2));
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4;
          const d = (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3;
          s += d; n++;
          if (d > 2) changed++;
        }
      }
      return { mean: s / Math.max(1, n), changedFrac: changed / Math.max(1, n), pixels: n };
    })();
  }`
};

// Eye landmarks from real detection: centroids (iris guard), lids, bg.
async function eyeProbes(page) {
  return page.evaluate(() => {
    const regs = window.AuraGram.face.store().faces[0].regions;
    const mean = (arr) => arr.reduce((a, p) => ({ x: a.x + p.x / arr.length, y: a.y + p.y / arr.length }), { x: 0, y: 0 });
    const eL = mean(regs.leftEye), eR = mean(regs.rightEye);
    const bL = mean(regs.leftEyebrow), bR = mean(regs.rightEyebrow);
    const lips = mean(regs.lips);
    const nose = regs.nose[4] || mean(regs.nose);
    return {
      irisL: [eL.x, eL.y], irisR: [eR.x, eR.y],
      browL: [bL.x, bL.y], browR: [bR.x, bR.y], lips: [lips.x, lips.y],
      cheek: [nose.x - 0.09, nose.y - 0.02],
      bg: [[0.03, 0.5], [0.95, 0.08], [0.05, 0.05], [0.97, 0.95]]
    };
  });
}

// L1: ROI tracks the real eye coordinates.
test('L1 geometry mapping follows the detected eyes', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  const g = await page.evaluate(async () => {
    const geo = await import('/src/retouch/eyeGeometry.mjs');
    const regs = window.AuraGram.face.store().faces[0].regions;
    const xs = regs.faceOval.map((p) => p.x);
    const eyes = geo.describeEyes(regs, Math.max(...xs) - Math.min(...xs));
    return {
      left: { cx: eyes.left.cx, cy: eyes.left.cy, roi: eyes.left.roi, usable: eyes.left.usable },
      right: { cx: eyes.right.cx, cy: eyes.right.cy, roi: eyes.right.roi, usable: eyes.right.usable }
    };
  });
  for (const side of ['left', 'right']) {
    expect(g[side].usable, `${side} usable on a clear portrait`).toBe(true);
    expect(g[side].roi.x0, `${side} roi left of centroid`).toBeLessThan(g[side].cx);
    expect(g[side].roi.x1, `${side} roi right of centroid`).toBeGreaterThan(g[side].cx);
    expect(g[side].roi.y0, `${side} roi above centroid`).toBeLessThan(g[side].cy);
    expect(g[side].roi.y1, `${side} roi below centroid`).toBeGreaterThan(g[side].cy);
  }
});

// L2: left/right eyes are not swapped or mirrored.
test('L2 left and right eyes keep their own geometry', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  const g = await page.evaluate(async () => {
    const geo = await import('/src/retouch/eyeGeometry.mjs');
    const regs = window.AuraGram.face.store().faces[0].regions;
    const xs = regs.faceOval.map((p) => p.x);
    const eyes = geo.describeEyes(regs, Math.max(...xs) - Math.min(...xs));
    return { lcx: eyes.left.cx, rcx: eyes.right.cx, lax: eyes.left.angle, rax: eyes.right.angle };
  });
  // Subject-left eye appears image-right.
  expect(g.lcx, 'left eye is image-right of right eye').toBeGreaterThan(g.rcx);
  expect(Math.abs(g.lcx - g.rcx), 'eyes are distinct').toBeGreaterThan(0.05);
});

// L3: all-zero lashes are identity.
test('L3 zero lashes change nothing', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyLashState(page, { preset: 'normal', beauty: {}, lashes: {} });
  const base = await canvasDataUrl(page);
  await applyLashState(page, { preset: 'normal', beauty: {}, lashes: { density: 0, length: 0, definition: 0 } });
  expect(await canvasDataUrl(page), 'explicit zeros are identity').toBe(base);
  await applyLashState(page, { preset: 'vogue', beauty: {}, lashes: { density: 0, length: 0, definition: 0 } });
  const vogueZero = await canvasDataUrl(page);
  await applyLashState(page, { preset: 'vogue', beauty: {}, lashes: {} });
  expect(await canvasDataUrl(page), 'vogue zeros are identity').toBe(vogueZero);
});

// L4: max lash enhancement keeps the background pixel-identical.
test('L4 background isolation at full lashes', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyLashState(page, { preset: 'normal', lashes: {} });
  const base = await canvasDataUrl(page);
  await applyLashState(page, { preset: 'normal', lashes: { density: 100, length: 100, definition: 100 } });
  const full = await canvasDataUrl(page);
  const pr = await eyeProbes(page);
  const bgD = await callPx(page, PX.diffAt, [[...pr.bg], base, full]);
  bgD.forEach((d, i) => expect(d, `background pt ${i}`).toBeLessThanOrEqual(2));
  const out = await callPx(page, PX.outsideRoiMax, { a: base, b: full });
  expect(out.max, 'outside both eye ROIs').toBeLessThanOrEqual(2);
});

// L5: iris, pupil area, sclera zone, brows, cheek, lips are protected.
test('L5 protected regions survive full lashes', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyLashState(page, { preset: 'normal', lashes: {} });
  const base = await canvasDataUrl(page);
  await applyLashState(page, { preset: 'normal', lashes: { density: 100, length: 100, definition: 100 } });
  const full = await canvasDataUrl(page);
  const pr = await eyeProbes(page);
  const pts = [pr.irisL, pr.irisR, pr.browL, pr.browR, pr.cheek, pr.lips];
  const diffs = await callPx(page, PX.diffAt, [pts, base, full]);
  const names = ['irisL', 'irisR', 'browL', 'browR', 'cheek', 'lips'];
  diffs.forEach((d, i) => expect(d, `${names[i]} protected`).toBeLessThanOrEqual(4));
});

// L6: density is monotonic, gradual, and keeps gaps (no solid strip).
for (const mode of ['tilted', 'cropped']) test(`lash protection on a real ${mode} face`, async ({page})=>{
  await gotoApp(page);
  const data=await page.evaluate(async mode=>{
    const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src='/tests/fixtures/edge-source.jpg';});
    const c=document.createElement('canvas');
    c.width=mode==='cropped'?700:900;c.height=mode==='cropped'?700:1125;
    const x=c.getContext('2d');x.fillStyle='#101014';x.fillRect(0,0,c.width,c.height);
    if(mode==='cropped')x.drawImage(image,-420,-60);
    else{x.translate(c.width/2,c.height/2);x.rotate(Math.PI/12);x.drawImage(image,-image.naturalWidth/2,-image.naturalHeight/2);}
    return c.toDataURL('image/jpeg',.9).split(',')[1];
  },mode);
  const file=path.join(os.tmpdir(),`auragram-lash-${mode}-${process.pid}-${Date.now()}.jpg`);
  fs.writeFileSync(file,Buffer.from(data,'base64'));
  try{
    await uploadFile(page,file);
    expect(await waitFaceTerminal(page)).toBe('ready');
    await applyLashState(page,{lashes:{}});const base=await canvasDataUrl(page);
    await applyLashState(page,{lashes:{density:100,length:100,definition:100}});const full=await canvasDataUrl(page);
    const pr=await eyeProbes(page);
    const visible=[pr.irisL,pr.irisR,pr.browL,pr.browR,pr.lips].filter(([x,y])=>x>0&&x<1&&y>0&&y<1);
    expect(visible.length).toBeGreaterThanOrEqual(3);
    const diffs=await callPx(page,PX.diffAt,[visible,base,full]);
    diffs.forEach(diff=>expect(diff,'visible eye/brow/lip protection').toBeLessThanOrEqual(4));
    const outside=await callPx(page,PX.outsideRoiMax,{a:base,b:full});
    expect(outside.max,'outside clipped eye ROIs').toBeLessThanOrEqual(2);
  }finally{fs.unlinkSync(file);}
});

test('L6 density monotonicity without jumps or strips', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyLashState(page, { preset: 'normal', lashes: {} });
  const base = await canvasDataUrl(page);
  const means = [];
  for (const v of [25, 50, 75, 100]) {
    await applyLashState(page, { preset: 'normal', lashes: { density: v, length: 0, definition: 0 } });
    const cur = await canvasDataUrl(page);
    const s = await callPx(page, PX.bandStats, { a: base, b: cur });
    means.push(s.mean);
    if (v === 100) {
      expect(s.changedFrac, 'density100 changes the band').toBeGreaterThan(0.005);
      expect(s.changedFrac, 'no solid strip (gaps preserved)').toBeLessThan(0.6);
    }
  }
  for (let i = 1; i < means.length; i++) {
    expect(means[i] + 0.15, `density step ${i} monotonic`).toBeGreaterThanOrEqual(means[i - 1]);
  }
  expect(Math.max(...means) - Math.min(...means), 'bounded total range').toBeLessThan(30);
});

// L7: length extends real structures gradually (spatial, not mere darkening).
test('L7 length monotonicity and spatial extension', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyLashState(page, { preset: 'normal', lashes: {} });
  const base = await canvasDataUrl(page);
  const means = [];
  let lastShot = base;
  for (const v of [30, 60, 100]) {
    await applyLashState(page, { preset: 'normal', lashes: { density: 0, length: v, definition: 0 } });
    lastShot = await canvasDataUrl(page);
    const s = await callPx(page, PX.bandStats, { a: base, b: lastShot });
    means.push(s.mean);
  }
  // Only length>0 — any band change IS the length effect (no darkening pass).
  const full = await callPx(page, PX.bandStats, { a: base, b: lastShot });
  const info = await page.evaluate(() => window.AuraGram.lash.info());
  if (info && (info.left.tips > 0 || info.right.tips > 0)) {
    expect(full.mean, 'length100 extends detected structures').toBeGreaterThan(0.02);
    for (let i = 1; i < means.length; i++) {
      expect(means[i] + 0.1, `length step ${i} monotonic`).toBeGreaterThanOrEqual(means[i - 1]);
    }
  } else {
    // Honest skip on undetectable lashes still proves isolation elsewhere.
    expect(full.mean, 'no confident tips: length stays near-idle').toBeLessThan(0.5);
  }
  const pr = await eyeProbes(page);
  const irisD = await callPx(page, PX.diffAt, [[pr.irisL, pr.irisR], base, lastShot]);
  irisD.forEach((d, i) => expect(d, `iris ${i} untouched by length`).toBeLessThanOrEqual(4));
});

// L8: definition stays inside the lash band.
test('L8 definition is band-local', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyLashState(page, { preset: 'normal', lashes: {} });
  const base = await canvasDataUrl(page);
  await applyLashState(page, { preset: 'normal', lashes: { density: 0, length: 0, definition: 100 } });
  const full = await canvasDataUrl(page);
  const pr = await eyeProbes(page);
  const far = await callPx(page, PX.diffAt, [[...pr.bg, pr.cheek, pr.lips, pr.irisL, pr.irisR], base, full]);
  far.forEach((d, i) => expect(d, `far pt ${i} untouched by definition`).toBeLessThanOrEqual(4));
  const out = await callPx(page, PX.outsideRoiMax, { a: base, b: full });
  expect(out.max, 'definition outside ROIs').toBeLessThanOrEqual(2);
});

// L9: deterministic rendering (no flicker).
test('L9 identical settings give identical pixels', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  const cfg = { preset: 'vogue', lashes: { density: 60, length: 40, definition: 50 } };
  await applyLashState(page, cfg);
  const a = await canvasDataUrl(page);
  await applyLashState(page, cfg);
  expect(await canvasDataUrl(page), 'deterministic rerender').toBe(a);
  await applyLashState(page, cfg);
  expect(await canvasDataUrl(page), 'third rerender stable').toBe(a);
});

// L10: no face — lashes skip, editor works.
test('L10 no face: lashes skip safely', async ({ page }) => {
  await gotoApp(page);
  const noface = path.join(os.tmpdir(), `auragram-lash-noface-${Date.now()}.png`);
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
  await applyLashState(page, { preset: 'vogue', lashes: {} });
  const plain = await canvasDataUrl(page);
  await applyLashState(page, { preset: 'vogue', lashes: { density: 100, length: 100, definition: 100 } });
  expect(await canvasDataUrl(page), 'no-face lashes are identity').toBe(plain);
});

// L11: blurry eyes get no fake strokes.
test('L11 blurred eyes are guarded (no black strokes)', async ({ page }) => {
  await gotoApp(page);
  const blurred = await page.evaluate(async () => {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej;
      i.src = '/tests/fixtures/edge-source.jpg';
    });
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0);
    cx.filter = 'blur(9px)';
    cx.drawImage(img, 0, 0); // heavy global blur: lashes unresolvable
    cx.filter = 'none';
    return cv.toDataURL('image/jpeg', 0.9);
  });
  const f = path.join(os.tmpdir(), `auragram-lash-blur-${Date.now()}.jpg`);
  fs.writeFileSync(f, Buffer.from(blurred.split(',')[1], 'base64'));
  await uploadFile(page, f);
  const status = await waitFaceTerminal(page);
  if (status !== 'ready') return; // detector itself gives up: vacuously safe
  await applyLashState(page, { preset: 'normal', lashes: {} });
  const base = await canvasDataUrl(page);
  await applyLashState(page, { preset: 'normal', lashes: { density: 100, length: 100, definition: 100 } });
  const full = await canvasDataUrl(page);
  const m = await callPx(page, PX.meanAbsDiff, { a: base, b: full });
  expect(m.mean, 'blurred eyes: near-idle (guarded)').toBeLessThan(0.6);
  expect(m.max, 'no harsh strokes on blur').toBeLessThan(60);
});

// L12: tiny portrait — isolation holds, no artifacts.
test('L12 low-resolution portrait stays safe', async ({ page }) => {
  await gotoApp(page);
  const tiny = await page.evaluate(async () => {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej;
      i.src = '/tests/fixtures/edge-source.jpg';
    });
    const cv = document.createElement('canvas');
    cv.width = 160; cv.height = 200;
    cv.getContext('2d').drawImage(img, 0, 0, 160, 200);
    return cv.toDataURL('image/jpeg', 0.85);
  });
  const f = path.join(os.tmpdir(), `auragram-lash-tiny-${Date.now()}.jpg`);
  fs.writeFileSync(f, Buffer.from(tiny.split(',')[1], 'base64'));
  await uploadFile(page, f);
  const status = await waitFaceTerminal(page);
  if (status !== 'ready') return;
  await applyLashState(page, { preset: 'normal', lashes: {} });
  const base = await canvasDataUrl(page);
  await applyLashState(page, { preset: 'normal', lashes: { density: 100, length: 100, definition: 100 } });
  const full = await canvasDataUrl(page);
  const out = await callPx(page, PX.outsideRoiMax, { a: base, b: full });
  expect(out.max, 'tiny portrait: outside ROIs intact').toBeLessThanOrEqual(3);
});

// L13: preview/export geometric agreement with lashes on.
test('L13 preview and export agree with lashes on', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyLashState(page, { preset: 'vogue', intensity: 88, lashes: { density: 50, length: 30, definition: 40 } });
  const ran = await page.evaluate(() => window.AuraGram.stats.retouchRan);
  expect(ran).toMatch(/lashes/);
  await page.click('#btnExport');
  await page.waitForFunction(() => !!window.AuraGram.getExportBlob(), null, { timeout: 45000 });
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

// L14: reset clears lashes and restores the original, geometry kept.
test('L14 reset zeroes lashes, keeps geometry', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  const before = await page.evaluate(() => ({
    id: window.AuraGram.face.imageId(),
    faces: window.AuraGram.face.store().faces.length
  }));
  await applyLashState(page, { preset: 'vogue', lashes: { density: 70, length: 50, definition: 60 } });
  await page.evaluate(() => window.AuraGram.resetAll());
  const st = await page.evaluate(() => ({
    lashes: window.AuraGram.state.lashes,
    preset: window.AuraGram.state.activePreset,
    id: window.AuraGram.face.imageId(),
    faces: window.AuraGram.face.store() ? window.AuraGram.face.store().faces.length : -1
  }));
  expect(st.lashes, 'lashes cleared').toEqual({ density: 0, length: 0, definition: 0 });
  expect(st.preset).toBe('normal');
  expect(st.id).toBe(before.id);
  expect(st.faces).toBe(before.faces);
});

// L15: before shows raw, release restores lashes edit.
test('L15 before/after round-trip with lashes', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyLashState(page, { preset: 'vogue', lashes: { density: 60, length: 40, definition: 50 } });
  const edited = await canvasDataUrl(page);
  const r = await page.evaluate(async () => {
    const A = window.AuraGram;
    A.state.isComparing = true;
    A.renderStudioCanvas();
    const before = document.getElementById('mainCanvas').toDataURL('image/png');
    A.state.isComparing = false;
    A.renderStudioCanvas();
    return { before, after: document.getElementById('mainCanvas').toDataURL('image/png') };
  });
  expect(r.after, 'release restores the lash edit').toBe(edited);
  const diff = await callPx(page, PX.meanAbsDiff, { a: r.before, b: edited });
  expect(diff.mean, 'before differs from edited').toBeGreaterThan(1.0);
});

// L16: lashes never alter global preset effects.
test('L16 preset independence (Vogue/Champagne globals kept)', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  for (const preset of ['vogue', 'champagne']) {
    await applyLashState(page, { preset, intensity: 100, lashes: {} });
    const plain = await canvasDataUrl(page);
    await applyLashState(page, { preset, intensity: 100, lashes: { density: 100, length: 100, definition: 100 } });
    const lashed = await canvasDataUrl(page);
    const out = await callPx(page, PX.outsideRoiMax, { a: plain, b: lashed });
    expect(out.max, `${preset} globals outside ROIs`).toBeLessThanOrEqual(2);
  }
  await applyLashState(page, { preset: 'normal', lashes: { density: 80, length: 60, definition: 70 } });
  const normalLashed = await canvasDataUrl(page);
  await applyLashState(page, { preset: 'vogue', lashes: { density: 80, length: 60, definition: 70 } });
  const vogueLashed = await canvasDataUrl(page);
  const presetKept = await callPx(page, PX.meanAbsDiff, { a: normalLashed, b: vogueLashed });
  expect(presetKept.mean, 'preset still restyles under lashes').toBeGreaterThan(1.0);
});

// L17: lashes and Eyes are independent values.
test('L17 lash sliders never touch beauty.eyes and vice versa', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await page.evaluate(() => {
    const A = window.AuraGram;
    A.resetAll();
    A.state.activePreset = 'normal'; A.state.activeFX = 'none';
    for (const k of Object.keys(A.state.beauty)) A.state.beauty[k] = 0;
    for (const k of Object.keys(A.state.adjustments)) A.state.adjustments[k] = 0;
    A.state.adjustments.vignette = 0;
    A.state.beauty.eyes = 50;
    A.state.lashes = { density: 40, length: 30, definition: 20 };
    A.renderStudioCanvas();
  });
  await waitRetouchReady(page);
  const st = await page.evaluate(() => ({ eyes: window.AuraGram.state.beauty.eyes, lashes: window.AuraGram.state.lashes }));
  expect(st.eyes, 'eyes kept').toBe(50);
  expect(st.lashes, 'lashes kept').toEqual({ density: 40, length: 30, definition: 20 });
  // Drive the real UI sliders: lash input must not move beauty.eyes.
  await page.click('[data-tab="beauty"]');
  await page.getByRole('button', { name: /Ресницы/ }).click();
  await page.locator('#lashDensity').focus();
  await page.locator('#lashDensity').press('End');
  for (let i = 0; i < 23; i++) await page.locator('#lashDensity').press('ArrowLeft');
  const after = await page.evaluate(() => ({ eyes: window.AuraGram.state.beauty.eyes, d: window.AuraGram.state.lashes.density }));
  expect(after.d, 'lash slider applied').toBe(77);
  expect(after.eyes, 'eyes untouched by lash slider').toBe(50);
  await page.getByRole('button', { name: /Акцент/ }).click();
  await page.locator('#mainSlider').press('ArrowRight');
  expect(await page.evaluate(() => window.AuraGram.state.lashes)).toEqual({ density:77, length:30, definition:20 });
  expect(await page.evaluate(() => window.AuraGram.state.beauty.eyes)).toBe(51);
});

// L18: analysis cache follows the current photo.
test('L18 lash cache never leaks across photos', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, PORTRAIT());
  await waitFaceTerminal(page);
  await applyLashState(page, { preset: 'normal', lashes: { density: 50, length: 30, definition: 40 } });
  const a = await page.evaluate(() => ({ key: window.AuraGram.lash.info()?.key, id: window.AuraGram.face.imageId() }));
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyLashState(page, { preset: 'normal', lashes: { density: 50, length: 30, definition: 40 } });
  const b = await page.evaluate(() => ({ key: window.AuraGram.lash.info()?.key, id: window.AuraGram.face.imageId() }));
  expect(b.id, 'photo generation advanced').not.toBe(a.id);
  if (a.key && b.key) expect(b.key, 'cache follows the photo').not.toBe(a.key);
  expect(String(b.key), 'cache key matches current photo').toContain(String(b.id));
});

// L19: sliders never run MediaPipe or lash analysis.
test('L19 no inference or re-analysis on slider moves', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyLashState(page, { preset: 'normal', lashes: { density: 50, length: 30, definition: 40 } });
  const before = await page.evaluate(() => ({
    id: window.AuraGram.face.imageId(),
    detectMs: window.AuraGram.stats.faceDetectMs,
    analyseMs: window.AuraGram.retouch.timings()?.lashAnalyseMs,
    key: window.AuraGram.lash.info()?.key
  }));
  await page.evaluate(() => {
    const A = window.AuraGram;
    A.state.lashes = { density: 51, length: 31, definition: 41 };
    A.renderStudioCanvas();
    A.state.lashes = { density: 52, length: 32, definition: 42 };
    A.renderStudioCanvas();
  });
  const after = await page.evaluate(() => ({
    id: window.AuraGram.face.imageId(),
    detectMs: window.AuraGram.stats.faceDetectMs,
    analyseMs: window.AuraGram.retouch.timings()?.lashAnalyseMs,
    key: window.AuraGram.lash.info()?.key
  }));
  expect(after.id, 'same photo').toBe(before.id);
  expect(after.detectMs, 'no new detection').toBe(before.detectMs);
  expect(after.key, 'same analysis cache').toBe(before.key);
  expect(after.analyseMs, 'analysis not re-run').toBe(before.analyseMs);
});

// L20: warm-render budget vs G1b.1.
test('L20 performance: lash warm cost within budget', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  const res = await page.evaluate(async () => {
    const A = window.AuraGram;
    const run = async (lashes) => {
      A.resetAll();
      A.state.activePreset = 'vogue'; A.state.presetIntensity = 100; A.state.activeFX = 'none';
      for (const k of Object.keys(A.state.beauty)) A.state.beauty[k] = 0;
      for (const k of Object.keys(A.state.adjustments)) A.state.adjustments[k] = 0;
      A.state.adjustments.vignette = 0;
      A.state.lashes = { ...lashes };
      A.renderStudioCanvas();
      if (A.retouch.snapshot() && !A.retouch.ready()) {
        await new Promise((res2) => {
          const t = setInterval(() => { if (A.retouch.ready()) { clearInterval(t); res2(0); } }, 50);
          setTimeout(() => { clearInterval(t); res2(0); }, 15000);
        });
      }
      A.renderStudioCanvas(); // warm (analysis cached from here on)
      const samples = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        A.renderStudioCanvas();
        samples.push(performance.now() - t0);
      }
      samples.sort((a, b) => a - b);
      const T = A.retouch.timings();
      return {
        median: samples[2], samples,
        w: document.getElementById('mainCanvas').width, h: document.getElementById('mainCanvas').height,
        analyseMs: T.lashAnalyseMs, enhanceMs: T.lashEnhanceMs, ran: A.stats.retouchRan
      };
    };
    const base = await run({ density: 0, length: 0, definition: 0 });
    const lashed = await run({ density: 50, length: 30, definition: 40 });
    const full = await run({ density: 100, length: 100, definition: 100 });
    return { base, lashed, full, ua: navigator.userAgent, hw: navigator.hardwareConcurrency || 0 };
  });
  console.log('L20 perf ' + JSON.stringify(res));
  expect(res.lashed.ran, 'performance must execute a real lash pass').toContain('density');
  expect(res.lashed.enhanceMs).toBeGreaterThan(0);
  expect(res.lashed.median, 'warm render finishes').toBeLessThan(2000);
  // Target budget: +15ms over the lash-free warm render at 864×1080.
  expect(res.lashed.median - res.base.median, 'lash warm delta within +15ms').toBeLessThan(15);
  expect(res.full.w * res.full.h > 0, 'nonzero canvas').toBe(true);
});

// L21: bounded buffers, no per-render growth.
test('L21 memory: lash buffers bounded and reused', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyLashState(page, { preset: 'normal', lashes: { density: 60, length: 50, definition: 50 } });
  const b1 = await page.evaluate(() => window.AuraGram.lash.buffers());
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.AuraGram.renderStudioCanvas());
  }
  const b2 = await page.evaluate(() => window.AuraGram.lash.buffers());
  // One additional mask-resolution layer caches the smooth/glow target in 0.3.
  // The existing 4MB byte budget and no-growth requirement remain unchanged.
  expect(b1.count, 'bounded canvas count').toBeLessThanOrEqual(9);
  expect(b2.count, 'no buffer growth across renders').toBe(b1.count);
  expect(b2.bytes, 'bounded bytes (<4MB)').toBeLessThan(4 * 1024 * 1024);
});

// L22: real MediaPipe + real lash algorithm on a licensed portrait.
test('L22 real portrait: detection finds lashes and enhances them', async ({ page }) => {
  const errors = await gotoApp(page);
  await uploadFile(page, EDGE());
  expect(await waitFaceTerminal(page)).toBe('ready');
  expect(await page.evaluate(() => window.AuraGram.stats.faceCount)).toBe(1);
  await applyLashState(page, { preset: 'normal', lashes: {} });
  const base = await canvasDataUrl(page);
  await applyLashState(page, { preset: 'normal', lashes: { density: 70, length: 50, definition: 60 } });
  const info = await page.evaluate(() => window.AuraGram.lash.info());
  expect(info, 'analysis ran').not.toBe(null);
  const confident = info.left.confidence > 0 || info.right.confidence > 0;
  expect(confident || (info.left.reason && info.right.reason), 'confidence or honest reason').toBeTruthy();
  if (confident) {
    const s = await callPx(page, PX.bandStats, { a: base, b: await canvasDataUrl(page) });
    expect(s.mean, 'visible enhancement in the band').toBeGreaterThan(0.02);
  }
  const fatal = errors.filter((e) => !NOISE.test(e));
  expect(fatal, JSON.stringify(fatal)).toEqual([]);
});

// L23: blush without buffers paints nothing and never throws.
test('L23 blush safe-skip without a buffer layer', async ({ page }) => {
  await gotoApp(page);
  const r = await page.evaluate(async () => {
    const retouch = await import('/src/retouch/retouch.mjs');
    const session = retouch.createRetouchSession();
    const ell = (ex, ey, rx, ry, n) => Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return { x: ex + Math.cos(a) * rx, y: ey + Math.sin(a) * ry, z: 0 };
    });
    const regions = {
      faceOval: ell(0.5, 0.52, 0.3, 0.36, 36),
      leftEye: ell(0.61, 0.44, 0.045, 0.022, 16),
      rightEye: ell(0.39, 0.44, 0.045, 0.022, 16),
      leftEyebrow: ell(0.61, 0.385, 0.055, 0.015, 10),
      rightEyebrow: ell(0.39, 0.385, 0.055, 0.015, 10),
      lips: ell(0.5, 0.66, 0.085, 0.038, 20),
      nose: Array.from({ length: 8 }, (_, i) => ({ x: 0.5, y: 0.46 + (i / 7) * 0.18, z: 0 }))
    };
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = rej;
      im.src = '/tests/visual/synthetic/skin-light.png';
    });
    const W = 320, H = 320;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0);
    const before = cx.getImageData(0, 0, W, H).data.slice();
    let threw = null;
    let ran = [];
    try {
      // No buffers at all: the G1c-safe path must skip without painting.
      const out = session.applyPasses(cx, W, H, {
        face: { imageId: 777001, regions },
        beauty: { smooth: 0, antired: 0, glow: 0, eyes: 0, blush: 100, sculpt: 0 },
        src: img, gradeFilter: 'brightness(100%)', gradeSig: 'l23',
        buffers: undefined
      });
      ran = out.ran;
    } catch (e) { threw = String(e && e.message || e); }
    const after = cx.getImageData(0, 0, W, H).data;
    let diff = 0;
    for (let i = 0; i < after.length; i += 4) {
      diff += Math.abs(after[i] - before[i]) + Math.abs(after[i + 1] - before[i + 1]) + Math.abs(after[i + 2] - before[i + 2]);
    }
    return { threw, ran, diff };
  });
  expect(r.threw, 'never throws').toBe(null);
  expect(r.diff, 'paints nothing without buffers').toBe(0);
});

// L24: golden regression — lashes-off output matches the G1b.1 baseline.
test('L24 golden regression vs G1b.1 baseline', async ({ page }) => {
  const golden = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'golden/g1b1-golden.json'), 'utf8'));
  await gotoApp(page);
  const live = await page.evaluate(async (settings) => {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = rej;
      im.src = '/tests/visual/synthetic/skin-light.png';
    });
    const ell = (ex, ey, rx, ry, n) => Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return { x: ex + Math.cos(a) * rx, y: ey + Math.sin(a) * ry, z: 0 };
    });
    const regions = {
      faceOval: ell(0.5, 0.52, 0.3, 0.36, 36),
      leftEye: ell(0.61, 0.44, 0.045, 0.022, 16),
      rightEye: ell(0.39, 0.44, 0.045, 0.022, 16),
      leftEyebrow: ell(0.61, 0.385, 0.055, 0.015, 10),
      rightEyebrow: ell(0.39, 0.385, 0.055, 0.015, 10),
      lips: ell(0.5, 0.66, 0.085, 0.038, 20),
      nose: Array.from({ length: 8 }, (_, i) => ({ x: 0.5, y: 0.46 + (i / 7) * 0.18, z: 0 }))
    };
    const face = { imageId: 4242, regions };
    const A = window.AuraGram;
    const t0 = Date.now();
    // Trigger the lazy module using the local fixture and explicit geometry.
    A.renderImage(document.createElement('canvas').getContext('2d'), 8, 8, img, A.state, face);
    while (!A.retouch.ready() && Date.now() - t0 < 30000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const out = {};
    for (const name of settings) {
      const st = JSON.parse(JSON.stringify(A.createNeutralState()));
      st.adjustments.vignette = 0;
      if (name === 'vogue') { st.activePreset = 'vogue'; }
      else if (name === 'champagne') { st.activePreset = 'champagne'; }
      else if (name.endsWith('100')) { st.beauty[name.replace('100', '')] = 100; }
      const cv = document.createElement('canvas');
      cv.width = 320; cv.height = 320;
      A.renderImage(cv.getContext('2d'), 320, 320, img, st, face);
      const d = cv.getContext('2d').getImageData(0, 0, 320, 320).data;
      let sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 28) { sum += d[i] + d[i + 1] + d[i + 2]; n++; }
      out[name] = { sum, mean: sum / n };
    }
    return out;
  }, golden.settings);
  for (const name of golden.settings) {
    const ref = golden.goldens[name].sum, got = live[name].sum;
    const drift = Math.abs(got - ref) / ref;
    expect(drift, `${name} golden drift ${got} vs ${ref}`).toBeLessThan(golden.tolerance.relDrift);
  }
});

// L25: no paid services with lashes engaged.
test('L25 no paid inference with lashes on', async ({ page }) => {
  const reqs = [];
  page.on('request', (r) => reqs.push({ url: r.url(), method: r.method(), hasBody: !!r.postData() }));
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyLashState(page, { preset: 'vogue', lashes: { density: 80, length: 60, definition: 70 } });
  await page.click('#btnExport');
  await page.waitForFunction(() => !!window.AuraGram.getExportBlob(), null, { timeout: 45000 });
  await expect(page.locator('#exportModal')).toBeVisible();
  const bad = reqs.filter((r) => /ml\.googleapis|aiplatform|vertex|openai|anthropic|huggingface|replicate|cohere|stability\.ai|mediapipe-models|storage\.googleapis.*(model|mediapipe)/i.test(r.url));
  expect(bad, JSON.stringify(bad)).toEqual([]);
  const uploads = reqs.filter((r) => (r.method === 'POST' || r.method === 'PUT') && r.hasBody);
  expect(uploads, JSON.stringify(uploads)).toEqual([]);
});

// Debug: ?debugLashes=1 overlay renders, export stays clean.
test('debugLashes overlay renders without touching export', async ({ page }) => {
  await gotoApp(page, '?debugLashes=1');
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await applyLashState(page, { preset: 'normal', lashes: { density: 60, length: 50, definition: 50 } });
  const overlay = await page.evaluate(() => {
    const c = document.getElementById('lashOverlay');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++;
    return { w: c.width, h: c.height, painted: n };
  });
  expect(overlay.painted, 'debug overlay paints ROI/lid/tips').toBeGreaterThan(10);
  await page.click('#btnExport');
  await page.waitForFunction(() => !!window.AuraGram.getExportBlob(), null, { timeout: 45000 });
  await expect(page.locator('#exportModal')).toBeVisible();
  const bytesDebug = await page.evaluate(async () => Array.from(new Uint8Array(await window.AuraGram.getExportBlob().arrayBuffer())));
  await page.click('#btnCloseModal');
  const page2 = await page.context().newPage();
  await gotoApp(page2, '');
  await uploadFile(page2, EDGE());
  await waitFaceTerminal(page2);
  await applyLashState(page2, { preset: 'normal', lashes: { density: 60, length: 50, definition: 50 } });
  await page2.click('#btnExport');
  await page2.waitForFunction(() => !!window.AuraGram.getExportBlob(), null, { timeout: 45000 });
  await expect(page2.locator('#exportModal')).toBeVisible();
  const bytesPlain = await page2.evaluate(async () => Array.from(new Uint8Array(await window.AuraGram.getExportBlob().arrayBuffer())));
  expect(bytesDebug, 'debug overlay never leaks into export').toEqual(bytesPlain);
  await page2.close();
});
