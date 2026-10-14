/* AuraGram Gauntlet 1a — browser E2E for face detection (Playwright + Chromium).
 * Runs REAL MediaPipe inference (local vendor + committed model) against the
 * licit test portrait tests/fixtures/portrait.jpg (app's own Unsplash demo
 * photo, downscaled). Variants (off-center/landscape/no-face) are composed
 * in-page from that portrait — no private photos anywhere.
 * Served over local http (webServer) so ESM/worker/WASM behave like Pages.
 */
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORTRAIT_URL = '/tests/fixtures/portrait.jpg';

// Benign MediaPipe/XNNPACK/WebGL info chatter (logged via console.error by
// the library itself, not app failures). Anything else is a real error.
const NOISE = /favicon|net::|Failed to load resource|AbortError|aborted|XNNPACK|WebGL|GL Driver|Graph successfully|inference_feedback|face_landmarker_graph|gl_context/i;

function fatalOnly(errors) {
  return errors.filter((e) => !NOISE.test(e));
}

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

async function waitFaceTerminal(page, timeout = 90000) {
  await page.waitForFunction(
    () => ['ready', 'no_face', 'failed', 'unsupported'].includes(window.AuraGram.face.status()),
    null,
    { timeout }
  );
  return page.evaluate(() => ({
    status: window.AuraGram.face.status(),
    store: window.AuraGram.face.store(),
    metrics: window.AuraGram.face.metrics(),
    stats: {
      faceDetectionStatus: window.AuraGram.stats.faceDetectionStatus,
      faceCount: window.AuraGram.stats.faceCount,
      faceDetectMs: window.AuraGram.stats.faceDetectMs,
      modelLoadMs: window.AuraGram.stats.modelLoadMs,
      faceWorkerMode: window.AuraGram.stats.faceWorkerMode,
      faceInputWidth: window.AuraGram.stats.faceInputWidth,
      faceInputHeight: window.AuraGram.stats.faceInputHeight
    }
  }));
}

/** Compose upload variants in-page from committed fixtures (same-origin).
 * Edge/orientation variants use the full-size edge-source.jpg (same licit
 * Unsplash frame as portrait.jpg, 900px) so faces stay real-world-sized:
 * a 256px source + JPEG + dark bg sits exactly on the detector's noise
 * floor and would test compression artifacts instead of face position. */
async function makeVariantFile(page, kind) {
  const src = kind === 'noface' ? null : '/tests/fixtures/edge-source.jpg';
  const dataUrl = await page.evaluate(async ([k, portraitUrl]) => {
    const load = (url) => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = url;
    });
    const fitH = (img, h) => {
      const s = h / img.naturalHeight;
      return { w: Math.round(img.naturalWidth * s), h: Math.round(img.naturalHeight * s) };
    };
    const cv = document.createElement('canvas');
    const cx = cv.getContext('2d');
    if (k === 'offcenter' || k === 'landscape' || k === 'tall') {
      const portrait = await load(portraitUrl);
      if (k === 'offcenter') {
        const s = fitH(portrait, 620);
        cv.width = s.w + 480; cv.height = 660; // dark field extends LEFT: face right
        cx.fillStyle = '#181820'; cx.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(portrait, 460, 20, s.w, s.h);
      } else if (k === 'landscape') {
        const s = fitH(portrait, 560);
        cv.width = 960; cv.height = 600;
        cx.fillStyle = '#101018'; cx.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(portrait, Math.round((960 - s.w) / 2), 20, s.w, s.h);
      } else {
        const s = fitH(portrait, 760);
        cv.width = 560; cv.height = 800;
        cx.fillStyle = '#101018'; cx.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(portrait, Math.round((560 - s.w) / 2), 20, s.w, s.h);
      }
    } else if (k === 'noface') {
    } else if (k === 'noface') {
      cv.width = 240; cv.height = 240;
      const g = cx.createLinearGradient(0, 0, 240, 240);
      g.addColorStop(0, '#3b2d5c'); g.addColorStop(1, '#0e7490');
      cx.fillStyle = g; cx.fillRect(0, 0, 240, 240);
      cx.fillStyle = 'rgba(255,255,255,0.25)';
      cx.beginPath(); cx.arc(120, 120, 60, 0, Math.PI * 2); cx.fill();
    }
    return cv.toDataURL('image/jpeg', 0.9);
  }, [kind, src]);
  const p = path.join(os.tmpdir(), `auragram-face-${kind}-${Date.now()}.jpg`);
  fs.writeFileSync(p, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return p;
}

