'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib');
const root=path.join(__dirname,'expanded-evidence'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const aliases=JSON.parse(fs.readFileSync(root+'/images.json')),records=JSON.parse(fs.readFileSync(root+'/sources.json')).records;
for(const r of records)if(hash(fs.readFileSync(root+'/sources/'+r.file))!==r.sha256)throw Error('Original changed');
let labels=0,views=0;const freezes={};
for(const name of ['lash-expanded-independent-labels.json','lash-expanded-additional-labels.json']){
 const b=fs.readFileSync(path.join(__dirname,name)),data=JSON.parse(b);freezes[name]=hash(b);
 for(const view of data.views){views++;if(view.sourceSHA256!==records.find(r=>r.file===view.file).sha256)throw Error('Annotation source differs');const alias=aliases.find(a=>a.label===path.basename(view.originalCrop)&&a.category==='original-only');if(!alias||alias.sha256!==view.originalCropSHA256)throw Error('Annotation viewing crop changed');labels+=(view.labels||[]).length;}
}
const results={};for(const engine of ['chromium','webkit']){
 const geometry=JSON.parse(zlib.gunzipSync(fs.readFileSync(root+'/geometry-'+engine+'.json.gz'))),matrix=JSON.parse(zlib.gunzipSync(fs.readFileSync(root+'/matrix-'+engine+'.json.gz')));
 for(const r of matrix.runs){const g=geometry.runs.find(g=>g.file===r.file);for(const side of ['left','right']){
  if(JSON.stringify(g.perEye[side].tips)!==JSON.stringify(r.eyes[side].tips))throw Error('Frozen geometry reanalysis differs: '+r.file+side);
  if(r.roundtrip[side].maxNormalizedError>1e-12)throw Error('Legacy ring roundtrip failed');
 }}
 results[engine]={ready:matrix.runs.length,noFace:matrix.excluded.filter(e=>e.status==='no_face').length,tipDataExactlyReproduced:true,modelRequests:matrix.requests.filter(p=>/\.(wasm|task)$/.test(p)).length};
}
console.log(JSON.stringify({nativeSources:records.length,originalViews:views,provisionalLabels:labels,freezes,engines:results},null,2));
