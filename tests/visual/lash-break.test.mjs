import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {traceDownward} from './lash-downward.mjs';
import {rootReach,routeTo,edgeFacts,unreachedComponents,partitionReferences} from './lash-break-graph.mjs';
const require=createRequire(import.meta.url),{instrument}=require('./lash-break-instrument.cjs'),p=JSON.parse(fs.readFileSync(new URL('./lash-downward-protocol.json',import.meta.url))).parameters;
test('instrumentation observes without changing original traces, arrays or diagnostics',async()=>{
 const source=fs.readFileSync(new URL('./lash-downward.mjs',import.meta.url),'utf8'),m=await instrument(source,'V3'),upper=[{x:8,y:16},{x:32,y:16},{x:56,y:16}],lower=[{x:8,y:16},{x:32,y:23},{x:56,y:16}],a=new Float32Array(4096).fill(.8);
 for(let y=14;y<36;y++)for(let x=0;x<64;x++)a[y*64+x]=.8-.65*Math.exp(-((x-32)**2)/.6);
 const before=a.slice(),original=traceDownward(a,64,64,upper,lower,p),observed=m.module.traceDownward(a,64,64,upper,lower,p);for(const k of Object.keys(original))assert.deepEqual(observed[k],original[k]);assert.deepEqual(a,before);assert.ok(observed.debug.rawEdge);assert.ok(observed.debug.preThinActive.length===4096);
});
test('instrumentation anchor drift fails rather than producing an approximate implementation',async()=>{await assert.rejects(instrument('export const changed=true;','V3'),/anchor drift/);});
test('edge failures preserve simultaneous depth, angle and alignment reasons',()=>{
 const n=9,dx=new Float32Array(n),dy=new Float32Array(n),depth=new Float32Array(n),active=new Uint8Array(n).fill(1);dx[4]=1;dx[7]=-1;depth[4]=2;depth[7]=0;
 const f=edgeFacts(4,7,3,{active,debug:{dx,dy,depth,edge:()=>false}},p);assert.equal(f.rawAllowed,false);assert.ok(f.reasons.includes('depth-backtrack'));assert.ok(f.reasons.includes('orientation-agreement'));assert.ok(f.reasons.includes('source-alignment'));assert.ok(f.reasons.includes('target-alignment'));
});
test('diagnostic routes cannot invent a root or jump an unobserved gap',()=>{
 const active=new Uint8Array(9),roots=new Uint8Array(9);active[0]=active[8]=1;roots[0]=1;const reach=rootReach(active,roots,3,3);assert.equal(reach.reached[8],0);const empty=rootReach(active,new Uint8Array(9),3,3);assert.equal(empty.count,0);
});
test('a failed selected route is not a global disconnection when another strict route exists',()=>{
 const active=new Uint8Array(9),roots=new Uint8Array(9);for(const i of [0,1,3,4])active[i]=1;roots[0]=1;
 const edge=(i,j)=>i===0&&j===3||i===3&&j===4,strict=rootReach(active,roots,3,3,edge),loose=rootReach(active,roots,3,3),debug={dx:new Float32Array(9),dy:new Float32Array(9),depth:new Float32Array(9),edge};
 const r=routeTo(4,loose,strict.reached,3,{active,debug},p);assert.equal(r.status,'ALREADY_STRICTLY_REACHABLE');assert.ok(r.firstFailure);assert.equal(r.firstFrontier,null);
});
test('unreached components exclude roots and strictly reached vertices with deterministic target choice',()=>{
 const active=new Uint8Array(9),roots=new Uint8Array(9),strict=new Uint8Array(9);for(const i of [0,1,3,4,8])active[i]=1;roots[0]=1;strict[0]=strict[3]=1;const loose=rootReach(active,roots,3,3),c=unreachedComponents(active,loose,strict,3,3);assert.equal(c.length,1);assert.equal(c[0].size,3);assert.equal(c[0].minIndex,1);assert.equal(c[0].target,8);
});
test('real ready-photo references are not mislabeled as no-face by filename matching',()=>{
 const {loadInputs}=require('./lash-domain-inputs.cjs'),d=loadInputs(),r=partitionReferences(d.labels,d.runs.map(r=>r.file));assert.equal(r.ready.length,5);assert.equal(r.unavailable.length,3);assert.ok(r.ready.some(l=>l.id==='F2-217-L1'));assert.ok(r.unavailable.every(l=>l.file==='pexels-31215869.jpg'));
});
