import{test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{analyzeNativeShaft}from'./lash-native-shaft.mjs';
import{checkShaftContinuity}from'./lash-native-continuity.mjs';
import{probeAnchor}from'./lash-anchor-probe.mjs';
import{inspectLoss}from'./lash-loss-profiles.mjs';
import{followCurve}from'./lash-curve-probe.mjs';
import{followCurve as followSubpixel}from'./lash-subpixel-probe.mjs';
import{measureCentroid}from'./lash-subpixel-center.mjs';
const protocol=JSON.parse(fs.readFileSync(new URL('./lash-shaft-protocol.json',import.meta.url)));
function fixture(kind){const w=80,h=80,luma=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const center=40-Math.tan(Math.PI/12)*(y-20),gauss=d=>Math.exp(-d*d/(2*.35*.35));
 luma[y*w+x]=kind==='step'?(x<40?.2:.8):kind==='parallel'?.8-.55*Math.max(gauss(x-38.75),gauss(x-41.25)):.8-.55*gauss(x-center);
 if(kind==='gap'&&Math.abs(y-24)<=.5)luma[y*w+x]=.8;
 }return{w,h,luma};}
const path=[{x:40,y:20},{x:40,y:40}];
test('image-derived centers recover a sloped shaft without manual direction input',()=>{
 const f=fixture('line'),a=analyzeNativeShaft(f.luma,f.w,f.h,path,{sx:6,sy:6,protocol});
 for(const c of a.configurations){const fit=c.fits.find(f=>f.window===6);assert.ok(fit.available);assert.ok(Math.abs(fit.angleDegrees-(-75))<4,JSON.stringify(fit));}
});
test('equally strong parallel valleys are unresolved, not selected as one fiber',()=>{
 const f=fixture('parallel'),a=analyzeNativeShaft(f.luma,f.w,f.h,path,{sx:6,sy:6,protocol});
 for(const c of a.configurations){assert.ok(c.rows.every(r=>!r.accepted));assert.ok(c.rows.some(r=>r.reason==='multiple-valleys'));assert.ok(c.fits.every(f=>!f.available));}
});
test('a one-sided intensity step is not a thin dark center',()=>{
 const f=fixture('step'),a=analyzeNativeShaft(f.luma,f.w,f.h,path,{sx:6,sy:6,protocol});
 for(const c of a.configurations)assert.ok(c.fits.every(f=>!f.available));
});
test('missing measured center prevents fitting across an image gap',()=>{
 const f=fixture('gap'),a=analyzeNativeShaft(f.luma,f.w,f.h,path,{sx:6,sy:6,protocol});
 for(const c of a.configurations){assert.equal(c.rows.find(r=>r.distance===4).accepted,false);assert.ok(c.fits.every(f=>!f.available));}
});
test('dense evidence detects an unsampled gap between two valid center rows',()=>{
 const w=80,h=80,luma=Float32Array.from({length:w*h},(_,i)=>{const x=i%w,y=Math.floor(i/w);return y===23?.8:.8-.55*Math.exp(-((x-40)**2)/(2*.35*.35));});
 const a=analyzeNativeShaft(luma,w,h,path,{sx:6,sy:6,protocol}),dense={denseStepNative:.5,radiiNative:[.75,1.5],observationFloor:.006};
 for(const c of a.configurations){const rows=c.rows.filter(r=>r.distance<=6);assert.ok(rows.every(r=>r.accepted));const result=checkShaftContinuity(luma,w,h,rows,dense);assert.equal(result.allSamplesSupported,false);assert.ok(result.samples.some(s=>!s.supported));}
});

