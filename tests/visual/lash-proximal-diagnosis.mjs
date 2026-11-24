import {lidFrame} from '../../src/retouch/lashAnalysis.mjs';
import {insideRegion} from './lash-spatial-match.mjs';

/** Post-hoc diagnostic: no seed generation, path extension or acceptance. */
export function diagnoseProximal(records,lid,lower,ambiguities=[]) {
 const measure=p=>{
  const f=lidFrame(lid,lower,p.x,p.y);
  return {point:p,signedLidDistance:f?.distance??null,
   gateClearance:f?Math.max(0,f.distance-1.5):null,
   insideAmbiguity:ambiguities.some(a=>insideRegion(p,a.region))};
 };
 // Conservative reachability bound for the existing signed gate: every
 // accepted gate point lies in at least one segment's inward half-plane.
 // Distance to that union is a lower bound, not an observed hair length.
 const gateLowerBound=p=>{
  const low=lower.reduce((a,p)=>({x:a.x+p.x/lower.length,y:a.y+p.y/lower.length}),{x:0,y:0});
  const distances=[];
  for(let i=1;i<lid.length;i++){
   const a=lid[i-1],b=lid[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(!length)continue;
   let nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
   if(nx*(low.x-a.x)+ny*(low.y-a.y)>0){nx=-nx;ny=-ny;}
   distances.push((p.x-a.x)*nx+(p.y-a.y)*ny-1.5);
  }
  return distances.length?Math.max(0,Math.min(...distances)):null;
 };
 const rows=records.map(r=>{
  const points=r.proximal?.points||[],last=points.at(-1);
  const measured=points.map(measure),end=last&&measure(last);
  // Refused candidate centres are explicitly not appended to observed paths.
  const attempt=r.proximal?.attempts?.at(-1);
  const candidate=attempt?.center&&r.patch?measure({x:attempt.center.x+r.patch.x,y:attempt.center.y+r.patch.y}):null;
  const minDistance=measured.length?Math.min(...measured.map(p=>p.signedLidDistance??Infinity)):null;
  const near=measured.some(p=>p.signedLidDistance!==null&&p.signedLidDistance<=1.5);
  const budget=r.reasons.includes('seed-budget');
  const classification=budget?'unprocessed-seed-budget':!last?'no-observed-proximal-path':
   near?'observed-proximal-gate':end.insideAmbiguity?'stopped-inside-marked-ambiguity':'stopped-outside-marked-ambiguity';
  return{rank:r.rank,index:r.index,status:r.status,proximalConnection:r.proximalConnection,
   stop:r.proximal?.reason??r.reasons[0],classification,
   gateReachabilityLowerBound:points[0]?gateLowerBound(points[0]):null,
   impossibleWithin36FromObservedStart:points[0]?gateLowerBound(points[0])>36:false,
   observedSamples:points.length,observedArc:last?.arc??0,
   start:points[0]?measure(points[0]):null,end:end??null,minSignedLidDistance:minDistance,
   enteredMarkedAmbiguity:measured.some(p=>p.insideAmbiguity),
   // Spatial proximity alone must never change the actual association decision.
   observedGateButUnconfirmed:near&&!r.proximalConnection,
   unacceptedAttempt:candidate?{...candidate,linkAccepted:attempt.linkAccepted===true,denseSupported:attempt.denseSupported??null}:null};
 });
 const countBy=key=>rows.reduce((a,r)=>(a[r[key]]=(a[r[key]]||0)+1,a),{});
 const distances=rows.filter(r=>r.end?.signedLidDistance!==null&&r.end).map(r=>r.end.signedLidDistance).sort((a,b)=>a-b);
 const quantile=q=>distances.length?distances[Math.floor((distances.length-1)*q)]:null;
 return{rows,summary:{records:rows.length,classifications:countBy('classification'),stops:countBy('stop'),
  impossibleWithin36FromObservedStart:rows.filter(r=>r.impossibleWithin36FromObservedStart).length,
  enteredMarkedAmbiguity:rows.filter(r=>r.enteredMarkedAmbiguity).length,
  observedGateButUnconfirmed:rows.filter(r=>r.observedGateButUnconfirmed).length,
  endpointSignedDistance:{count:distances.length,min:quantile(0),median:quantile(.5),max:quantile(1)},
  meaning:'Signed distances to the measured FaceMesh lid gate, not a measured missing hair segment or permission to fill it.'}};
}
