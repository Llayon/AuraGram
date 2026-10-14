/* AuraGram G1b.1 — compositing contract unit gates (no browser).
 * Run: node --test tests/g1b1.test.mjs
 * Static gates are supplementary: real pixel proof lives in
 * tests/e2e-g1b1.spec.js (I1–I14). These unit gates pin the architecture
 * so the coupling cannot silently return.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
const RETOUCH = fs.readFileSync(path.join(ROOT, 'src', 'retouch', 'retouch.mjs'), 'utf8');

describe('G1b.1 Bug A — preset globals independent of beauty', () => {
  test('no beauty-gated preset gloss/crisp conditions remain', () => {
    assert.ok(!APP.includes('if (st.beauty.glow === 0)'), 'gloss must not be gated on beauty.glow');
    assert.ok(!APP.includes('if (st.beauty.eyes === 0)'), 'crisp must not be gated on beauty.eyes');
  });
  test('compositing contract documented in renderImage', () => {
    assert.ok(APP.includes('G1b.1 COMPOSITING CONTRACT'), 'contract comment missing in app.js');
    assert.ok(RETOUCH.includes('G1b.1 COMPOSITING CONTRACT'), 'contract comment missing in retouch.mjs');
  });
  test('no early-return beauty kill-switches', () => {
    assert.ok(!/if\s*\(\s*beauty\.glow\s*>\s*0\s*\)\s*return/.test(APP), 'glow kill-switch found');
    assert.ok(!/if\s*\(\s*beauty\.eyes\s*>\s*0\s*\)\s*return/.test(APP), 'eyes kill-switch found');
  });
});

describe('G1b.1 Bug B — blush masked by skin', () => {
  test('blush paints a private layer masked by S.maskSkin', () => {
    assert.ok(RETOUCH.includes('function applyBlush'), 'applyBlush missing');
    assert.ok(RETOUCH.includes('destination-in'), 'masking composite missing');
    assert.ok(RETOUCH.includes('S.maskSkin'), 'skin mask reference missing in retouch');
    // The blush function itself must reference the skin mask (not just sculpt).
    const idx = RETOUCH.indexOf('function applyBlush');
    const block = RETOUCH.slice(idx, idx + 3500);
    assert.ok(block.includes('S.maskSkin'), 'applyBlush must intersect with S.maskSkin');
    assert.ok(block.includes('detailBuffer') || block.includes('detailCtx'), 'blush must reuse a buffer layer');
  });
  test('blush never applies destination-in to the main photo canvas', () => {
    // applyBlush receives tctx (main) + buffers; destination-in must target
    // detailCtx only. A direct `tctx.globalCompositeOperation = 'destination-in'`
    // inside applyBlush would destroy photo pixels outside the mask.
    const idx = RETOUCH.indexOf('function applyBlush');
    const block = RETOUCH.slice(idx, idx + 4000);
    assert.ok(!block.includes("tctx.globalCompositeOperation = 'destination-in'"), 'blush must not destination-in the main canvas');
    assert.ok(!block.includes('tctx.globalCompositeOperation = "destination-in"'), 'blush must not destination-in the main canvas');
  });
  test('blush keeps cheek geometry + soft-light look, strength-gated', () => {
    const idx = RETOUCH.indexOf('function applyBlush');
    const block = RETOUCH.slice(idx, idx + 4000);
    assert.ok(block.includes('cheekCenters'), 'cheek anchoring lost');
    assert.ok(block.includes('soft-light'), 'blush composite mode changed unexpectedly');
    assert.ok(RETOUCH.includes("if (v.blush > 0)"), 'blush zero-gate missing (R7)');
  });
});

describe('G1b.1 allowed-region contract', () => {
  test('all six tools route through masks (audit)', () => {
    // Smooth/antired/glow via maskCombine (skin); eyes via maskEyes; sculpt via maskSkin.
    assert.ok(RETOUCH.includes('maskCombine(S.low)'), 'smooth/glow skin path missing');
    assert.ok(RETOUCH.includes('maskCombine(S.dered)'), 'antired skin path missing');
    assert.ok(RETOUCH.includes('S.maskEyes'), 'eyes mask path missing');
    const sculptIdx = RETOUCH.indexOf('function applySculpt');
    assert.ok(RETOUCH.slice(sculptIdx, sculptIdx + 2000).includes('S.maskSkin'), 'sculpt skin path missing');
  });
});
