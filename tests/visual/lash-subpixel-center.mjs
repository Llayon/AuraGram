import {sampleBilinear} from './lash-endpoint-profile.mjs';

export function measureCentroid(luma,w,h,point,u,margin,p){
 const normal={x:-u.y,y:u.x},radius=p.searchHalfNative+margin,profile=[];
 const sample=d=>sampleBilinear(luma,w,h,point.x+normal.x*d,point.y+normal.y*d);
 let left,right;
 try{left=sample(-radius);right=sample(radius);for(let d=-radius;d<=radius+1e-9;d+=p.profileStepNative){const value=sample(d);profile.push({offset:d,value,deficit:left+(right-left)*(d+radius)/(2*radius)-value});}}
 catch(e){if(e.message!=='Profile outside measured bitmap')throw e;return{accepted:false,reason:'crop-boundary',profile};}
 const peak=Math.max(...profile.map(r=>r.deficit)),groups=[];
 for(const r of profile){if(r.deficit>=peak*p.competingPeakRatio){if(!groups.length||groups.at(-1).at(-1)!==profile[profile.indexOf(r)-1])groups.push([]);groups.at(-1).push(r);}}
 let reason='ok';
 if(peak<p.minimumValley)reason='weak-valley';
 else if(groups.length!==1)reason='multiple-valleys';
 else {const g=groups[0],a=profile.indexOf(g[0]),b=profile.indexOf(g.at(-1)),level=peak*p.competingPeakRatio,cross=(r,t)=>r.offset+(t.offset-r.offset)*(level-r.deficit)/(t.deficit-r.deficit),lo=a?cross(profile[a-1],profile[a]):g[0].offset,hi=b<profile.length-1?cross(profile[b],profile[b+1]):g.at(-1).offset;if(lo>=p.searchHalfNative||hi<=-p.searchHalfNative)reason='search-boundary';}
 const peakIndex=profile.findIndex(r=>r.deficit===peak);let low=peakIndex,high=peakIndex;while(low>0&&profile[low-1].deficit>=p.massSupportFloor)low--;while(high<profile.length-1&&profile[high+1].deficit>=p.massSupportFloor)high++;const component=profile.slice(low,high+1);
 const mass=component.reduce((s,r)=>s+Math.max(0,r.deficit),0),shift=mass?component.reduce((s,r)=>s+r.offset*Math.max(0,r.deficit),0)/mass:0;
 if(reason==='ok'&&Math.abs(shift)>=p.searchHalfNative-1e-9)reason='search-boundary';
 let value;
 try{value=sample(shift);}catch(e){if(e.message!=='Profile outside measured bitmap')throw e;reason='crop-boundary';}
 if(reason==='ok'&&Math.min(left-value,right-value)<p.minimumValley)reason='one-sided-edge';
 const variance=mass?component.reduce((s,r)=>s+(r.offset-shift)**2*Math.max(0,r.deficit),0)/mass:null;
 return{accepted:reason==='ok',reason,shift,variance,profile,reference:point,normal,dominantLobes:groups.length,massComponentRange:[profile[low].offset,profile[high].offset],center:reason==='ok'?{x:point.x+normal.x*shift,y:point.y+normal.y*shift}:null};
}
