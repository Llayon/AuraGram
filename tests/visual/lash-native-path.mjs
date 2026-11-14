import {initializeNativeCell} from './lash-native-cell.mjs';
import {followCurve} from './lash-subpixel-probe.mjs';
import {measureAt} from './lash-endpoint-profile.mjs';
import {auditSpatialEnding} from './lash-spatial-ending.mjs';
import {lidFrame} from '../../src/retouch/lashAnalysis.mjs';

export const NATIVE_PATH_PROTOCOL=Object.freeze({
 stepNative:.5,maximumArcNative:36,maximumSteps:72,searchHalfNative:.5,
 profileStepNative:.25,minimumValley:.006,competingPeakRatio:.9,
 massSupportFloor:.006,radiiNative:[.75,1.5],observationFloor:.006,
 denseStepNative:.25,directionWindowNative:2,maximumTurnDegrees:15,
 bootstrapDistancesNative:[1,.5,0,-.5,-1],maximumBootstrapResidualNative:.25,
});
const sourcePoint=(p,rect)=>({...p,x:p.x+rect.x,y:p.y+rect.y});
const censored=reason=>({status:'censored',endpointConfirmed:false,proximalConnection:false,path:[],reasons:[reason]});

/** Offline experiment. readPatch(rect, target) synchronously fills contiguous
 * native luma; never upscale, annotate, prefilter tips or return another buffer.
 * Seed order comes exclusively from analyzeLuma's frozen automatic ledger.
 */
export function auditNativeSeeds({width,height,readPatch,seeds,roi,lid,lower,initializeCell=false}) {
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw Error('Invalid source dimensions');
 const work=new Float32Array(256*256),results=[];
 for(const seed of seeds){
  const provenance={rank:seed.rank,index:seed.index,provenance:seed.provenance,seed:{x:seed.x,y:seed.y}};
  const finish=r=>results.push({...provenance,...r});
  if(results.length>=128){finish(censored('seed-budget'));continue;}
  if(!Number.isFinite(seed.x)||!Number.isFinite(seed.y)||!Number.isFinite(seed.tangent?.x)||!Number.isFinite(seed.tangent?.y)){
   finish({...censored('invalid-seed'),status:'ambiguous'});continue;
  }
  if(seed.x<0||seed.y<0||seed.x>width-1||seed.y>height-1){finish(censored('source-boundary'));continue;}
  const x0=Math.max(0,Math.floor(seed.x)-128),y0=Math.max(0,Math.floor(seed.y)-128);
  const rect={x:x0,y:y0,w:Math.min(256,width-x0),h:Math.min(256,height-y0)};
  if(rect.w<1||rect.h<1){finish(censored('source-boundary'));continue;}
  work.fill(NaN);const luma=work.subarray(0,rect.w*rect.h);try{readPatch(rect,luma);}catch(e){finish({...censored('source-read-failed'),readError:String(e.message||e)});continue;}
  if(luma.some(v=>!Number.isFinite(v)||v<0||v>1)){finish(censored('unavailable-native-pixels'));continue;}
  let local={x:seed.x-rect.x,y:seed.y-rect.y};
  const frame=lidFrame(lid,lower,seed.x,seed.y);
  let tx=seed.tangent.x,ty=seed.tangent.y;const norm=Math.hypot(tx,ty);tx/=norm;ty/=norm;
  if(!frame||!Number.isFinite(tx)||!Number.isFinite(ty)){
   finish({...censored('unmeasured-axis'),status:'ambiguous'});continue;
  }
  if(tx*frame.nx+ty*frame.ny<0){tx=-tx;ty=-ty;}
  if(frame.distance<3.5||tx*frame.nx+ty*frame.ny<.25){finish({...censored('no-distinct-shaft-outside-proximal-region'),status:'ambiguous'});continue;}
  let initialization;
  if(initializeCell){
   initialization=initializeNativeCell(luma,rect.w,rect.h,local,{x:tx,y:ty},seed.nativeCell,NATIVE_PATH_PROTOCOL);
   if(!initialization.accepted){finish({...censored('native-cell-'+initialization.reason),status:initialization.reason==='crop-boundary'?'censored':'ambiguous',patch:rect,initialization});continue;}
   local=initialization.center;
  }
  const inROI=p=>{const q=sourcePoint(p,rect);return q.x>=roi.x&&q.y>=roi.y&&q.x<=roi.x+roi.w-1&&q.y<=roi.y+roi.h-1;};
  // Both paths are observed from the same automatic seed. The flags merely
  // enable the existing mathematical operator; ownership is checked below.
  const proximal=followCurve(luma,rect.w,rect.h,local,{available:true,tx:-tx,ty:-ty},
   {body:true,association:true},{margin:1.5,protocol:NATIVE_PATH_PROTOCOL,
    stopAtPoint:p=>{const q=sourcePoint(p,rect);return !inROI(p)?'roi-boundary':lidFrame(lid,lower,q.x,q.y)?.distance<=1.5?'observed-proximal-region':false;}});
  const root=proximal.points.at(-1),rootSource=root&&sourcePoint(root,rect);
  const connected=proximal.reason==='observed-proximal-region'&&proximal.points.every(inROI)&&
   proximal.points.length>=5&&lidFrame(lid,lower,rootSource.x,rootSource.y)?.distance<=1.5;
  const remaining=Math.max(0,36-(root?.arc||0));
  const distal=followCurve(luma,rect.w,rect.h,local,{available:true,tx,ty},{body:true,association:true},
   {margin:1.5,protocol:{...NATIVE_PATH_PROTOCOL,maximumArcNative:remaining,maximumSteps:Math.floor(remaining/.5)},stopAtPoint:p=>!inROI(p)?'roi-boundary':false});
  const path=distal.points.map(p=>sourcePoint(p,rect));
  const fit=distal.attempts.filter(a=>a.linkAccepted).at(-1)?.directionFit??distal.bootstrapFit;
  const tangent=fit?.available?{x:fit.tx,y:fit.ty}:{x:tx,y:ty};
  const reasons=[proximal.reason,distal.reason];
  const evidence={initialization,proximal:{...proximal,points:proximal.points.map(p=>sourcePoint(p,rect))},distal:{...distal,points:path},patch:rect,path,tangent,proximalConnection:connected,
   measurements:distal.attempts.filter(a=>a.accepted).map(a=>({point:a.center&&sourcePoint(a.center,rect),
    tangent:a.tangent,widthSigma:Number.isFinite(a.variance)?Math.sqrt(a.variance):null,
    contrast:Math.max(...a.profile.map(p=>p.deficit))})),
   attemptCoordinateSpace:'patch-local-pixels'};
  const boundary=[proximal,distal].some(c=>c.reason.includes('crop-boundary')||!c.points.every(inROI));
  const budget=[proximal,distal].some(c=>['arc-budget','step-budget'].includes(c.reason));
  let branches=false,branchCensored=false;
  for(const curve of [proximal,distal])for(let i=0;i<curve.points.length;i++){
   const p=curve.points[i],f=i?curve.attempts.filter(a=>a.linkAccepted)[i-1]?.directionFit:curve.bootstrapFit;
   if(!f?.available)continue;
   for(const radius of [.75,1.5]){
    let bands=0,previous=false;
    for(let k=-12;k<=12;k++){
     try{const q={x:p.x-f.ty*k*.25,y:p.y+f.tx*k*.25};
      const supported=measureAt(luma,rect.w,rect.h,q,{x:f.tx,y:f.ty},{x:-f.ty,y:f.tx},[radius]).response>=.006;
      if(supported&&!previous)bands++;previous=supported;
      if(supported&&Math.abs(k)===12)branchCensored=true;
     }catch(e){if(e.message!=='Profile outside measured bitmap')throw e;branchCensored=true;}
    }
    if(bands>1)branches=true;
   }
  }
  const last=distal.points.at(-1);
  const endingROIClipped=last&&[-8,8].some(dx=>[-8,8].some(dy=>!inROI({x:last.x+dx,y:last.y+dy})));
  const ending=auditSpatialEnding(luma,rect.w,rect.h,distal.points,tangent,{proximalConnection:connected,budgetExhausted:budget,roiClipped:boundary||branchCensored||endingROIClipped});
  const status=boundary||budget||branchCensored||endingROIClipped?'censored':branches?'ambiguous':!connected?'ambiguous':ending.status;
  finish({...evidence,status,endpointConfirmed:false,ending:{...ending,coordinateSpace:"patch-local-pixels"},reasons:[...reasons,...(branches?['multiple-supported-bands']:[]),...(branchCensored?['branch-probe-censored']:[]),...(!connected?['unconfirmed-proximal-path']:[]),...ending.reasons]});
 }
 return{coordinateSpace:'original-source-pixels',limit:128,workingBufferBytes:work.byteLength,results};
}

