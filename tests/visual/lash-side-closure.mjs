/** Topology of a measured 0.25px dark-deficit grid, not biological ownership.
 * Background is interpolated between the two measured lateral margins.
 * A finite connected island is only a closure candidate; no Length approval.
 */
export function inspectSideClosure(rows,{floor=.006}={}) {
 const fail=(status,reason,extra={})=>({status,reason,endpointConfirmed:false,...extra});
 const count=rows.length,width=rows[0]?.samples.length;
 if(count!==25||width!==25||rows.some(r=>r.samples.length!==width))return fail('censored','incomplete-grid');
 if(rows.some(r=>r.samples.some(s=>s.unavailable||!Number.isFinite(s.value))))return fail('censored','unavailable-intensity');
 const mask=rows.map(r=>{
  const a=r.samples[0].value,b=r.samples.at(-1).value;
  return r.samples.map((s,i)=>a+(b-a)*i/(width-1)-s.value>=floor);
 });
 // The supplied path must enter at the back through the central shaft.
 if(!mask[0][12])return fail('ambiguous','no-back-shaft');
 const visited=new Set([12]),queue=[12];
 for(let cursor=0;cursor<queue.length;cursor++){
  const index=queue[cursor],y=Math.floor(index/width),x=index%width;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const yy=y+dy,xx=x+dx,id=yy*width+xx;
   if(yy<0||yy>=count||xx<0||xx>=width||!mask[yy][xx]||visited.has(id))continue;
   visited.add(id);queue.push(id);
  }
 }
 const bands=rows.map((r,y)=>{
  const runs=[];for(let x=0;x<width;x++)if(visited.has(y*width+x)){
   if(!x||!visited.has(y*width+x-1))runs.push([]);runs.at(-1).push(x);
  }
  return{ahead:r.ahead,runs:runs.map(run=>({left:r.samples[run[0]].offset,right:r.samples[run.at(-1)].offset,width:(run.at(-1)-run[0])*.25}))};
 });
 const evidence={bands,componentSamples:visited.size,threshold:floor};
 if(bands.some(b=>b.runs.length>1))return fail('ambiguous','split-connected-contour',evidence);
 const disconnected=mask.some((r,y)=>r.some((v,x)=>v&&!visited.has(y*width+x)));
 if(disconnected)return fail('ambiguous','detached-support-gap-or-neighbor',evidence);
 if(bands.some(b=>b.runs.some(r=>r.left<=-2.75||r.right>=2.75)))return fail('censored','lateral-contour-boundary',evidence);
 if(bands.at(-1).runs.length)return fail('continuing','front-contour-boundary',evidence);
 const occupied=bands.filter(b=>b.runs.length),last=occupied.at(-1);
 if(!last||last.ahead<-.5)return fail('ambiguous','closure-behind-stop',evidence);
 if(bands.filter(b=>b.ahead<=-.5).some(b=>!b.runs.length))return fail('ambiguous','unobserved-preceding-contour',evidence);
 const tail=occupied.filter(b=>b.ahead>=last.ahead-1);
 const before=tail[0].runs[0],cap=last.runs[0];
 if(tail.length<3||before.width-cap.width<.5)return fail('ambiguous','no-resolved-convergence',evidence);
 // Both lateral contours must converge, not just a one-sided edge moving.
 if(cap.left<before.left||cap.right>before.right)return fail('ambiguous','inconsistent-side-convergence',evidence);
 const end=rows.find(r=>r.ahead===last.ahead);
 const x=(cap.left+cap.right)/2,near=end.samples.reduce((a,b)=>Math.abs(b.offset-x)<Math.abs(a.offset-x)?b:a);
 return fail('closure-candidate','two-sided-contour-closure',{
  ...evidence,tipRegion:{ahead:[last.ahead,last.ahead+.25],across:[cap.left-.125,cap.right+.125]},
  measuredCap:near.point,meaning:'Finite image-contrast contour only. Ownership, causal gaps and real-photo performance unverified.'});
}
