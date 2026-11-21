import {sampleBilinear,measureAt} from './lash-endpoint-profile.mjs';
import {fitShaftAxis} from './lash-native-shaft.mjs';

function localCenter(luma,w,h,point,u,margin,p){
 const normal={x:-u.y,y:u.x},radius=p.searchHalfNative+margin,profile=[];
 const sample=d=>sampleBilinear(luma,w,h,point.x+normal.x*d,point.y+normal.y*d);
 let left,right;
 try{
  left=sample(-radius);right=sample(radius);
  for(let d=-radius;d<=radius+1e-9;d+=p.profileStepNative){const value=sample(d);profile.push({offset:d,value,deficit:left+(right-left)*(d+radius)/(2*radius)-value});}
 }catch(e){if(e.message!=='Profile outside measured bitmap')throw e;return{accepted:false,reason:'crop-boundary',profile};}
 const candidates=profile.filter(r=>Math.abs(r.offset)<=p.searchHalfNative+1e-9),peak=candidates.reduce((a,b)=>b.deficit>a.deficit?b:a);
 let reason='ok',shift=peak.offset;
 if(peak.deficit<p.minimumValley)reason='weak-valley';
 else if(Math.abs(shift)>=p.searchHalfNative-1e-9)reason='search-boundary';
 else if(Math.min(left-peak.value,right-peak.value)<p.minimumValley)reason='one-sided-edge';
 else if(profile.some((r,i)=>i>0&&i<profile.length-1&&Math.abs(r.offset-shift)>p.competingPeakSeparationNative&&r.deficit>=peak.deficit*p.competingPeakRatio&&r.deficit>=profile[i-1].deficit&&r.deficit>=profile[i+1].deficit))reason='multiple-valleys';
 if(reason==='ok'){
  const i=profile.indexOf(peak),a=profile[i-1],b=profile[i+1],den=a.deficit-2*peak.deficit+b.deficit;
  if(den>=-1e-8)reason='flat-center';
  else shift+=Math.max(-p.maximumParabolicAdjustmentNative,Math.min(p.maximumParabolicAdjustmentNative,.5*p.profileStepNative*(a.deficit-b.deficit)/den));
 }
 return{accepted:reason==='ok',reason,shift,profile,reference:point,normal,center:reason==='ok'?{x:point.x+normal.x*shift,y:point.y+normal.y*shift}:null};
}

export function followCurve(luma,w,h,seed,axis,eligibility,{margin,protocol:p}){
 const base={outcome:'UNKNOWN',endpointConfirmed:false};
 if(!axis.available||!seed||!eligibility.body||!eligibility.association)return{...base,available:false,reason:'unconfirmed-seed-association-or-body',points:[],attempts:[]};
 let u={x:axis.tx,y:axis.ty},current={...seed},arc=0;
 const points=[{...current,arc:0}],attempts=[];
 for(let i=0;i<p.maximumSteps;i++){
  if(arc+p.stepNative>p.maximumArcNative+1e-9)return{...base,available:true,reason:'arc-budget',points,attempts};
  const reference={x:current.x+u.x*p.stepNative,y:current.y+u.y*p.stepNative},m=localCenter(luma,w,h,reference,u,margin,p),record={step:i,arcBefore:arc,tangent:{...u},...m};attempts.push(record);
  if(!m.accepted)return{...base,available:true,reason:m.reason,points,attempts};
  const dx=m.center.x-current.x,dy=m.center.y-current.y,len=Math.hypot(dx,dy),segment={x:dx/len,y:dy/len},normal={x:-segment.y,y:segment.x},dense=[];
  if(arc+len>p.maximumArcNative+1e-9)return{...base,available:true,reason:'arc-budget',points,attempts};
  const count=Math.ceil(len/p.denseStepNative);
  try{
   for(let k=0;k<=count;k++){const t=k/count,point={x:current.x+dx*t,y:current.y+dy*t},v=measureAt(luma,w,h,point,segment,normal,p.radiiNative);dense.push({point,response:v.response,supported:v.response>=p.observationFloor});}
  }catch(e){if(e.message!=='Profile outside measured bitmap')throw e;record.dense=dense;return{...base,available:true,reason:'crop-boundary',points,attempts};}
  record.dense=dense;
  if(dense.some(s=>!s.supported))return{...base,available:true,reason:'unconfirmed-dense-link',points,attempts};
  let nextU=u;const proposedArc=arc+len;
  if(proposedArc>=p.directionWindowNative){
   const local=[{...m.center,arc:proposedArc},...points.slice().reverse().filter(q=>proposedArc-q.arc<=p.directionWindowNative+1e-9)],fit=fitShaftAxis(local.map(center=>({accepted:true,center})));
   record.directionFit=fit;
   if(!fit.available)return{...base,available:true,reason:'unconfirmed-local-direction',points,attempts};
   const turn=Math.acos(Math.max(-1,Math.min(1,u.x*fit.tx+u.y*fit.ty)))*180/Math.PI;record.turnDegrees=turn;
   if(turn>p.maximumTurnDegrees)return{...base,available:true,reason:'turn-bound',points,attempts};
   nextU={x:fit.tx,y:fit.ty};
  }
  arc=proposedArc;current=m.center;u=nextU;points.push({...current,arc});record.linkAccepted=true;
 }
 return{...base,available:true,reason:'step-budget',points,attempts};
}