/** Pixel-centre preserving conversion; ledger order and identity are unchanged. */
export function projectAutomaticSeeds(audit,{x,y,scaleX,scaleY}) {
 if(audit.coordinateSpace!=='analysis-roi'||![x,y,scaleX,scaleY].every(Number.isFinite)||scaleX<1||scaleY<1)
  throw Error('Expected automatic ROI ledger and native no-upscale mapping');
 return audit.seeds.map(s=>({...s,x:x+(s.x+.5)*scaleX-.5,y:y+(s.y+.5)*scaleY-.5,
  nativeCell:{w:scaleX,h:scaleY},tangent:{x:s.tangent.x*scaleX,y:s.tangent.y*scaleY}}));
}

/** Browser source-pixel adapter. One canvas and the caller-owned luma buffer.
 * getImageData creates a temporary RGBA view per patch; no full-image readback.
 */
export function createNativePatchReader(source) {
 const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});let closed=false;
 if(!ctx)throw Error('Native patch context unavailable');
 return{width,height,readPatch(rect,target){
  if(closed)throw Error('Native reader disposed');
  if(![rect.x,rect.y,rect.w,rect.h].every(Number.isInteger)||rect.x<0||rect.y<0||rect.w<1||rect.h<1||rect.w>256||rect.h>256||rect.x+rect.w>width||rect.y+rect.h>height||target.length!==rect.w*rect.h)throw Error('Invalid native patch');
  ctx.clearRect(0,0,256,256);ctx.drawImage(source,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);
  const bytes=ctx.getImageData(0,0,rect.w,rect.h).data;
  for(let i=0;i<target.length;i++)target[i]=(.2126*bytes[4*i]+.7152*bytes[4*i+1]+.0722*bytes[4*i+2])/255;
 },dispose(){closed=true;canvas.width=canvas.height=0;}};
}
