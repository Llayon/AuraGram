// Post-hoc scoring only. These functions are never imported by the tracer.
export function insideRegion(point, polygon) {
 if(!point||polygon.length<3)return false;
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [ax,ay]=polygon[j],[bx,by]=polygon[i],cross=(point.x-ax)*(by-ay)-(point.y-ay)*(bx-ax);
  if(Math.abs(cross)<1e-8&&point.x>=Math.min(ax,bx)-1e-8&&point.x<=Math.max(ax,bx)+1e-8&&point.y>=Math.min(ay,by)-1e-8&&point.y<=Math.max(ay,by)+1e-8)return true;
  if((ay>point.y)!==(by>point.y)&&point.x<(bx-ax)*(point.y-ay)/(by-ay)+ax)inside=!inside;
 }
 return inside;
}
export function directionAllowed(tangent,[lo,hi]) {
 if(!tangent||!Number.isFinite(tangent.x)||!Number.isFinite(tangent.y)||Math.hypot(tangent.x,tangent.y)<1e-8)return false;
 if(Math.abs(hi-lo)>=360)return true;
 const angle=Math.atan2(tangent.y,tangent.x)*180/Math.PI;
 const normalize=v=>(v%360+360)%360;
 return normalize(angle-lo)<=normalize(hi-lo)+1e-8;
}
export function matchRegions(candidates,labels) {
 const edges=candidates.map(c=>labels.map((l,j)=>insideRegion(c.point,l.region)&&directionAllowed(c.tangent,l.directionRange)?j:-1).filter(j=>j>=0));
 const owners=new Map();
 function augment(i,seen){for(const j of edges[i]){if(seen.has(j))continue;seen.add(j);if(!owners.has(j)||augment(owners.get(j),seen)){owners.set(j,i);return true;}}return false;}
 for(let i=0;i<candidates.length;i++)augment(i,new Set());
 return {matches:[...owners].map(([label,candidate])=>({label:labels[label].id,candidate:candidates[candidate].id})),unmatchedCandidates:candidates.filter((_,i)=>![...owners.values()].includes(i)).map(c=>c.id),unmatchedLabels:labels.filter((_,i)=>!owners.has(i)).map(l=>l.id)};
}
