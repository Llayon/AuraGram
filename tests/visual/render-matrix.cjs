#!/usr/bin/env node
'use strict';
/**
 * Visual render matrix (Gauntlet 1b).
 * Renders fixed fixture × setting combinations through the REAL app pipeline
 * in headless Chromium and saves exact canvas PNGs + a manifest.
 *
 * Usage:
 *   node tests/visual/render-matrix.mjs --out tests/visual/baseline
 *   node tests/visual/render-matrix.mjs --out tests/visual/g1b --mask
 *
 * --mask also saves the debug skin mask (mask-<fixture>.png).
 * Outputs are deterministic for identical code (same fixture, same settings).
 * PNG bytes may differ across Chromium versions — compare with tolerance
 * (see tests/visual/compare-matrix.mjs) or regenerate both sides together.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8139;

const FIXTURES = ['tests/fixtures/portrait.jpg', 'tests/fixtures/edge-source.jpg'];

// Deliberately mixed: neutral/preset/default (must NEVER change in G1b)
// plus beauty isolations (smooth/antired intentionally change in G1b).
// Setting mutations live in the page.evaluate below (single source).
const SETTINGS = ['neutral', 'default', 'vogue', 'smooth100', 'antired100'];

function parseArgs() {
  const out = { out: null, mask: false };
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--out') out.out = process.argv[++i];
    if (process.argv[i] === '--mask') out.mask = true;
  }
  if (!out.out) { console.error('missing --out'); process.exit(1); }
  return out;
}

async function main() {
  const { out, mask } = parseArgs();
  const outDir = path.resolve(ROOT, out);
  fs.mkdirSync(outDir, { recursive: true });

  const server = spawn(process.execPath, [path.join(ROOT, 'tests', 'static-server.cjs'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
  let failed = 0;
  try {
    const { chromium } = require('@playwright/test');
    const browser = await chromium.launch();
    const manifest = { settings: SETTINGS, fixtures: FIXTURES, files: [] };
    for (const fixture of FIXTURES) {
      const base = path.basename(fixture, path.extname(fixture));
      for (const name of SETTINGS) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
          await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 45000 });
          await page.waitForFunction(() => !!window.AuraGram, null, { timeout: 15000 });
          await page.setInputFiles('#fileInput', path.join(ROOT, fixture));
          await page.waitForFunction(() => window.AuraGram.loadState.status === 'ready', null, { timeout: 30000 });
          // Methodology: geometry + retouch must be READY before capture,
          // otherwise beauty renders would silently miss the local passes.
          await page.waitForFunction(
            () => ['ready', 'no_face', 'failed', 'unsupported'].includes(window.AuraGram.face.status()),
            null, { timeout: 100000 });
          await page.evaluate((settingName) => {
            const A = window.AuraGram;
            const st = A.state;
            if (settingName === 'default') {
              // As-loaded state (vogue + ring_light + beauty defaults): the
              // upload kept current settings, so just re-render as-is.
            } else {
              A.resetAll(); // neutral baseline for isolations
              if (settingName === 'vogue') {
                st.activePreset = 'vogue'; st.presetIntensity = 100;
              } else if (settingName === 'smooth100' || settingName === 'antired100') {
                st.activePreset = 'normal'; st.activeFX = 'none';
                for (const k of Object.keys(st.beauty)) st.beauty[k] = 0;
                for (const k of Object.keys(st.adjustments)) st.adjustments[k] = 0;
                st.beauty[settingName === 'smooth100' ? 'smooth' : 'antired'] = 100;
              }
            }
            A.renderStudioCanvas();
          }, name);
          // Let the lazily-loaded retouch module land, then re-render so the
          // capture always includes the face-aware passes when beauty is on.
          await page.waitForFunction(() => {
            const A = window.AuraGram;
            const b = A.state.beauty;
            const anyOn = b.smooth > 0 || b.antired > 0 || b.glow > 0 || b.eyes > 0 || b.blush > 0 || b.sculpt > 0;
            return !anyOn || !A.retouch.snapshot() || A.retouch.ready();
          }, null, { timeout: 60000 });
          await page.evaluate(() => window.AuraGram.renderStudioCanvas());
          const png = await page.evaluate(() => {
            const c = document.getElementById('mainCanvas');
            return { w: c.width, h: c.height, url: c.toDataURL('image/png') };
          });
          const file = `${base}-${name}.png`;
          fs.writeFileSync(path.join(outDir, file), Buffer.from(png.url.split(',')[1], 'base64'));
          if (mask) {
            const skin = await page.evaluate(() => {
              const A = window.AuraGram;
              if (!A.retouch || !A.face.store()) return null;
              return A.retouch.debugMaskDataUrl();
            });
            if (skin) {
              const mfile = `mask-${base}.png`;
              fs.writeFileSync(path.join(outDir, mfile), Buffer.from(skin.split(',')[1], 'base64'));
              manifest.files.push(mfile);
            }
          }
          manifest.files.push(file);
          if (errors.length) console.log(`  warn ${file}: ${errors.join(' | ').slice(0, 200)}`);
          console.log(`  ok ${file} (${png.w}x${png.h})`);
        } catch (e) {
          failed += 1;
          console.log(`  FAIL ${base}-${name}: ${e.message.slice(0, 200)}`);
        }
        await page.close();
      }
    }
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await browser.close();
  } finally {
    server.kill();
  }
  if (failed) process.exit(1);
  console.log(`matrix done: ${outDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
