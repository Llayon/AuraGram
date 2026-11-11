import{test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{analyzeNativeShaft}from'./lash-native-shaft.mjs';
import{checkShaftContinuity}from'./lash-native-continuity.mjs';
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
