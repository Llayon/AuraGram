import {measureAt} from './lash-endpoint-profile.mjs';

// QA only: all coordinates refer to decoded native luma pixel centers.
export function probeAnchor(luma, w, h, anchor, firstCenter, axis, bodySupported, protocol) {
  if (!axis.available || !firstCenter) return {available: false, outcome: 'UNKNOWN', reason: 'no-complete-measured-axis'};
  const normal = {x: -axis.ty, y: axis.tx};
  const along = {x: axis.tx * protocol.alongStepNative, y: axis.ty * protocol.alongStepNative};
  const measure = point => {
    try {
      const value = measureAt(luma, w, h, point, along, normal, protocol.radiiNative);
      return {point, ...value, supported: value.response >= protocol.observationFloor};
    } catch (error) {
      if (error.message !== 'Profile outside measured bitmap') throw error;
      return {point, supported: false, unavailable: true, reason: 'crop-boundary'};
    }
  };
  const gap = Math.hypot(firstCenter.x - anchor.x, firstCenter.y - anchor.y);
  const count = Math.max(1, Math.ceil(gap / protocol.stepNative));
  const association = Array.from({length: count + 1}, (_, i) => {
    const t = i / count;
    return {distanceNative: gap * t, ...measure({x: anchor.x + (firstCenter.x - anchor.x) * t, y: anchor.y + (firstCenter.y - anchor.y) * t})};
  });
  const forward = [];
  for (let d = 0; d <= protocol.maximumForwardNative + 1e-9; d += protocol.stepNative) {
    forward.push({distanceNative: d, ...measure({x: anchor.x + axis.tx * d, y: anchor.y + axis.ty * d})});
  }
  const transitions = forward.slice(1).flatMap((p, i) => p.supported !== forward[i].supported ? [{distanceNative: p.distanceNative, fromSupported: forward[i].supported, toSupported: p.supported}] : []);
  const associationSupported = association.every(p => p.supported);
  const complete = associationSupported && bodySupported;
  const continuing = complete && forward.every(p => p.supported);
  return {
    available: true, bodySupported, gapNative: gap, associationSupported, association, forward, transitions,
    firstUnsupportedNative: forward.find(p => !p.supported && !p.unavailable)?.distanceNative ?? null,
    firstUnavailableNative: forward.find(p => p.unavailable)?.distanceNative ?? null,
    outcome: continuing ? 'continuing-within-bound' : 'UNKNOWN',
    reason: !associationSupported ? 'unconfirmed-anchor-association' : !bodySupported ? 'unconfirmed-body-continuity' : continuing ? 'supported-all-the-way-to-bound-not-an-endpoint' : 'contrast-loss-or-reentry-is-not-an-endpoint',
    endpointConfirmed: false,
    meaning: 'Fixed-axis sampled contrast. Neither association nor continuation proves same-fiber ownership; no rendering permission.'
  };
}
