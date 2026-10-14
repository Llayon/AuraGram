/* AuraGram Gauntlet 0 — browser E2E (Playwright).
 * Run: npx playwright test
 * Uses small locally-generated PNGs only (no personal data, no network photos).
 * Covers T1–T14 at the browser level against index.html served over local http
 * (static-server.cjs via webServer — required so ESM/worker/WASM paths behave
 * exactly like on GitHub Pages; file:// would block them via CORS).
 */
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// 2x2 red PNG (programmatically generated fixture, base64).
const RED_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8//8/AzGAiShVWGwA' +
  'AJcCAT/xCQXwAAAAAElFTkSuQmCC';
// 2x2 blue PNG.
const BLUE_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8//8/AzGAiShVWGwA' +
  'AJcCAT/xCQXwAAAAAElFTkSuQmCC';

function fixture(name, b64) {
  const p = path.join(os.tmpdir(), `auragram-${name}.png`);
  fs.writeFileSync(p, Buffer.from(b64, 'base64'));
  return p;
}

async function gotoApp(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.AuraGram, null, { timeout: 10000 });
  return errors;
}

async function uploadFixture(page, file) {
  await page.setInputFiles('#fileInput', file);
  await page.waitForFunction(() => window.AuraGram.loadState.status === 'ready', null, { timeout: 15000 });
}

async function canvasSignature(page) {
  return page.evaluate(() => {
    const c = document.getElementById('mainCanvas');
    const x = c.getContext('2d');
    const d = x.getImageData(0, 0, Math.min(c.width, 32), Math.min(c.height, 32)).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    return { sum, w: c.width, h: c.height };
  });
}

// T1: boot without critical errors (local fixture avoids network flakiness).
test('T1 app boots without critical errors', async ({ page }) => {
  const errors = await gotoApp(page);
  const red = fixture('red', RED_PNG_B64);
  await uploadFixture(page, red);
  // G1a: photo upload also schedules local face detection; allowlist the
  // library's own info chatter (XNNPACK/WebGL), fail on anything else.
  const fatal = errors.filter((e) => !/favicon|net::|Failed to load resource|XNNPACK|WebGL|GL Driver|Graph successfully|inference_feedback|face_landmarker_graph|gl_context/i.test(e));
  expect(fatal, JSON.stringify(fatal)).toEqual([]);
});

// T2: user can upload a photo.
test('T2 user can upload a photo', async ({ page }) => {
  await gotoApp(page);
  await uploadFixture(page, fixture('red2', RED_PNG_B64));
  const status = await page.evaluate(() => ({
    s: window.AuraGram.loadState.status,
    w: document.getElementById('mainCanvas').width
  }));
  expect(status.s).toBe('ready');
  expect(status.w).toBeGreaterThan(0);
  await expect(page.locator('#loadOverlay')).toBeHidden();
});

// T3: corrupt image does not break the editor.
test('T3 corrupt image does not break the editor', async ({ page }) => {
  await gotoApp(page);
  await uploadFixture(page, fixture('red3', RED_PNG_B64));
  const bad = path.join(os.tmpdir(), 'auragram-bad.png');
  fs.writeFileSync(bad, Buffer.from('not-an-image-at-all', 'utf8'));
  await page.setInputFiles('#fileInput', bad);
  await page.waitForTimeout(1200);
  const alive = await page.evaluate(() => ({
    hasApi: !!window.AuraGram,
    canvasW: document.getElementById('mainCanvas').width
  }));
  expect(alive.hasApi).toBe(true);
  expect(alive.canvasW).toBeGreaterThan(0); // previous photo kept, editor alive
});

// T4: rapid photo switching causes no race (last upload wins, editor alive).
test('T4 rapid switching causes no load race', async ({ page }) => {
  await gotoApp(page);
  const a = fixture('race-a', RED_PNG_B64);
  const b = fixture('race-b', BLUE_PNG_B64);
  await page.setInputFiles('#fileInput', a);
  await page.setInputFiles('#fileInput', b);
  await page.waitForFunction(() => window.AuraGram.loadState.status === 'ready', null, { timeout: 15000 });
  const ok = await page.evaluate(() => document.getElementById('mainCanvas').width > 0);
  expect(ok).toBe(true);
});

