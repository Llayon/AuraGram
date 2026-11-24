/** Diagnostics only. No observed component/route is a physical hair claim. */
export function partitionReferences(labels,availableFiles){const known=new Set(availableFiles);return{ready:labels.filter(l=>known.has(l.file)),unavailable:labels.filter(l=>!known.has(l.file))};}
export function neighbors(i,w,h){const x=i%w,y=Math.floor(i/w),out=[];for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const xx=x+ox,yy=y+oy;if((ox||oy)&&xx>=0&&xx<w&&yy>=0&&yy<h)out.push(yy*w+xx);}return out;}
export function rootReach(active,roots,w,h,edge=()=>true){
 const reached=new Uint8Array(active.length),parent=new Int32Array(active.length).fill(-1),distance=new Int32Array(active.length).fill(-1),queue=new Uint32Array(active.length);let head=0,tail=0;
 for(let i=0;i<roots.length;i++)if(roots[i]&&active[i]){reached[i]=1;distance[i]=0;queue[tail++]=i;}
 while(head<tail){const i=queue[head++];for(const j of neighbors(i,w,h))if(active[j]&&!reached[j]&&edge(i,j)){reached[j]=1;parent[j]=i;distance[j]=distance[i]+1;queue[tail++]=j;}}
 return{reached,parent,distance,count:tail};
}
export function edgeFacts(i,j,w,state,p){
 const {active,debug}=state,ox=j%w-i%w,oy=Math.floor(j/w)-Math.floor(i/w),step=Math.hypot(ox,oy),agreement=debug.dx[i]*debug.dx[j]+debug.dy[i]*debug.dy[j],sourceAlignment=(ox*debug.dx[i]+oy*debug.dy[i])/step,targetAlignment=(ox*debug.dx[j]+oy*debug.dy[j])/step,depthChange=debug.depth[j]-debug.depth[i];
 const reasons=[];if(!active[i])reasons.push('source-inactive');if(!active[j])reasons.push('target-inactive');if(debug.depth[j]<debug.depth[i]-p.depthBacktrack)reasons.push('depth-backtrack');if(agreement<p.orientationAgreement)reasons.push('orientation-agreement');if(sourceAlignment<p.edgeAlignment)reasons.push('source-alignment');if(targetAlignment<p.edgeAlignment)reasons.push('target-alignment');
 const rawAllowed=!!active[i]&&!!active[j]&&debug.depth[j]>=debug.depth[i]-p.depthBacktrack&&agreement>=p.orientationAgreement&&sourceAlignment>=p.edgeAlignment&&targetAlignment>=p.edgeAlignment;
 const allowed=debug.edge(i,j);if(rawAllowed&&!allowed)reasons.push('redundant-edge-pruning');return{i,j,depthChange,agreement,sourceAlignment,targetAlignment,rawAllowed,allowed,reasons};
}
export function routeTo(target,loose,strict,w,state,p){
 if(!loose.reached[target])return{target,status:'NO_OBSERVED_UNDIRECTED_ROOT_ROUTE',path:[],firstFailure:null};
 const path=[];for(let i=target;i>=0;i=loose.parent[i])path.push(i);path.reverse();let firstFailure=null,firstFrontier=null;
 for(let k=1;k<path.length;k++){const f=edgeFacts(path[k-1],path[k],w,state,p);if(!f.allowed&&!firstFailure)firstFailure={step:k,...f};if(strict[f.i]&&!strict[f.j]&&!firstFrontier)firstFrontier={step:k,...f};}
 return{target,status:strict[target]?'ALREADY_STRICTLY_REACHABLE':'DIAGNOSTIC_ROUTE_ONLY',path,firstFailure,firstFrontier,meaning:'Shortest automatic-root8-neighbor route with deterministic ties. First failure and first strict-frontier exit are route-specific, not unique cuts or physical fiber breaks.'};
}
export function unreachedComponents(active,loose,strict,w,h){
 const seen=new Uint8Array(active.length),queue=new Uint32Array(active.length),components=[];
 for(let seed=0;seed<active.length;seed++)if(active[seed]&&loose.reached[seed]&&!strict[seed]&&!seen[seed]){let head=0,tail=1,minIndex=seed,target=seed;queue[0]=seed;seen[seed]=1;
  while(head<tail){const i=queue[head++];minIndex=Math.min(minIndex,i);if(loose.distance[i]>loose.distance[target]||loose.distance[i]===loose.distance[target]&&i<target)target=i;for(const j of neighbors(i,w,h))if(active[j]&&loose.reached[j]&&!strict[j]&&!seen[j]){seen[j]=1;queue[tail++]=j;}}
  components.push({size:tail,minIndex,target,rootDistanceSteps:loose.distance[target]});
 }return components.sort((a,b)=>b.size-a.size||a.minIndex-b.minIndex);
}
