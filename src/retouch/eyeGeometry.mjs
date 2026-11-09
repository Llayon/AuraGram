/**
 * AuraGram G1c — eye geometry for natural lash enhancement (pure, no DOM).
 *
 * MediaPipe gives eyelid/iris landmarks, NOT individual lashes. This module
 * turns the existing normalized regions into per-eye structures:
 * upper/lower lid polylines, eye axis, lid normal, a bounded Eye ROI and an
 * upper-lash band. All coordinates NORMALIZED [0,1]; margins are
 * face-relative (scale with the eye/face, never fixed pixels), so Preview
 * and Export map identically (same contract as the skin mask).
 *
 * Side convention (matches skinMask.mjs): regions.leftEye is the SUBJECT's
 * left eye, which appears on the IMAGE right. Outer/inner corners are
 * derived per eye from its own bbox extremes — the two eyes are never
 * mirrored onto each other and keep their individual asymmetry (L2).
 */
import { clampPoint } from '../vision/faceGeometry.mjs';

/** Working bitmap cap for one Eye ROI (long side, px). Small by design. */
export const LASH_ROI_MAX_DIM = 224;
/** Minimum usable eye width (normalized). Below this the eye is skipped. */
export const LASH_MIN_EYE_W = 0.02;

/** Deterministic [0,1) hash for stable procedural placement (no Math.random). */
export function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function mean(points) {
  let x = 0, y = 0;
  for (const p of points) { x += p.x; y += p.y; }
  return { x: x / points.length, y: y / points.length };
}

function bboxOf(points) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const p of points.map(clampPoint)) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/**
 * Describe one eye from its 16-pt ring + brow (both normalized arrays).
 * @param {Array} eyePoints ring around the eye (any order)
 * @param {Array} browPoints brow polyline (may be empty)
 * @param {number} faceW face width (normalized) for face-relative margins
 * @param {boolean} isSubjectLeft true for regions.leftEye
 */
export function describeEye(eyePoints, browPoints, faceW, isSubjectLeft) {
  const pts = eyePoints.map(clampPoint);
  const c = mean(pts);
  const bb = bboxOf(pts);
  // Split ring into lids by vertical position relative to centroid. Robust
  // to ring order and in-plane roll (roll just tilts both lids together).
  const upper = pts.filter((p) => p.y <= c.y + bb.h * 0.08).sort((a, b) => a.x - b.x);
  const lower = pts.filter((p) => p.y > c.y + bb.h * 0.08).sort((a, b) => a.x - b.x);
  const upperLid = upper.length >= 3 ? upper : [...pts].sort((a, b) => a.x - b.x).slice(0, Math.max(3, Math.ceil(pts.length / 2)));
  const lowerLid = lower.length >= 2 ? lower : [...pts].sort((a, b) => a.x - b.x).slice(Math.floor(pts.length / 2));
  // Corners: outer points at the ear side. Subject-left eye sits on the
  // image right, so its outer corner is the max-x extreme (and vice versa).
  const outer = isSubjectLeft
    ? { ...upperLid[upperLid.length - 1] }
    : { ...upperLid[0] };
  const inner = isSubjectLeft
    ? { ...upperLid[0] }
    : { ...upperLid[upperLid.length - 1] };
  const axis = Math.atan2(inner.y - outer.y, inner.x - outer.x);
  // Lid normal points AWAY from the eye interior (up-ish for upper lids):
  // perpendicular of the axis, flipped to negative-y.
  let nx = Math.sin(axis), ny = -Math.cos(axis);
  if (ny > 0) { nx = -nx; ny = -ny; }
  const w = Math.max(1e-4, bb.w), h = Math.max(1e-4, bb.h);
  // Eye ROI: tight bbox + face-relative margins. Room above the lid for
  // lash length (0.9 eye-heights up), modest margins elsewhere. Eyebrow
  // clearance is enforced by the applicator mask, not by shrinking the ROI.
  const mUp = h * 1.1 + faceW * 0.012;
  const mDown = h * 0.7 + faceW * 0.008;
  const mSide = w * 0.28 + faceW * 0.008;
  const roi = {
    x0: Math.max(0, bb.x0 - mSide),
    y0: Math.max(0, bb.y0 - mUp),
    x1: Math.min(1, bb.x1 + mSide),
    y1: Math.min(1, bb.y1 + mDown)
  };
  const usable = bb.w >= LASH_MIN_EYE_W && (roi.x1 - roi.x0) > 0.01 && (roi.y1 - roi.y0) > 0.01;
  return {
    cx: c.x, cy: c.y, w, h, angle: axis,
    outer, inner, upperLid, lowerLid,
    lidNormal: { x: nx, y: ny },
    roi, usable,
    // Brow centroid (for protection); null when unknown.
    brow: browPoints && browPoints.length ? mean(browPoints.map(clampPoint)) : null
  };
}

/** Describe both eyes. Never swaps or mirrors left/right (L2). */
export function describeEyes(regions, faceW) {
  const fw = Math.max(0.01, faceW);
  return {
    left: describeEye(regions.leftEye, regions.leftEyebrow, fw, true),
    right: describeEye(regions.rightEye, regions.rightEyebrow, fw, false)
  };
}

/** ROI working bitmap size (long side capped, aspect kept, tiny by design). */
export function lashRoiSize(roi) {
  const w = roi.x1 - roi.x0, h = roi.y1 - roi.y0;
  const refW = w * 320, refH = h * 320; // reference pixels at 320px-wide photo
  const k = Math.min(1, LASH_ROI_MAX_DIM / Math.max(refW, refH));
  return { w: Math.max(24, Math.round(refW * k)), h: Math.max(16, Math.round(refH * k)) };
}
