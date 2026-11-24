import {deriveDistalBodyStart} from './lash-distal-body-start.mjs';
import {auditScaleCorrespondence} from './lash-scale-correspondence.mjs';
import {initializeNativeCell} from './lash-native-cell.mjs';
import {followCurve} from './lash-subpixel-probe.mjs';
import {NATIVE_PATH_PROTOCOL} from './lash-native-path.mjs';
import {traceCoarseSeeds,coarseRouteToSource} from './lash-coarse-route.mjs';
import {projectAutomaticSeeds} from './lash-native-path.mjs';
import {auditSharedArcProximal} from './lash-shared-arc-proximal.mjs';
import {auditProximalBands} from './lash-proximal-band-audit.mjs';

/** Separates full coarse evidence from bounded forward native refinement.
 * Optional reverse diagnostic uses the same start and remaining arc budget.
 */
export function auditMultiscaleSeeds({coarse,mapping,width,height,readPatch,distalBodyStart=false,geometricCenterBound=false,denseAxis='segment',proximalGeometry,compareDistalBands=false}) {
 const routes=traceCoarseSeeds(coarse),distalRoutes=traceCoarseSeeds(coarse,'distal'),seeds=projectAutomaticSeeds({coordinateSpace:'analysis-roi',seeds:coarse.seeds},mapping);
 const work=new Float32Array(256*256),results=[];
 for(let rank=0;rank<seeds.length;rank++){
  const seed=seeds[rank],route=coarseRouteToSource(routes[rank],mapping),base={rank:seed.rank,index:seed.index,seed,correspondence:{status:'unavailable',reason:'native-local-not-evaluated',ownershipConfirmed:false,endpointConfirmed:false},coarse:route,coarseDistal:coarseRouteToSource(distalRoutes[rank],mapping),coarseProximalConnection:route.connected,broadRootAmbiguity:route.broadSupport,proximalConnection:false,endpointConfirmed:false};
  const finish=r=>results.push({...base,...r,reasons:[r.reason]});
  if(rank>=128){finish({status:'censored',reason:'seed-budget'});continue;}
  const localStart=distalBodyStart?deriveDistalBodyStart(distalRoutes[rank],coarse,mapping):{accepted:true,policy:'original-automatic-seed-cell',sourcePoint:{x:seed.x,y:seed.y},tangent:seed.tangent,nativeCell:seed.nativeCell,routeCellIndex:0};
  base.localStart=localStart;
  if(!localStart.accepted){finish({status:localStart.status,reason:'distal-start-'+localStart.reason});continue;}
  const patchX=Math.max(0,Math.floor(localStart.sourcePoint.x)-128);
  const patchY=Math.max(0,Math.floor(localStart.sourcePoint.y)-128);
  // Intersect the existing window with integer pixel centers in the ROI.
  // This also confines every bilinear interpolation neighbor to the ROI.
  const x=Math.max(patchX,Math.ceil(mapping.x));
  const y=Math.max(patchY,Math.ceil(mapping.y));
  const right=Math.min(width-1,patchX+255,Math.floor(mapping.x+coarse.w*mapping.scaleX-1));
  const bottom=Math.min(height-1,patchY+255,Math.floor(mapping.y+coarse.h*mapping.scaleY-1));
  const rect={x,y,w:right-x+1,h:bottom-y+1};
  if(rect.w<1||rect.h<1){finish({status:'censored',reason:'local-roi-boundary'});continue;}
  work.fill(NaN);const luma=work.subarray(0,rect.w*rect.h);
  try{readPatch(rect,luma);}catch(e){finish({status:'censored',reason:e.code==='unavailable-native-pixels'?e.code:'source-read-failed'});continue;}
  if(luma.some(v=>!Number.isFinite(v)||v<0||v>1)){finish({status:'censored',reason:'unavailable-native-pixels'});continue;}
  let axis=localStart.tangent;
  // ROI operator measures an outward axis; preserve it under native scaling.
  const norm=Math.hypot(axis.x,axis.y);if(!Number.isFinite(norm)||norm<1e-8){finish({status:'ambiguous',reason:'unmeasured-seed-axis'});continue;}
  axis={x:axis.x/norm,y:axis.y/norm};
  const point={x:localStart.sourcePoint.x-rect.x,y:localStart.sourcePoint.y-rect.y},initialization=initializeNativeCell(luma,rect.w,rect.h,point,axis,localStart.nativeCell,NATIVE_PATH_PROTOCOL,{geometricCenterBound});
  if(!initialization.accepted){finish({status:initialization.reason==='crop-boundary'?'censored':'ambiguous',reason:'native-cell-'+initialization.reason,patch:rect,initialization});continue;}
  const inROI=p=>{const x=p.x+rect.x,y=p.y+rect.y;return x>=mapping.x&&y>=mapping.y&&x<=mapping.x+coarse.w*mapping.scaleX-1&&y<=mapping.y+coarse.h*mapping.scaleY-1;};
  const c=followCurve(luma,rect.w,rect.h,initialization.center,{available:true,tx:axis.x,ty:axis.y},{body:true,association:true},{margin:1.5,protocol:NATIVE_PATH_PROTOCOL,denseAxis,stopAtPoint:p=>!inROI(p)?'local-roi-boundary':false});
  const localROICensored=c.points.some(p=>[-3,3].some(x=>[-3,3].some(y=>!inROI({x:p.x+x,y:p.y+y}))));
  const local={...c,roiCensored:localROICensored,points:c.points.map(p=>({...p,x:p.x+rect.x,y:p.y+rect.y})),coordinateSpace:'original-source-pixels',attemptCoordinateSpace:'patch-local-pixels',maximumArcNative:36};
  const localBoundary=c.reason.includes('crop-boundary')||c.reason==='local-roi-boundary';
  const proximalAudit=proximalGeometry ? auditSharedArcProximal(luma,rect,initialization.center,axis,c,proximalGeometry) : undefined;
  const distalBandAudit = compareDistalBands && c.points.length > 0 ? {
   coordinateSpace:'patch-local-pixels',
   response:auditProximalBands(luma,rect.w,rect.h,c.points),
   transverseContrast:auditProximalBands(luma,rect.w,rect.h,c.points,'transverseContrast')
  } : undefined;
  finish({status:route.status==='censored'||localROICensored||localBoundary||['arc-budget','step-budget'].includes(c.reason)?'censored':'ambiguous',reason:localBoundary?'native-local-crop-boundary':route.connected?'coarse-connection-native-ownership-unverified':route.reason,patch:rect,initialization,local,correspondence:auditScaleCorrespondence(base.coarseDistal,local.points,{startCellIndex:localStart.routeCellIndex}),
   ...(proximalAudit ? {proximalAudit} : {}),
   ...(distalBandAudit ? {distalBandAudit} : {}),
   broadRootAmbiguity:route.broadSupport,coarseProximalConnection:route.connected});
 }
 return{results,seedLimit:128,workingBufferBytes:work.byteLength,localRefinementLimit:36};
}
