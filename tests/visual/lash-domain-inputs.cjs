'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const map=()=>JSON.parse(fs.readFileSync('tests/visual/freeend-evidence/files.json'));
function archived(relative){const m=map()[relative];if(!m)throw Error('Missing archived '+relative);const raw=fs.readFileSync('tests/visual/freeend-evidence/'+m.asset),bytes=m.gzip?zlib.gunzipSync(raw):raw;if(hash(bytes)!==m.sha256)throw Error('Archive drift');return bytes;}
function loadInputs(){
 const runs=[],inputs={},oldSources=JSON.parse(fs.readFileSync('tests/visual/crossing-evidence/sources.json')).sources;
 const keep=['natural.jpg','hair-occlusion.jpg','pexels-7123010.jpg','light.jpg','light-rotated25.jpg'];
 for(const engine of ['chromium','webkit']){
  const oldFile=`tests/visual/crossing-evidence/nominal-${engine}.json.gz`,oldBytes=fs.readFileSync(oldFile),old=JSON.parse(zlib.gunzipSync(oldBytes));inputs[oldFile]=hash(oldBytes);
  for(const r of old.runs.filter(r=>keep.includes(r.file))){const s=oldSources.find(s=>s.file===r.file),imagePath=path.posix.normalize('tests/visual/crossing-evidence/'+s.path);if(hash(fs.readFileSync(imagePath))!==s.sha256)throw Error('Source drift');runs.push({engine,file:r.file,W:r.W,H:r.H,geometry:r.geometry,imagePath,imageSHA256:s.sha256,sourceKind:'frozen-crossing',sourceHashes:old.sourceHashes.candidate,crossing:Object.fromEntries(['left','right'].map(side=>[side,r.current[side].diagnostics.crossing]))});}
  for(const batch of ['freeend','freeend2']){
   const ref=`tests/visual/out/${batch}-05-analysis/manifest-${engine}.json`,bytes=archived(ref),m=JSON.parse(bytes);inputs[ref]=hash(bytes);
   for(const r of m.runs.filter(r=>r.status==='ready')){const imageRef=`tests/visual/out/${batch}-01-download/${r.file}`,entry=map()[imageRef],imagePath='tests/visual/freeend-evidence/'+entry.asset;if(hash(fs.readFileSync(imagePath))!==r.sha256)throw Error('Source drift');runs.push({engine,file:r.file,W:r.W,H:r.H,geometry:r.geometry,imagePath,imageSHA256:r.sha256,sourceKind:'frozen-freeend',sourceHashes:m.sourceHashes,crossing:Object.fromEntries(['left','right'].map(side=>[side,r.budgets[0].eyes[side].diagnostics.crossing]))});}
  }
 }
 const labelFiles=['tests/visual/lash-freeend-independent-labels.json','tests/visual/lash-freeend2-independent-labels.json'];
 const labels=[];for(const f of labelFiles){const bytes=fs.readFileSync(f);inputs[f]=hash(bytes);const d=JSON.parse(bytes);for(const v of d.views)for(const l of v.labels){const r=(v.labelCoordinateFrame||v.crop).sourceRectXYWH;labels.push({file:v.source,id:l.id,tip:{x:r[0]+l.tipNative[0],y:r[1]+l.tipNative[1]},shaft:l.proximalShaftNative.map(p=>({x:r[0]+p[0],y:r[1]+p[1]})),uncertainty:l.tipUncertaintyNativePx});}}
 for(const run of runs)for(const[f,d]of Object.entries(run.sourceHashes))if(hash(fs.readFileSync('src/'+f))!==d)throw Error('Frozen/live helper disagreement '+f);
 return{runs,labels,inputs};
}
module.exports={hash,archived,loadInputs};
