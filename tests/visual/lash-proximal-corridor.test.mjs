import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectProximalCorridor} from './lash-proximal-corridor.mjs';
const w=64,h=64;
const image=f=>Float32Array.from({length:w*h},(_,i)=>f(i%w,Math.floor(i/w)));
const line=image(x=>.8-.5*Math.exp(-((x-32)**2)/.35));
const params={start:{x:32,y:20},tangent:{x:0,y:1},lid:[{x:4,y:30},{x:60,y:30}],lower:[{x:4,y:44},{x:60,y:44}],roi:{x:0,y:0,w,h},budget:20};
const run=(a,p={})=>inspectProximalCorridor(a,w,h,{...params,...p});
test('observed narrow component reaches gate without granting ownership',()=>{
 const a=run(line);assert.equal(a.status,'component-candidate');assert.equal(a.proximalConnection,false);assert.equal(a.endpointConfirmed,false);assert.ok(a.observedAhead<=10);assert.deepEqual(a,run(line));
});
test('no source pixels, clipped ROI and shared budget exhaustion stay censored',()=>{
 assert.equal(run(image(()=>NaN)).status,'censored');assert.equal(run(line,{budget:3}).reason,'shared-arc-budget');
 assert.equal(run(line,{roi:{x:31,y:0,w:2,h}}).reason,'corridor-roi-boundary');
});
test('fork, crossing, parallel neighbor and gap never grant connection',()=>{
 const profiles=[
 image((x,y)=>.8-.5*Math.exp(-Math.min((x-32-Math.max(0,y-23)*.8)**2,(x-32+Math.max(0,y-23)*.8)**2)/.15)),
 image((x,y)=>.8-.5*Math.exp(-Math.min((x-32)**2,(x-32-(y-24))**2)/.15)),
 image(x=>.8-.5*Math.exp(-Math.min((x-32)**2,(x-34)**2)/.15)),
 image((x,y)=>y>=24&&y<=26?.8:.8-.5*Math.exp(-((x-32)**2)/.35)),
 ];
 for(const p of profiles){const a=run(p);assert.notEqual(a.status,'component-candidate');assert.equal(a.proximalConnection,false);}
});
test('dark flat clump, one-sided eyeliner edge, noise and weak support refuse',()=>{
 for(const p of [image(()=>.2),image(x=>x<32?.2:.8),image((x,y)=>.8+.001*Math.sin(x*7+y*3)),image(x=>.8-.002*Math.exp(-((x-32)**2)))])assert.notEqual(run(p).status,'component-candidate');
});
