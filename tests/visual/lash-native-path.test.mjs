import test from 'node:test';
import assert from 'node:assert/strict';
import {auditNativeSeeds,projectAutomaticSeeds} from './lash-native-path.mjs';
const w=96,h=96;
const seed={rank:0,index:4848,x:48,y:50,tangent:{x:0,y:-1},provenance:'automatic-strong-ridge-before-tip-filter'};
const image=f=>Float32Array.from({length:w*h},(_,i)=>f(i%w,Math.floor(i/w)));
const line=image(x=>.8-.5*Math.exp(-((x-48)**2)/.35));
function run(pixels,seeds=[seed],extra={}){
 const buffers=[];let reads=0;
 const a=auditNativeSeeds({width:w,height:h,seeds,roi:{x:0,y:0,w,h},lid:[{x:8,y:70},{x:88,y:70}],lower:[{x:8,y:84},{x:88,y:84}],readPatch:(r,target)=>{reads++;buffers.push(target.buffer);for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++)target[y*r.w+x]=pixels[(y+r.y)*w+x+r.x];},...extra});
 return{...a,buffers,reads};
}
test('native observed proximal connection is retained, 36px budget never grants a tip',()=>{
 const a=run(line),r=a.results[0];assert.equal(r.proximalConnection,true);assert.equal(r.status,'censored');assert.equal(r.endpointConfirmed,false);
 assert.ok(r.proximal.points.at(-1).arc+r.distal.points.at(-1).arc<=36);
 assert.deepEqual(a,run(line));assert.equal(a.workingBufferBytes,256*256*4);
});
test('missing observed proximal support refuses association despite geometric proximity',()=>{
 const pixels=image((x,y)=>.8-(y<56?.5*Math.exp(-((x-48)**2)/.35):0));
 const r=run(pixels).results[0];assert.equal(r.proximalConnection,false);assert.notEqual(r.status,'terminal');assert.ok(r.reasons.includes('unconfirmed-proximal-path'));
});
test('one native buffer is reused and exhausted seed budget never backfills',()=>{
 const seeds=Array.from({length:129},(_,rank)=>({...seed,rank,x:NaN}));
 const a=run(line,seeds);assert.equal(a.results.length,129);assert.equal(a.reads,0);assert.equal(a.results[128].reasons[0],'seed-budget');
 const b=run(line,[seed,{...seed,rank:1}]);assert.equal(b.buffers[0],b.buffers[1]);
});
test('unavailable source measurements and clipped ROI remain censored',()=>{
 assert.equal(run(image(()=>NaN)).results[0].status,'censored');
 const r=run(line,[seed],{roi:{x:40,y:48,w:16,h:6}}).results[0];assert.equal(r.status,'censored');assert.equal(r.proximalConnection,false);
});
test('automatic seed projection retains rank, identity and pixel centres',()=>{
 const audit={coordinateSpace:'analysis-roi',seeds:[seed]};
 const [p]=projectAutomaticSeeds(audit,{x:100,y:200,scaleX:2,scaleY:3});
 assert.equal(p.x,196.5);assert.equal(p.y,351);assert.equal(p.rank,0);assert.equal(p.index,seed.index);
 assert.throws(()=>projectAutomaticSeeds(audit,{x:0,y:0,scaleX:.5,scaleY:1}));
});

test('fork, crossing and parallel structures preserve refusal',()=>{
 const profiles={
 fork:(x,y)=>Math.min(Math.abs(x-48-Math.max(0,48-y)*.5),Math.abs(x-48+Math.max(0,48-y)*.5)),
 crossing:(x,y)=>Math.min(Math.abs(x-48),Math.abs(x-48-(y-44))),
 parallel:x=>Math.min(Math.abs(x-48),Math.abs(x-50)),
 };
 for(const [name,distance]of Object.entries(profiles)){
 const a=run(image((x,y)=>.8-.5*Math.exp(-(distance(x,y)**2)/.35))).results[0];
 assert.equal(a.endpointConfirmed,false,name);assert.notEqual(a.status,'terminal',name);
 const expected={fork:'multiple-valleys',crossing:'multiple-supported-bands',parallel:'bootstrap-one-sided-edge'};
 assert.ok(a.reasons.includes(expected[name]),name+': '+a.reasons);
 }
});
test('step edge, weak shaft and flat noise cannot establish proximal connection',()=>{
 const profiles=[image(x=>x<48?.3:.8),image(x=>.8-.002*Math.exp(-((x-48)**2)/.35)),image((x,y)=>.8+.001*Math.sin(x*7+y*11))];
 for(const a of profiles){const r=run(a).results[0];assert.equal(r.proximalConnection,false);assert.equal(r.endpointConfirmed,false);}
});

test('curved continuing shaft and weak ending never become terminal on trace stop',()=>{
 const curved=image((x,y)=>.8-.5*Math.exp(-((x-48-.004*(y-50)**2)**2)/.35));
 const weakEnd=image((x,y)=>.8-.5*Math.max(0,Math.min(1,(y-38)/5))*Math.exp(-((x-48)**2)/.35));
 for(const pixels of [curved,weakEnd]){const r=run(pixels).results[0];assert.ok(r.path.length>2);assert.notEqual(r.status,'terminal');assert.equal(r.endpointConfirmed,false);}
});

import {analyzeLuma} from '../../src/retouch/lashAnalysis.mjs';
test('automatic seeds before tip filtering can reach native stage without annotation input',()=>{
 const lid=[{x:8,y:70},{x:88,y:70}],lower=[{x:8,y:84},{x:88,y:84}];
 const a=analyzeLuma(line,w,h,lid,lower,28,{x:8,y:70},[],{structureAudit:true});
 assert.ok(a.structureAudit.seeds.length>0);
 const seeds=projectAutomaticSeeds(a.structureAudit,{x:0,y:0,scaleX:1,scaleY:1});
 const r=run(line,seeds.slice(0,2));
 assert.equal(r.results.length,2);
 for(let i=0;i<2;i++){assert.equal(r.results[i].index,a.structureAudit.seeds[i].index);assert.equal(r.results[i].provenance,'automatic-strong-ridge-before-tip-filter');}
});
