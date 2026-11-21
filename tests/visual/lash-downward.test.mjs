import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {traceDownward} from './lash-downward.mjs';
const p=JSON.parse(fs.readFileSync(new URL('./lash-downward-protocol.json',import.meta.url))).parameters;
const upper=[{x:8,y:16},{x:32,y:16},{x:56,y:16}],lower=[{x:8,y:16},{x:32,y:23},{x:56,y:16}];
function image({end=35,gap=false,horizontal=false}={}){const a=new Float32Array(64*64).fill(.8);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const d=horizontal?Math.abs(y-16):Math.abs(x-(30+.25*(y-16)))/Math.hypot(1,.25),along=horizontal?x>=16&&x<=48:y>=14&&y<=end;if(along&&(!gap||y<24||y>29))a[y*64+x]=.8-.65*Math.exp(-d*d/(2*.55*.55));}return a;}
test('downward prototype is bounded and blank source creates no hypotheses',()=>{
 const a=new Float32Array(4096).fill(.7),r=traceDownward(a,64,64,upper,lower,p);assert.equal(r.diagnostics.activePixels,0);assert.equal(r.traces.length,0);assert.ok(r.diagnostics.memoryBytes<=4096*40);assert.throws(()=>traceDownward(new Float32Array(225*2),225,2,upper,lower,p),/Bounded/);
});
test('observed downward graph attaches near upper arc with measured diagonal orientation',()=>{
 const a=image(),copy=a.slice(),r=traceDownward(a,64,64,upper,lower,p);assert.ok(r.diagnostics.connectedPixels>5);assert.ok(r.traces.some(t=>t.length>8));assert.deepEqual(a,copy);
 for(const t of r.traces){assert.ok(Math.abs(t.root.y-16)<=p.rootRadius);for(let k=0;k<t.points.length;k++){const q=t.points[k];assert.ok(r.response[q.y*64+q.x]>=p.responseFloor);if(k){const a=t.points[k-1];assert.ok(Math.hypot(q.x-a.x,q.y-a.y)<=Math.SQRT2+1e-9);}}if(t.axis&&t.length>8){assert.ok(t.axis.dy>0);assert.ok(t.axis.dx>0);}}
});
test('visible gap cannot acquire graph root attachment by invented connecting pixels',()=>{
 const r=traceDownward(image({gap:true}),64,64,upper,lower,p);for(const t of r.traces)assert.ok(t.points.every(q=>q.y<27),'unobserved gap must not be jumped');
});
test('lid-parallel liner cannot become a long downward candidate',()=>{
 const r=traceDownward(image({horizontal:true}),64,64,upper,lower,p);assert.ok(!r.traces.some(t=>t.qualifiedObservation));assert.ok(!r.traces.some(t=>t.tip.y>23));
});
test('tip inside predicted opening remains disqualified even with root evidence',()=>{
 const r=traceDownward(image({end:20}),64,64,upper,lower,p);assert.ok(r.diagnostics.connectedPixels>0);assert.ok(!r.traces.some(t=>t.qualifiedObservation));for(const t of r.traces)if(t.protectedTip.inside)assert.ok(t.reasons.includes('protected-or-uncertain-tip'));
});
test('a continuing structure reaching probe budget is not a free endpoint',()=>{
 const r=traceDownward(image({end:60}),64,64,upper,lower,p);assert.ok(r.traces.some(t=>t.length>8));assert.ok(!r.traces.some(t=>t.qualifiedObservation));assert.ok(r.traces.some(t=>t.reasons.includes('domain-boundary')||t.reasons.includes('forward-support-not-an-ending')));
});
test('all observed hypotheses are deterministic for identical pixels and geometry',()=>{
 const a=image();assert.deepEqual(traceDownward(a,64,64,upper,lower,p).traces,traceDownward(a,64,64,upper,lower,p).traces);
});
test('critic single-root-zone samples are not mistaken for different arc attachment positions',()=>{
 const a=new Float32Array(4096).fill(.8);for(let y=14;y<=35;y++)for(let x=0;x<64;x++)a[y*64+x]=.8-.65*Math.exp(-((x-32)**2)/(2*.55*.55));
 const r=traceDownward(a,64,64,upper,lower,p),long=r.traces.filter(t=>t.length>8);assert.ok(long.length>0);for(const t of long){assert.equal(t.rootContactSpan,0);assert.ok(t.rootAssociations>1);assert.ok(!t.reasons.includes('multiple-root-associations'));assert.equal(t.branching,0);}
});
test('declared tapered-strand phase family includes qualified observations without changing forward floor',()=>{
 const outcomes=[];for(let k=0;k<8;k++){const end=32.125+k*.125,a=new Float32Array(4096).fill(.8);for(let y=14;y<64;y++)for(let x=0;x<64;x++){const amplitude=.65*Math.max(0,Math.min(1,(end-y)/3));a[y*64+x]=.8-amplitude*Math.exp(-((x-32)**2)/(2*.55*.55));}const r=traceDownward(a,64,64,upper,lower,p);outcomes.push({end,qualified:r.traces.filter(t=>t.qualifiedObservation).map(t=>({tip:t.tip,forward:t.forward}))});}
 assert.ok(outcomes.some(r=>r.qualified.length>0),'single tapered analytic strand must not always abstain');for(const r of outcomes)for(const t of r.qualified){assert.ok(Math.abs(t.tip.y-r.end)<=1.5);assert.ok(t.forward.every(v=>v.response!==null&&v.response<p.responseFloor));}
 console.log('Tapered analytic phases '+JSON.stringify(outcomes));
});
test('unavailable forward kernels at an image crop are unknown rather than empty space',()=>{
 const a=image({end:60}).slice(0,64*32),r=traceDownward(a,64,32,upper,lower,p);assert.ok(r.traces.some(t=>t.forward.some(v=>v.response===null)));
 for(const t of r.traces.filter(t=>t.forward.some(v=>v.response===null))){assert.ok(t.reasons.includes('forward-unavailable'));assert.equal(t.qualifiedObservation,false);}
});
