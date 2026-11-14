import test from 'node:test';
import assert from 'node:assert/strict';
import gate from './lash-spatial-cohort-gate.cjs';
const fixture=()=>{
 const sources=[],annotations=[];
 for(const split of ['development','validation'])for(let i=0;i<6;i++){
 const file=split+i;
 sources.push({file,split,identityGroup:file,sha256:'fixture',status:'downloaded',faceMesh:{chromium:'ready',webkit:'ready'}});
 const tips=Array.from({length:5},()=>({region:[[0,0],[1,0],[1,1]],directionRange:[-1,1],observedPath:[[0,0],[1,1]]}));
 annotations.push({file,role:i<4?'positive':'hard',originalOnly:true,reviewer:'fixture',frozenSHA256:'fixture',eyes:{left:{tips},right:{tips}}});
 }return{sources,annotations};
};
test('complete independent quota can pass qualification gate',()=>{const f=fixture();assert.equal(gate.validateCohort(f.sources,f.annotations).eligible,true);});
test('cross-split identity and real FaceMesh failure prevent qualification',()=>{
 const f=fixture();f.sources[6].identityGroup=f.sources[0].identityGroup;f.sources[0].faceMesh.webkit='no_face';
 const r=gate.validateCohort(f.sources,f.annotations);assert.equal(r.eligible,false);assert.ok(r.errors.some(e=>e.startsWith('identity-leakage')));assert.ok(r.errors.some(e=>e.startsWith('facemesh-ineligible')));
});
test('missing labels and too few distinguishable tips cannot pass',()=>{
 const f=fixture();f.annotations[0].eyes.left.tips=[];delete f.annotations[1].frozenSHA256;
 assert.equal(gate.validateCohort(f.sources,f.annotations).eligible,false);
});

test('one evaluated eye needs five labels and an explicit reason for excluding the other',()=>{
 const f=fixture();f.annotations[0].evaluatedEyes=['left'];f.annotations[0].excludedEyes={right:'Original-only source review: defocused eye'};f.annotations[0].eyes.right.tips=[];
 assert.equal(gate.validateCohort(f.sources,f.annotations).eligible,true);
 delete f.annotations[0].excludedEyes;assert.equal(gate.validateCohort(f.sources,f.annotations).eligible,false);
});
test('empty evaluated-eye selection or FaceMesh failure cannot be hidden by eye exclusion',()=>{
 const f=fixture();f.annotations[0].evaluatedEyes=[];assert.equal(gate.validateCohort(f.sources,f.annotations).eligible,false);
 f.annotations[0].evaluatedEyes=['left'];f.annotations[0].excludedEyes={right:'Defocused'};f.sources[0].faceMesh.webkit='no_face';
 assert.equal(gate.validateCohort(f.sources,f.annotations).eligible,false);
});
