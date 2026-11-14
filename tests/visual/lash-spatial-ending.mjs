import {inspectSideClosure} from './lash-side-closure.mjs';
import {measureAt} from './lash-endpoint-profile.mjs';

// Experimental evidence only. Coordinates and distances are native source pixels.
// No adapter to production tips: a bounded response island is not ownership proof.
export function auditSpatialEnding(luma, w, h, path, tangent, context = {}) {
  const base = {status:'ambiguous', endpointConfirmed:false, path, tangent,
    proximalConnection:context.proximalConnection === true, profiles:[], reasons:[]};
  const refuse = (status, reason) => ({...base,status,reasons:[reason]});
  if (!path.length) return refuse('ambiguous','no-observed-path');
  if (context.budgetExhausted) return refuse('censored','path-budget');
  if (context.roiClipped) return refuse('censored','roi-boundary');
  const norm = Math.hypot(tangent?.x, tangent?.y);
  if (!Number.isFinite(norm) || Math.abs(norm-1)>1e-6) return refuse('ambiguous','unmeasured-tangent');
  const end=path.at(-1), normal={x:-tangent.y,y:tangent.x};
  for (const radius of [.75,1.5]) {
    const rows=[];
    for(let ai=0;ai<=24;ai++) {
      const ahead=-2+ai*.25, samples=[];
      for(let ni=0;ni<=24;ni++) {
        const offset=-3+ni*.25;
        const point={x:end.x+tangent.x*ahead+normal.x*offset,y:end.y+tangent.y*ahead+normal.y*offset};
        try {
          const m=measureAt(luma,w,h,point,tangent,normal,[radius]);
          samples.push({offset,point,response:m.response,contrast:m.transverseContrast,value:m.center,supported:m.response>=.006});
        } catch(e) {
          if(e.message!=='Profile outside measured bitmap') throw e;
          samples.push({offset,point,unavailable:true});
        }
      }
      rows.push({ahead,samples});
    }
    const unavailable=rows.some(r=>r.samples.some(s=>s.unavailable));
    const boundary=rows.some(r=>r.samples[0].supported||r.samples.at(-1).supported);
    const forward=rows.some(r=>r.ahead>=.5&&r.samples.some(s=>s.supported));
    const observed=rows.filter(r=>r.ahead<=-.5).every(r=>r.samples.some(s=>Math.abs(s.offset)<=.5&&s.supported));
    const split=rows.some(r=>r.samples.filter((s,i,a)=>s.supported&&!a[i-1]?.supported).length>1);
    base.profiles.push({radius,rows,unavailable,boundary,forward,observed,split,sideClosure:inspectSideClosure(rows)});
  }
  if(base.profiles.some(p=>p.unavailable||p.boundary)) return refuse('censored','unavailable-or-side-boundary');
  if(base.profiles.some(p=>p.split)) return refuse('ambiguous','multiple-supported-bands');
  if(base.profiles[0].forward!==base.profiles[1].forward || base.profiles[0].observed!==base.profiles[1].observed)
    return refuse('ambiguous','profile-disagreement');
  if(base.profiles.every(p=>p.forward)) return refuse('continuing','spatial-continuation');
  if(!base.proximalConnection) return refuse('ambiguous','unconfirmed-proximal-path');
  if(!base.profiles.every(p=>p.observed)) return refuse('ambiguous','unconfirmed-preceding-shaft');
  // Absence of valley response does not establish converging physical edges.
  return refuse('ambiguous','side-boundary-closure-unproven');
}