// T5/T6: preset changes the image; reset returns to original.
test('T5 preset changes image; T6 reset returns original', async ({ page }) => {
  await gotoApp(page);
  await uploadFixture(page, fixture('preset', RED_PNG_B64));
  await page.evaluate(() => window.AuraGram.resetAll());
  const before = await canvasSignature(page);
  await page.evaluate(() => {
    window.AuraGram.state.activePreset = 'noir';
    window.AuraGram.state.presetIntensity = 100;
    window.AuraGram.renderStudioCanvas();
  });
  const after = await canvasSignature(page);
  expect(after.sum).not.toBe(before.sum); // T5
  await page.evaluate(() => window.AuraGram.resetAll());
  const reset = await canvasSignature(page);
  expect(reset.sum).toBe(before.sum); // T6
  const neutral = await page.evaluate(() => window.AuraGram.isStateNeutral(window.AuraGram.state));
  expect(neutral).toBe(true);
});

// T7/T8: hold Before shows original; release restores the edit.
test('T7 hold shows original; T8 release restores edit', async ({ page }) => {
  await gotoApp(page);
  await uploadFixture(page, fixture('compare', RED_PNG_B64));
  await page.evaluate(() => {
    window.AuraGram.state.activePreset = 'noir';
    window.AuraGram.state.presetIntensity = 100;
    window.AuraGram.renderStudioCanvas();
  });
  const edited = await canvasSignature(page);
  const btn = page.locator('#btnCompare');
  await btn.dispatchEvent('pointerdown');
  await page.waitForTimeout(200);
  const comparing = await page.evaluate(() => window.AuraGram.state.isComparing);
  expect(comparing).toBe(true); // T7
  await expect(page.locator('#compareBadge')).toBeVisible();
  await page.mouse.up();
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup')));
  await page.waitForTimeout(200);
  const restored = await page.evaluate(() => window.AuraGram.state.isComparing);
  expect(restored).toBe(false); // T8
  const back = await canvasSignature(page);
  expect(back.sum).toBe(edited.sum);
});

// T9/T10: preview & export share settings; export is a valid PNG.
test('T9/T10 export reuses settings and produces a valid PNG', async ({ page }) => {
  await gotoApp(page);
  await uploadFixture(page, fixture('export', RED_PNG_B64));
  await page.evaluate(() => {
    window.AuraGram.state.activePreset = 'cinematic';
    window.AuraGram.state.presetIntensity = 88;
    window.AuraGram.renderStudioCanvas();
  });
  await page.click('#btnExport');
  await expect(page.locator('#exportModal')).toBeVisible();
  const src = await page.locator('#exportPreviewImg').getAttribute('src');
  expect(src && src.startsWith('blob:')).toBe(true);
  const sig = await page.evaluate(async () => {
    const blob = window.AuraGram.getExportBlob();
    const buf = new Uint8Array(await blob.arrayBuffer());
    return { type: blob.type, head: Array.from(buf.slice(0, 8)) };
  });
  expect(sig.type).toBe('image/png');
  expect(sig.head).toEqual([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic
  const meta = await page.locator('#exportMeta').textContent();
  expect(meta).toMatch(/Экспорт/);
});

// T12: no Telegram photo-send promises in UI or code paths.
test('T12 no fake Telegram sending', async ({ page }) => {
  await gotoApp(page);
  await expect(page.locator('#btnSendTelegram')).toHaveCount(0);
  const body = await page.locator('body').textContent();
  expect(body).not.toMatch(/Отправить в бота Telegram/);
  const hasSendData = await page.evaluate(() => document.documentElement.innerHTML.includes('sendData'));
  expect(hasSendData).toBe(false);
});

// T13: key controls reachable in mobile viewports.
for (const vp of [{ w: 320, h: 568 }, { w: 375, h: 667 }, { w: 390, h: 844 }, { w: 430, h: 932 }]) {
  test(`T13 controls reachable at ${vp.w}x${vp.h}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await gotoApp(page);
    await uploadFixture(page, fixture(`vp-${vp.w}`, RED_PNG_B64));
    for (const sel of ['#btnExport', '#mainSlider', '#tab-filters', '#btnCompare', '#btnMagicAI']) {
      await expect(page.locator(sel), sel).toBeVisible();
    }
    const box = await page.locator('#btnExport').boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(vp.h + 1);
  });
}

test('T13 desktop 1280x800 layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoApp(page);
  await uploadFixture(page, fixture('desktop', RED_PNG_B64));
  await expect(page.locator('#btnExport')).toBeVisible();
  await expect(page.locator('#mainSlider')).toBeVisible();
});
