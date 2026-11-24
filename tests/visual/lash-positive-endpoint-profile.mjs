// QA-only copy of the existing boundary endpoint measurement, applied to a
// FIXED old candidate set. Observation floor/positions/scales are unchanged.
export function endpointProfile(luma,w,h,tip){
 const sample=(x,y)=>{x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));const ix=Math.floor(x),iy=Math.floor(y),jx=Math.min(w-1,ix+1),jy=Math.min(h-1,iy+1),fx=x-ix,fy=y-iy;return(luma[iy*w+ix]*(1-fx)+luma[iy*w+jx]*fx)*(1-fy)+(luma[jy*w+ix]*(1-fx)+luma[jy*w+jx]*fx)*fy;};
 const point=tip.evidence.points[0],tx=tip.dx,ty=tip.dy;
 const profile=[-2,-1,0,.5,1,1.5,2,3].map(offset=>{
  const x=point.x+tx*offset,y=point.y+ty*offset,center=sample(x,y),along=(sample(x+tx,y+ty)+sample(x-tx,y-ty))*.5;
  let response=0,transverseContrast=-Infinity;
  for(const radius of[.75,1.5]){const left=sample(x-ty*radius,y+tx*radius),right=sample(x+ty*radius,y-tx*radius),farLeft=sample(x-ty*radius*5/3,y+tx*radius*5/3),farRight=sample(x+ty*radius*5/3,y-tx*radius*5/3),valley=Math.min(left-center,right-center,(farLeft+farRight)*.5-center);transverseContrast=Math.max(transverseContrast,valley);response=Math.max(response,valley-Math.max(0,along-center)*.5);}
  return{offset,center,transverseContrast,response};
 });
 const reason=profile.find(p=>p.offset===0).response<.006?'weak-fitted-tip-direction':profile.some(p=>p.offset>=1&&p.offset<=2&&p.response>=.006)?'continuing-transverse-ridge':'passes-existing-endpoint-check';
 return{profile,reason,passes:reason==='passes-existing-endpoint-check'};
}
