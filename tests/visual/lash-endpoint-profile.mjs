// QA vector form of the existing endpoint operator. No candidate generation.
export function sampleBilinear(a,w,h,x,y){
 if(x<0||y<0||x>w-1||y>h-1)throw Error('Profile outside measured bitmap');
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,jx=Math.min(w-1,ix+1),jy=Math.min(h-1,iy+1);
 return(a[iy*w+ix]*(1-fx)+a[iy*w+jx]*fx)*(1-fy)+(a[jy*w+ix]*(1-fx)+a[jy*w+jx]*fx)*fy;
}
export function measureAt(a,w,h,point,along,normal,radii){
 const sample=(x,y)=>sampleBilinear(a,w,h,x,y),{x,y}=point,center=sample(x,y),alongMean=(sample(x+along.x,y+along.y)+sample(x-along.x,y-along.y))*.5;
 const alongPenalty=Math.max(0,alongMean-center)*.5;let response=0,transverseContrast=-Infinity;
 const scales=radii.map(radius=>{const left=sample(x-normal.x*radius,y-normal.y*radius),right=sample(x+normal.x*radius,y+normal.y*radius),farLeft=sample(x-normal.x*radius*5/3,y-normal.y*radius*5/3),farRight=sample(x+normal.x*radius*5/3,y+normal.y*radius*5/3),valley=Math.min(left-center,right-center,(farLeft+farRight)*.5-center),r=Math.max(0,valley-alongPenalty);response=Math.max(response,r);transverseContrast=Math.max(transverseContrast,valley);return{radius,left,right,farLeft,farRight,valley,response:r};});
 return{center,alongMean,alongPenalty,transverseContrast,response,scales};
}
export function interpretEndpoint(profile,floor=.006){
 if(profile.find(p=>p.offset===0).response<floor)return'weak-fitted-tip-direction';
 if(profile.some(p=>p.offset>=1&&p.offset<=2&&p.response>=floor))return'continuing-transverse-ridge';
 return'passes-existing-endpoint-check';
}
