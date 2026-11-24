import {lidFrame} from '../../src/retouch/lashAnalysis.mjs';
import {proximalBudgetBound} from './lash-proximal-budget-bound.mjs';
import {NATIVE_PATH_PROTOCOL} from './lash-native-path.mjs';
import {followCurve} from './lash-subpixel-probe.mjs';
import {measureAt} from './lash-endpoint-profile.mjs';

function measureRejectedStep(luma, {w, h}, reverse, toSource) {
  const step = reverse.attempts.at(-1);
  if (!step || step.linkAccepted) return null;
  const last = reverse.points.at(-1);
  const evidence = {
    last: toSource(last),
    reference: step.reference ? toSource(step.reference) : null,
    center: step.center ? toSource(step.center) : null,
    tangent: step.tangent,
    centerReason: step.reason,
    shift: step.shift ?? null,
    centerBound: NATIVE_PATH_PROTOCOL.searchHalfNative,
    profile: step.profile
  };
  if (reverse.reason !== 'unconfirmed-dense-link') return evidence;

  const dx = step.center.x - last.x;
  const dy = step.center.y - last.y;
  const length = Math.hypot(dx, dy);
  const axis = {x: dx / length, y: dy / length};
  const normal = {x: -axis.y, y: axis.x};
  const {radiiNative, observationFloor} = NATIVE_PATH_PROTOCOL;
  const samples = step.dense.map(({point, response, supported}) => {
    const measured = measureAt(luma, w, h, point, axis, normal, radiiNative);
    if (measured.response !== response || (response >= observationFloor) !== supported)
      throw Error('Proximal stop measurement differs from the recorded link');
    const valleys = measured.scales.map(({valley}) => valley);
    const reason = supported ? 'supported' :
      Math.max(...valleys) < observationFloor ? 'below-transverse-floor' : 'below-floor-after-along-penalty';
    return {point: toSource(point), response, valleys, alongPenalty: measured.alongPenalty, reason};
  });
  return {...evidence, dense: {axis, radii: radiiNative, observationFloor, samples}};
}

/** Fixed reverse probe from the same initialization, after paying the distal arc. */
export function auditSharedArcProximal(luma, patch, initialization, axis, distal, {lid, lower, recordStop = false}) {
  if (!distal.points.length) return {status:'unavailable', reason:'no-observed-distal-start'};
  const toSource = p => ({...p, x:p.x + patch.x, y:p.y + patch.y});
  const start = distal.points[0];
  const distalArc = distal.points.at(-1).arc;
  const remaining = NATIVE_PATH_PROTOCOL.maximumArcNative - distalArc;
  const lowerBound = proximalBudgetBound(toSource(start), lid, lower);
  const base = {distalArc, remaining, lowerBound};
  if (lowerBound === null) return {...base,status:'unavailable',reason:'missing-lid-geometry'};
  if (lowerBound > remaining + 1e-8) return {...base,status:'censored',reason:'proximal-gate-beyond-budget'};
  const step = NATIVE_PATH_PROTOCOL.stepNative;
  if (remaining < step) return {...base,status:'censored',reason:'no-proximal-step-budget'};
  const reverse = followCurve(luma, patch.w, patch.h, initialization,
    {available:true,tx:-axis.x,ty:-axis.y}, {body:true,association:true}, {
      margin:1.5, protocol:{...NATIVE_PATH_PROTOCOL,maximumArcNative:remaining,maximumSteps:Math.floor(remaining / step)},
      stopAtPoint: p => {
        const source = toSource(p);
        return lidFrame(lid, lower, source.x, source.y)?.distance <= 1.5 ? 'proximal-gate' : false;
      }
    });
  const first = reverse.points[0];
  if (first && Math.hypot(first.x - start.x, first.y - start.y) > 1e-8)
    return {...base,status:'ambiguous',reason:'unshared-native-start',reverseStart:toSource(first)};
  const arc = reverse.points.at(-1)?.arc ?? 0;
  return {...base, status:reverse.reason === 'proximal-gate' ? 'gate-observed' :
    reverse.reason.includes('boundary') || reverse.reason.endsWith('-budget') ? 'censored' : 'ambiguous',
    reason:reverse.reason, proximalArc:arc, points:reverse.points.map(toSource),
    ...(recordStop ? {stopEvidence:measureRejectedStep(luma, patch, reverse, toSource)} : {})};
}
