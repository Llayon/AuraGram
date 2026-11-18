import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeNativeCell} from './lash-native-cell.mjs';
import {auditNativeSeeds,NATIVE_PATH_PROTOCOL} from './lash-native-path.mjs';
import {followCurve} from './lash-subpixel-probe.mjs';
const w=80,h=80,point={x:40,y:40},axis={x:0,y:-1};
const image=f=>Float32Array.from({length:w*h},(_,i)=>f(i%w,Math.floor(i/w)));
const init=(a,cell={w:4,h:4},p=point,u=axis)=>initializeNativeCell(a,w,h,p,u,cell,NATIVE_PATH_PROTOCOL);
const line=shift=>image(x=>.8-.5*Math.exp(-((x-40-shift)**2)/.15));
test('native cell recovers a single displaced shaft without moving outside its cell',()=>{
 const a=init(line(1));assert.equal(a.accepted,true);assert.ok(Math.abs(a.center.x-41)<.05);assert.equal(a.center.y,40);
 assert.equal(init(line(1.25),{w:1,h:1}).accepted,false);
 assert.deepEqual(a,init(line(1)));
});
test('two supported cell lobes reject even a weaker competing neighbor',()=>{
 for(const second of [.5,.05]){
 const a=init(image(x=>.8-.5*Math.exp(-((x-39)**2)/.1)-second*Math.exp(-((x-41)**2)/.1)));
 assert.equal(a.accepted,false);assert.match(a.reason,/multiple/);
 }
});
test('missing crop, outside-cell peak, step edge and low signal refuse',()=>{
 assert.equal(init(line(0),{w:4,h:4},{x:1,y:40}).reason,'crop-boundary');
 assert.equal(init(line(3)).accepted,false);
 assert.equal(init(image(x=>x<40?.3:.8)).accepted,false);
 assert.equal(init(image(()=>.8)).accepted,false);
});
test('diagonal anisotropic cell constrains both native coordinates',()=>{
 const u={x:Math.SQRT1_2,y:-Math.SQRT1_2},a=image((x,y)=>.8-.5*Math.exp(-Math.pow(((x-40)+(y-40))/Math.SQRT2-.5,2)/.15));
 const r=init(a,{w:2,h:6},point,u);assert.equal(r.accepted,true);assert.ok(Math.abs(r.center.x-40)<1);assert.ok(Math.abs(r.center.y-40)<3);
});
test('cell initialization changes only opt-in start, keeps seed identity and root evidence policy',()=>{
 const pixels=line(1.25),seed={rank:0,index:99,x:40,y:40,tangent:axis,nativeCell:{w:4,h:4},provenance:'automatic-strong-ridge-before-tip-filter'};
 const args={width:w,height:h,seeds:[seed],roi:{x:0,y:0,w,h},lid:[{x:4,y:56},{x:76,y:56}],lower:[{x:4,y:69},{x:76,y:69}],readPatch:(r,t)=>{for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++)t[y*r.w+x]=pixels[(y+r.y)*w+x+r.x];}};
 const old=auditNativeSeeds(args).results[0],next=auditNativeSeeds({...args,initializeCell:true}).results[0];
 assert.equal(old.proximalConnection,false);assert.equal(next.proximalConnection,true);assert.equal(next.endpointConfirmed,false);assert.equal(next.index,99);assert.deepEqual(next.seed,{x:40,y:40});
 assert.ok(next.proximal.points.at(-1).arc+next.distal.points.at(-1).arc<=36);
});

test('a broad cell center cannot bypass missing narrow native shaft evidence',()=>{
 const pixels=image(x=>.8-.04*Math.exp(-((x-40)**2)/50));
 const center=init(pixels,{w:8,h:8});
 assert.equal(center.accepted,true);
 const curve=followCurve(pixels,w,h,center.center,{available:true,tx:axis.x,ty:axis.y},
  {body:true,association:true},{margin:1.5,protocol:NATIVE_PATH_PROTOCOL});
 assert.equal(curve.reason,'bootstrap-weak-valley');
 assert.equal(curve.points.length,0);assert.equal(curve.endpointConfirmed,false);
 assert.equal(curve.bootstrap[0].accepted,false);
});

test('opt-in exact cell bound does not discard an interior center by grid rounding',()=>{
 const pixels=line(2.05),cell={w:4.2,h:4};
 const old=init(pixels,cell),next=initializeNativeCell(pixels,w,h,point,axis,cell,NATIVE_PATH_PROTOCOL,{geometricCenterBound:true});
 assert.equal(old.accepted,false);assert.equal(old.reason,'search-boundary');
 assert.equal(next.accepted,true);assert.ok(next.center.x>42&&next.center.x<42.1);
 assert.deepEqual(next.profile,old.profile);assert.equal(next.shift,old.shift);
 assert.equal(next.searchHalfNative,2);assert.equal(next.centerBoundNative,2.1);
});
test('exact geometric bound still rejects an observed center outside the original cell',()=>{
 for(const shift of [2.5,-2.5]){
 const r=initializeNativeCell(line(shift),w,h,point,axis,{w:4.2,h:4},NATIVE_PATH_PROTOCOL,{geometricCenterBound:true});
 assert.equal(r.accepted,false);assert.equal(r.reason,'search-boundary');
 }
});
test('opt-in exact bound retains multiple-lobe and one-sided edge refusals',()=>{
 for(const pixels of [image(x=>x<40?.3:.8),image(x=>.8-.5*Math.exp(-((x-39)**2)/.1)-.1*Math.exp(-((x-41)**2)/.1))]){
 const r=initializeNativeCell(pixels,w,h,point,axis,{w:4.2,h:4},NATIVE_PATH_PROTOCOL,{geometricCenterBound:true});
 assert.equal(r.accepted,false);
 }
});
test('anisotropic exact bounds preserve sample positions and keep accepted centers in the rectangle',()=>{
 let accepted=0;
 for(const angle of [-Math.PI/2,-Math.PI/4,0])for(const shift of [-2,-1,0,1,2]){
 const u={x:Math.cos(angle),y:Math.sin(angle)},cell={w:2.1,h:6};
 const pixels=image((x,y)=>.8-.5*Math.exp(-((-(x-40)*u.y+(y-40)*u.x-shift)**2)/.3));
 const old=init(pixels,cell,point,u),next=initializeNativeCell(pixels,w,h,point,u,cell,NATIVE_PATH_PROTOCOL,{geometricCenterBound:true});
 assert.deepEqual(old.profile,next.profile);
 if(next.accepted){accepted++;assert.ok(Math.abs(next.center.x-40)<cell.w/2);assert.ok(Math.abs(next.center.y-40)<cell.h/2);}
 }
 assert.ok(accepted>0);
});
