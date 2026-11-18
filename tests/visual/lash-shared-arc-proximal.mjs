import {lidFrame} from '../../src/retouch/lashAnalysis.mjs';
import {proximalBudgetBound} from './lash-proximal-budget-bound.mjs';
import {NATIVE_PATH_PROTOCOL} from './lash-native-path.mjs';
import {followCurve} from './lash-subpixel-probe.mjs';

/** Fixed reverse probe from the same initialization, after paying the distal arc. */
export function auditSharedArcProximal(luma, patch, initialization, axis, distal, {lid, lower}) {
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
    reason:reverse.reason, proximalArc:arc, points:reverse.points.map(toSource)};
}
