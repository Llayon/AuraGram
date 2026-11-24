/** Agreement within nominal resampled source cells is supporting local
 * evidence, not proof of biological identity or absence of a hidden merger.
 */
export function auditScaleCorrespondence(coarseDistal,nativePoints,{startCellIndex=0}={}) {
 const rows=[];let feasible=[startCellIndex];
 const base={rows,endpointConfirmed:false,ownershipConfirmed:false};
 const finish=(status,reason)=>({...base,status,reason});
 if(!coarseDistal?.points?.length||!nativePoints?.length)return finish('unavailable','missing-observed-overlap');
 for(let i=0;i<nativePoints.length;i++){
  const p=nativePoints[i],matches=[];
  coarseDistal.points.forEach((q,j)=>{
   const cell=q.uncertaintyCell;
   if(q.support!=='transverse-valley'||!cell)return;
   if(Math.abs(p.x-q.x)<=cell.width/2+1e-8&&Math.abs(p.y-q.y)<=cell.height/2+1e-8)matches.push(j);
  });
  const allowed=matches.filter(j=>feasible.some(k=>j>=k));
  rows.push({nativeIndex:i,point:p,observedCellIndices:matches,monotoneCellIndices:allowed});
  if(!matches.length)return finish('unconfirmed','outside-observed-distal-cells');
  if(!allowed.length)return finish('ambiguous','reversed-cell-progress');
  feasible=allowed;
 }
 if(coarseDistal.reason==='multiple-coarse-continuations')return finish('ambiguous','coarse-branch-unresolved');
 if(!rows.some(r=>r.monotoneCellIndices.every(i=>i>startCellIndex)))return finish('unavailable','seed-cell-only');
 return finish('consistent-local-evidence','observed-cell-correspondence-without-ownership');
}
