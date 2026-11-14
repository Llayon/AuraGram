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
module.exports={validateCohort};