const PORTRAIT = () => path.resolve(__dirname, 'fixtures/portrait.jpg');

// Real inference: one portrait → one face, 478 landmarks, sane geometry.
test('face: real inference finds the portrait face', async ({ page }) => {
  const errors = await gotoApp(page);
  await uploadFile(page, PORTRAIT());
  const r = await waitFaceTerminal(page);
  expect(r.status, JSON.stringify(r.metrics)).toBe('ready');
  expect(r.store.faces.length).toBe(1);
  const lm = r.store.faces[0].landmarks;
  expect(lm.length).toBe(478);
  expect(lm.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)).toBe(true);
  const b = r.store.faces[0].bounds;
  expect(b.x1 - b.x0).toBeGreaterThan(0.2);
  expect(b.y1 - b.y0).toBeGreaterThan(0.2);
  expect(r.stats.faceCount).toBe(1);
  expect(r.stats.faceDetectMs).toBeGreaterThan(0);
  expect(r.stats.modelLoadMs).toBeGreaterThan(0);
  expect(Math.max(r.stats.faceInputWidth, r.stats.faceInputHeight)).toBeLessThanOrEqual(640);
  expect(['worker', 'main-thread']).toContain(r.stats.faceWorkerMode);
  expect(fatalOnly(errors), JSON.stringify(errors)).toEqual([]);
});

// Worker-first: Chromium must use the module worker (fallback stays for Safari).
test('face: inference runs in the Web Worker when available', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, PORTRAIT());
  const r = await waitFaceTerminal(page);
  expect(r.status).toBe('ready');
  expect(r.stats.faceWorkerMode).toBe('worker');
});

// Geometry across compositions: off-center, landscape, tall, no-face.
test('face: off-center / landscape / portrait / no-face compositions', async ({ page }) => {
  await gotoApp(page);
  for (const kind of ['offcenter', 'landscape', 'tall']) {
    const file = await makeVariantFile(page, kind);
    await uploadFile(page, file);
    const r = await waitFaceTerminal(page);
    expect(r.status, kind).toBe('ready');
    expect(r.store.faces.length, kind).toBe(1);
  }
  const noface = await makeVariantFile(page, 'noface');
  await uploadFile(page, noface);
  const r2 = await waitFaceTerminal(page);
  expect(r2.status).toBe('no_face');
  // Editor still fully functional without a face.
  const alive = await page.evaluate(() => {
    window.AuraGram.state.activePreset = 'noir';
    window.AuraGram.renderStudioCanvas();
    return document.getElementById('mainCanvas').width > 0;
  });
  expect(alive).toBe(true);
});

// Off-center face: bounds must reflect the right-edge position.
test('face: off-center bounds track the face position', async ({ page }) => {
  await gotoApp(page);
  await uploadFile(page, await makeVariantFile(page, 'offcenter'));
  const r = await waitFaceTerminal(page);
  expect(r.status).toBe('ready');
  const b = r.store.faces[0].bounds;
  const cx = (b.x0 + b.x1) / 2;
  expect(cx).toBeGreaterThan(0.55); // face was pasted on the right side
});

