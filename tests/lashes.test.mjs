/* AuraGram G1c — lash unit tests (pure geometry/math, no DOM, no network).
 * Run: node --test tests/lashes.test.mjs
 * Covers eye-geometry mapping (L1/L2 foundations), confidence gates (L11),
 * strength curves + determinism (L6/L9 foundations) and state plumbing.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../src/state/editorState.js');

import {
  describeEye, describeEyes, hash01, lashRoiSize,
  LASH_ROI_MAX_DIM, LASH_MIN_EYE_W
} from '../src/retouch/eyeGeometry.mjs';
import { lumaOf, lidYAt, scoreConfidence } from '../src/retouch/lashAnalysis.mjs';
import {
  lashDensityCurve, lashLengthCurve, lashDefinitionCurve,
  isNeutralLashes, lashCorrectionCount, fillDensityRGBA
} from '../src/retouch/lashEnhancement.mjs';

test('density target preserves source brightness and scales with strength/confidence', () => {
  const ridge=new Uint8Array([255,255,255,255]), data=new Uint8ClampedArray(8*8*4);
  const minima=[];
  for(const strength of [0,25,50,100]) {
    fillDensityRGBA(data,8,8,ridge,2,2,strength,1);
    const rgb=Array.from(data).filter((value,index)=>index%4!==3);
    minima.push(Math.min(...rgb));assert.ok(Math.min(...rgb)>=166);
    for(let i=3;i<data.length;i+=4)assert.equal(data[i],255);
  }
  assert.equal(minima[0],255);assert.ok(minima[1]>minima[2]&&minima[2]>minima[3]);
  fillDensityRGBA(data,8,8,ridge,2,2,100,0);assert.ok(data.every(value=>value===255));
  fillDensityRGBA(data,8,8,ridge,2,2,100,.5);assert.ok(data[0]>minima[3]);
});

test('density interpolates ridge edges rather than drawing opaque pixel rectangles', () => {
  const data=new Uint8ClampedArray(16*2*4);
  fillDensityRGBA(data,16,2,new Uint8Array([255,0,255,0]),2,2,100,1);
  const values=Array.from({length:16},(_,x)=>data[x*4]);
  assert.ok(values.some(value=>value>166&&value<255));
  for(let x=1;x<16;x++){assert.ok(values[x]>=values[x-1]);assert.ok(values[x]-values[x-1]<=20);}
  fillDensityRGBA(data,16,2,new Uint8Array(),2,2,100);assert.ok(data.every(value=>value===255));
});

// Same mock face shape as the retouch suite (normalized, centered).
function mockRegions(cx = 0.5, cy = 0.5, w = 0.4, h = 0.5) {
  const ell = (ex, ey, rx, ry, n) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: ex + Math.cos(a) * rx, y: ey + Math.sin(a) * ry, z: 0 };
  });
  return {
    faceOval: ell(cx, cy, w / 2, h / 2, 36),
    leftEye: ell(cx + w * 0.18, cy - h * 0.08, w * 0.06, h * 0.03, 16),
    rightEye: ell(cx - w * 0.18, cy - h * 0.08, w * 0.06, h * 0.03, 16),
    leftEyebrow: ell(cx + w * 0.18, cy - h * 0.16, w * 0.07, h * 0.02, 10),
    rightEyebrow: ell(cx - w * 0.18, cy - h * 0.16, w * 0.07, h * 0.02, 10),
    lips: ell(cx, cy + h * 0.22, w * 0.11, h * 0.05, 20),
    nose: Array.from({ length: 8 }, (_, i) => ({ x: cx, y: cy - h * 0.12 + (i / 7) * h * 0.24, z: 0 }))
  };
}

describe('L1 geometry mapping — ROI follows the real eye', () => {
  test('ROI contains the eye bbox with face-relative margins', () => {
    const r = mockRegions();
    const eyes = describeEyes(r, 0.4);
    for (const side of ['left', 'right']) {
      const e = eyes[side];
      assert.equal(e.usable, true);
      assert.ok(e.roi.x0 < e.cx && e.roi.x1 > e.cx, `${side} roi spans the eye center`);
      assert.ok(e.roi.y0 < e.cy && e.roi.y1 > e.cy, `${side} roi spans the eye vertically`);
      assert.ok(e.upperLid.length >= 3, `${side} upper lid polyline`);
      assert.ok(e.lidNormal.y < 0, `${side} lid normal points up/out of the eye`);
    }
  });
  test('margins scale with the face (no fixed pixels)', () => {
    const small = describeEyes(mockRegions(0.5, 0.5, 0.2, 0.25), 0.2);
    const big = describeEyes(mockRegions(0.5, 0.5, 0.4, 0.5), 0.4);
    const margin = (e) => (e.roi.x1 - e.roi.x0) - e.w;
    const ratio = margin(big.left) / margin(small.left);
    assert.ok(ratio > 1.6 && ratio < 2.5, `margins scale ~2x, got ${ratio}`);
  });
  test('off-center / edge eyes stay usable and clipped to the frame', () => {
    const r = mockRegions(0.8, 0.5, 0.4, 0.5);
    const eyes = describeEyes(r, 0.4);
    assert.ok(eyes.left.usable || eyes.right.usable, 'at least the visible eye works');
    for (const e of [eyes.left, eyes.right]) {
      assert.ok(e.roi.x0 >= 0 && e.roi.x1 <= 1 && e.roi.y0 >= 0 && e.roi.y1 <= 1, 'roi clipped');
    }
  });
  test('tiny eyes are reported unusable (low-res guard)', () => {
    const r = mockRegions(0.5, 0.5, 0.03, 0.04);
    const eyes = describeEyes(r, 0.03);
    assert.equal(eyes.left.usable, false);
    assert.equal(eyes.right.usable, false);
  });
  test('ROI bitmap stays small (LASH_ROI_MAX_DIM cap)', () => {
    assert.ok(LASH_ROI_MAX_DIM <= 224, 'roi cap must stay small');
    const s = lashRoiSize({ x0: 0.3, y0: 0.3, x1: 0.7, y1: 0.6 });
    assert.ok(Math.max(s.w, s.h) <= LASH_ROI_MAX_DIM, `capped, got ${s.w}x${s.h}`);
    assert.ok(s.w >= 24 && s.h >= 16, 'minimum sane');
  });
});

describe('L2 left/right consistency — never mirrored', () => {
  test('outer corners sit on the ear side of each eye', () => {
    const eyes = describeEyes(mockRegions(), 0.4);
    // Subject-left eye is image-right: outer = larger x.
    assert.ok(eyes.left.outer.x > eyes.left.inner.x, 'left eye outer is image-right');
    assert.ok(eyes.right.outer.x < eyes.right.inner.x, 'right eye outer is image-left');
    // Centers differ — the two descriptions are not copies.
    assert.ok(Math.abs(eyes.left.cx - eyes.right.cx) > 0.05, 'eyes keep asymmetry');
    assert.ok(eyes.left.angle !== eyes.right.angle || Math.abs(eyes.left.cx - eyes.right.cx) > 0, 'per-eye axes');
  });
  test('hash01 is deterministic in [0,1)', () => {
    assert.equal(hash01('left:7'), hash01('left:7'));
    assert.ok(hash01('left:7') !== hash01('right:7'), 'sides differ');
    assert.ok(hash01('x') >= 0 && hash01('x') < 1, 'range');
  });
});

describe('confidence gates (L11 blurry-eye guard foundations)', () => {
  test('unusable eye short-circuits', () => {
    assert.deepEqual(
      scoreConfidence({ sharp01: 1, coverage: 1, contrast01: 1, usable: false }),
      { confidence: 0, reason: 'eye-unusable' });
  });
  test('blurry eyes are rejected', () => {
    const s = scoreConfidence({ sharp01: 0.002, coverage: 0.8, contrast01: 0.2, usable: true });
    assert.equal(s.reason, 'blurry');
    assert.equal(s.confidence, 0);
  });
  test('sparse ridges are rejected', () => {
    const s = scoreConfidence({ sharp01: 0.5, coverage: 0.02, contrast01: 0.2, usable: true });
    assert.equal(s.reason, 'sparse');
    assert.equal(s.confidence, 0);
  });
  test('pale lashes weaken but are not fully rejected', () => {
    const s = scoreConfidence({ sharp01: 0.5, coverage: 0.5, contrast01: 0.01, usable: true });
    assert.equal(s.reason, 'low-contrast');
    assert.ok(s.confidence >= 0 && s.confidence < 0.4, `weakened, got ${s.confidence}`);
  });
  test('good eyes pass with reason ok', () => {
    const s = scoreConfidence({ sharp01: 0.6, coverage: 0.6, contrast01: 0.2, usable: true });
    assert.equal(s.reason, 'ok');
    assert.ok(s.confidence > 0.5, `confident, got ${s.confidence}`);
  });
  test('luma + lid interpolation math', () => {
    assert.ok(Math.abs(lumaOf(255, 255, 255) - 255) < 1e-9);
    assert.ok(lumaOf(0, 0, 0) === 0);
    const lid = [{ x: 0, y: 10 }, { x: 10, y: 20 }];
    assert.equal(lidYAt(lid, 5), 15);
    assert.equal(lidYAt(lid, -3), 10);
    assert.equal(lidYAt(lid, 99), 20);
  });
});

describe('lash curves + state (L3/L6/L9 foundations)', () => {
  test('zero is zero, clamped, monotonic, conservative', () => {
    for (const [fn, max] of [[lashDensityCurve, 0.5], [lashLengthCurve, 1.0], [lashDefinitionCurve, 0.45]]) {
      assert.equal(fn(0), 0);
      assert.equal(fn(-3), 0);
      assert.ok(fn(100) <= max + 1e-9, `capped at ${max}`);
      assert.equal(fn(999), fn(100), 'clamped above 100');
      let prev = -1;
      for (let v = 0; v <= 100; v += 5) {
        const cur = fn(v);
        assert.ok(cur >= prev - 1e-12, 'monotonic');
        prev = cur;
      }
    }
    // Conservative: small values stay subtle.
    assert.ok(lashDensityCurve(20) < 0.1, 'density20 subtle');
    assert.ok(lashDefinitionCurve(15) < 0.12, 'definition15 subtle');
  });
  test('neutral helpers + app state plumbing', () => {
    assert.equal(isNeutralLashes(null), true);
    assert.equal(isNeutralLashes({ density: 0, length: 0, definition: 0 }), true);
    assert.equal(isNeutralLashes({ density: 1, length: 0, definition: 0 }), false);
    assert.equal(lashCorrectionCount({ density: 20, length: 0, definition: 15 }), 2);
    assert.deepEqual(api.createLashesState(), { density: 0, length: 0, definition: 0 });
    assert.equal(api.isNeutralLashes(api.createInitialState().lashes), true);
    assert.equal(api.isNeutralLashes(api.createNeutralState().lashes), true);
    assert.equal(api.isStateNeutral(api.createNeutralState()), true);
    assert.equal(api.isStateNeutral(api.createInitialState()), false);
    const st = api.createNeutralState();
    st.lashes.density = 10;
    assert.equal(api.isStateNeutral(st), false, 'lashes break neutrality');
    assert.equal(api.getActiveCorrectionCount(st), 1, 'one lash correction counted');
  });
  test('LASH_MIN_EYE_W sane', () => {
    assert.ok(LASH_MIN_EYE_W > 0 && LASH_MIN_EYE_W < 0.05, `min eye ${LASH_MIN_EYE_W}`);
  });
});
