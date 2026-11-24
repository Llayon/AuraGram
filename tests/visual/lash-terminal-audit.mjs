import {measureAt} from './lash-endpoint-profile.mjs';

export function responseBands(samples){
 const runs=[];for(let i=0;i<samples.length;i++){const s=samples[i];if(s.supported){if(!i||!samples[i-1].supported)runs.push([]);runs.at(-1).push(s);}}
 return runs.map(run=>({from:run[0].offset,to:run.at(-1).offset,peak:Math.max(...run.map(s=>s.response)),containsAxis:run.some(s=>s.offset===0),boundaryCensored:run[0].offset===samples[0].offset||run.at(-1).offset===samples.at(-1).offset}));
}
export function auditTerminal(luma,w,h,curve,p){
 if(!curve.points.length)return{available:false,reason:'no-observed-path',endpointConfirmed:false,outcome:'UNKNOWN',neighborhoods:[]};
 const accepted=curve.attempts.filter(a=>a.linkAccepted),neighborhoods=[];
 const measure=(point,u)=>{try{const v=measureAt(luma,w,h,point,u,{x:-u.y,y:u.x},p.radiiNative);return{response:v.response,supported:v.response>=p.observationFloor};}catch(e){if(e.message!=='Profile outside measured bitmap')throw e;return{unavailable:true,supported:false};}};
 let nextArc=0;
 for(let i=0;i<curve.points.length;i++){
  const point=curve.points[i];if(point.arc+1e-9<nextArc&&i!==curve.points.length-1)continue;nextArc=point.arc+p.sampleArcSpacingNative;
  const fit=i?accepted[i-1].directionFit:curve.bootstrapFit,u={x:fit.tx,y:fit.ty},normal={x:-u.y,y:u.x};
  const probes=p.lookAheadNative.map(ahead=>{const samples=[];for(let offset=-p.transverseHalfNative;offset<=p.transverseHalfNative+1e-9;offset+=p.transverseStepNative){const q={x:point.x+u.x*ahead+normal.x*offset,y:point.y+u.y*ahead+normal.y*offset};samples.push({offset,point:q,...measure(q,u)});}const bands=responseBands(samples);return{ahead,samples,bands,secondaryBands:bands.filter(b=>!b.containsAxis).length,unavailable:samples.some(s=>s.unavailable)};});
  neighborhoods.push({arc:point.arc,point,tangent:u,probes});
 }
 const last=curve.points.at(-1),fit=accepted.at(-1)?.directionFit??curve.bootstrapFit,u={x:fit.tx,y:fit.ty};
 const profile=p.terminalOffsetsNative.map(distance=>({distance,point:{x:last.x+u.x*distance,y:last.y+u.y*distance},...measure({x:last.x+u.x*distance,y:last.y+u.y*distance},u)}));
 const forward=profile.filter(s=>s.distance>0),forwardSupport=forward.filter(s=>s.supported).length;
 return{available:true,stop:curve.reason,lastArc:last.arc,neighborhoods,profile,forwardSupport,secondaryProbeCount:neighborhoods.flatMap(n=>n.probes).filter(q=>q.secondaryBands>0).length,completeSecondaryBandCount:neighborhoods.flatMap(n=>n.probes.flatMap(q=>q.bands)).filter(b=>!b.containsAxis&&!b.boundaryCensored).length,censoredSecondaryBandCount:neighborhoods.flatMap(n=>n.probes.flatMap(q=>q.bands)).filter(b=>!b.containsAxis&&b.boundaryCensored).length,unavailable:neighborhoods.some(n=>n.probes.some(q=>q.unavailable))||profile.some(s=>s.unavailable),endpointConfirmed:false,outcome:'UNKNOWN',meaning:'Sampled response bands do not certify branches or same-fiber ownership. Boundary-touching bands are censored, not localized branches. Forward weakness, controller stop or budget is not an endpoint.'};
}
