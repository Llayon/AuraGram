/** Offline geometric measurements only. No semantic skin/closure classifier,
 * lash detection, rendering, guard bypass or permission to extend a strand. */
export function closestSegment(p,a,b){
 const vx=b.x-a.x,vy=b.y-a.y,l2=vx*vx+vy*vy;
 const t=l2?Math.max(0,Math.min(1,((p.x-a.x)*vx+(p.y-a.y)*vy)/l2)):0;
 const q={x:a.x+t*vx,y:a.y+t*vy};return{...q,distance:Math.hypot(p.x-q.x,p.y-q.y)};
}
export function polygonMeasure(p,polygon){
 let inside=false,distance=Infinity;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];distance=Math.min(distance,closestSegment(p,a,b).distance);
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return{inside,boundaryDistance:distance};
}
export function eyeFrame(upper,lower){
 const a=upper[0],b=upper.at(-1),width=Math.hypot(b.x-a.x,b.y-a.y);
 if(!(width>0)||upper.length<2||lower.length<2)throw Error('Degenerate eye axis');
 const axis={x:(b.x-a.x)/width,y:(b.y-a.y)/width};
 const at=(arc,t)=>{const u=t*(arc.length-1),i=Math.min(arc.length-2,Math.floor(u)),f=u-i;return{x:arc[i].x*(1-f)+arc[i+1].x*f,y:arc[i].y*(1-f)+arc[i+1].y*f};};
 const signedProfile=[.25,.5,.75].map(t=>{const u=at(upper,t),l=at(lower,t);return((l.x-u.x)*-axis.y+(l.y-u.y)*axis.x)/width;});
 const profile=signedProfile.map(Math.abs),polygon=upper.concat(lower.slice().reverse());
 let area2=0,crossed=false;const orient=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];area2+=a.x*b.y-a.y*b.x;
  for(let j=i+2;j<polygon.length;j++){const c=polygon[j],d=polygon[(j+1)%polygon.length];if(orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0)crossed=true;}
 }
 // Ignore duplicated canonical corners, then reject nonadjacent edge touches
 // and collinear overlaps as well as proper crossings. This is numerical
 // topology validation, never semantic proof of eyelid localization.
 const epsilon=width*1e-10,clean=[];for(const p of polygon)if(!clean.length||Math.hypot(p.x-clean.at(-1).x,p.y-clean.at(-1).y)>epsilon)clean.push(p);
 if(clean.length>1&&Math.hypot(clean[0].x-clean.at(-1).x,clean[0].y-clean.at(-1).y)<=epsilon)clean.pop();
 let selfContact=false;
 for(let i=0;i<clean.length;i++)for(let j=i+1;j<clean.length;j++){
  if(j===i+1||(i===0&&j===clean.length-1))continue;
  const a=clean[i],b=clean[(i+1)%clean.length],c=clean[j],d=clean[(j+1)%clean.length];
  if(Math.min(closestSegment(a,c,d).distance,closestSegment(b,c,d).distance,closestSegment(c,a,b).distance,closestSegment(d,a,b).distance)<=epsilon)selfContact=true;
 }
 const nonzeroArea=Math.abs(area2)>width*width*1e-10,gapSignChange=Math.min(...signedProfile)<-1e-10&&Math.max(...signedProfile)>1e-10;
 const topologyAligned=Math.hypot(upper[0].x-lower[0].x,upper[0].y-lower[0].y)<width*1e-8&&Math.hypot(upper.at(-1).x-lower.at(-1).x,upper.at(-1).y-lower.at(-1).y)<width*1e-8;
 return{width,axis,origin:a,apertureProfile:profile,signedGapProfile:signedProfile,apertureMedian:profile.slice().sort((a,b)=>a-b)[1],validity:{nonzeroArea,crossed,selfContact,gapSignChange,topologyAligned,usable:nonzeroArea&&!crossed&&!selfContact&&!gapSignChange&&topologyAligned}};
}
export function measureDomainPoint(p,upper,lower,options){
 const frame=eyeFrame(upper,lower),low=lower.reduce((a,q)=>({x:a.x+q.x/lower.length,y:a.y+q.y/lower.length}),{x:0,y:0});let nearest=null;
 for(let i=1;i<upper.length;i++){
  const a=upper[i-1],b=upper[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(!length)continue;
  const q=closestSegment(p,a,b);if(nearest&&q.distance>=nearest.distance)continue;
  let nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;if(nx*(low.x-q.x)+ny*(low.y-q.y)>0){nx=-nx;ny=-ny;}
  nearest={...q,signedDistance:(p.x-q.x)*nx+(p.y-q.y)*ny};
 }
 const polygon=polygonMeasure(p,upper.concat(lower.slice().reverse())),clearance=Math.max(options.minimumClearance,options.relativeClearance*frame.width,options.uncertainty||0);
 const axial=((p.x-frame.origin.x)*frame.axis.x+(p.y-frame.origin.y)*frame.axis.y)/frame.width;
 const clearlyOutside=frame.validity.usable&&!polygon.inside&&polygon.boundaryDistance>clearance;
 // The slab is a diagnostic probe, deliberately NOT a skin/strand mask.
 const belowProbe=options.depthRatios.map(depth=>({depth,contains:clearlyOutside&&axial>=options.axisRange[0]&&axial<=options.axisRange[1]&&nearest.signedDistance<0&&nearest.distance<=depth*frame.width}));
 return{axial,nearest,polygon,clearance,clearlyOutside,geometryValidity:frame.validity,belowProbe,containmentMeaning:'Center-only slab membership. Uncertainty disk is checked against opening clearance only, not all slab boundaries. Outside polygon does not identify skin.'};
}
