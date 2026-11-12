import test from 'node:test';
import assert from 'node:assert/strict';
import {eyeFrame,measureDomainPoint,polygonMeasure} from './lash-domain.mjs';
const upper=[{x:0,y:0},{x:50,y:-5},{x:100,y:0}],lower=[{x:0,y:0},{x:50,y:5},{x:100,y:0}];
const options={axisRange:[.1,.9],depthRatios:[.25,.5],minimumClearance:2,relativeClearance:.005};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('domain audit never admits predicted opening or its boundary into below probe',()=>{
 for(const p of [{x:50,y:0},{x:50,y:5},{x:50,y:6}]){
  const r=measureDomainPoint(p,upper,lower,options);assert.equal(r.clearlyOutside,false);assert.ok(r.belowProbe.every(p=>!p.contains));
 }
});
test('source uncertainty disk touching opening is conservatively unresolved',()=>{
 const p={x:50,y:10};assert.equal(measureDomainPoint(p,upper,lower,{...options,uncertainty:5}).clearlyOutside,false);
 assert.equal(measureDomainPoint(p,upper,lower,{...options,uncertainty:4}).clearlyOutside,true);
});
test('projected down outside opening is a geometric probe, not certified skin or lash',()=>{
 const r=measureDomainPoint({x:50,y:30},upper,lower,options);assert.equal(r.polygon.inside,false);assert.ok(r.nearest.signedDistance<0);assert.equal(r.belowProbe[0].contains,false);assert.equal(r.belowProbe[1].contains,true);assert.equal('isSkin'in r,false);assert.equal('isLash'in r,false);
});
test('native rotation and translation preserve distances, aperture and probe decisions',()=>{
 const angle=1.2,rotate=p=>({x:p.x*Math.cos(angle)-p.y*Math.sin(angle)+321,y:p.x*Math.sin(angle)+p.y*Math.cos(angle)-87}),p={x:43,y:22};
 const a=measureDomainPoint(p,upper,lower,options),b=measureDomainPoint(rotate(p),upper.map(rotate),lower.map(rotate),options);
 close(a.nearest.signedDistance,b.nearest.signedDistance);close(a.polygon.boundaryDistance,b.polygon.boundaryDistance);close(a.axial,b.axial);assert.deepEqual(a.belowProbe,b.belowProbe);close(eyeFrame(upper,lower).apertureMedian,eyeFrame(upper.map(rotate),lower.map(rotate)).apertureMedian);
});
test('scale covariant geometry uses actual native pixels and relative eye width',()=>{
 const scale=p=>({x:p.x*4,y:p.y*4}),p={x:50,y:20},a=measureDomainPoint(p,upper,lower,{...options,minimumClearance:2,uncertainty:3}),b=measureDomainPoint(scale(p),upper.map(scale),lower.map(scale),{...options,minimumClearance:8,uncertainty:12});
 close(a.nearest.distance*4,b.nearest.distance);close(a.clearance*4,b.clearance);close(a.axial,b.axial);assert.deepEqual(a.belowProbe,b.belowProbe);
});
test('corner extrapolation is excluded and outward side is not mislabeled downward',()=>{
 for(const p of [{x:-10,y:20},{x:110,y:20},{x:50,y:-20}])assert.ok(measureDomainPoint(p,upper,lower,options).belowProbe.every(p=>!p.contains));
});
test('degenerate axis fails rather than creating a usable domain',()=>{
 assert.throws(()=>eyeFrame([{x:1,y:1},{x:1,y:1}],lower),/Degenerate/);
 assert.equal(polygonMeasure({x:50,y:0},upper.concat(lower.slice().reverse())).inside,true);
});
test('coincident or crossed lid arcs cannot produce an audited usable domain',()=>{
 const flat=[{x:0,y:0},{x:50,y:0},{x:100,y:0}],crossed=[{x:0,y:0},{x:25,y:5},{x:50,y:-10},{x:75,y:5},{x:100,y:0}];
 assert.equal(eyeFrame(flat,flat).validity.usable,false);
 assert.equal(measureDomainPoint({x:50,y:20},flat,flat,options).clearlyOutside,false);
 assert.equal(eyeFrame(upper,crossed).validity.usable,false);
});
test('critic collinear retracing counterexample is rejected without moving source landmarks',()=>{
 const upper=[{x:0,y:0},{x:40,y:0},{x:60,y:0},{x:40,y:0},{x:100,y:0}],lower=[{x:0,y:0},{x:50,y:10},{x:100,y:0}],before=JSON.stringify({upper,lower});
 const frame=eyeFrame(upper,lower);assert.equal(frame.validity.selfContact,true);assert.equal(frame.validity.usable,false);
 assert.equal(measureDomainPoint({x:50,y:30},upper,lower,options).clearlyOutside,false);assert.equal(JSON.stringify({upper,lower}),before);
});
