import test from 'node:test';
import assert from 'node:assert/strict';
import gate from './lash-spatial-cohort-gate.cjs';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import qualifier from './lash-spatial-qualify.cjs';
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

const byteFixture=()=>{
 const f=fixture(),artifacts=new Map(),hash=b=>createHash('sha256').update(b).digest('hex');
 for(const s of f.sources){
  const a=f.annotations.find(a=>a.file===s.file);
  delete a.frozenSHA256;
  const sourceBytes=Buffer.from('source-fixture:'+s.file),annotationBytes=Buffer.from(JSON.stringify(a));
  s.sha256=hash(sourceBytes);a.frozenSHA256=hash(annotationBytes);
  artifacts.set(s.file,{sourceBytes,annotationBytes});
 }
 return{...f,artifacts};
};
test('byte gate verifies exact source and external frozen annotation digest',()=>{
 const f=byteFixture(),r=gate.verifyCohortArtifacts(f.sources,f.annotations,f.artifacts);
 assert.equal(r.eligible,true);assert.equal(r.integrityVerified,true);assert.equal(r.verified.length,12);
});
test('changed source bytes or frozen annotation bytes fail without metadata changes',()=>{
 const f=byteFixture();f.artifacts.get(f.sources[0].file).sourceBytes[0]^=1;
 f.artifacts.get(f.sources[1].file).annotationBytes[0]^=1;
 const r=gate.verifyCohortArtifacts(f.sources,f.annotations,f.artifacts);
 assert.equal(r.eligible,false);assert.equal(r.integrityVerified,false);
 assert.ok(r.errors.includes('source-digest-mismatch:'+f.sources[0].file));
 assert.ok(r.errors.includes('annotation-digest-mismatch:'+f.sources[1].file));
});
test('valid frozen bytes cannot authorize a different in-memory annotation',()=>{
 const f=byteFixture();f.annotations[0].eyes.left.tips[0].region[0][0]=99;
 const r=gate.verifyCohortArtifacts(f.sources,f.annotations,f.artifacts);
 assert.ok(r.errors.includes('annotation-record-mismatch:'+f.sources[0].file));assert.equal(r.eligible,false);
});
test('missing bytes, duplicate annotations and placeholder hashes fail closed',()=>{
 const f=byteFixture();f.artifacts.delete(f.sources[0].file);f.annotations.push({...f.annotations[1]});f.sources[2].sha256='fixture';
 const r=gate.verifyCohortArtifacts(f.sources,f.annotations,f.artifacts);
 assert.equal(r.eligible,false);assert.ok(r.errors.includes('source-bytes-missing:'+f.sources[0].file));
 assert.ok(r.errors.includes('annotation-not-unique:'+f.sources[1].file));assert.ok(r.errors.includes('source-digest-mismatch:'+f.sources[2].file));
});
test('intact bytes do not bypass metadata qualification or real FaceMesh refusal',()=>{
 const f=byteFixture();f.sources[0].faceMesh.webkit='no_face';
 const r=gate.verifyCohortArtifacts(f.sources,f.annotations,f.artifacts);
 assert.equal(r.integrityVerified,true);assert.equal(r.eligible,false);
 assert.ok(r.metadataErrors.some(e=>e.startsWith('facemesh-ineligible')));
});

function withFiles(run){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lash-qualification-'));
 try{
  const f=byteFixture();
  for(const [file,a]of f.artifacts){fs.writeFileSync(path.join(dir,file),a.sourceBytes);fs.writeFileSync(path.join(dir,file+'.json'),a.annotationBytes);}
  const sources=path.join(dir,'sources.json'),annotations=path.join(dir,'annotations.json');
  fs.writeFileSync(sources,JSON.stringify({sources:f.sources}));
  fs.writeFileSync(annotations,JSON.stringify({annotations:f.annotations,artifacts:f.sources.map(s=>({file:s.file,path:s.file+'.json'}))}));
  run({dir,f,sources,annotations});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('file qualification reads actual artifacts and detects later disk changes',()=>withFiles(({dir,sources,annotations})=>{
 assert.equal(qualifier.qualifyFiles(sources,annotations,dir).eligible,true);
 fs.appendFileSync(path.join(dir,'development0'),'changed');
 assert.equal(qualifier.qualifyFiles(sources,annotations,dir).eligible,false);
}));
test('qualification CLI records refusal and preserves an existing output',()=>withFiles(({dir,sources})=>{
 const output=path.join(dir,'result.json'),args=['tests/visual/lash-spatial-qualify.cjs',sources,'-',dir,output];
 assert.equal(spawnSync(process.execPath,args).status,2);
 const original=fs.readFileSync(output);assert.equal(JSON.parse(original).eligible,false);
 assert.equal(spawnSync(process.execPath,args).status,1);assert.deepEqual(fs.readFileSync(output),original);
}));
test('duplicate artifact entries cannot silently select a convenient annotation',()=>withFiles(({dir,sources,annotations})=>{
 const m=JSON.parse(fs.readFileSync(annotations));m.artifacts.push({...m.artifacts[0]});fs.writeFileSync(annotations,JSON.stringify(m));
 const r=qualifier.qualifyFiles(sources,annotations,dir);
 assert.equal(r.eligible,false);assert.ok(r.readErrors.some(e=>e.code==='DUPLICATE_ARTIFACT'));
}));
