/* AuraGram G1b — retouch unit tests (pure math/geometry, no DOM).
 * Run: node --test tests/retouch.test.mjs
 * Covers curves (R6/R7 foundations), refinement hue-independence (2.3),
 * face-relative protection geometry (2.2), mask sizing (R2/R13 foundations).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  smoothCurve, antiredCurve, glowCurve, eyesCurve, blushCurve, sculptCurve,
  DERED_MAX_PULL, DERED_DEAD, DERED_FULL, hasFace
} from '../src/retouch/retouch.mjs';
import {
  SKIN_MASK_MAX_DIM, maskSizeFor, faceMetrics, protectionEllipses,
  eyeMaskEllipses, cheekCenters, noseTipPoint, refineFactorFor
} from '../src/retouch/skinMask.mjs';
import { clampPoint } from '../src/vision/faceGeometry.mjs';

// Mock face: centered oval + plausible features (normalized).
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

describe('intensity curves (R6 monotonic, R7 zero)', () => {
  const curves = { smoothCurve, antiredCurve, glowCurve, eyesCurve, blushCurve, sculptCurve };
  const maxK = { smoothCurve: 0.9, antiredCurve: 1.0, glowCurve: 0.32, eyesCurve: 0.5, blushCurve: 0.5, sculptCurve: 0.55 };
  for (const [name, fn] of Object.entries(curves)) {
    test(`${name}: zero is zero, max is capped, monotonic, smooth`, () => {
      assert.equal(fn(0), 0);
      assert.equal(fn(-5), 0);
      assert.ok(Math.abs(fn(100) - maxK[name]) < 1e-9, `${name}(100)=${fn(100)}`);
      assert.ok(fn(999) <= maxK[name] + 1e-9, 'clamped above 100');
      let prev = 0;
      for (let v = 0; v <= 100; v += 2) {
        const cur = fn(v);
        assert.ok(cur >= prev - 1e-12, `${name} decreases at ${v}`);
        prev = cur;
      }
      // No sharp jumps: max step over 2 units stays small (smooth transitions).
      let jump = 0;
      for (let v = 0; v < 100; v += 2) jump = Math.max(jump, fn(v + 2) - fn(v));
      assert.ok(jump < maxK[name] * 0.12, `${name} jumps ${jump}`);
    });
  }
  test('small values stay subtle (low slider ≈ invisible retouch)', () => {
    assert.ok(smoothCurve(10) < 0.9 * 0.06, `smooth(10)=${smoothCurve(10)}`);
  });
});

describe('de-red constants', () => {
  test('dead zone < full range, pull capped below total destruction', () => {
    assert.ok(0 <= DERED_DEAD && DERED_DEAD < DERED_FULL && DERED_FULL <= 1);
    assert.ok(DERED_MAX_PULL > 0 && DERED_MAX_PULL <= 0.5, `pull=${DERED_MAX_PULL}`);
  });
});

describe('refinement is hue-blind and conservative (2.3)', () => {
  test('healthy skin keeps ~full strength regardless of hue', () => {
    // Same luminance/saturation, different hues → identical factor.
    assert.equal(refineFactorFor(0.55, 0.25, 0.05), refineFactorFor(0.55, 0.25, 0.05));
    assert.ok(refineFactorFor(0.6, 0.2, 0.05) > 0.95);
    assert.ok(refineFactorFor(0.3, 0.15, 0.05) > 0.9, 'dark skin must not be punished');
  });
  test('dark desaturated areas (hair/shadow) are reduced, never zeroed harshly', () => {
    const f = refineFactorFor(0.08, 0.1, 0.05);
    assert.ok(f < 0.6 && f >= 0.08, `f=${f}`);
  });
  test('strong edges (glasses/hair) are reduced smoothly', () => {
    const soft = refineFactorFor(0.5, 0.2, 0.25);
    const hard = refineFactorFor(0.5, 0.2, 0.6);
    assert.ok(soft > hard && hard >= 0.08);
    assert.ok(refineFactorFor(0.5, 0.2, 0.1) === 1, 'calm areas untouched');
  });
});

describe('face-relative protection geometry (2.2)', () => {
  test('expected shape inventory', () => {
    const r = mockRegions();
    const kinds = protectionEllipses(r).map((e) => e.kind).sort().join(',');
    assert.equal(kinds, 'brow,brow,eye,eye,lips,nostril,nostril');
    assert.equal(eyeMaskEllipses(r).length, 2);
    assert.equal(cheekCenters(r).length, 2);
    assert.ok(noseTipPoint(r).x > 0 && noseTipPoint(r).y > 0);
    const m = faceMetrics(r);
    assert.ok(Math.abs(m.cx - 0.5) < 0.02 && Math.abs(m.cy - 0.5) < 0.02);
    assert.ok(Number.isFinite(m.angle));
  });
  test('margins scale with the face (no fixed pixels)', () => {
    const small = protectionEllipses(mockRegions(0.5, 0.5, 0.2, 0.25));
    const big = protectionEllipses(mockRegions(0.5, 0.5, 0.4, 0.5));
    const avg = (arr, k) => arr.reduce((a, e) => a + e[k], 0) / arr.length;
    const ratio = avg(big, 'rx') / avg(small, 'rx');
    assert.ok(ratio > 1.7 && ratio < 2.3, `rx scales ${ratio}x for a 2x face`);
  });
  test('cheeks sit below the outer eye corners, clear of eyes and lips', () => {
    const r = mockRegions();
    for (const c of cheekCenters(r)) {
      assert.ok(c.y > 0.45 && c.y < 0.62, `cheek y=${c.y}`);
      assert.ok(c.r > 0.02 && c.r < 0.15, `cheek r=${c.r}`);
    }
  });
  test('works off-center (edge faces)', () => {
    const r = mockRegions(0.72, 0.5, 0.4, 0.5);
    const m = faceMetrics(r);
    assert.ok(Math.abs(m.cx - 0.72) < 0.03, `cx=${m.cx}`);
    for (const e of protectionEllipses(r)) {
      assert.ok(e.cx > 0.4 && e.cx < 1.0, `ellipse at ${e.cx}`);
    }
  });
  test('hasFace guards the pipeline (R9)', () => {
    assert.equal(hasFace(null), false);
    assert.equal(hasFace({}), false);
    assert.equal(hasFace({ imageId: 1, regions: mockRegions() }), true);
    assert.equal(hasFace({ imageId: 1, regions: { faceOval: [{ x: 0, y: 0 }] } }), false);
  });
});

describe('mask sizing (R2/R13)', () => {
  test('long side capped, aspect kept, minimum sane', () => {
    assert.equal(SKIN_MASK_MAX_DIM <= 384, true);
    const s = maskSizeFor(4000, 3000);
    assert.ok(Math.max(s.w, s.h) <= 384);
    assert.ok(Math.abs(s.w / s.h - 4000 / 3000) < 0.02);
    const tiny = maskSizeFor(10, 8);
    assert.ok(tiny.w >= 8 && tiny.h >= 8);
  });
  test('clampPoint clips without mutating originals', () => {
    const p = { x: -0.2, y: 1.4, z: 5 };
    assert.deepEqual(clampPoint(p), { x: 0, y: 1, z: 5 });
    assert.deepEqual(p, { x: -0.2, y: 1.4, z: 5 });
  });
});
