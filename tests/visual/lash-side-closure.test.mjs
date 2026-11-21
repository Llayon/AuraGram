import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSideClosure} from './lash-side-closure.mjs';
import {auditSpatialEnding} from './lash-spatial-ending.mjs';
const grid=f=>Array.from({length:25},(_,y)=>({ahead:-2+y*.25,samples:Array.from({length:25},(_,x)=>({offset:-3+x*.25,point:{x:-3+x*.25,y:-2+y*.25},value:f(-3+x*.25,-2+y*.25)}))}));
const dark=(d)=>.8-.5*Math.exp(-d/.35);
test('rounded observed cap has converging lateral contours with localized uncertainty',()=>{
 const rows=grid((x,y)=>dark(x*x+Math.max(0,y)**2));
 const a=inspectSideClosure(rows);assert.equal(a.status,'closure-candidate');assert.equal(a.endpointConfirmed,false);
 assert.ok(a.tipRegion.ahead[0]>=0&&a.tipRegion.ahead[1]<2);
 assert.ok(a.bands.filter(r=>r.ahead<=-.5).every(r=>r.runs.length===1));
 assert.deepEqual(a,inspectSideClosure(rows));
});
test('continuing shaft and curved continuation have no resolved closed cap',()=>{
 assert.equal(inspectSideClosure(grid(x=>dark(x*x))).status,'continuing');
 const a=inspectSideClosure(grid((x,y)=>dark((x-.12*y*y)**2)));
 assert.notEqual(a.status,'closure-candidate');
});
test('fork with central empty space and intersection refuse contour ownership',()=>{
 const fork=inspectSideClosure(grid((x,y)=>dark(Math.min((x-Math.max(0,y)*.8)**2,(x+Math.max(0,y)*.8)**2))));
 assert.equal(fork.status,'ambiguous');assert.equal(fork.reason,'split-connected-contour');
 const cross=inspectSideClosure(grid((x,y)=>dark(Math.min(x*x,(x-y)**2))));
 assert.equal(cross.status,'ambiguous');
});
test('disconnected continuation across a gap and parallel structure stay ambiguous',()=>{
 const gap=inspectSideClosure(grid((x,y)=>y>.5&&y<1.5?.8:dark(x*x)));
 assert.equal(gap.reason,'detached-support-gap-or-neighbor');
 const parallel=inspectSideClosure(grid((x,y)=>dark(Math.min(x*x,(x-2)**2))));
 assert.notEqual(parallel.status,'closure-candidate');
});
test('incomplete, unavailable or lateral-truncated grids stay censored',()=>{
 assert.equal(inspectSideClosure([]).status,'censored');
 assert.equal(inspectSideClosure(grid(()=>NaN)).status,'censored');
 const a=inspectSideClosure(grid((x,y)=>dark((x-.8*Math.max(0,y))**2)));
 assert.equal(a.status,'censored');
});
test('one-sided edge, weak structure and noise cannot produce contour closure',()=>{
 for(const f of [(x)=>x<0?.3:.8,(x)=>.8-.002*Math.exp(-x*x),(x,y)=>.8+.001*Math.sin(x*7+y*11)]){
 assert.notEqual(inspectSideClosure(grid(f)).status,'closure-candidate');
 }
});
test('pixel-based audit retains side closure evidence without Length permission',()=>{
 const w=48,h=48,luma=Float32Array.from({length:w*h},(_,i)=>{const x=i%w-24,y=24-Math.floor(i/w);return dark(x*x+Math.max(0,y)**2);});
 const a=auditSpatialEnding(luma,w,h,[{x:24,y:28},{x:24,y:26},{x:24,y:24}],{x:0,y:-1},{proximalConnection:true});
 assert.equal(a.endpointConfirmed,false);
 assert.ok(a.profiles.every(p=>p.sideClosure.status==='closure-candidate'));
 assert.deepEqual(a.profiles[0].sideClosure,a.profiles[1].sideClosure);
});

test('linear illumination gradient leaves the measured closure topology unchanged',()=>{
 const a=inspectSideClosure(grid((x,y)=>dark(x*x+Math.max(0,y)**2)));
 const b=inspectSideClosure(grid((x,y)=>dark(x*x+Math.max(0,y)**2)+.01*x+.002*y));
 assert.equal(b.status,'closure-candidate');assert.deepEqual(b.tipRegion,a.tipRegion);
});
test('constant-width photometric fade is indistinguishable from an apparent rounded cap',()=>{
 const cap=grid((x,y)=>.8-.5*Math.exp(-(x*x+Math.max(0,y)**2)/.35));
 const fade=grid((x,y)=>.8-(.5*Math.exp(-(Math.max(0,y)**2)/.35))*Math.exp(-x*x/.35));
 const a=inspectSideClosure(cap),b=inspectSideClosure(fade);
 assert.equal(a.status,'closure-candidate');assert.equal(b.status,'closure-candidate');
 assert.deepEqual(a.tipRegion,b.tipRegion);assert.equal(b.endpointConfirmed,false);
 // A contour closes under a fixed contrast threshold even if the shaft
 // width stays constant and only its contrast fades. Do not promote it.
});
