'use strict';
// Qualification gate only. Annotation coordinates are never tracing inputs.
function validateCohort(sources, annotations){
 const errors=[], ids=new Set(), identities=new Map();
 for(const s of sources){
 if(ids.has(s.file))errors.push('duplicate-source:'+s.file);ids.add(s.file);
 if(!['development','validation'].includes(s.split))errors.push('invalid-split:'+s.file);
 if(!s.identityGroup)errors.push('identity-unreviewed:'+s.file);
 else if(identities.has(s.identityGroup)&&identities.get(s.identityGroup)!==s.split)errors.push('identity-leakage:'+s.identityGroup);
 else identities.set(s.identityGroup,s.split);
 if(!s.sha256||s.status!=='downloaded')errors.push('missing-source:'+s.file);
 const a=annotations.find(a=>a.file===s.file);
 if(!a?.originalOnly||!a?.reviewer||!a?.frozenSHA256)errors.push('annotation-unfrozen:'+s.file);
 if(a?.role==='positive'){
 for(const engine of ['chromium','webkit'])if(s.faceMesh?.[engine]!=='ready')errors.push('facemesh-ineligible:'+engine+':'+s.file);
 const evaluated=a.evaluatedEyes??['left','right'];
 if(!Array.isArray(evaluated)||!evaluated.length||new Set(evaluated).size!==evaluated.length||evaluated.some(side=>!['left','right'].includes(side)))errors.push('invalid-evaluated-eyes:'+s.file);
 const selected=Array.isArray(evaluated)?evaluated.filter(side=>['left','right'].includes(side)):[];
 for(const side of ['left','right'].filter(side=>!selected.includes(side)))if(!a.excludedEyes?.[side]?.trim())errors.push('unexplained-eye-exclusion:'+s.file+':'+side);
 for(const side of selected){
 const eye=a.eyes?.[side];
 if(!eye||eye.tips?.length<5||!eye.tips)errors.push('insufficient-tips:'+s.file+':'+side);
 if(!eye?.tips?.every(t=>t.region?.length>=3&&t.directionRange?.length===2&&t.observedPath?.length>=2))errors.push('incomplete-tip-label:'+s.file+':'+side);
 }
 }
 }
 for(const split of ['development','validation']){
 const members=sources.filter(s=>s.split===split);
 if(members.length!==6)errors.push('requires-six:'+split);
 for(const [role,count] of [['positive',4],['hard',2]])if(members.filter(s=>annotations.find(a=>a.file===s.file)?.role===role).length!==count)errors.push('role-quota:'+split+':'+role);
 }
 return{eligible:errors.length===0,errors};
}
// Separate byte-integrity gate. Artifacts are caller-supplied local bytes; this
// function performs no filesystem/network access and never initializes tracing.
// Each annotation artifact contains exactly the annotation record without its
// frozenSHA256 field (the digest belongs in the external manifest).
function verifyCohortArtifacts(sources, annotations, artifacts){
 const {createHash}=require('node:crypto');
 const {isDeepStrictEqual}=require('node:util');
 const errors=[], verified=[];
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
 const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 const counts=new Map();
 for(const a of annotations)counts.set(a.file,(counts.get(a.file)||0)+1);
 for(const s of sources){
  const before=errors.length,a=annotations.find(a=>a.file===s.file),artifact=artifacts?.get(s.file);
  if(counts.get(s.file)!==1)errors.push('annotation-not-unique:'+s.file);
  if(!Buffer.isBuffer(artifact?.sourceBytes))errors.push('source-bytes-missing:'+s.file);
  else if(!validHash(s.sha256)||digest(artifact.sourceBytes)!==s.sha256)errors.push('source-digest-mismatch:'+s.file);
  if(!Buffer.isBuffer(artifact?.annotationBytes))errors.push('annotation-bytes-missing:'+s.file);
  else {
   if(!validHash(a?.frozenSHA256)||digest(artifact.annotationBytes)!==a.frozenSHA256)errors.push('annotation-digest-mismatch:'+s.file);
   try {
    const stored=JSON.parse(artifact.annotationBytes.toString('utf8'));
    const {frozenSHA256,...record}=a||{};
    if(!isDeepStrictEqual(stored,record))errors.push('annotation-record-mismatch:'+s.file);
   }catch{errors.push('annotation-json-invalid:'+s.file);}
  }
  if(errors.length===before)verified.push(s.file);
 }
 const metadata=validateCohort(sources,annotations);
 return{integrityVerified:errors.length===0&&sources.length>0,
  eligible:errors.length===0&&metadata.eligible,errors,metadataErrors:metadata.errors,verified};
}
module.exports={validateCohort,verifyCohortArtifacts};
