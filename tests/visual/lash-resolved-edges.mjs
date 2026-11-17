// Offline geometric evidence only; no seeds, tracing, annotation or Length grant.
const LEVELS=[.25,.5], FLOOR=.006, MIN_CONTRAST=.024;
export function measureResolvedEdges(samples){
 const fail=(status,reason)=>({status,reason,endpointConfirmed:false});
 if(!Array.isArray(samples)||samples.length<5)return fail('censored','incomplete-profile');
 if(samples.some((s,i)=>!Number.isFinite(s.offset)||!Number.isFinite(s.value)||s.unavailable||(i&&s.offset<=samples[i-1].offset)))return fail('censored','unavailable-or-unordered-profile');
 const first=samples[0],last=samples.at(-1),span=last.offset-first.offset;
 const deficits=samples.map(s=>first.value+(last.value-first.value)*(s.offset-first.offset)/span-s.value);
 const peak=Math.max(...deficits);
 if(peak<MIN_CONTRAST)return fail('ambiguous','unresolved-contrast');
 const centerValue=samples[deficits.indexOf(peak)].value;
 if(Math.min(first.value-centerValue,last.value-centerValue)<FLOOR)return fail('ambiguous','one-sided-intensity-edge');
 const edges=[];
 for(const level of LEVELS){
  const threshold=peak*level,runs=[];
  for(let i=0;i<samples.length;i++)if(deficits[i]>=threshold){if(!i||deficits[i-1]<threshold)runs.push([]);runs.at(-1).push(i);}
  if(runs.length!==1)return fail('ambiguous','multiple-profile-bands');
  const lo=runs[0][0],hi=runs[0].at(-1);
  if(lo===0||hi===samples.length-1)return fail('censored','profile-boundary');
  const crossing=(a,b)=>samples[a].offset+(samples[b].offset-samples[a].offset)*(threshold-deficits[a])/(deficits[b]-deficits[a]);
  const left=crossing(lo-1,lo),right=crossing(hi,hi+1);
  // Require measured differences at both edge brackets, not noise amplification.
  if(deficits[lo]-deficits[lo-1]<FLOOR||deficits[hi]-deficits[hi+1]<FLOOR)return fail('ambiguous','unresolved-edge-gradient');
  edges.push({level,left,right,width:right-left});
 }
 return{status:'resolved-profile',endpointConfirmed:false,contrast:peak,edges,
  meaning:'Relative-intensity edges, not calibrated physical shaft boundaries'};
}

export function inspectResolvedTaper(rows){
 const measured=rows.map(r=>({ahead:r.ahead,...measureResolvedEdges(r.samples)}));
 const finish=(status,reason)=>({status,reason,endpointConfirmed:false,rows:measured});
 if(rows.some((r,i)=>!Number.isFinite(r.ahead)||(i&&r.ahead<=rows[i-1].ahead)))return finish('censored','unavailable-or-unordered-rows');
 if(measured.some(r=>r.status==='censored'))return finish('censored','incomplete-edge-measurement');
 if(measured.some(r=>r.reason==='multiple-profile-bands'))return finish('ambiguous','multiple-profile-bands');
 const resolved=measured.filter(r=>r.status==='resolved-profile');
 if(resolved.length<3)return finish('ambiguous','insufficient-resolved-rows');
 // A gap cannot be bridged by later resolved sections.
 const start=measured.indexOf(resolved[0]),end=measured.indexOf(resolved.at(-1));
 if(measured.slice(start,end+1).some(r=>r.status!=='resolved-profile'))return finish('ambiguous','unresolved-intervening-profile');
 const a=resolved[0],b=resolved.at(-1);
 for(let k=0;k<LEVELS.length;k++){
  const first=a.edges[k],last=b.edges[k];
  if(first.width-last.width<.5||last.width>first.width*.5)return finish('ambiguous','no-resolved-width-reduction');
  if(last.left<=first.left||last.right>=first.right)return finish('ambiguous','no-two-sided-convergence');
  for(let i=1;i<resolved.length;i++)if(resolved[i].edges[k].left<resolved[i-1].edges[k].left-1e-8||resolved[i].edges[k].right>resolved[i-1].edges[k].right+1e-8)return finish('ambiguous','nonmonotone-edges');
 }
 return finish('resolved-taper-evidence','two-level-two-sided-convergence-without-terminal-proof');
}
