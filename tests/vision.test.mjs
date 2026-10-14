/* AuraGram Gauntlet 1a — unit/integration tests (F1–F12, no browser, no network).
 * Run: node --test tests/vision.test.mjs
 * Real inference is covered by tests/e2e-face.spec.js (Playwright + Chromium).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as geo from '../src/vision/faceGeometry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const APP = () => read('src/app.js');
const DETECTOR = () => read('src/vision/faceDetector.mjs');
const WORKER = () => read('src/vision/faceWorker.js');
const OVERLAY = () => read('src/vision/faceOverlay.mjs');
const HTML = () => read('index.html');

// F1: MediaPipe loads from local project resources.
describe('F1 local runtime', () => {
  test('vendored ESM bundle + WASM present with sane sizes', () => {
    const bundle = path.join(ROOT, 'vendor/mediapipe/vision_bundle.mjs');
    const simd = path.join(ROOT, 'vendor/mediapipe/wasm/vision_wasm_internal.wasm');
    const nosimd = path.join(ROOT, 'vendor/mediapipe/wasm/vision_wasm_nosimd_internal.wasm');
    for (const f of [bundle, simd, nosimd]) assert.ok(fs.existsSync(f), `missing ${f}`);
    assert.ok(fs.statSync(bundle).size > 100_000, 'bundle suspiciously small');
    assert.ok(fs.statSync(simd).size > 5_000_000, 'simd wasm suspiciously small');
    assert.ok(fs.statSync(nosimd).size > 5_000_000, 'nosimd wasm suspiciously small');
  });
  test('bundle is self-contained (no bare CDN imports)', () => {
    const bundle = read('vendor/mediapipe/vision_bundle.mjs');
    const bare = bundle.match(/from\s*["'][^"'./][^"']*["']/g);
    assert.equal(bare, null, `bare imports would hit network: ${bare && bare.slice(0, 3)}`);
  });
  test('no runtime CDN for MediaPipe in app sources', () => {
    for (const [name, src] of [['app.js', APP()], ['faceDetector', DETECTOR()], ['faceWorker', WORKER()]]) {
      assert.ok(!src.includes('cdn.jsdelivr'), `${name} references jsdelivr`);
      assert.ok(!src.includes('unpkg.com/@mediapipe'), `${name} references unpkg mediapipe`);
    }
  });
  test('fixed dependency version + lockfile', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.equal(pkg.dependencies?.['@mediapipe/tasks-vision'], '0.10.21');
    assert.ok(fs.existsSync(path.join(ROOT, 'package-lock.json')), 'lockfile missing');
    assert.ok(!pkg.dependencies?.['@mediapipe/tasks-vision']?.includes('latest'), 'must not track @latest');
  });
});

// F2: model + WASM reachable under the Pages subpath via relative URLs.
describe('F2 local model URLs', () => {
  test('model committed with expected size', () => {
    const model = path.join(ROOT, 'vendor/mediapipe/face_landmarker.task');
    assert.ok(fs.existsSync(model), 'model missing — see vendor/mediapipe/ATTRIBUTION.md');
    assert.equal(fs.statSync(model).size, 3758596);
  });
  test('all vision URLs derive from module location (subpath-safe)', () => {
    assert.ok(DETECTOR().includes('new URL(') && DETECTOR().includes('import.meta.url'), 'detector must build URLs from import.meta.url');
    assert.ok(WORKER().includes("'../../vendor/mediapipe/vision_bundle.cjs'"), 'classic worker must import the vendored CJS bundle relatively');
    assert.ok(!/'\/vendor\//.test(DETECTOR() + WORKER()), 'absolute /vendor/ path breaks the /AuraGram/ subpath');
    assert.ok(!DETECTOR().includes('/AuraGram/'), 'hardcoded subpath breaks other deployments');
  });
  test('ATTRIBUTION + license notice present', () => {
    const attr = read('vendor/mediapipe/ATTRIBUTION.md');
    assert.ok(attr.includes('Apache'), 'license must be documented');
    assert.ok(attr.includes('face_landmarker.task'), 'model source must be documented');
  });
});

// F3: normalized coordinates translate consistently to Preview/Export.
describe('F3 coordinate mapping', () => {
  const mk = (n = 478) => Array.from({ length: n }, (_, i) => ({ x: (i % 100) / 100, y: ((i * 7) % 100) / 100, z: 0 }));
  test('toPixels maps identically for preview and export proportions', () => {
    const p = { x: 0.5, y: 0.25, z: 0 };
    assert.deepEqual(geo.toPixels(p, 1080, 1920), { x: 540, y: 480 });
    const a = geo.toPixels(p, 720, 1280);
    const b = geo.toPixels(p, 2160, 3840);
    assert.equal(b.x / a.x, 3);
    assert.equal(b.y / a.y, 3);
  });
  test('landmark validation: 478 in-range points pass, anything else fails', () => {
    assert.equal(geo.isValidLandmarkSet(mk()), true);
    assert.equal(geo.isValidLandmarkSet(mk(477)), false);
    const bad = mk();
    bad[10] = { x: 1.5, y: 0.5, z: 0 };
    assert.equal(geo.isValidLandmarkSet(bad), false);
    assert.equal(geo.isValidLandmarkSet([]), false);
  });
  test('regions use documented topology indices (< 478) with expected sizes', () => {
    for (const [key, idx] of Object.entries(geo.FACE_REGIONS)) {
      assert.ok(idx.every((i) => Number.isInteger(i) && i >= 0 && i < geo.FACE_POINT_COUNT), `${key} has out-of-range index`);
    }
    const r = geo.buildRegions(mk());
    assert.deepEqual(
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.length])),
      { faceOval: 36, leftEye: 16, rightEye: 16, leftEyebrow: 10, rightEyebrow: 10, lips: 20, nose: 8 }
    );
  });
  test('bounds are sane and null-safe', () => {
    assert.equal(geo.computeBounds([]), null);
    const b = geo.computeBounds([{ x: 0.2, y: 0.3, z: 0 }, { x: 0.8, y: 0.9, z: 0 }]);
    assert.deepEqual(b, { x0: 0.2, y0: 0.3, x1: 0.8, y1: 0.9 });
  });
  test('detection operates on the original aspect (no mirror/crop in mapping)', () => {
    const in1 = geo.detectionInputSize(4000, 3000);
    assert.ok(Math.max(in1.w, in1.h) <= 640 && in1.w / in1.h - 4000 / 3000 < 0.01);
    assert.deepEqual(geo.detectionInputSize(100, 80), { w: 100, h: 80 });
  });
});

// F4/F6/F10: store semantics.
describe('face store', () => {
  const mk = () => Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  test('F4 empty result is no_face, never an exception', () => {
    const s = geo.createFaceStore();
    geo.setStoreResult(s, 7, 640, 480, []);
    assert.equal(s.status, 'no_face');
    assert.deepEqual(s.faces, []);
    assert.equal(s.imageId, 7);
  });
  test('F4 malformed landmark sets are dropped, valid ones kept', () => {
    const s = geo.createFaceStore();
    geo.setStoreResult(s, 7, 640, 480, [[{ x: 0, y: 0 }], mk()]);
    assert.equal(s.status, 'ready');
    assert.equal(s.faces.length, 1);
    assert.ok(s.faces[0].bounds && s.faces[0].regions.faceOval.length === 36);
  });
  test('F6 result is bound to its photo; geometry has measurable size', () => {
    const s = geo.createFaceStore();
    geo.setStoreResult(s, 42, 800, 600, [mk()]);
    assert.equal(s.imageId, 42);
    assert.ok(geo.geometryByteSize(s) > 10_000, 'geometry should be tens of KB');
    geo.clearStore(s);
    assert.equal(s.imageId, 0);
    assert.deepEqual(s.faces, []);
  });
});

// F5/F6/F7/F8/F10: lifecycle wiring (static — behaviour pinned by E2E).
describe('lifecycle wiring', () => {
  test('F5 model errors degrade to failed/unsupported, never throw into the editor', () => {
    assert.ok(DETECTOR().includes("'failed'"), 'missing failed status');
    assert.ok(DETECTOR().includes("'unsupported'"), 'missing unsupported status');
    assert.ok(APP().includes("onFaceStatus({ status: 'failed'"), 'module-load failure must surface as failed, not throw');
    assert.ok(DETECTOR().includes('catch'), 'detection needs guarded paths');
  });
  test('F6 generation tokens + stale-result discard', () => {
    assert.ok(DETECTOR().includes('latestImageId'), 'missing generation token');
    assert.ok(DETECTOR().includes('imageId !== latestImageId'), 'missing stale-result guard');
    assert.ok(DETECTOR().includes('pending'), 'missing latest-wins queue');
    assert.ok(APP().includes('imageId !== faceImageId'), 'app must drop callbacks for stale photos');
    assert.ok(APP().includes('faceImageId += 1'), 'photo load must advance the generation');
  });
  test('F7 slider/tab/preset edits never schedule inference (only adoptImage does)', () => {
    const app = APP();
    const schedCalls = (app.match(/scheduleFaceDetection\(img, faceImageId\)/g) || []).length;
    assert.equal(schedCalls, 1, 'detection must be scheduled from exactly one place (adoptImage)');
    const sliderBlock = app.slice(app.indexOf("mainSlider.addEventListener('input'"), app.indexOf("querySelectorAll('.nav-tab')"));
    assert.ok(!sliderBlock.includes('scheduleFaceDetection'), 'slider must not trigger inference');
    assert.ok(!sliderBlock.includes('faceDetector'), 'slider must not touch the vision stack');
  });
  test('F8 singletons: cached worker/landmarker, same-photo skip, no buffer cloning', () => {
    const d = DETECTOR();
    assert.ok(d.includes('if (mainLandmarker) return'), 'main-thread landmarker must be a singleton');
    assert.ok(d.includes('if (workerReady && worker) return'), 'worker must be reused');
    assert.ok(d.includes('already analysed — no new inference'), 'same photo must not re-run inference');
    assert.ok(d.includes('modelAssetPath'), 'model must load via same-origin URL (no cloned buffers)');
    assert.ok(!d.includes('modelAssetBuffer'), 'ArrayBuffer model loading is unsupported by the runtime');
  });
  test('F10 reset clears geometry but keeps the cached model/runtime', () => {
    assert.ok(APP().includes('resetFaceState()'), 'resetAll must reset face state');
    const resetBlock = DETECTOR().slice(DETECTOR().indexOf('function reset()'), DETECTOR().indexOf('function destroy()'));
    assert.ok(!resetBlock.includes('terminate'), 'reset must not kill the worker (model stays cached)');
    assert.ok(!resetBlock.includes('mainLandmarker = null'), 'reset must not drop the landmarker');
    assert.ok(resetBlock.includes("clearStore(store, 'not_started')"), 'reset must clear the store');
  });
  test('no temporary diagnostics leak into the release', () => {
    for (const [name, src] of [['app.js', APP()], ['faceDetector', DETECTOR()], ['faceWorker', WORKER()]]) {
      assert.ok(!src.includes('TEMP-DIAG'), `${name} contains temporary diagnostics`);
      assert.ok(!src.includes('__lastDetectInput') && !src.includes('__detectHistory'), `${name} leaks debug handles`);
    }
  });
});

// F9: overlay isolation.
describe('F9 overlay isolation', () => {
  test('debug overlay lives on a separate canvas, never in the export path', () => {
    assert.ok(HTML().includes('id="faceOverlay"'), 'overlay canvas missing');
    assert.ok(HTML().includes('?debugFace=1') || APP().includes("get('debugFace')"), 'debug gate missing');
    assert.ok(!APP().split('function openExportModal')[1].split('const btnExport')[0].includes('faceOverlay'), 'export must not reference the overlay');
    const renderFn = APP().slice(APP().indexOf('function renderImage('), APP().indexOf('function drawArtisticFX'));
    assert.ok(!renderFn.includes('face'), 'render pipeline must not reference face data (non-regression)');
  });
  test('overlay module draws regions in distinct colors', () => {
    for (const c of ['#22d3ee', '#f472b6', '#fb923c', '#a78bfa', '#fb7185', '#facc15']) {
      assert.ok(OVERLAY().includes(c), `missing region color ${c}`);
    }
  });
});

// F11: strictly local inference.
describe('F11 no external AI', () => {
  test('vision stack performs no external fetches (model/WASM are same-origin)', () => {
    for (const [name, src] of [['faceDetector', DETECTOR()], ['faceWorker', WORKER()], ['faceGeometry', read('src/vision/faceGeometry.mjs')]]) {
      const code = src.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      assert.ok(!/https?:\/\//.test(code), `${name} contains an absolute URL — inference must stay local`);
      assert.ok(!/api[_-]?key/i.test(code), `${name} mentions API keys`);
    }
    assert.ok(DETECTOR().includes('modelAssetPath'), 'model must load via a local same-origin path');
    assert.ok(DETECTOR().includes("new URL('face_landmarker.task'"), 'model URL must derive from the module location');
  });
});

// F12: bounded detection input.
describe('F12 bounded input', () => {
  test('detection input capped within 512–640 px', () => {
    assert.ok(geo.FACE_DETECT_MAX_DIM >= 512 && geo.FACE_DETECT_MAX_DIM <= 640);
    const big = geo.detectionInputSize(4032, 3024);
    assert.ok(Math.max(big.w, big.h) <= 640);
  });
});
