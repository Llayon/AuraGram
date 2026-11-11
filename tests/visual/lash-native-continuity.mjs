import{measureAt,interpretEndpoint}from'./lash-endpoint-profile.mjs';
export function checkShaftContinuity(luma,w,h,rows,protocol){
 if(rows.length<3||rows.some(r=>!r.accepted))return{available:false,allSamplesSupported:false,reason:'incomplete-observed-centers',samples:[]};
 const samples=[];for(let i=1;i<rows.length;i++){const a=rows[i-1].center,b=rows[i].center,len=Math.hypot(a.x-b.x,a.y-b.y);if(!len)return{available:false,allSamplesSupported:false,reason:'zero-segment',samples};const u={x:(a.x-b.x)/len,y:(a.y-b.y)/len},normal={x:-u.y,y:u.x},count=Math.ceil(len/protocol.denseStepNative);
  for(let k=0;k<=count;k++){const t=k/count,point={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},along={x:u.x*(protocol.alongStepNative??1),y:u.y*(protocol.alongStepNative??1)},m=measureAt(luma,w,h,point,along,normal,protocol.radiiNative);samples.push({segment:i-1,fraction:t,point,...m,supported:m.response>=protocol.observationFloor});}
 }
 return{available:true,allSamplesSupported:samples.every(s=>s.supported),reason:samples.every(s=>s.supported)?'dense-sampled-bilateral-support-not-fiber-proof':'unconfirmed-native-continuity',samples};
}
export function probeAutomaticAxis(luma,w,h,anchor,fit,{sx,sy,protocol}){
 if(!fit.available)return{available:false,reason:'no-measured-axis'};
 const u={x:fit.tx,y:fit.ty},normal={x:-u.y,y:u.x},along={x:u.x*(protocol.alongStepNative??1),y:u.y*(protocol.alongStepNative??1)},analysisStepNative=1/Math.hypot(u.x/sx,u.y/sy),measure=d=>measureAt(luma,w,h,{x:anchor.x+u.x*d,y:anchor.y+u.y*d},along,normal,protocol.radiiNative);
 const profile=protocol.endpointOffsetsAnalysis.map(offset=>({offset,distanceNative:offset*analysisStepNative,...measure(offset*analysisStepNative)})),curve=[];
 for(let d=protocol.forwardDistancesNative.from;d<=protocol.forwardDistancesNative.to+1e-9;d+=protocol.forwardDistancesNative.step)curve.push({distanceNative:d,...measure(d)});
 return{available:true,axisDegrees:fit.angleDegrees,analysisStepNative,profile,curve,interpretation:interpretEndpoint(profile,protocol.observationFloor),meaning:'Fixed old anchor; no endpoint refinement or rendering. Operator outcome is diagnostic only.'};
}
