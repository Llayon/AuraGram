// QA-only. Deliberately has no annotation, endpoint label or manual-axis input.
function sample(a,w,h,x,y){
 if(x<0||y<0||x>w-1||y>h-1)return null;
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,jx=Math.min(w-1,ix+1),jy=Math.min(h-1,iy+1);
 return(a[iy*w+ix]*(1-fx)+a[iy*w+jx]*fx)*(1-fy)+(a[jy*w+ix]*(1-fx)+a[jy*w+jx]*fx)*fy;
}
function interpolatePrefix(points,distance){
 let arc=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(!length)continue;
  if(arc+length>=distance-1e-9){const t=Math.max(0,Math.min(1,(distance-arc)/length));return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,tx:(a.x-b.x)/length,ty:(a.y-b.y)/length,segment:i-1};}arc+=length;
 }return null;
}
export function measureShaftCenter(luma,w,h,point,{sx,sy,margin,protocol}){
 const nx=-point.ty,ny=point.tx,cellHalfNormal=.5*(Math.abs(nx)*sx+Math.abs(ny)*sy),step=protocol.profileStepNative;
 const searchHalf=Math.floor((cellHalfNormal+1e-12)/step)*step,radius=searchHalf+margin;
 const base={reference:{x:point.x,y:point.y},nx,ny,cellHalfNormal,searchHalf,radius,margin};
 if(searchHalf<step)return{...base,accepted:false,reason:'insufficient-cell-support',profile:[]};
 const left=sample(luma,w,h,point.x-nx*radius,point.y-ny*radius),right=sample(luma,w,h,point.x+nx*radius,point.y+ny*radius);
 if(left===null||right===null)return{...base,accepted:false,reason:'crop-boundary',profile:[]};
 const profile=[];for(let k=-Math.round(radius/step);k<=Math.round(radius/step);k++){const offset=k*step,value=sample(luma,w,h,point.x+nx*offset,point.y+ny*offset);if(value===null)return{...base,accepted:false,reason:'crop-boundary',profile:[]};const background=left+(right-left)*(offset+radius)/(2*radius);profile.push({offset,value,background,deficit:background-value});}
 const candidates=profile.filter(p=>Math.abs(p.offset)<=searchHalf+1e-12),peak=candidates.reduce((a,b)=>b.deficit>a.deficit?b:a);let reason='ok',shift=peak.offset;
 if(peak.deficit<protocol.minimumValley)reason='weak-valley';
 else if(Math.abs(peak.offset)>=searchHalf-1e-12)reason='search-boundary';
 else if(Math.min(left-peak.value,right-peak.value)<protocol.minimumValley)reason='one-sided-edge';
 else if(profile.some((p,i)=>i>0&&i<profile.length-1&&Math.abs(p.offset-peak.offset)>protocol.competingPeakSeparationNative&&p.deficit>=peak.deficit*protocol.competingPeakRatio&&p.deficit>=profile[i-1].deficit&&p.deficit>=profile[i+1].deficit))reason='multiple-valleys';
 if(reason==='ok'){const i=profile.indexOf(peak),a=profile[i-1],b=profile[i+1],den=a.deficit-2*peak.deficit+b.deficit;if(den>=-1e-8)reason='flat-center';else shift+=Math.max(-protocol.maximumParabolicAdjustmentNative,Math.min(protocol.maximumParabolicAdjustmentNative,.5*step*(a.deficit-b.deficit)/den));}
 const accepted=reason==='ok';return{...base,accepted,reason,peakDeficit:peak.deficit,proposedShift:shift,center:accepted?{x:point.x+nx*shift,y:point.y+ny*shift}:null,profile};
}
export function fitShaftAxis(rows){
 if(rows.length<3||rows.some(r=>!r.accepted))return{available:false,reason:'incomplete-observed-centers'};
 const points=rows.map(r=>r.center),mean={x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length};let xx=0,xy=0,yy=0;
 for(const p of points){const dx=p.x-mean.x,dy=p.y-mean.y;xx+=dx*dx;xy+=dx*dy;yy+=dy*dy;}
 const total=xx+yy;if(total<1e-12)return{available:false,reason:'zero-span'};
 const angle=.5*Math.atan2(2*xy,xx-yy);let tx=Math.cos(angle),ty=Math.sin(angle);if(tx*(points[0].x-points.at(-1).x)+ty*(points[0].y-points.at(-1).y)<0){tx=-tx;ty=-ty;}
 const projections=points.map(p=>(p.x-mean.x)*tx+(p.y-mean.y)*ty),residuals=points.map(p=>Math.abs(-(p.x-mean.x)*ty+(p.y-mean.y)*tx));
 return{available:true,reason:'all-pre-tip-centers-observed-not-fiber-certification',tx,ty,angleDegrees:Math.atan2(ty,tx)*180/Math.PI,center:mean,coherence:Math.hypot(xx-yy,2*xy)/total,maxOrthogonalResidual:Math.max(...residuals),rmsOrthogonalResidual:Math.sqrt(residuals.reduce((s,d)=>s+d*d,0)/points.length),span:Math.max(...projections)-Math.min(...projections),count:points.length};
}
export function analyzeNativeShaft(luma,w,h,observedPrefix,{sx,sy,protocol}){
 const configurations=protocol.profileMarginsNative.map(margin=>{
  const rows=protocol.prefixDistancesNative.map(distance=>{const p=interpolatePrefix(observedPrefix,distance);return p?{distance,segment:p.segment,...measureShaftCenter(luma,w,h,p,{sx,sy,margin,protocol})}:{distance,accepted:false,reason:'observed-prefix-too-short',profile:[]};});
  const fits=protocol.fitWindowsNative.map(window=>({window,...fitShaftAxis(rows.filter(r=>r.distance<=window))}));return{margin,rows,fits};
 });
 return{configurations,meaning:'No favorable margin/window chosen. Available axes describe observed local centers only, not endpoint or same-fiber certainty.'};
}