const anchorProtocol=JSON.parse(fs.readFileSync(new URL('./lash-anchor-protocol.json',import.meta.url)));
const vertical={available:true,tx:0,ty:-1};
function anchorFixture(gap=false){
 const w=80,h=80,luma=Float32Array.from({length:w*h},(_,i)=>{
  const x=i%w,y=Math.floor(i/w);
  return (y<25 || (gap&&y===29))?.8:.8-.55*Math.exp(-((x-40)**2)/(2*.35*.35));
 });return{w,h,luma};
}
test('observed termination remains UNKNOWN rather than certifying a biological endpoint',()=>{
 const f=anchorFixture(),r=probeAnchor(f.luma,f.w,f.h,{x:40,y:30},{x:40,y:32},vertical,true,anchorProtocol);
 assert.equal(r.associationSupported,true);assert.ok(r.firstUnsupportedNative>0);assert.equal(r.outcome,'UNKNOWN');assert.equal(r.endpointConfirmed,false);
});
test('forward contrast reentry is retained and cannot bypass an intervening gap',()=>{
 const f=anchorFixture(true),r=probeAnchor(f.luma,f.w,f.h,{x:40,y:30},{x:40,y:32},vertical,true,anchorProtocol);
 assert.ok(r.transitions.some(t=>!t.fromSupported&&t.toSupported));assert.equal(r.outcome,'UNKNOWN');
});
test('missing anchor support and cropped kernels both prevent endpoint approval',()=>{
 const f=anchorFixture();
 const r=probeAnchor(f.luma,f.w,f.h,{x:38,y:30},{x:40,y:32},vertical,true,anchorProtocol);
 assert.equal(r.associationSupported,false);assert.equal(r.reason,'unconfirmed-anchor-association');
 const cropped=probeAnchor(f.luma,f.w,f.h,{x:0,y:30},{x:0,y:32},vertical,true,anchorProtocol);
 assert.ok(cropped.association.some(p=>p.unavailable));assert.equal(cropped.outcome,'UNKNOWN');
 assert.equal(cropped.firstUnsupportedNative,null);assert.equal(cropped.firstUnavailableNative,0);
});

const lossProtocol=JSON.parse(fs.readFileSync(new URL('./lash-loss-protocol.json',import.meta.url)));
test('off-axis thin support is retained without declaring a new endpoint',()=>{
 const w=80,h=80,luma=Float32Array.from({length:w*h},(_,i)=>.8-.55*Math.exp(-((i%w-41.1)**2)/(2*.35*.35)));
 const r=inspectLoss(luma,w,h,{x:40,y:30},vertical,3,{sx:6,sy:6,margin:1.5,protocol:lossProtocol,centerProtocol:protocol});
 assert.ok(r.rows.some(p=>p.displacedSupport));assert.equal(r.outcome,'UNKNOWN');assert.equal(r.endpointConfirmed,false);
});
test('one-sided edge near a loss cannot become displaced thin support',()=>{
 const w=80,h=80,luma=Float32Array.from({length:w*h},(_,i)=>i%w<41?.2:.8);
 const r=inspectLoss(luma,w,h,{x:40,y:30},vertical,3,{sx:6,sy:6,margin:1.5,protocol:lossProtocol,centerProtocol:protocol});
 assert.equal(r.displacedSupportRows,0);assert.ok(r.rows.every(p=>!p.accepted));
});
test('missing loss or automatic axis does not initiate a new profile search',()=>{
 for(const [a,loss] of [[{available:false},3],[vertical,null]]){
  const r=inspectLoss(new Float32Array(1),1,1,{x:0,y:0},a,loss,{sx:1,sy:1,margin:1.5,protocol:lossProtocol,centerProtocol:protocol});
  assert.equal(r.available,false);assert.equal(r.rows.length,0);assert.equal(r.endpointConfirmed,false);
 }
});

