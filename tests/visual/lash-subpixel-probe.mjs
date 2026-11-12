import {sampleBilinear,measureAt} from './lash-endpoint-profile.mjs';
import {fitShaftAxis} from './lash-native-shaft.mjs';

import {measureCentroid as localCenter} from './lash-subpixel-center.mjs';

export function followCurve(luma,w,h,seed,axis,eligibility,{margin,protocol:p}){
 const base={outcome:'UNKNOWN',endpointConfirmed:false};
 if(!axis.available||!seed||!eligibility.body||!eligibility.association)return{...base,available:false,reason:'unconfirmed-seed-association-or-body',points:[],attempts:[]};
 const prior={x:axis.tx,y:axis.ty},bootstrap=[];
 for(const d of p.bootstrapDistancesNative){const point={x:seed.x+prior.x*d,y:seed.y+prior.y*d},m=localCenter(luma,w,h,point,prior,margin,p);bootstrap.push({distance:d,...m});if(!m.accepted)return{...base,available:true,reason:'bootstrap-'+m.reason,points:[],attempts:[],bootstrap};}
 const bootstrapFit=fitShaftAxis(bootstrap.map(r=>({accepted:true,center:r.center})));
 if(!bootstrapFit.available||bootstrapFit.maxOrthogonalResidual>p.maximumBootstrapResidualNative)return{...base,available:true,reason:'bootstrap-direction',points:[],attempts:[],bootstrap,bootstrapFit};
 const verifyLink=(a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),u={x:dx/len,y:dy/len},normal={x:-u.y,y:u.x},samples=[];for(let k=0,n=Math.ceil(len/p.denseStepNative);k<=n;k++){const t=k/n,point={x:a.x+dx*t,y:a.y+dy*t};let response;try{response=measureAt(luma,w,h,point,u,normal,p.radiiNative).response;}catch(e){if(e.message!=='Profile outside measured bitmap')throw e;return{supported:false,samples,reason:'crop-boundary'};}samples.push({point,response,supported:response>=p.observationFloor});}return{supported:samples.every(s=>s.supported),samples};};
 const bootstrapLinks=[];for(let i=1;i<bootstrap.length;i++){const link=verifyLink(bootstrap[i-1].center,bootstrap[i].center);bootstrapLinks.push(link);if(!link.supported)return{...base,available:true,reason:'bootstrap-dense-link',points:[],attempts:[],bootstrap,bootstrapFit,bootstrapLinks};}
 const initializationCorrectionDegrees=Math.acos(Math.max(-1,Math.min(1,prior.x*bootstrapFit.tx+prior.y*bootstrapFit.ty)))*180/Math.PI;
 let u={x:bootstrapFit.tx,y:bootstrapFit.ty},current={...bootstrap.find(r=>r.distance===0).center},arc=0;
 const points=[{...current,arc:0}],attempts=[];const history=bootstrap.filter(r=>r.distance<=0).map(r=>({...r.center,arc:-Math.hypot(r.center.x-current.x,r.center.y-current.y)}));
 const evidence={bootstrap,bootstrapFit,bootstrapLinks,initializationCorrectionDegrees,originalSeed:seed,refinedSeed:current};

 for(let i=0;i<p.maximumSteps;i++){
  if(arc+p.stepNative>p.maximumArcNative+1e-9)return{...base,...evidence,available:true,reason:'arc-budget',points,attempts};
  const reference={x:current.x+u.x*p.stepNative,y:current.y+u.y*p.stepNative},m=localCenter(luma,w,h,reference,u,margin,p),record={step:i,arcBefore:arc,tangent:{...u},...m};attempts.push(record);
  if(!m.accepted)return{...base,...evidence,available:true,reason:m.reason,points,attempts};
  const dx=m.center.x-current.x,dy=m.center.y-current.y,len=Math.hypot(dx,dy),segment={x:dx/len,y:dy/len},normal={x:-segment.y,y:segment.x},dense=[];
  if(arc+len>p.maximumArcNative)return{...base,...evidence,available:true,reason:'arc-budget',points,attempts};
  const count=Math.ceil(len/p.denseStepNative);
  try{
   for(let k=0;k<=count;k++){const t=k/count,point={x:current.x+dx*t,y:current.y+dy*t},v=measureAt(luma,w,h,point,segment,normal,p.radiiNative);dense.push({point,response:v.response,supported:v.response>=p.observationFloor});}
  }catch(e){if(e.message!=='Profile outside measured bitmap')throw e;record.dense=dense;return{...base,...evidence,available:true,reason:'crop-boundary',points,attempts};}
  record.dense=dense;
  if(dense.some(s=>!s.supported))return{...base,...evidence,available:true,reason:'unconfirmed-dense-link',points,attempts};
  let nextU=u;const proposedArc=arc+len;
  if(true){
   const local=[{...m.center,arc:proposedArc},...points.slice().reverse().filter(q=>proposedArc-q.arc<=p.directionWindowNative+1e-9),...history.filter(q=>q.arc<0&&proposedArc-q.arc<=p.directionWindowNative+1e-9)],fit=fitShaftAxis(local.map(center=>({accepted:true,center})));
   record.directionFit=fit;
   if(!fit.available)return{...base,...evidence,available:true,reason:'unconfirmed-local-direction',points,attempts};
   const turn=Math.acos(Math.max(-1,Math.min(1,u.x*fit.tx+u.y*fit.ty)))*180/Math.PI;record.turnDegrees=turn;
   if(turn>p.maximumTurnDegrees)return{...base,...evidence,available:true,reason:'turn-bound',points,attempts};
   nextU={x:fit.tx,y:fit.ty};
  }
  arc=proposedArc;current=m.center;u=nextU;points.push({...current,arc});record.linkAccepted=true;
 }
 return{...base,...evidence,available:true,reason:'step-budget',points,attempts};
}
