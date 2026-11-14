/** Offline, enlarged direction hypothesis. NOT imported by the applicator.
 * Numeric floors stay fixed; more axis states still enlarge accepted paths. */
import {lidFrame} from '../../src/retouch/lashAnalysis.mjs';
import {neighbors} from './lash-break-graph.mjs';
export function buildModes(state,w,h,upper,lower,p){
 const n=w*h;if(state.active.length!==n||w>p.maxSide||h>p.maxSide||state.debug.spectra.length!==n*8)throw Error('Bounded spectrum grid');
 const mask=new Uint8Array(n),vx=new Float32Array(n*8),vy=new Float32Array(n*8);let count=0;
 for(let i=0;i<n;i++)if(state.active[i]){
  const f=lidFrame(upper,lower,i%w,Math.floor(i/w));
  for(let k=0;k<8;k++){const response=state.debug.spectra[i*8+k],orth=state.debug.spectra[i*8+(k+4)%8];if(!Number.isFinite(response)||!Number.isFinite(orth))continue;
   const shape=(response-Math.max(0,orth))/Math.max(1e-12,response);let x=Math.cos(k*Math.PI/8),y=Math.sin(k*Math.PI/8);const inward=-(x*f.nx+y*f.ny);
   if(response<p.responseFloor||shape<p.anisotropyFloor||Math.abs(inward)<p.normalProjection)continue;if(inward<0){x=-x;y=-y;}mask[i]|=1<<k;vx[i*8+k]=x;vy[i*8+k]=y;count++;
  }
  const best=state.debug.bestIndex[i];if(!(mask[i]&(1<<best)))throw Error('Winning mode eligibility drift');if(vx[i*8+best]!==state.debug.dx[i]||vy[i*8+best]!==state.debug.dy[i])throw Error('Winning Float32 vector drift');
 }
 return{mask,vx,vy,active:state.active,roots:state.roots,depth:state.debug.depth,spectra:state.debug.spectra,count,typedBytes:mask.byteLength+vx.byteLength+vy.byteLength};
}
export function modeEdge(i,k,j,l,w,m,p){
 if(!(m.mask[i]&(1<<k))||!(m.mask[j]&(1<<l))||m.depth[j]<m.depth[i]-p.depthBacktrack)return false;
 const ox=j%w-i%w,oy=Math.floor(j/w)-Math.floor(i/w),step=Math.hypot(ox,oy);if(!step||Math.max(Math.abs(ox),Math.abs(oy))!==1)return false;
 const a=i*8+k,b=j*8+l;return m.vx[a]*m.vx[b]+m.vy[a]*m.vy[b]>=p.orientationAgreement&&(ox*m.vx[a]+oy*m.vy[a])/step>=p.edgeAlignment&&(ox*m.vx[b]+oy*m.vy[b])/step>=p.edgeAlignment;
}
export function expandReach(m,w,h,p){
 const n=w*h,reached=new Uint8Array(n*8),parent=new Int32Array(n*8).fill(-1),queue=new Uint32Array(n*8),pixels=new Uint8Array(n);let head=0,tail=0;
 for(let i=0;i<n;i++)if(m.roots[i])for(let k=0;k<8;k++)if(m.mask[i]&(1<<k)){const s=i*8+k;reached[s]=1;queue[tail++]=s;pixels[i]=1;}
 while(head<tail){const s=queue[head++],i=Math.floor(s/8),k=s%8;for(const j of neighbors(i,w,h))if(m.active[j])for(let l=0;l<8;l++){const t=j*8+l;if(!reached[t]&&modeEdge(i,k,j,l,w,m,p)){reached[t]=1;parent[t]=s;pixels[j]=1;queue[tail++]=t;}}}
 return{reached,parent,pixels,stateCount:tail,pixelCount:pixels.reduce((n,v)=>n+v,0),typedBytes:m.typedBytes+reached.byteLength+parent.byteLength+queue.byteLength+pixels.byteLength};
}
export function pairSpectrum(i,j,w,h,m,p,reach){
 const pairs=[];for(let k=0;k<8;k++)for(let l=0;l<8;l++)if(modeEdge(i,k,j,l,w,m,p)){
  const previous=[],next=[];for(const a of neighbors(i,w,h))if(a!==j&&m.active[a])for(let q=0;q<8;q++)if(modeEdge(a,q,i,k,w,m,p))previous.push(a*8+q);
  for(const b of neighbors(j,w,h))if(b!==i&&m.active[b])for(let q=0;q<8;q++)if(modeEdge(j,l,b,q,w,m,p))next.push(b*8+q);
  let combinations=0,rootedCombinations=0,first=null,firstRooted=null;for(const a of previous)for(const b of next)if(Math.floor(a/8)!==Math.floor(b/8)){const witness=[a,i*8+k,j*8+l,b];combinations++;if(!first)first=witness;if(reach.reached[a]){rootedCombinations++;if(!firstRooted)firstRooted=witness;}}
  pairs.push({sourceMode:k,targetMode:l,sourceResponse:m.spectra[i*8+k],targetResponse:m.spectra[j*8+l],sourceStateReachable:!!reach.reached[i*8+k],previousStateChoices:previous.length,nextStateChoices:next.length,fourPointCombinations:combinations,rootedFourPointCombinations:rootedCombinations,firstWitness:first,firstRootedWitness:firstRooted});
 }
 return{i,j,pairs,pairCount:pairs.length,localFourPointPairs:pairs.filter(p=>p.fourPointCombinations).length,rootReachablePairs:pairs.filter(p=>p.sourceStateReachable).length,rootedFourPointPairs:pairs.filter(p=>p.rootedFourPointCombinations).length,meaning:'Local and root-state feasibility are separate. More supported modes/witnesses are ambiguity, not probability, fiber ownership or approved Length.'};
}
export function stateRoute(pixel,reach,m,p){
 let target=-1;for(let k=0;k<8;k++)if(reach.reached[pixel*8+k]){target=pixel*8+k;break;}if(target<0)return{status:'NO_EXPANDED_ROOT_STATE_ROUTE',states:[],pixels:[]};
 const states=[];let s=target;while(s>=0&&states.length<p.maxSteps){states.push(s);s=reach.parent[s];}states.reverse();return{status:s>=0?'CENSORED_STATE_ROUTE':'DIAGNOSTIC_ROOT_STATE_ROUTE',states,pixels:states.map(s=>Math.floor(s/8)),censored:s>=0,meaning:'One deterministic consistent state path; inspection uses original maxSteps, not a certified physical root, free tip or unique strand'};
}