// Race: A then B immediately → final geometry belongs to B.
test('face: rapid photo switch never applies stale landmarks', async ({ page }) => {
  await gotoApp(page);
  const solid = await makeVariantFile(page, 'noface');
  await page.setInputFiles('#fileInput', PORTRAIT());
  await page.setInputFiles('#fileInput', solid);
  await page.waitForFunction(() => window.AuraGram.loadState.status === 'ready', null, { timeout: 30000 });
  const r = await waitFaceTerminal(page);
  const currentId = await page.evaluate(() => window.AuraGram.face.imageId());
  expect(r.store.imageId).toBe(currentId);
  expect(r.status).toBe('no_face'); // last photo has no face — A must not overwrite it
});

// Model failure: editor + export keep working.
test('face: blocked model degrades to failed, editor and export survive', async ({ page }) => {
  await page.route('**/vendor/mediapipe/**', (route) => route.abort('failed'));
  const errors = await gotoApp(page);
  const red = path.join(os.tmpdir(), 'auragram-face-red.png');
  fs.writeFileSync(red, Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8//8/AzGAiShVWGwAAJcCAT/xCQXwAAAAAElFTkSuQmCC', 'base64'));
  await uploadFile(page, red);
  const r = await waitFaceTerminal(page, 60000);
  expect(r.status).toBe('failed');
  await page.click('#btnExport');
  await expect(page.locator('#exportModal')).toBeVisible();
  const src = await page.locator('#exportPreviewImg').getAttribute('src');
  expect(src && src.startsWith('blob:')).toBe(true);
  expect(fatalOnly(errors), JSON.stringify(errors)).toEqual([]);
  await page.unrouteAll();
});

// Debug overlay draws shapes; export bytes are identical with/without debug.
test('face: debug overlay renders and never leaks into export', async ({ page }) => {
  await gotoApp(page, '?debugFace=1');
  await uploadFile(page, PORTRAIT());
  const r = await waitFaceTerminal(page);
  expect(r.status).toBe('ready');
  await expect(page.locator('#faceOverlay')).toBeVisible();
  const overlayPixels = await page.evaluate(() => {
    const c = document.getElementById('faceOverlay');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n += 1;
    return n;
  });
  expect(overlayPixels).toBeGreaterThan(100);
  const pill = await page.locator('#faceStatusPill').textContent();
  expect(pill).toMatch(/Лицо:/);

  // Export WITH debug on.
  await page.evaluate(() => {
    window.AuraGram.resetAll();
    window.AuraGram.state.activePreset = 'cinematic';
    window.AuraGram.state.presetIntensity = 88;
    window.AuraGram.renderStudioCanvas();
  });
  await page.click('#btnExport');
  await expect(page.locator('#exportModal')).toBeVisible();
  const bytesDebug = await page.evaluate(async () => {
    const b = window.AuraGram.getExportBlob();
    return Array.from(new Uint8Array(await b.arrayBuffer()));
  });
  await page.click('#btnCloseModal');

  // Same photo + settings, debug OFF → bytes must match exactly.
  const page2 = await page.context().newPage();
  await gotoApp(page2, '');
  await uploadFile(page2, PORTRAIT());
  await waitFaceTerminal(page2);
  await page2.evaluate(() => {
    window.AuraGram.resetAll();
    window.AuraGram.state.activePreset = 'cinematic';
    window.AuraGram.state.presetIntensity = 88;
    window.AuraGram.renderStudioCanvas();
  });
  await page2.click('#btnExport');
  await expect(page2.locator('#exportModal')).toBeVisible();
  const bytesPlain = await page2.evaluate(async () => {
    const b = window.AuraGram.getExportBlob();
    return Array.from(new Uint8Array(await b.arrayBuffer()));
  });
  expect(bytesPlain.length).toBeGreaterThan(1000);
  expect(bytesDebug).toEqual(bytesPlain); // MediaPipe changes zero export pixels
  await page2.close();
});

// Debug overlay hidden without the flag.
test('face: no overlay without ?debugFace=1', async ({ page }) => {
  await gotoApp(page, '');
  await uploadFile(page, PORTRAIT());
  await waitFaceTerminal(page);
  await expect(page.locator('#faceOverlay')).toBeHidden();
});
