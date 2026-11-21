/** Independent pre-tip ROI route audit. Existing eight-neighbor coarse
 * evidence, with an explicit branch refusal and no ready-tip filtering.
 */
export function traceCoarseSeeds({seeds,w,h,ridge,responseMap,anisotropy,dx,dy,distance,valid,rootSupport,normalsX,normalsY,bandH},direction='proximal') {
 const outward=direction==='distal';
 if(!['proximal','distal'].includes(direction))throw Error('Invalid coarse route direction');
 const offsets=[];for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++)if(ox||oy)offsets.push({ox,oy});
 return seeds.map((seed,rank)=>{
  const base={rank:seed.rank,index:seed.index,points:[],connected:false,broadSupport:false,endpointConfirmed:false};
  if(rank>=128)return{...base,status:'censored',reason:'seed-budget'};
  let cur=seed.index;const seen=new Set([cur]),points=[],limit=Math.min(128,Math.floor(bandH*3));let broad=false;
  const finish=(status,reason,connected=false)=>({...base,points,status,reason,connected,broadSupport:broad});
  if(!valid[cur])return finish('ambiguous','invalid-coarse-seed');
  for(let step=0;step<=limit;step++){
   const x=cur%w,y=Math.floor(cur/w),thin=responseMap[cur]>=.006&&anisotropy[cur]>=.5;
   broad||=!thin;
   points.push({x,y,support:thin?'transverse-valley':rootSupport[cur]?'broad-root':'ridge-only',response:responseMap[cur],anisotropy:anisotropy[cur]});
   if(outward&&!thin)return finish('ambiguous','unobserved-distal-valley');
   if(!outward&&distance[cur]<=2)return finish('ambiguous',broad?'coarse-connected-broad-root':'coarse-connected-native-ownership-unverified',true);
   if(step===limit)return finish('censored','coarse-path-budget');
   const candidates=[];
   for(const o of offsets){
    const xx=x+o.ox,yy=y+o.oy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const j=yy*w+xx;
    const faint=responseMap[j]>=.006&&anisotropy[j]>=.5;
    if(!valid[j]||(ridge[j]<25&&!rootSupport[j]&&!faint)||seen.has(j)||(outward?distance[j]<distance[cur]-.15:distance[j]>distance[cur]+.15)||(outward&&!faint))continue;
    const ux=dx[cur]||dy[cur]?dx[cur]:normalsX[cur],uy=dx[cur]||dy[cur]?dy[cur]:normalsY[cur];
    const length=Math.hypot(o.ox,o.oy),align=(outward?1:-1)*(o.ox*ux+o.oy*uy)/length;
    const coherence=dx[j]||dy[j]?Math.abs(dx[j]*ux+dy[j]*uy):1;
    if(align<.25||coherence<.7)continue;
    candidates.push({...o,index:j,score:align+coherence+ridge[j]/510+(outward?distance[j]-distance[cur]:distance[cur]-distance[j])*.3});
   }
   if(!candidates.length)return finish('ambiguous',outward?'unobserved-distal-link':'unobserved-coarse-link');
   const components=[],unused=new Set(candidates);
   while(unused.size){const group=[unused.values().next().value];unused.delete(group[0]);for(let k=0;k<group.length;k++)for(const c of unused)if(Math.abs(c.ox-group[k].ox)<=1&&Math.abs(c.oy-group[k].oy)<=1){group.push(c);unused.delete(c);}components.push(group);}
   if(components.length!==1)return finish('ambiguous','multiple-coarse-continuations');
   let best=candidates[0];for(const c of candidates)if(c.score>best.score)best=c;
   cur=best.index;seen.add(cur);
  }
 });
}

export function coarseRouteToSource(route,mapping) {
 return{...route,coordinateSpace:'original-source-pixel-cells',points:route.points.map(p=>({...p,
  x:mapping.x+(p.x+.5)*mapping.scaleX-.5,y:mapping.y+(p.y+.5)*mapping.scaleY-.5,
  uncertaintyCell:{width:mapping.scaleX,height:mapping.scaleY}})),
  meaning:'Resampled observed ROI cells, not subpixel native centres or same-fiber certification.'};
}
