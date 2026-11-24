import {sampleBilinear} from './lash-endpoint-profile.mjs';
import {lidFrame} from '../../src/retouch/lashAnalysis.mjs';

/** Diagnostic only: connected contrast is not same-fiber ownership. This
 * inspects actual native pixels; never fills an unsupported gap or approves
 * proximalConnection/Length. Stops at the inherited shared arc remainder.
 */
export function inspectProximalCorridor(luma,w,h,{start,tangent,lid,lower,roi,budget}) {
 const rows=[],base={endpointConfirmed:false,proximalConnection:false,rows};
 const finish=(status,reason,extra={})=>({...base,status,reason,...extra});
 const norm=Math.hypot(tangent?.x,tangent?.y);
 if(!Number.isFinite(norm)||norm<1e-8||!start)return finish('ambiguous','missing-measured-proximal-direction');
 if(!Number.isFinite(budget)||budget<=0)return finish('censored','shared-arc-budget');
 const max=Math.min(36,budget),u={x:tangent.x/norm,y:tangent.y/norm},n={x:-u.y,y:u.x};
 let previous=null;
 for(let ai=0;ai<=Math.floor(max/.25);ai++){
  const ahead=ai*.25,samples=[];
  for(let k=-12;k<=12;k++){
   const offset=k*.25,point={x:start.x+u.x*ahead+n.x*offset,y:start.y+u.y*ahead+n.y*offset};
   if(point.x<roi.x||point.y<roi.y||point.x>roi.x+roi.w-1||point.y>roi.y+roi.h-1)return finish('censored','corridor-roi-boundary');
   try{const value=sampleBilinear(luma,w,h,point.x,point.y);if(!Number.isFinite(value))return finish('censored','unavailable-corridor-pixel');samples.push({point,offset,value});}
   catch(e){if(e.message!=='Profile outside measured bitmap')throw e;return finish('censored','corridor-source-boundary');}
  }
  const left=samples[0].value,right=samples.at(-1).value;
  for(let i=0;i<samples.length;i++){const s=samples[i];s.deficit=left+(right-left)*i/24-s.value;s.supported=s.deficit>=.006;}
  const bands=[];
  for(let i=0;i<samples.length;i++)if(samples[i].supported){if(!i||!samples[i-1].supported)bands.push([]);bands.at(-1).push(i);}
  const row={ahead,samples,bands:bands.map(b=>({from:samples[b[0]].offset,to:samples[b.at(-1)].offset}))};rows.push(row);
  if(bands.length!==1)return finish('ambiguous',bands.length?'multiple-corridor-bands':'unobserved-corridor-gap');
  const b=bands[0],lo=b[0],hi=b.at(-1);
  if(lo<=1||hi>=23)return finish('censored','corridor-side-boundary');
  if(!ai&&(lo>12||hi<12))return finish('ambiguous','observed-stop-not-on-component');
  if(previous&&(hi<previous.lo-1||lo>previous.hi+1))return finish('ambiguous','disconnected-corridor-rows');
  previous={lo,hi};
  const gateSamples=b.filter(i=>{const p=samples[i].point;return lidFrame(lid,lower,p.x,p.y)?.distance<=1.5;});
  if(gateSamples.length)return finish('component-candidate','contrast-component-reaches-proximal-gate',{
   gatePoints:gateSamples.map(i=>samples[i].point),observedAhead:ahead,
   meaning:'An image-contrast component touches the geometric gate. Fiber ownership through a merger is unproven; never substitute this for observed valley-path connection.'});
 }
 return finish('censored','shared-arc-budget');
}
