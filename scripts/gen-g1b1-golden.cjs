#!/usr/bin/env node
'use strict';
/**
 * G1b.1 golden checksum generator (Gauntlet 1c, Phase 1.2).
 *
 * Renders 9 fixed settings through the REAL app pipeline (renderImage with a
 * FIXED mock face on a synthetic fixture) in headless Chromium and records
 * pixel checksums into tests/golden/g1b1-golden.json.
 *
 * Mock (not MediaPipe) geometry keeps goldens deterministic: no model, no
 * network, no detection variance. Canvas ops themselves are deterministic
 * per Chromium build; L24 compares with documented tolerances (relative
 * checksum drift < 0.5% AND sampled mean abs diff < 2.0/255).
 *
 * Run once per intentional pipeline change; NEVER regenerate to silence a
 * failure — investigate first.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8141;
const OUT = path.join(ROOT, 'tests', 'golden', 'g1b1-golden.json');

const SETTINGS = [
  'original', 'vogue', 'champagne',
  'smooth100', 'antired100', 'glow100', 'eyes100', 'blush100', 'sculpt100'
];

async function main() {
  const server = spawn(process.execPath, [path.join(ROOT, 'tests', 'static-server.cjs'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const { chromium } = require('@playwright/test');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForFunction(() => !!window.AuraGram, null, { timeout: 15000 });

    const goldens = await page.evaluate(async (settings) => {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im); im.onerror = rej;
        im.src = '/tests/visual/synthetic/skin-light.png';
      });
      const W = 320, H = 320;
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
      // Wait for the lazy retouch module so beauty settings take effect.
      A.state.activePreset = 'normal';
      A.renderImage(document.createElement('canvas').getContext('2d'), 8, 8, img, A.state, face);
      const t0 = Date.now();
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
        cv.width = W; cv.height = H;
        A.renderImage(cv.getContext('2d'), W, H, img, st, face);
        const d = cv.getContext('2d').getImageData(0, 0, W, H).data;
        let sum = 0, sumSq = 0, n = 0;
        for (let i = 0; i < d.length; i += 28) { // every 7th pixel, R+G+B
          const v = d[i] + d[i + 1] + d[i + 2];
          sum += v; sumSq += v * v; n++;
        }
        out[name] = { sum, mean: sum / n, w: W, h: H, fixture: 'skin-light.png', face: 'mock-4242' };
      }
      return out;
    }, SETTINGS);

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    const manifest = {
      version: 1,
      generator: 'scripts/gen-g1b1-golden.cjs',
      baseCommit: 'c71df9d01591b7335619befdc57a96cc5b8bd5bd',
      tolerance: { relDrift: 0.005, note: 'L24 also requires sampled mean abs diff < 2.0 grayscale levels' },
      settings: SETTINGS,
      goldens
    };
    fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));
    console.log('goldens written: ' + OUT);
    for (const [k, v] of Object.entries(goldens)) console.log(`  ${k}: sum=${v.sum} mean=${v.mean.toFixed(2)}`);
    await browser.close();
  } finally {
    server.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
