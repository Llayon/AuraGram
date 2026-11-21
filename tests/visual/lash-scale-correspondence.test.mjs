import test from 'node:test';
import assert from 'node:assert/strict';
import {auditScaleCorrespondence} from './lash-scale-correspondence.mjs';
import {traceCoarseSeeds} from './lash-coarse-route.mjs';
const route=(reason='unobserved-distal-link')=>({reason,points:[0,4,8,12].map(y=>({x:10,y,support:'transverse-valley',uncertaintyCell:{width:4,height:4}}))});
test('agreement across measured cells remains evidence, not ownership permission',()=>{
 const a=auditScaleCorrespondence(route(),[0,1,3,5,7,9].map(y=>({x:10,y})));assert.equal(a.status,'consistent-local-evidence');assert.equal(a.ownershipConfirmed,false);assert.equal(a.endpointConfirmed,false);
});
test('native diversion to a neighboring structure is not silently assigned to an observed cell',()=>{
 const a=auditScaleCorrespondence(route(),[{x:10,y:0},{x:10,y:3},{x:13,y:5}]);assert.equal(a.status,'unconfirmed');assert.equal(a.reason,'outside-observed-distal-cells');
});
test('seed-only evidence, backward progress and coarse branch cannot prove correspondence',()=>{
 assert.equal(auditScaleCorrespondence(route(),[{x:10,y:0}]).reason,'seed-cell-only');
 assert.equal(auditScaleCorrespondence(route(),[{x:10,y:8},{x:10,y:0}]).reason,'reversed-cell-progress');
 assert.equal(auditScaleCorrespondence(route('multiple-coarse-continuations'),[{x:10,y:0},{x:10,y:4}]).reason,'coarse-branch-unresolved');
});
test('distal coarse audit follows only outward thin evidence and retains input seed identity',()=>{
 const w=20,h=20,n=w*h,a={seeds:[{rank:0,index:10*w+10}],w,h,bandH:10};
 for(const key of ['ridge','responseMap','anisotropy','dx','dy','distance','valid','rootSupport','normalsX','normalsY'])a[key]=new Float32Array(n);
 for(let y=4;y<=16;y++){const i=y*w+10;a.valid[i]=1;a.ridge[i]=200;a.responseMap[i]=.1;a.anisotropy[i]=1;a.dy[i]=-1;a.normalsY[i]=-1;a.distance[i]=18-y;}
 const r=traceCoarseSeeds(a,'distal')[0];assert.equal(r.index,a.seeds[0].index);assert.equal(r.points[0].y,10);assert.equal(r.points.at(-1).y,4);assert.equal(r.connected,false);assert.equal(r.reason,'unobserved-distal-link');
});
