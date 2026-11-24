import test from 'node:test';
import assert from 'node:assert/strict';
import {followCurve} from './lash-subpixel-probe.mjs';
import {NATIVE_PATH_PROTOCOL as protocol} from './lash-native-path.mjs';
const w=96,h=96,seed={x:48,y:50},axis={available:true,tx:0,ty:-1};
const image=f=>Float32Array.from({length:w*h},(_,i)=>f(i%w,Math.floor(i/w)));
const run=a=>followCurve(a,w,h,seed,axis,{body:true,association:true},{margin:1.5,protocol,denseAxis:'measured-tangent'});
test('fixed measured tangent retains a continuous observed shaft under the original budget',()=>{
 const a=image(x=>.8-.5*Math.exp(-((x-48)**2)/.35)),r=run(a);
 assert.ok(['arc-budget','step-budget'].includes(r.reason));assert.ok(r.points.at(-1).arc<=36);assert.ok(r.points.at(-1).arc>35);
 assert.equal(r.endpointConfirmed,false);assert.deepEqual(r,run(a));
 assert.ok(r.attempts.every(a=>a.dense?.every(s=>s.supported)));
});
test('measured tangent never resumes beyond an observed gap',()=>{
 const r=run(image((x,y)=>y>43&&y<47?.8:.8-.5*Math.exp(-((x-48)**2)/.35)));
 assert.ok(r.points.length>1);assert.ok(r.points.every(p=>p.y>43));
 assert.ok(!['arc-budget','step-budget'].includes(r.reason));assert.equal(r.endpointConfirmed,false);
});
test('symmetric diverging branches do not become a selected continuing shaft',()=>{
 const r=run(image((x,y)=>{const branch=Math.max(0,46-y)*.8,d=Math.min(Math.abs(x-48-branch),Math.abs(x-48+branch));return .8-.5*Math.exp(-(d*d)/.35);}));
 assert.ok(r.points.length>1);assert.ok(r.points.every(p=>p.y>40));
 assert.ok(!['arc-budget','step-budget'].includes(r.reason));assert.equal(r.endpointConfirmed,false);
});
test('weak, one-sided and unavailable observations retain early refusal',()=>{
 for(const a of [image(()=>.8),image(x=>x<48?.3:.8),image(()=>NaN)]){
 const r=run(a);assert.equal(r.points.length,0);assert.equal(r.endpointConfirmed,false);
 }
});
test('unrecognized axis policy is an error, never a favorable fallback',()=>{
 assert.throws(()=>followCurve(image(()=>.8),w,h,seed,axis,{body:true,association:true},{margin:1.5,protocol,denseAxis:'best'}),/Unknown dense-link axis policy/);
});
