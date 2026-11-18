// Paired development-run invariants; no labels or candidate selection.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const [beforeDir,defaultDir,exactDir,out,repeatDir]=process.argv.slice(2);
if(!out||fs.existsSync(out))throw Error('Supply before/default/exact runs and NEW summary');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>k!=='analysisMs').map(([k,x])=>[k,clean(x)])):v;
const result={kind:'paired-cell-boundary-development-diagnostic',labelsUsed:false,engines:{}};
for(const engine of ['chromium','webkit']){
 const files=[beforeDir,defaultDir,exactDir].map(d=>path.join(d,engine+'.json'));
 const [before,old,next]=files.map(f=>JSON.parse(fs.readFileSync(f)));
 let repeat;
 if(repeatDir){const file=path.join(repeatDir,engine+'.json');repeat=JSON.parse(fs.readFileSync(file));assert.deepEqual(clean(next.run),clean(repeat.run));files.push(file);}
 assert.equal(before.sourceSHA256,old.sourceSHA256);assert.equal(old.sourceSHA256,next.sourceSHA256);
 assert.equal(before.geometrySHA256,old.geometrySHA256);assert.equal(old.geometrySHA256,next.geometrySHA256);
 assert.deepEqual(clean(before.run),clean(old.run));
 const sides={};
 for(const side of ['left','right']){
  assert.deepEqual(old.run[side].automaticSeeds,next.run[side].automaticSeeds);
  assert.equal(old.run[side].results.length,next.run[side].results.length);
  const changed=[];let profiles=0;
  for(let i=0;i<old.run[side].results.length;i++){
   const a=old.run[side].results[i],b=next.run[side].results[i];
   for(const field of ['rank','index','seed','coarse','coarseDistal','localStart'])assert.deepEqual(a[field],b[field]);
   if(a.initialization||b.initialization){assert.deepEqual(a.initialization.profile,b.initialization.profile);profiles++;}
   if(a.initialization?.accepted)assert.equal(b.initialization.accepted,true);
   if(b.initialization?.accepted){
    const p=b.initialization.center,reference=b.initialization.reference,cell=b.initialization.cell;
    assert.ok(Math.abs(p.x-reference.x)<cell.w/2);assert.ok(Math.abs(p.y-reference.y)<cell.h/2);
   }
   if(a.initialization?.accepted!==b.initialization?.accepted){
    assert.equal(a.initialization.reason,'search-boundary');
    changed.push({rank:b.rank,acceptedBefore:a.initialization.accepted,acceptedAfter:b.initialization.accepted,shift:b.initialization.shift,sampleHalf:b.initialization.searchHalfNative,geometricBound:b.initialization.centerBoundNative,localStop:b.local?.reason,observedPoints:b.local?.points.length??0,proximalConnection:b.proximalConnection,endpointConfirmed:b.endpointConfirmed});
   }
   assert.equal(b.endpointConfirmed,false);
  }
  sides[side]={sampleProfilesExactlyEqual:profiles,changedCenters:changed};
 }
 result.engines[engine]={defaultExactlyPreservedExcludingTiming:true,exactRepeatIdenticalExcludingTiming:repeat?true:null,sourceSHA256:old.sourceSHA256,inputs:files.map(file=>({file,sha256:hash(fs.readFileSync(file))})),sides};
 console.log(engine,JSON.stringify(Object.fromEntries(Object.entries(sides).map(([side,s])=>[side,{profiles:s.sampleProfilesExactlyEqual,changed:s.changedCenters.length}]))));
}
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
