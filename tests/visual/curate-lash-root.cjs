'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),assert=require('node:assert/strict');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=process.argv[2],target=process.argv[3];
if(!source||!target||fs.existsSync(target))throw Error('Supply existing run and NEW evidence directory');
fs.mkdirSync(target,{recursive:true});fs.mkdirSync(path.join(target,'assets'));
const images=[],summary={};
for(const engine of ['chromium','webkit']){
 const bytes=fs.readFileSync(path.join(source,engine+'.json')),m=JSON.parse(bytes);
 assert.equal(m.scriptSHA256,hash(fs.readFileSync(path.join(__dirname,'lash-root-continuation.cjs'))));
 fs.writeFileSync(path.join(target,engine+'.json.gz'),zlib.gzipSync(bytes,{level:9}),{flag:'wx'});
 summary[engine]={grouped:m.grouped,candidates:0,observedCrossing:0,unresolved:0,conditions:0};
 for(const r of m.results)for(const e of r.eyes)for(const row of e.rows){
  summary[engine].conditions++;
  for(const t of row.tested){assert.equal(t.interpretation,t.crossed?'observed-crossing':'unresolved');summary[engine].candidates++;summary[engine][t.crossed?'observedCrossing':'unresolved']++;}
  const image=fs.readFileSync(path.join(source,row.png)),digest=hash(image),file='assets/'+digest+'.png';
  if(!fs.existsSync(path.join(target,file)))fs.writeFileSync(path.join(target,file),image,{flag:'wx'});
  images.push({label:row.png,file,sha256:digest,width:image.readUInt32BE(16),height:image.readUInt32BE(20)});
 }
}
fs.writeFileSync(path.join(target,'images.json'),JSON.stringify(images,null,2),{flag:'wx'});
fs.writeFileSync(path.join(target,'summary.json'),JSON.stringify(summary,null,2),{flag:'wx'});
fs.writeFileSync(path.join(target,'.gitattributes'),'*.json -text\n*.gz -text\n*.txt -whitespace\n',{flag:'wx'});
fs.writeFileSync(path.join(target,'index.html'),'<!doctype html><meta charset="utf-8"><title>Root continuation: rejected</title><style>body{font:16px sans-serif;background:#222;color:#eee}figure{overflow:auto}img{max-width:none;image-rendering:pixelated}</style><h1>Root-continuation counterfactual: REJECTED</h1><p>Diagnostic overlays on unchanged native eye crops, no Length rendering. Cyan=previously eligible candidate, NOT a confirmed natural fiber or approved extension. Amber=observed crossing (none found here). Purple=root-chord continuation, red=existing whole-eye scanner paths. No observed crossing means UNRESOLVED, not safe. Last proximal path points may belong to broad merged eyelid support. See README and critic. Full sources/earlier effect comparisons remain in crossing-evidence and expanded-evidence.</p><label>Native zoom <select onchange="document.querySelectorAll(\'img\').forEach(i=>{i.width=i.dataset.w*this.value;i.height=i.dataset.h*this.value})"><option value="1">100%</option><option value="2">200%</option><option value="4">400%</option></select></label>'+images.map(i=>`<figure><figcaption>${i.label}</figcaption><img loading="lazy" src="${i.file}" width="${i.width}" height="${i.height}" data-w="${i.width}" data-h="${i.height}"></figure>`).join(''),{flag:'wx'});
console.log(JSON.stringify(summary,null,2));
