import test from 'node:test';
import assert from 'node:assert/strict';
import {traceCoarseSeeds,coarseRouteToSource} from './lash-coarse-route.mjs';
import {auditMultiscaleSeeds} from './lash-multiscale-path.mjs';
function fixture(broad=false){
 const w=48,h=64,n=w*h,arrays={ridge:new Uint8Array(n),responseMap:new Float32Array(n),anisotropy:new Float32Array(n),dx:new Float32Array(n),dy:new Float32Array(n),distance:new Float32Array(n),valid:new Uint8Array(n),rootSupport:new Uint8Array(n),normalsX:new Float32Array(n),normalsY:new Float32Array(n)};
 for(let y=10;y<=50;y++){const i=y*w+24;arrays.ridge[i]=200;arrays.responseMap[i]=.1;arrays.anisotropy[i]=1;arrays.dy[i]=-1;arrays.distance[i]=50-y;arrays.valid[i]=1;arrays.normalsY[i]=-1;if(broad&&y>40){arrays.responseMap[i]=0;arrays.dy[i]=0;arrays.rootSupport[i]=1;}}
 return{w,h,bandH:30,seeds:[{rank:0,index:10*w+24,x:24,y:10,tangent:{x:0,y:-1},provenance:'automatic-strong-ridge-before-tip-filter'}],...arrays};
}
test('coarse whole route retains source cell uncertainty instead of becoming a native point trace',()=>{
 const a=traceCoarseSeeds(fixture())[0],b=coarseRouteToSource(a,{x:0,y:0,scaleX:4,scaleY:4});
 assert.equal(a.connected,true);assert.ok((b.points.at(-1).y-b.points[0].y)>36);assert.deepEqual(b.points[0].uncertaintyCell,{width:4,height:4});assert.equal(b.endpointConfirmed,false);
});
test('broad root support is retained as ambiguity, not dropped or granted native ownership',()=>{
 const a=traceCoarseSeeds(fixture(true))[0];assert.equal(a.connected,true);assert.equal(a.broadSupport,true);assert.equal(a.status,'ambiguous');assert.ok(a.points.some(p=>p.support==='broad-root'));
});
test('gap, separated coarse continuations and seed budget refuse without replacement',()=>{
 const a=fixture();a.valid[25*a.w+24]=0;assert.equal(traceCoarseSeeds(a)[0].connected,false);
 const b=fixture();b.valid[11*b.w+24]=0;
 for(const x of [23,25]){const i=11*b.w+x;b.valid[i]=1;b.ridge[i]=200;b.responseMap[i]=.1;b.anisotropy[i]=1;b.dy[i]=-1;b.distance[i]=39;}
 assert.equal(traceCoarseSeeds(b)[0].reason,'multiple-coarse-continuations');
 const c=fixture();c.seeds=Array.from({length:129},(_,rank)=>({...c.seeds[0],rank}));const r=traceCoarseSeeds(c);assert.equal(r.length,129);assert.equal(r[128].reason,'seed-budget');
});
test('full coarse path and local native <=36 arc have independent budgets and unchanged seed identity',()=>{
 const coarse=fixture(true),width=192,height=256;const a=auditMultiscaleSeeds({coarse,width,height,mapping:{x:0,y:0,scaleX:4,scaleY:4},readPatch:(r,t)=>{for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++)t[y*r.w+x]=.8-.5*Math.exp(-((x+r.x-97.5)**2)/.35);}}).results[0];
 assert.equal(a.index,coarse.seeds[0].index);assert.equal(a.coarseProximalConnection,true);assert.equal(a.proximalConnection,false);assert.equal(a.broadRootAmbiguity,true);assert.ok(a.local.points.at(-1).arc<=36);assert.ok(a.coarse.points.at(-1).y-a.coarse.points[0].y>36);assert.equal(a.endpointConfirmed,false);
});

test('native read failure cannot erase independent coarse connection or grant ownership',()=>{
 const coarse=fixture(true),a=auditMultiscaleSeeds({coarse,width:192,height:256,mapping:{x:0,y:0,scaleX:4,scaleY:4},readPatch:()=>{throw Error('Unavailable pixels');}}).results[0];
 assert.equal(a.coarseProximalConnection,true);assert.equal(a.broadRootAmbiguity,true);assert.equal(a.proximalConnection,false);assert.equal(a.status,'censored');assert.equal(a.reason,'source-read-failed');
});
test('native ROI or source boundary preserves explicit censoring',()=>{
 const coarse=fixture(),a=auditMultiscaleSeeds({coarse,width:48,height:64,mapping:{x:0,y:0,scaleX:1,scaleY:1},readPatch:(r,t)=>{for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++)t[y*r.w+x]=.8-.5*Math.exp(-((x+r.x-24)**2)/.35);}}).results[0];
 assert.equal(a.status,'censored');assert.equal(a.endpointConfirmed,false);
});