const curveProtocol=JSON.parse(fs.readFileSync(new URL('./lash-curve-protocol.json',import.meta.url)));
function curveFixture(kind){const w=80,h=80,luma=Float32Array.from({length:w*h},(_,i)=>{
 const x=i%w,y=Math.floor(i/w),g=d=>Math.exp(-d*d/(2*.35*.35));
 if(kind==='gap'&&y===27)return .8;
 const fork=kind==='fork'?Math.max(0,30-y)*.6:0;
 return .8-.55*Math.max(g(x-40-fork),g(x-40+fork));
});return{w,h,luma};}
function runCurve(kind,eligibility={body:true,association:true}){const f=curveFixture(kind);return followCurve(f.luma,f.w,f.h,{x:40,y:34},vertical,eligibility,{margin:1.5,protocol:curveProtocol});}
test('bounded native following retains a straight supported shaft without endpoint approval',()=>{
 const r=runCurve('straight');assert.equal(r.reason,'arc-budget');assert.ok(r.points.at(-1).arc<=12);assert.ok(r.points.length>10);assert.ok(r.attempts.every(a=>a.linkAccepted));assert.equal(r.endpointConfirmed,false);
});
test('a symmetric fork cannot be silently selected as one supported continuation',()=>{
 const r=runCurve('fork');assert.notEqual(r.reason,'arc-budget');assert.ok(r.points.at(-1).y>27);assert.equal(r.outcome,'UNKNOWN');assert.equal(r.attempts.at(-1).linkAccepted,undefined);
});
test('native curve following stops at a gap and never resumes beyond it',()=>{
 const r=runCurve('gap');assert.ok(r.points.at(-1).y>27);assert.notEqual(r.reason,'arc-budget');assert.equal(r.endpointConfirmed,false);
});
test('unconfirmed body or anchor association cannot seed a curve',()=>{
 for(const eligibility of [{body:false,association:true},{body:true,association:false}]){const r=runCurve('straight',eligibility);assert.equal(r.available,false);assert.equal(r.points.length,0);assert.equal(r.attempts.length,0);}
});

const subpixelProtocol=JSON.parse(fs.readFileSync(new URL('./lash-subpixel-component-protocol.json',import.meta.url)));
test('symmetric half-pixel plateau has a centered observation without selecting a neighbor',()=>{
 const w=80,h=80,luma=Float32Array.from({length:w*h},(_,i)=>.8-.55*Math.exp(-((i%w-40.5)**2)/(2*.7*.7)));
 const r=measureCentroid(luma,w,h,{x:40.5,y:34},{x:0,y:-1},1.5,subpixelProtocol);assert.equal(r.accepted,true);assert.ok(Math.abs(r.shift)<1e-10);
});
test('measured initialization corrects a coarse prior while subsequent turns retain their bound',()=>{
 const f=curveFixture('straight'),angle=-65*Math.PI/180,r=followSubpixel(f.luma,f.w,f.h,{x:40,y:34},{available:true,tx:Math.cos(angle),ty:Math.sin(angle)},{body:true,association:true},{margin:1.5,protocol:subpixelProtocol});
 assert.equal(r.reason,'arc-budget');assert.ok(r.initializationCorrectionDegrees>20);assert.ok(r.attempts.filter(a=>a.linkAccepted).every(a=>a.turnDegrees<=15));assert.ok(r.points.at(-1).arc<=12);assert.equal(r.endpointConfirmed,false);
});
test('centroid observation rejects separate dominant valleys and one-sided steps',()=>{
 const w=80,h=80;for(const kind of ['pair','step']){
 const luma=Float32Array.from({length:w*h},(_,i)=>{const x=i%w,g=d=>Math.exp(-d*d/(2*.25*.25));return kind==='step'?(x<40?.2:.8):.8-.55*Math.max(g(x-39),g(x-41));});
 const r=measureCentroid(luma,w,h,{x:40,y:34},{x:0,y:-1},1.5,subpixelProtocol);assert.equal(r.accepted,false);}
});
test('subpixel paths still stop at gaps and a symmetric fork without endpoint approval',()=>{
 for(const kind of ['gap','fork']){const f=curveFixture(kind),r=followSubpixel(f.luma,f.w,f.h,{x:40,y:34},vertical,{body:true,association:true},{margin:1.5,protocol:subpixelProtocol});assert.notEqual(r.reason,'arc-budget');assert.equal(r.endpointConfirmed,false);assert.ok(!r.points.length||r.points.at(-1).y>27);}
});
test('a weaker disconnected neighbor cannot pull the dominant subpixel center',()=>{
 const w=80,h=80;
 for(const slope of [0,.002]){const luma=Float32Array.from({length:w*h},(_,i)=>{const x=i%w;return .8+slope*(x-40)-(x===40?.55:x===42?.1:0);});
 const r=measureCentroid(luma,w,h,{x:40,y:34},{x:0,y:-1},2.5,subpixelProtocol);assert.equal(r.accepted,true);assert.ok(Math.abs(r.shift)<1e-5);assert.ok(r.massComponentRange[1]<2);}
});
