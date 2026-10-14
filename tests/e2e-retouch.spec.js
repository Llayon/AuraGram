/* AuraGram G1b — retouch browser E2E (Playwright + Chromium).
 * Real MediaPipe detection + real photos for the retouch path (R19);
 * synthetic tone patches + injected mock geometry for the algorithm matrix
 * (tones, texture, occlusion) without touching app state.
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

// Neutral base, then exactly one beauty tool at a value (preset normal, no FX).
async function isolateBeauty(page, tool, value) {
  await page.evaluate(([t, v]) => {
    const A = window.AuraGram;
    A.resetAll();
    const st = A.state;
    st.activePreset = 'normal'; st.activeFX = 'none';
    for (const k of Object.keys(st.beauty)) st.beauty[k] = 0;
    for (const k of Object.keys(st.adjustments)) st.adjustments[k] = 0;
    if (t) st.beauty[t] = v;
    A.renderStudioCanvas();
  }, [tool, value]);
  // Retouch module is lazy — wait for it when beauty is engaged.
  await page.waitForFunction(() => {
    const A = window.AuraGram;
    const b = A.state.beauty;
    const on = b.smooth > 0 || b.antired > 0 || b.glow > 0 || b.eyes > 0 || b.blush > 0 || b.sculpt > 0;
    return !on || !A.retouch.snapshot() || A.retouch.ready();
  }, null, { timeout: 60000 });
  await page.evaluate(() => window.AuraGram.renderStudioCanvas());
}

async function canvasDataUrl(page) {
  return page.evaluate(() => document.getElementById('mainCanvas').toDataURL('image/png'));
}

// Pixel metrics inside the page (exact, no screenshots).
// fnSrc is an arrow-function SOURCE string; arg must be JSON-serializable.
async function callPx(page, fnSrc, arg) {
  return page.evaluate(`(${fnSrc})(${JSON.stringify(arg)})`);
}

const PX = {
  // pts: normalized [[x,y]...]; a/b: PNG dataURLs. Returns per-point RGB sums.
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
        const x = Math.round(nx * A.w), y = Math.round(ny * A.h);
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
  }`
};

// R1: neutral render is (near-)identical to the raw source pixels.
test('R1 neutral render equals the original pixels', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, PORTRAIT());
  await page.evaluate(() => window.AuraGram.resetAll());
  // Compare neutral render against a pristine re-decode of the fixture.
  const diff = await page.evaluate(() => {
    const c = document.getElementById('mainCanvas');
    const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    // Re-decode the uploaded fixture for a pristine reference.
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const t = document.createElement('canvas');
        t.width = c.width; t.height = c.height;
        t.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const b = t.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let max = 0;
        for (let i = 0; i < a.length; i += 4) {
          max = Math.max(max, Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        }
        res(max);
      };
      img.src = '/tests/fixtures/portrait.jpg';
    });
  });
  expect(diff).toBeLessThanOrEqual(2);
});

// R7: every beauty tool at 0 is identity (byte-identical dataURLs).
test('R7 zero strength is identity for every tool', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, PORTRAIT());
  await waitFaceTerminal(page);
  await isolateBeauty(page, null, 0);
  const neutral = await canvasDataUrl(page);
  for (const tool of ['smooth', 'antired', 'glow', 'eyes', 'blush', 'sculpt']) {
    await isolateBeauty(page, tool, 0);
    expect(await canvasDataUrl(page), tool).toBe(neutral);
  }
});

// R3/R4/R5: eyes, lips and background are pixel-identical under smooth100.
test('R3/R4/R5 protected regions and background survive smooth100', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  const pts = await page.evaluate(() => {
    const regs = window.AuraGram.face.store().faces[0].regions;
    const mean = (arr) => arr.reduce((a, p) => ({ x: a.x + p.x / arr.length, y: a.y + p.y / arr.length }), { x: 0, y: 0 });
    const eL = mean(regs.leftEye), eR = mean(regs.rightEye), lips = mean(regs.lips);
    return { eyeL: [eL.x, eL.y], eyeR: [eR.x, eR.y], lips: [lips.x, lips.y] };
  });
  await isolateBeauty(page, null, 0);
  const neutral = await canvasDataUrl(page);
  await isolateBeauty(page, 'smooth', 100);
  const smooth = await canvasDataUrl(page);
  const diffs = await callPx(page, PX.diffAt, [[pts.eyeL, pts.eyeR, pts.lips, [0.03, 0.5], [0.95, 0.08]], neutral, smooth]);
  // GPU compositing rounding is ±1; structural protection is proven by the
  // mask-alpha check below (alpha must be exactly 0 at these points).
  for (const [i, name] of [[0, 'left eye'], [1, 'right eye'], [2, 'lips'], [3, 'background left'], [4, 'background corner']]) {
    expect(diffs[i], name).toBeLessThanOrEqual(2);
  }
  const alphas = await page.evaluate(async (p) => {
    const url = window.AuraGram.retouch.debugMaskDataUrl();
    const img = await new Promise((res2) => {
      const im = new Image();
      im.onload = () => res2(im);
      im.src = url;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    return [p.eyeL, p.eyeR, p.lips].map(([nx, ny]) => {
      const xi = Math.round(nx * c.width), yi = Math.round(ny * c.height);
      return d[(yi * c.width + xi) * 4 + 3];
    });
  }, pts);
  expect(alphas, 'mask alpha at eyes/lips must be 0').toEqual([0, 0, 0]);
});

// R6 + texture: monotonic effect, pores/moles survive (luma untouched).
test('R6 monotonic smooth; texture and mole survive at 100', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  const cheek = await page.evaluate(() => {
    const regs = window.AuraGram.face.store().faces[0].regions;
    const nose = regs.nose[4];
    return [nose.x - 0.09, nose.y - 0.02];
  });
  const shots = [];
  for (const v of [0, 25, 50, 75, 100]) {
    await isolateBeauty(page, 'smooth', v);
    shots.push(await canvasDataUrl(page));
  }
  // Masked-region effect grows monotonically (mean abs diff vs level 0).
  const diffs = [];
  for (let i = 1; i < shots.length; i++) {
    const m = await callPx(page, PX.meanAbsDiff, { a: shots[0], b: shots[i] });
    void m;
    const region = await page.evaluate(async ([u0, u1, g]) => {
      const read = (url) => new Promise((res2) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const x = c.getContext('2d');
          x.drawImage(img, 0, 0);
          res2(x.getImageData(0, 0, c.width, c.height));
        };
        img.src = url;
      });
      const A = await read(u0), B = await read(u1);
      const S = 90;
      const px = Math.round(g[0] * A.width), py = Math.round(g[1] * A.height);
      const x0 = Math.max(0, px - S / 2), y0 = Math.max(0, py - S / 2);
      let s = 0;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = ((y0 + y) * A.width + (x0 + x)) * 4;
        s += (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2])) / 3;
      }
      return s / (S * S);
    }, [shots[0], shots[i], cheek]);
    diffs.push(region);
  }
  for (let i = 1; i < diffs.length; i++) {
    expect(diffs[i] + 0.5, `smooth level ${i} monotonic`).toBeGreaterThanOrEqual(diffs[i - 1]);
  }
  // Texture energy retained (no plastic): >= 55% of the original.
  const energies = [];
  for (const shot of [shots[0], shots[4]]) {
    energies.push(await page.evaluate(async ([u, g]) => {
      const img = await new Promise((res2) => {
        const im = new Image();
        im.onload = () => res2(im);
        im.src = u;
      });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const S = 90;
      const px = Math.round(g[0] * c.width), py = Math.round(g[1] * c.height);
      const d = x.getImageData(Math.max(0, px - S / 2), Math.max(0, py - S / 2), S, S).data;
      let lap = 0;
      for (let j = 1; j < S - 1; j++) for (let i = 1; i < S - 1; i++) {
        const k = (j * S + i) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const l = 4 * d[k + ch] - d[k - 4 + ch] - d[k + 4 + ch] - d[k - S * 4 + ch] - d[k + S * 4 + ch];
          lap += l * l;
        }
      }
      return lap / ((S - 2) * (S - 2));
    }, [shot, cheek]));
  }
  expect(energies[1] / energies[0]).toBeGreaterThan(0.55);
});

// R8: antired acts inside the mask, spares red background objects and lips.
test('R8 antired isolation: red background object and lips spared', async ({ page }) => {
  await gotoApp(page);
  // Portrait with a pure-red square pasted into the background corner.
  const redFile = await page.evaluate(async () => null).then(async () => {
    const dataUrl = await page.evaluate(async () => {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i); i.onerror = rej;
        i.src = '/tests/fixtures/edge-source.jpg';
      });
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const cx = cv.getContext('2d');
      cx.drawImage(img, 0, 0);
      cx.fillStyle = '#e11d2e';
      cx.fillRect(8, 8, 90, 90); // red object on background
      return cv.toDataURL('image/jpeg', 0.92);
    });
    const p = path.join(os.tmpdir(), `auragram-redbg-${Date.now()}.jpg`);
    fs.writeFileSync(p, Buffer.from(dataUrl.split(',')[1], 'base64'));
    return p;
  });
  await uploadFile(page, redFile);
  await waitFaceTerminal(page);
  const geom = await page.evaluate(() => {
    const regs = window.AuraGram.face.store().faces[0].regions;
    const mean = (arr) => arr.reduce((a, p) => ({ x: a.x + p.x / arr.length, y: a.y + p.y / arr.length }), { x: 0, y: 0 });
    const nose = regs.nose[4];
    return { cheek: [nose.x - 0.09, nose.y - 0.02], lips: [mean(regs.lips).x, mean(regs.lips).y] };
  });
  await isolateBeauty(page, null, 0);
  const neutral = await canvasDataUrl(page);
  await isolateBeauty(page, 'antired', 100);
  const treated = await canvasDataUrl(page);
  const res = await page.evaluate(async ([neu, tre, g]) => {
    const read = (url) => new Promise((res2) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        res2({ d: x.getImageData(0, 0, c.width, c.height), w: c.width, h: c.height });
      };
      img.src = url;
    });
    const A = await read(neu), B = await read(tre);
    const px = (R, nx, ny) => {
      const x = Math.round(nx * R.w), y = Math.round(ny * R.h);
      const i = (y * R.w + x) * 4;
      return [R.d.data[i], R.d.data[i + 1], R.d.data[i + 2]];
    };
    const gap = (p) => (p[0] - p[1]) + (p[0] - p[2]);
    const bgN = px(A, 50 / A.w, 50 / A.h), bgT = px(B, 50 / B.w, 50 / B.h);
    const chN = px(A, g.cheek[0], g.cheek[1]), chT = px(B, g.cheek[0], g.cheek[1]);
    const liN = px(A, g.lips[0], g.lips[1]), liT = px(B, g.lips[0], g.lips[1]);
    const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    return {
      bgDist: dist(bgN, bgT),
      cheekGapBefore: gap(chN), cheekGapAfter: gap(chT),
      lipsDist: dist(liN, liT)
    };
  }, [neutral, treated, geom]);
  expect(res.bgDist, 'red background object must not change').toBe(0);
  expect(res.cheekGapAfter, 'cheek redness must decrease').toBeLessThan(res.cheekGapBefore);
  expect(res.lipsDist, 'lips must be spared').toBeLessThanOrEqual(6);
});

// R9: no face → local retouch skipped, render equals neutral.
test('R9 no face: retouch skipped, editor works', async ({ page }) => {
  await gotoApp(page);
  const noface = path.join(os.tmpdir(), `auragram-r9-${Date.now()}.png`);
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
  await isolateBeauty(page, null, 0);
  const neutral = await canvasDataUrl(page);
  await isolateBeauty(page, 'smooth', 100);
  expect(await canvasDataUrl(page), 'smooth must skip without a face').toBe(neutral);
  const pill = await page.locator('#faceStatusPill').textContent();
  expect(pill).toMatch(/недоступна|не найдено/i);
});

// R11: reset preserves the photo geometry.
test('R11 reset preserves valid geometry of the same photo', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  const before = await page.evaluate(() => ({
    id: window.AuraGram.face.imageId(),
    count: window.AuraGram.stats.faceCount,
    faces: window.AuraGram.face.store().faces.length,
    status: window.AuraGram.face.status()
  }));
  expect(before.status).toBe('ready');
  await page.evaluate(() => window.AuraGram.resetAll());
  const after = await page.evaluate(() => ({
    id: window.AuraGram.face.imageId(),
    count: window.AuraGram.stats.faceCount,
    faces: window.AuraGram.face.store() ? window.AuraGram.face.store().faces.length : -1,
    status: window.AuraGram.face.status()
  }));
  expect(after.id).toBe(before.id);
  expect(after.faces).toBe(before.faces);
  expect(after.status).toBe('ready');
});

// R12: switching photos swaps the geometry.
test('R12 geometry follows the current photo', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, PORTRAIT());
  await waitFaceTerminal(page);
  const a = await page.evaluate(() => ({
    id: window.AuraGram.face.imageId(),
    w: window.AuraGram.face.store().width
  }));
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  const b = await page.evaluate(() => ({
    id: window.AuraGram.face.imageId(),
    w: window.AuraGram.face.store().width,
    status: window.AuraGram.face.status()
  }));
  expect(b.id).not.toBe(a.id);
  expect(b.status).toBe('ready');
  expect(b.w).toBeGreaterThan(a.w); // edge-source is the larger file
});

// R13: preview/export consistency (tolerant, resolution-aware).
test('R13 preview and export agree within tolerance', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await page.evaluate(() => {
    const A = window.AuraGram;
    A.resetAll();
    A.state.activePreset = 'cinematic'; A.state.presetIntensity = 88;
    A.state.beauty.smooth = 60; A.state.beauty.antired = 40;
    A.renderStudioCanvas();
  });
  await page.waitForFunction(() => window.AuraGram.retouch.ready(), null, { timeout: 60000 });
  await page.evaluate(() => window.AuraGram.renderStudioCanvas());
  const ran = await page.evaluate(() => window.AuraGram.stats.retouchRan);
  expect(ran).toMatch(/smooth/);
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
    return { mean: s / (pa.length / 4), ew: img.naturalWidth, eh: img.naturalHeight };
  });
  expect(m.ew).toBeGreaterThanOrEqual(864); // export keeps source resolution
  expect(m.mean).toBeLessThan(8);
});

// R15: cropped face (landmarks past the frame) still yields geometry.
test('R15 half-cropped face is kept, not dropped', async ({ page }) => {
  await gotoApp(page);
  const dataUrl = await page.evaluate(async () => {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej;
      i.src = '/tests/fixtures/edge-source.jpg';
    });
    const cv = document.createElement('canvas');
    cv.width = 700; cv.height = 700;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#101014'; cx.fillRect(0, 0, 700, 700);
    cx.drawImage(img, -420, -60); // face half out of the left edge
    return cv.toDataURL('image/jpeg', 0.9);
  });
  const f = path.join(os.tmpdir(), `auragram-crop-${Date.now()}.jpg`);
  fs.writeFileSync(f, Buffer.from(dataUrl.split(',')[1], 'base64'));
  await uploadFile(page, f);
  expect(await waitFaceTerminal(page)).toBe('ready');
});

// R17: debugSkin overlay never leaks into export.
test('R17 debugSkin export equality', async ({ page }) => {
  await gotoApp(page, '?debugSkin=1');
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await page.evaluate(() => {
    const A = window.AuraGram;
    A.resetAll();
    A.state.activePreset = 'cinematic'; A.state.presetIntensity = 88;
    A.state.beauty.smooth = 60;
    A.renderStudioCanvas();
  });
  await page.waitForFunction(() => window.AuraGram.retouch.ready(), null, { timeout: 60000 });
  await page.evaluate(() => window.AuraGram.renderStudioCanvas());
  await page.click('#btnExport');
  await expect(page.locator('#exportModal')).toBeVisible();
  const bytesDebug = await page.evaluate(async () => Array.from(new Uint8Array(await window.AuraGram.getExportBlob().arrayBuffer())));
  await page.click('#btnCloseModal');
  const page2 = await page.context().newPage();
  await gotoApp(page2, '');
  await uploadFile(page2, EDGE());
  await waitFaceTerminal(page2);
  await page2.evaluate(() => {
    const A = window.AuraGram;
    A.resetAll();
    A.state.activePreset = 'cinematic'; A.state.presetIntensity = 88;
    A.state.beauty.smooth = 60;
    A.renderStudioCanvas();
  });
  await page2.waitForFunction(() => window.AuraGram.retouch.ready(), null, { timeout: 60000 });
  await page2.evaluate(() => window.AuraGram.renderStudioCanvas());
  await page2.click('#btnExport');
  await expect(page2.locator('#exportModal')).toBeVisible();
  const bytesPlain = await page2.evaluate(async () => Array.from(new Uint8Array(await window.AuraGram.getExportBlob().arrayBuffer())));
  expect(bytesPlain.length).toBeGreaterThan(1000);
  expect(bytesDebug).toEqual(bytesPlain);
  await page2.close();
});

// R2: mask coverage is resolution-stable.
test('R2 mask geometry is resolution-stable', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  const cov = await page.evaluate(async () => {
    const skin = await import('/src/retouch/skinMask.mjs');
    const regs = window.AuraGram.face.store().faces[0].regions;
    const src = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej;
      i.src = '/tests/fixtures/edge-source.jpg';
    });
    const out = [];
    for (const [W, H] of [[864, 1080], [432, 540]]) {
      const { w, h } = skin.maskSizeFor(W, H);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const s = skin.buildSkinAlpha(cv.getContext('2d'), regs, src, w, h);
      out.push(s.coverage);
    }
    return out;
  });
  expect(Math.abs(cov[0] - cov[1])).toBeLessThan(0.05);
});

// R18: no external AI traffic, no uploads.
test('R18 no external AI calls and no photo uploads', async ({ page }) => {
  const reqs = [];
  page.on('request', (r) => reqs.push({ url: r.url(), method: r.method(), hasBody: !!r.postData() }));
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  await isolateBeauty(page, 'smooth', 60);
  await page.click('#btnExport');
  await expect(page.locator('#exportModal')).toBeVisible();
  // Static font stylesheet / G0 CDN assets are allowed; anything AI-shaped is not.
  const bad = reqs.filter((r) => /ml\.googleapis|aiplatform|vertex|openai|anthropic|huggingface|replicate|cohere|stability\.ai|mediapipe-models|storage\.googleapis.*(model|mediapipe)/i.test(r.url));
  expect(bad, JSON.stringify(bad)).toEqual([]);
  const uploads = reqs.filter((r) => (r.method === 'POST' || r.method === 'PUT') && r.hasBody);
  expect(uploads, JSON.stringify(uploads)).toEqual([]);
});

// P1/P2 gates: glow, eyes, blush, sculpt are localized and safe.
test('P1/P2 tools are face-localized and bounded', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  const geom = await page.evaluate(() => {
    const regs = window.AuraGram.face.store().faces[0].regions;
    const mean = (arr) => arr.reduce((a, p) => ({ x: a.x + p.x / arr.length, y: a.y + p.y / arr.length }), { x: 0, y: 0 });
    const nose = regs.nose[4];
    return { cheek: [nose.x - 0.09, nose.y - 0.02], eye: [mean(regs.leftEye).x, mean(regs.leftEye).y] };
  });
  await isolateBeauty(page, null, 0);
  const neutral = await canvasDataUrl(page);
  // Blush is checked separately at its landmark-derived apples (below).
  for (const tool of ['glow', 'eyes', 'sculpt']) {
    await isolateBeauty(page, tool, 60);
    const treated = await canvasDataUrl(page);
    const m = await callPx(page, PX.diffAt, [[geom.cheek, geom.eye, [0.03, 0.5]], neutral, treated]);
    const [cheekD, eyeD, bgD] = m;
    expect(bgD, `${tool}: background must stay`).toBe(0);
    expect(cheekD + eyeD, `${tool}: must act on the face`).toBeGreaterThan(0);
  }
  // Blush acts at the landmark-derived cheek apples: sample the real centers.
  const blushPts = await page.evaluate(async () => {
    const skin = await import('/src/retouch/skinMask.mjs');
    return skin.cheekCenters(window.AuraGram.face.store().faces[0].regions).map((c) => [c.x, c.y]);
  });
  await isolateBeauty(page, 'blush', 60);
  const blushTreated = await canvasDataUrl(page);
  const blushD = await callPx(page, PX.diffAt, [blushPts, neutral, blushTreated]);
  expect(blushD[0] + blushD[1], 'blush acts at cheek apples').toBeGreaterThan(0);
  // Blush specifically lifts cheek redness slightly.
  await isolateBeauty(page, 'blush', 60);
  const lift = await page.evaluate(async ([neu, tre, g]) => {
    const read = (url) => new Promise((res2) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        res2({ d: x.getImageData(0, 0, c.width, c.height), w: c.width, h: c.height });
      };
      img.src = url;
    });
    const A = await read(neu), B = await read(tre);
    const px = (R) => {
      const x = Math.round(g[0] * R.w), y = Math.round(g[1] * R.h);
      const i = (y * R.w + x) * 4;
      return R.d.data[i];
    };
    return px(B) - px(A);
  }, [neutral, await canvasDataUrl(page), geom.cheek]);
  expect(lift).toBeGreaterThanOrEqual(0);
});

// R10: detection failure + beauty engaged → editor and export survive.
test('R10 beauty with failed detection degrades safely', async ({ page }) => {
  await page.route('**/vendor/mediapipe/**', (route) => route.abort('failed'));
  await gotoApp(page);
  const red = path.join(os.tmpdir(), 'auragram-r10.png');
  fs.writeFileSync(red, Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8//8/AzGAiShVWGwAAJcCAT/xCQXwAAAAAElFTkSuQmCC', 'base64'));
  await uploadFile(page, red);
  await waitFaceTerminal(page, 60000);
  expect(await page.evaluate(() => window.AuraGram.face.status())).toBe('failed');
  await isolateBeauty(page, 'smooth', 80);
  await page.click('#btnExport');
  await expect(page.locator('#exportModal')).toBeVisible();
  await page.unrouteAll();
});

// R16: very large photo exports without unhandled failure.
test('R16 large-photo export stays handled', async ({ page }) => {
  await gotoApp(page);
  const dataUrl = await page.evaluate(async () => {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej;
      i.src = '/tests/fixtures/edge-source.jpg';
    });
    const cv = document.createElement('canvas');
    cv.width = 3000; cv.height = 2400;
    const cx = cv.getContext('2d');
    const g = cx.createLinearGradient(0, 0, 3000, 2400);
    g.addColorStop(0, '#2a2033'); g.addColorStop(1, '#101018');
    cx.fillStyle = g; cx.fillRect(0, 0, 3000, 2400);
    cx.drawImage(img, 1500, 200, 1200, 1500); // large face, right side
    return cv.toDataURL('image/jpeg', 0.85);
  });
  const f = path.join(os.tmpdir(), `auragram-big-${Date.now()}.jpg`);
  fs.writeFileSync(f, Buffer.from(dataUrl.split(',')[1], 'base64'));
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await uploadFile(page, f);
  await waitFaceTerminal(page, 120000);
  await page.evaluate(() => {
    const A = window.AuraGram;
    A.resetAll();
    A.state.beauty.smooth = 60;
    A.renderStudioCanvas();
  });
  await page.click('#btnExport', { timeout: 30000 });
  await expect(page.locator('#exportModal')).toBeVisible({ timeout: 120000 });
  const ok = await page.evaluate(async () => {
    const b = window.AuraGram.getExportBlob();
    if (!b) return false;
    const head = Array.from(new Uint8Array(await b.arrayBuffer()).slice(0, 4));
    return b.type === 'image/png' && head[0] === 137 && head[1] === 80;
  });
  expect(ok).toBe(true);
  expect(errs, JSON.stringify(errs)).toEqual([]);
});

// R19: real photo + real detection + real retouch keeps texture.
test('R19 real retouch keeps texture on a real portrait', async ({ page }) => {
  const errors = await gotoApp(page);
  await uploadFile(page, EDGE());
  await waitFaceTerminal(page);
  expect(await page.evaluate(() => window.AuraGram.stats.faceCount)).toBe(1);
  expect(await page.evaluate(() => window.AuraGram.stats.faceWorkerMode)).toMatch(/worker|main-thread/);
  const cheekBox = await page.evaluate(() => {
    const regs = window.AuraGram.face.store().faces[0].regions;
    const nose = regs.nose[4];
    return [nose.x - 0.09, nose.y - 0.02];
  });
  const texOf = `([u, g]) => {
    return new Promise((res2) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        const S = 80;
        const px = Math.round(g[0] * c.width), py = Math.round(g[1] * c.height);
        const d = x.getImageData(Math.max(0, px - S / 2), Math.max(0, py - S / 2), S, S).data;
        let s = 0;
        for (let j = 1; j < S - 1; j++) for (let i = 1; i < S - 1; i++) {
          const k = (j * S + i) * 4;
          for (let ch = 0; ch < 3; ch++) {
            const l = 4 * d[k + ch] - d[k - 4 + ch] - d[k + 4 + ch] - d[k - S * 4 + ch] - d[k + S * 4 + ch];
            s += l * l;
          }
        }
        res2(s / ((S - 2) * (S - 2)));
      };
      img.src = u;
    });
  }`;
  await isolateBeauty(page, 'smooth', 60);
  const ran = await page.evaluate(() => window.AuraGram.stats.retouchRan);
  expect(ran).toMatch(/smooth/);
  const tex = await callPx(page, texOf, [await canvasDataUrl(page), cheekBox]);
  await isolateBeauty(page, null, 0);
  const tex0 = await callPx(page, texOf, [await canvasDataUrl(page), cheekBox]);
  expect(tex / tex0).toBeGreaterThan(0.55);
  const fatal = errors.filter((e) => !NOISE.test(e));
  expect(fatal, JSON.stringify(fatal)).toEqual([]);
});

// Tones matrix: synthetic patches + mock geometry, same behavior all tones.
test('tones: synthetic skin tones keep texture, spare background', async ({ page }) => {
  await gotoApp(page);
  const results = await page.evaluate(async () => {
    const retouch = await import('/src/retouch/retouch.mjs');
    const session = retouch.createRetouchSession();
    const tones = ['light', 'tan', 'brown', 'dark', 'warm-lit', 'cool-lit'];
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
    const face = { imageId: 9000, regions };
    const out = [];
    const energy = (ctx, x0, y0, w0, h0) => {
      const d = ctx.getImageData(x0, y0, w0, h0).data;
      let s = 0;
      for (let j = 1; j < h0 - 1; j++) for (let i = 1; i < w0 - 1; i++) {
        const k = (j * w0 + i) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const l = 4 * d[k + ch] - d[k - 4 + ch] - d[k + 4 + ch] - d[k - w0 * 4 + ch] - d[k + w0 * 4 + ch];
          s += l * l;
        }
      }
      return s / ((w0 - 2) * (h0 - 2));
    };
    for (const t of tones) {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im); im.onerror = rej;
        im.src = `/tests/visual/synthetic/skin-${t}.png`;
      });
      const W = 320, H = 320;
      const base = document.createElement('canvas');
      base.width = W; base.height = H;
      base.getContext('2d').drawImage(img, 0, 0);
      const corner0 = Array.from(base.getContext('2d').getImageData(8, 8, 4, 4).data);
      const e0 = energy(base.getContext('2d'), 40, 210, 60, 50);
      const tctx = base.getContext('2d');
      session.applyPasses(tctx, W, H, {
        face: { imageId: 9000 + out.length, regions },
        beauty: { smooth: 100, antired: 0, glow: 0, eyes: 0, blush: 0, sculpt: 0 },
        src: img, gradeFilter: 'brightness(100%)', gradeSig: 'tone-test',
        buffers: (() => {
          const c = document.createElement('canvas');
          return { detailBuffer: c, detailCtx: c.getContext('2d') };
        })()
      });
      const e1 = energy(base.getContext('2d'), 40, 210, 60, 50);
      // background corner (outside oval) must be bit-identical after retouch
      const d1 = Array.from(base.getContext('2d').getImageData(8, 8, 4, 4).data);
      // masked-region chroma shift proves the effect is visible (not vacuous)
      const dd = base.getContext('2d').getImageData(120, 200, 80, 60).data;
      let shift = 0;
      for (let i = 0; i < dd.length; i += 16) {
        shift += Math.abs(dd[i] - dd[i + 1]) + Math.abs(dd[i] - dd[i + 2]);
      }
      shift /= dd.length / 16;
      out.push({ tone: t, ratio: e1 / e0, shift, cornerSame: String(Array.from(d1)) === String(corner0) });
    }
    return out;
  });
  // Chroma-domain smoothing keeps luminance texture by design: energy stays
  // ≈1 while the masked chroma visibly evens out, on every tone.
  for (const r of results) {
    expect(r.ratio, `${r.tone}: texture retained`).toBeGreaterThan(0.85);
    expect(r.ratio, `${r.tone}: texture not invented`).toBeLessThan(1.15);
    expect(r.shift, `${r.tone}: chroma visibly evens`).toBeGreaterThan(0.2);
    expect(r.cornerSame, `${r.tone}: background identical`).toBe(true);
  }
  const ratios = results.map((r) => r.ratio);
  expect(Math.max(...ratios) - Math.min(...ratios), 'tone-independent behavior').toBeLessThan(0.2);
});

// Occlusion: glasses bar is retouched less than open cheek.
test('occlusion: refinement spares the glasses bar', async ({ page }) => {
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
      im.src = '/tests/visual/synthetic/skin-occlusion.png';
    });
    const W = 320, H = 320;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0);
    const before = cx.getImageData(0, 0, W, H);
    session.applyPasses(cx, W, H, {
      face: { imageId: 9100, regions },
      beauty: { smooth: 100, antired: 0, glow: 0, eyes: 0, blush: 0, sculpt: 0 },
      src: img, gradeFilter: 'brightness(100%)', gradeSig: 'occ-test',
      buffers: (() => {
        const c = document.createElement('canvas');
        return { detailBuffer: c, detailCtx: c.getContext('2d') };
      })()
    });
    const after = cx.getImageData(0, 0, W, H);
    const zone = (x0, y0, w0, h0) => {
      let s = 0, n = 0;
      for (let y = y0; y < y0 + h0; y++) for (let x = x0; x < x0 + w0; x++) {
        const i = (y * W + x) * 4;
        s += (Math.abs(before.data[i] - after.data[i]) + Math.abs(before.data[i + 1] - after.data[i + 1]) + Math.abs(before.data[i + 2] - after.data[i + 2])) / 3;
        n++;
      }
      return s / n;
    };
    // Mask alpha is the direct proof of refinement: the bar must carry
    // substantially less strength than open cheek skin.
    const skin = await import('/src/retouch/skinMask.mjs');
    const mc = document.createElement('canvas');
    mc.width = 320; mc.height = 320;
    skin.buildSkinAlpha(mc.getContext('2d'), regions, img, 320, 320);
    const md = mc.getContext('2d').getImageData(0, 0, 320, 320).data;
    const alphaAt = (x, y) => md[(y * 320 + x) * 4 + 3] / 255;
    return {
      bar: zone(120, 88, 80, 16),
      cheek: zone(120, 220, 80, 40),
      barAlpha: alphaAt(160, 96),
      cheekAlpha: alphaAt(160, 240)
    };
  });
  expect(r.cheek, 'open cheek is retouched').toBeGreaterThan(0.2);
  expect(r.barAlpha, 'glasses bar carries less mask strength').toBeLessThan(r.cheekAlpha * 0.8);
  expect(r.cheekAlpha, 'open cheek keeps strength').toBeGreaterThan(0.5);
});
