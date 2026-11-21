import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const [beforeDir,defaultDir,measuredDir,repeatDir,out]=process.argv.slice(2);
if(!out||fs.existsSync(out))throw Error('Supply before/default/measured/repeat runs and NEW summary');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>k!=='analysisMs').map(([k,x])=>[k,clean(x)])):v;
const result={kind:'fixed-axis-development-path-comparison',labelsUsed:false,engines:{},decision:'Not promoted: small path gains and baseline losses; LENGTH HOLD'};
for(const engine of ['chromium','webkit']){
 const files=[beforeDir,defaultDir,measuredDir,repeatDir].map(d=>path.join(d,engine+'.json'));
 const [before,old,next,repeat]=files.map(f=>JSON.parse(fs.readFileSync(f)));
 assert.deepEqual(clean(before.run),clean(old.run));assert.deepEqual(clean(next.run),clean(repeat.run));
 assert.equal(old.sourceSHA256,next.sourceSHA256);assert.equal(old.geometrySHA256,next.geometrySHA256);
 const sides={};
 for(const side of ['left','right']){
  assert.deepEqual(old.run[side].automaticSeeds,next.run[side].automaticSeeds);
  const a=old.run[side].results,b=next.run[side].results;assert.equal(a.length,b.length);
  const changes=[];
  for(let i=0;i<a.length;i++){
   for(const field of ['rank','index','seed','coarse','coarseDistal','localStart','initialization'])assert.deepEqual(a[i][field],b[i][field]);
   const points=b[i].local?.points||[];
   if(points.length)assert.ok(points.at(-1).arc<=36+1e-9);
   for(const attempt of b[i].local?.attempts||[])if(attempt.linkAccepted)assert.equal(attempt.denseSupported,true);
   assert.equal(b[i].endpointConfirmed,false);assert.equal(b[i].proximalConnection,false);
   if(a[i].local?.reason!==b[i].local?.reason||JSON.stringify(a[i].local?.points)!==JSON.stringify(b[i].local?.points))changes.push({rank:b[i].rank,index:b[i].index,oldStop:a[i].local?.reason,newStop:b[i].local?.reason,oldPoints:a[i].local?.points.length??0,newPoints:points.length,oldArc:a[i].local?.points.at(-1)?.arc??0,newArc:points.at(-1)?.arc??0});
  }
  sides[side]={changes,extendedRecords:changes.filter(r=>r.newArc>r.oldArc+1e-8).length,shortenedRecords:changes.filter(r=>r.newArc<r.oldArc-1e-8).length,lostObservedPaths:changes.filter(r=>r.oldPoints>0&&r.newPoints===0).length,maximumExtension:Math.max(0,...changes.map(r=>r.newArc-r.oldArc))};
 }
 result.engines[engine]={defaultPreserved:true,measuredRepeatIdentical:true,inputs:files.map(file=>({file,sha256:hash(fs.readFileSync(file))})),sides};
 console.log(engine,JSON.stringify(Object.fromEntries(Object.entries(sides).map(([side,s])=>[side,{extended:s.extendedRecords,shortened:s.shortenedRecords,lost:s.lostObservedPaths,maxExtension:s.maximumExtension}]))));
}
result.limitations='Repeated seed records are not independent hairs; path gains/losses are not recall or biological correctness. No ending/ownership approval.';
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
