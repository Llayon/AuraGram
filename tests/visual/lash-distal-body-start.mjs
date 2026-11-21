/** Fixed policy, before native refinement: penultimate observed distal cell.
 * Never selects a finished tip or retries another cell after refusal.
 */
export function deriveDistalBodyStart(route,coarse,mapping) {
 const refuse=(status,reason)=>({accepted:false,status,reason,policy:'penultimate-observed-distal-cell'});
 if(route.status==='censored')return refuse('censored','coarse-route-censored');
 if(route.reason!=='unobserved-distal-link')return refuse('ambiguous','coarse-distal-stop-unresolved');
 if(route.points.length<3)return refuse('ambiguous','insufficient-distal-body-cells');
 if(route.points.some(p=>p.support!=='transverse-valley'))return refuse('ambiguous','non-valley-distal-route');
 const routeCellIndex=route.points.length-2,p=route.points[routeCellIndex],index=p.y*coarse.w+p.x;
 const x=mapping.x+(p.x+.5)*mapping.scaleX-.5,y=mapping.y+(p.y+.5)*mapping.scaleY-.5;
 const tx=coarse.dx[index]*mapping.scaleX,ty=coarse.dy[index]*mapping.scaleY,norm=Math.hypot(tx,ty);
 if(!Number.isFinite(norm)||norm<1e-8)return refuse('ambiguous','unmeasured-distal-cell-tangent');
 return{accepted:true,status:'observed-start-only',reason:'fixed-distal-body-cell',policy:'penultimate-observed-distal-cell',routeCellIndex,roiCell:{x:p.x,y:p.y,index},sourcePoint:{x,y},tangent:{x:tx/norm,y:ty/norm},nativeCell:{w:mapping.scaleX,h:mapping.scaleY},endpointConfirmed:false};
}
