import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveDistalBodyStart} from './lash-distal-body-start.mjs';
import {auditScaleCorrespondence} from './lash-scale-correspondence.mjs';
const route={status:'ambiguous',reason:'unobserved-distal-link',points:[10,9,8,7].map(y=>({x:5,y,support:'transverse-valley'}))};
const coarse={w:20,dx:new Float32Array(400),dy:new Float32Array(400)};coarse.dy[8*20+5]=-1;
const mapping={x:100,y:200,scaleX:4,scaleY:3};
test('derived origin is exactly the fixed penultimate observed cell with measured local axis',()=>{
 const a=deriveDistalBodyStart(route,coarse,mapping);assert.equal(a.accepted,true);assert.equal(a.routeCellIndex,2);assert.equal(a.roiCell.index,165);assert.deepEqual(a.sourcePoint,{x:121.5,y:225});assert.deepEqual(a.tangent,{x:0,y:-1});assert.equal(a.endpointConfirmed,false);
 assert.deepEqual(route.points.map(p=>p.y),[10,9,8,7]);
});
test('branch, budget, too-short body and missing measured tangent refuse without another origin',()=>{
 assert.equal(deriveDistalBodyStart({...route,reason:'multiple-coarse-continuations'},coarse,mapping).accepted,false);
 assert.equal(deriveDistalBodyStart({...route,status:'censored'},coarse,mapping).status,'censored');
 assert.equal(deriveDistalBodyStart({...route,points:route.points.slice(0,2)},coarse,mapping).accepted,false);
 const blank={...coarse,dy:new Float32Array(400)};assert.equal(deriveDistalBodyStart(route,blank,mapping).reason,'unmeasured-distal-cell-tangent');
});
test('correspondence requires progress beyond derived cell, not merely beyond original seed',()=>{
 const r={reason:'unobserved-distal-link',points:[0,4,8,12].map(y=>({x:10,y,support:'transverse-valley',uncertaintyCell:{width:4,height:4}}))};
 assert.equal(auditScaleCorrespondence(r,[{x:10,y:8},{x:10,y:9}],{startCellIndex:2}).reason,'seed-cell-only');
 assert.equal(auditScaleCorrespondence(r,[{x:10,y:8},{x:10,y:12}],{startCellIndex:2}).status,'consistent-local-evidence');
});

import {auditMultiscaleSeeds} from './lash-multiscale-path.mjs';
test('native refusal at derived origin makes one read and never falls back to original seed',()=>{
 const w=20,h=20,n=w*h,a={seeds:[{rank:0,index:250,x:10,y:12,tangent:{x:0,y:-1},provenance:'automatic-strong-ridge-before-tip-filter'}],w,h,bandH:10};
 for(const key of ['ridge','responseMap','anisotropy','dx','dy','distance','valid','rootSupport','normalsX','normalsY'])a[key]=new Float32Array(n);
 for(let y=4;y<=16;y++){const i=y*w+10;a.valid[i]=1;a.ridge[i]=200;a.responseMap[i]=.1;a.anisotropy[i]=1;a.dy[i]=-1;a.normalsY[i]=-1;a.distance[i]=18-y;}
 let reads=0;const r=auditMultiscaleSeeds({coarse:a,mapping:{x:0,y:0,scaleX:4,scaleY:4},width:80,height:80,distalBodyStart:true,readPatch:(_,t)=>{reads++;t.fill(.8);}}).results[0];
 assert.equal(reads,1);assert.equal(r.index,250);assert.equal(r.seed.y,49.5);assert.equal(r.localStart.roiCell.index,110);assert.equal(r.localStart.sourcePoint.y,21.5);assert.equal(r.initialization.accepted,false);assert.equal(r.local,undefined);assert.equal(r.endpointConfirmed,false);
});
