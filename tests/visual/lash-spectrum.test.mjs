import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {traceDownward} from './lash-downward.mjs';
import {buildModes,modeEdge,expandReach,pairSpectrum,stateRoute} from './lash-spectrum.mjs';
const require=createRequire(import.meta.url),{capture}=require('./lash-spectrum-instrument.cjs'),p=JSON.parse(fs.readFileSync(new URL('./lash-downward-protocol.json',import.meta.url))).parameters;
const upper=[{x:0,y:1},{x:7,y:1}],lower=[{x:0,y:1},{x:3.5,y:4},{x:7,y:1}];
function toy(rows,rootNodes=[9]){const n=64,state={active:new Uint8Array(n),roots:new Uint8Array(n),debug:{spectra:new Float64Array(n*8),bestIndex:new Uint8Array(n).fill(255),dx:new Float32Array(n),dy:new Float32Array(n),depth:new Float32Array(n)}};for(let i=0;i<n;i++)state.debug.depth[i]=Math.floor(i/8)-1;
 for(const[i,bins]of rows){state.active[i]=1;state.debug.bestIndex[i]=bins[0];state.debug.dx[i]=Math.cos(bins[0]*Math.PI/8);state.debug.dy[i]=Math.sin(bins[0]*Math.PI/8);for(const[k,bin]of bins.entries())state.debug.spectra[i*8+bin]=k?.08:.1;}
 for(const i of rootNodes)state.roots[i]=1;return{state,m:buildModes(state,8,8,upper,lower,p)};
}
test('full-spectrum capture preserves original fields and records pre-Float32 winner response',async()=>{
 const module=await capture(fs.readFileSync(new URL('./lash-downward.mjs',import.meta.url),'utf8'),'V3'),a=new Float32Array(4096).fill(.8),u=[{x:8,y:16},{x:32,y:16},{x:56,y:16}],l=[{x:8,y:16},{x:32,y:23},{x:56,y:16}];for(let y=14;y<=35;y++)for(let x=0;x<64;x++)a[y*64+x]=.8-.65*Math.exp(-((x-32)**2)/.6);
 const original=traceDownward(a,64,64,u,l,p),b=module.module.traceDownward(a,64,64,u,l,p);for(const k of Object.keys(original))assert.deepEqual(b[k],original[k]);assert.equal(b.debug.spectra.length,4096*8);const i=20*64+32,k=b.debug.bestIndex[i];assert.ok(b.debug.spectra[i*8+k]>=p.responseFloor);assert.equal(Math.fround(b.debug.spectra[i*8+k]),b.response[i]);assert.ok(Number.isNaN(b.debug.spectra[0]));
});
test('supported nonwinning directions restore a consistent four-pixel analytic path without lowering .85',()=>{
 const{m}=toy([[9,[2]],[18,[1,2]],[27,[3,2]],[36,[2]]]),r=expandReach(m,8,8,p),pairs=pairSpectrum(18,27,8,8,m,p,r);assert.equal(modeEdge(18,1,27,3,8,m,p),false);assert.equal(modeEdge(18,2,27,2,8,m,p),true);assert.equal(r.pixels[36],1);assert.ok(pairs.rootedFourPointPairs>0);for(const q of pairs.pairs)if(q.firstWitness)assert.equal(new Set(q.firstWitness.map(s=>Math.floor(s/8))).size,4);
});
test('pairwise direction feasibility cannot teleport between incompatible states within one pixel',()=>{
 const{m}=toy([[9,[1]],[18,[1,3]],[27,[3]]]),r=expandReach(m,8,8,p);assert.equal(modeEdge(9,1,18,1,8,m,p),true);assert.equal(modeEdge(18,3,27,3,8,m,p),true);assert.equal(modeEdge(18,1,18,3,8,m,p),false);assert.equal(r.pixels[27],0);
});
test('local four-point support is explicitly separate from global root-state reach',()=>{
 const{m}=toy([[9,[2]],[18,[1,2]],[27,[3,2]],[36,[2]]],[]),r=expandReach(m,8,8,p),q=pairSpectrum(18,27,8,8,m,p,r);assert.ok(q.localFourPointPairs>0);assert.equal(q.rootedFourPointPairs,0);assert.equal(q.rootReachablePairs,0);assert.equal(r.stateCount,0);
});
test('additional axis states neither invent a gap pixel nor create an automatic root',()=>{
 const{m}=toy([[9,[2]],[27,[2]]]),r=expandReach(m,8,8,p);assert.equal(r.pixels[27],0);assert.equal(r.pixels[18],0);assert.equal(stateRoute(27,r,m,p).status,'NO_EXPANDED_ROOT_STATE_ROUTE');
});
test('unavailable alternate responses are not eligible and original winning vectors are retained',()=>{
 const{state}=toy([[18,[1,2]]],[]);state.debug.spectra[18*8+2]=NaN;const m=buildModes(state,8,8,upper,lower,p);assert.equal(m.mask[18]&(1<<2),0);assert.ok(m.mask[18]&(1<<1));assert.equal(m.vx[18*8+1],state.debug.dx[18]);assert.equal(m.vy[18*8+1],state.debug.dy[18]);
});
test('expanded typed state memory and graph size remain bounded by eight states per pixel',()=>{
 const{m}=toy([[9,[1,2,3]],[18,[1,2,3]]]),r=expandReach(m,8,8,p);assert.ok(r.stateCount<=64*8);assert.ok(r.typedBytes<=64*138);assert.throws(()=>buildModes({active:new Uint8Array(225),debug:{spectra:new Float64Array(225*8)}},225,1,upper,lower,p),/Bounded/);
});
test('state route inspection retains the original step budget and reports censoring',()=>{
 const{m}=toy([[9,[2]],[18,[2]],[27,[2]],[36,[2]]]),r=expandReach(m,8,8,p),path=stateRoute(36,r,m,{...p,maxSteps:2});assert.equal(path.status,'CENSORED_STATE_ROUTE');assert.equal(path.states.length,2);assert.equal(path.censored,true);
});
