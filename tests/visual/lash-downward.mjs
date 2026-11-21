/** Offline observation prototype. Never imported by the product renderer.
 * Pixel distances are WORKING-grid units; scores are engineering responses.
 * Root attachment means a graph reaches the predicted upper-arc neighborhood,
 * not biological root ownership. No gaps, manual seeds or extension drawing. */
import {lidFrame} from '../../src/retouch/lashAnalysis.mjs';
import {eyeFrame,polygonMeasure} from './lash-domain.mjs';
const sample=(a,w,h,x,y)=>{if(x<0||y<0||x>w-1||y>h-1)return null;const ix=Math.floor(x),iy=Math.floor(y),jx=Math.min(w-1,ix+1),jy=Math.min(h-1,iy+1),fx=x-ix,fy=y-iy;return(a[iy*w+ix]*(1-fx)+a[iy*w+jx]*fx)*(1-fy)+(a[jy*w+ix]*(1-fx)+a[jy*w+jx]*fx)*fy;};
function valley(luma,w,h,x,y,dx,dy,radii){
 const v=sample(luma,w,h,x,y),a=sample(luma,w,h,x+dx,y+dy),b=sample(luma,w,h,x-dx,y-dy);if(v===null||a===null||b===null)return null;let response=0,available=false;
 for(const radius of radii){const l=sample(luma,w,h,x-dy*radius,y+dx*radius),r=sample(luma,w,h,x+dy*radius,y-dx*radius),ll=sample(luma,w,h,x-dy*radius*5/3,y+dx*radius*5/3),rr=sample(luma,w,h,x+dy*radius*5/3,y-dx*radius*5/3);if([l,r,ll,rr].some(v=>v===null))continue;available=true;response=Math.max(response,Math.min(l-v,r-v,(ll+rr)*.5-v)-Math.max(0,(a+b)*.5-v)*.5);}
 return available?response:null;
}
function tangent(points){
 const mean=points.reduce((a,p)=>({x:a.x+p.x/points.length,y:a.y+p.y/points.length}),{x:0,y:0});let xx=0,xy=0,yy=0;for(const p of points){xx+=(p.x-mean.x)**2;xy+=(p.x-mean.x)*(p.y-mean.y);yy+=(p.y-mean.y)**2;}
 const theta=.5*Math.atan2(2*xy,xx-yy);let dx=Math.cos(theta),dy=Math.sin(theta);const a=points[0],b=points.at(-1);if(dx*(b.x-a.x)+dy*(b.y-a.y)<0){dx=-dx;dy=-dy;}return{dx,dy,coherence:Math.hypot(xx-yy,2*xy)/Math.max(1e-12,xx+yy)};
}
export function traceDownward(luma,w,h,upper,lower,p){
 if(luma.length!==w*h||w>p.maxSide||h>p.maxSide)throw Error('Bounded grid contract');
 const frame=eyeFrame(upper,lower),n=w*h,response=new Float32Array(n),dx=new Float32Array(n),dy=new Float32Array(n),anisotropy=new Float32Array(n),depth=new Float32Array(n),active=new Uint8Array(n),roots=new Uint8Array(n),visited=new Uint8Array(n),parent=new Int32Array(n),queue=new Uint32Array(n),stamps=new Uint16Array(n);parent.fill(-1);
 const buffers=[response,dx,dy,anisotropy,depth,active,roots,visited,parent,queue,stamps],memoryBytes=buffers.reduce((a,b)=>a+b.byteLength,0)+luma.byteLength;
 const empty={reason:'invalid-predicted-geometry',frame,traces:[],response,active,roots,connected:visited,diagnostics:{memoryBytes,qualified:0}};if(!frame.validity.usable)return empty;
 const directions=Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/8),y:Math.sin(i*Math.PI/8)})),polygon=upper.concat(lower.slice().reverse());let rootCount=0,activeCount=0;
 for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++){
  const i=y*w+x,f=lidFrame(upper,lower,x,y),d=-f.distance,u=((x-frame.origin.x)*frame.axis.x+(y-frame.origin.y)*frame.axis.y)/frame.width;depth[i]=d;
  if(u<p.axisRange[0]||u>p.axisRange[1]||d< -p.rootHeadroom||d>frame.width*p.depthRatio)continue;
  const values=directions.map(v=>valley(luma,w,h,x,y,v.x,v.y,p.radii));let best=0;for(let k=1;k<8;k++)if(values[k]>values[best])best=k;
  const strength=values[best],shape=(strength-Math.max(0,values[(best+4)%8]))/Math.max(1e-12,strength);response[i]=strength;anisotropy[i]=shape;
  let vx=directions[best].x,vy=directions[best].y;const inward=-(vx*f.nx+vy*f.ny);if(Math.abs(inward)<p.normalProjection||strength<p.responseFloor||shape<p.anisotropyFloor)continue;if(inward<0){vx=-vx;vy=-vy;}
  dx[i]=vx;dy[i]=vy;active[i]=1;activeCount++;if(Math.abs(d)<=p.rootRadius){roots[i]=1;rootCount++;}
 }
 // V2: retain only an observed transverse response maximum. No pixel is added.
 const thinned=new Uint8Array(n);for(let i=0;i<n;i++)if(active[i]){const x=i%w,y=Math.floor(i/w),a=sample(response,w,h,x-dy[i]*.75,y+dx[i]*.75),b=sample(response,w,h,x+dy[i]*.75,y-dx[i]*.75);if(a!==null&&b!==null&&response[i]>a&&response[i]>=b)thinned[i]=1;}
 const rawActivePixels=activeCount;active.set(thinned);activeCount=0;rootCount=0;for(let i=0;i<n;i++){if(active[i])activeCount++;roots[i]=active[i]&&Math.abs(depth[i])<=p.rootRadius?1:0;rootCount+=roots[i];}
 const adjacent=i=>{const x=i%w,y=Math.floor(i/w),out=[];for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++)if((ox||oy)&&x+ox>=0&&x+ox<w&&y+oy>=0&&y+oy<h)out.push((y+oy)*w+x+ox);return out;};
 const rawEdge=(i,j)=>{if(!active[i]||!active[j]||depth[j]<depth[i]-p.depthBacktrack)return false;const vx=j%w-i%w,vy=Math.floor(j/w)-Math.floor(i/w),len=Math.hypot(vx,vy);return dx[i]*dx[j]+dy[i]*dy[j]>=p.orientationAgreement&&(vx*dx[i]+vy*dy[i])/len>=p.edgeAlignment&&(vx*dx[j]+vy*dy[j])/len>=p.edgeAlignment;};
 const edge=(i,j)=>rawEdge(i,j)&&!adjacent(i).some(k=>k!==j&&Math.max(Math.abs(k%w-j%w),Math.abs(Math.floor(k/w)-Math.floor(j/w)))===1&&rawEdge(i,k)&&rawEdge(k,j));
 let head=0,tail=0;for(let i=0;i<n;i++)if(roots[i]){visited[i]=1;queue[tail++]=i;}
 while(head<tail){const i=queue[head++];for(const j of adjacent(i))if(!visited[j]&&edge(i,j)){visited[j]=1;parent[j]=i;queue[tail++]=j;}}
 const leaves=[];for(let i=0;i<n;i++)if(visited[i]&&!adjacent(i).some(j=>edge(i,j)))leaves.push(i);leaves.sort((a,b)=>depth[b]*response[b]-depth[a]*response[a]||a-b);
 const traces=[],rejections={};let stamp=0;
 for(const leaf of leaves.slice(0,p.maxTraces)){
  const indices=[];let index=leaf,length=0;while(index>=0&&indices.length<p.maxSteps){if(indices.length){const prev=indices.at(-1);length+=Math.hypot(index%w-prev%w,Math.floor(index/w)-Math.floor(prev/w));}indices.push(index);index=parent[index];}
  indices.reverse();const points=indices.map(i=>({x:i%w,y:Math.floor(i/w)})),graphTip=points.at(-1),tip={...graphTip},root=points[0],reasons=[];if(index>=0)reasons.push('path-budget');if(length<p.minPathLength)reasons.push('short-observed-path');
  const distal=points.slice(-p.distalSamples),axis=distal.length>=2?tangent(distal):null;if(!axis||axis.coherence<p.orientationAgreement)reasons.push('distal-orientation');
  const supportSamples=[];let supportBracket=null;
  if(axis){const at=t=>valley(luma,w,h,graphTip.x+axis.dx*t,graphTip.y+axis.dy*t,axis.dx,axis.dy,p.radii),start=at(0);supportSamples.push({distance:0,response:start});
   if(start===null||start<p.responseFloor)reasons.push('tangent-valley-unconfirmed');
   else{let lo=0,hi=null;for(let t=.25;t<=1;t+=.25){const v=at(t);supportSamples.push({distance:t,response:v});if(v===null){reasons.push('terminal-localization-unavailable');break;}if(v<p.responseFloor){hi=t;break;}lo=t;}
    if(hi===null)reasons.push('terminal-localization-unresolved');else{for(let k=0;k<6;k++){const mid=(lo+hi)/2,v=at(mid);supportSamples.push({distance:mid,response:v});if(v===null){reasons.push('terminal-localization-unavailable');break;}if(v>=p.responseFloor)lo=mid;else hi=mid;}supportBracket={supported:lo,unsupported:hi};tip.x+=axis.dx*lo;tip.y+=axis.dy*lo;}
   }
  }
  const f=lidFrame(upper,lower,tip.x,tip.y),u=((tip.x-frame.origin.x)*frame.axis.x+(tip.y-frame.origin.y)*frame.axis.y)/frame.width;
  if(tip.x<=p.endpointBorder||tip.y<=p.endpointBorder||tip.x>=w-1-p.endpointBorder||tip.y>=h-1-p.endpointBorder)reasons.push('image-boundary');
  if(Math.min(u-p.axisRange[0],p.axisRange[1]-u)*frame.width<=1||frame.width*p.depthRatio+f.distance<=1)reasons.push('domain-boundary');
  const protectedTip=polygonMeasure(tip,polygon),clearance=Math.max(p.minimumClearance,p.relativeClearance*frame.width);if(protectedTip.inside||protectedTip.boundaryDistance<=clearance)reasons.push('protected-or-uncertain-tip');
  const branching=indices.slice(-p.distalSamples).filter(i=>adjacent(i).filter(j=>edge(i,j)).length>1).length;if(branching)reasons.push('distal-branch-ambiguity');
  // Census alternative graph-root associations; censored searches cannot qualify.
  stamp++;let qh=0,qt=1,audited=0;queue[0]=leaf;stamps[leaf]=stamp;const associatedRoots=[];
  while(qh<qt&&audited<p.maxSteps*4){const i=queue[qh++];audited++;if(roots[i])associatedRoots.push({x:i%w,y:Math.floor(i/w)});for(const j of adjacent(i))if(stamps[j]!==stamp&&edge(j,i)){stamps[j]=stamp;queue[qt++]=j;}}
  if(qh<qt)reasons.push('root-census-censored');let rootSpan=0;for(const a of associatedRoots)for(const b of associatedRoots)rootSpan=Math.max(rootSpan,Math.hypot(a.x-b.x,a.y-b.y));
  const contacts=associatedRoots.map(q=>{const f=lidFrame(upper,lower,q.x,q.y);return{x:f.x,y:f.y};});let rootContactSpan=0;for(const a of contacts)for(const b of contacts)rootContactSpan=Math.max(rootContactSpan,Math.hypot(a.x-b.x,a.y-b.y));if(rootContactSpan>p.rootAmbiguityRadius)reasons.push('multiple-root-associations');
  const forward=axis?p.forwardDistances.map(distance=>({distance,response:valley(luma,w,h,tip.x+axis.dx*distance,tip.y+axis.dy*distance,axis.dx,axis.dy,p.radii)})):[];
  if(forward.some(v=>v.response===null))reasons.push('forward-unavailable');if(forward.some(v=>v.response>=p.responseFloor))reasons.push('forward-support-not-an-ending');
  let width=null;if(axis){const center=sample(luma,w,h,tip.x-axis.dx,tip.y-axis.dy),threshold=response[leaf]*.5,halves=[];for(const sign of [-1,1]){let half=null;for(let r=.25;r<=3;r+=.25){const v=sample(luma,w,h,tip.x-axis.dx-axis.dy*r*sign,tip.y-axis.dy+axis.dx*r*sign);if(v!==null&&v-center>=threshold){half=r;break;}}halves.push(half);}if(halves.every(v=>v!==null))width=halves[0]+halves[1];}if(width===null)reasons.push('width-unresolved');
  const qualified=reasons.length===0;for(const reason of reasons)rejections[reason]=(rejections[reason]||0)+1;
  traces.push({id:traces.length,points,root,graphTip,tip,supportSamples,supportBracket,length,axis,width,meanResponse:indices.reduce((s,i)=>s+response[i],0)/Math.max(1,indices.length),rootAssociations:associatedRoots.length,rootSpan,rootContactSpan,rootCensusNodes:audited,branching,protectedTip,clearance,forward,reasons,qualifiedObservation:qualified,meaning:'Observed graph attachment/contrast-support boundary, not certified same-strand root, physical free tip or approved Length'});
 }
 return{reason:'offline-observations-only',frame,traces,response,active,roots,connected:visited,diagnostics:{memoryBytes:memoryBytes+thinned.byteLength,rawActivePixels,activePixels:activeCount,rootSeeds:rootCount,connectedPixels:tail,leafCount:leaves.length,tracedLeaves:traces.length,censoredLeaves:Math.max(0,leaves.length-p.maxTraces),qualified:traces.filter(t=>t.qualifiedObservation).length,rejections}};
}
