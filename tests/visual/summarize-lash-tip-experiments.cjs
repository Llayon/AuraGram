'use strict';
// Preserve rejected experiments alongside the accepted Recovery baseline.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const output=process.argv[2];
if(!output||fs.existsSync(output))throw Error('Supply a NEW output directory');
fs.mkdirSync(output,{recursive:true});
const runs=process.argv.slice(3);
if(!runs.length)throw Error('Supply immutable LASH_RUN directory names');
const portraits=['light','natural'],rows=[],hashes={},replays=JSON.parse(process.env.LASH_ENGINE_REPLAYS||'{}');
for(const run of runs){
 if(!/^[\w-]+$/.test(run))throw Error('Invalid run');
 for(const engine of ['chromium','webkit']){
  const actualRun=replays[run+'/'+engine]||run;
  if(typeof actualRun!=='string'||!/^[\w-]+$/.test(actualRun))throw Error('Invalid replay run');
  const folder=path.join(__dirname,'out',actualRun);
  const file=path.join(folder,'manifest-'+engine+'.json');
  if(!fs.existsSync(file)){rows.push({run,actualRun,engine,status:fs.existsSync(path.join(folder,engine+'.started.json'))?'INTERRUPTED':'NOT RUN'});continue;}
  const text=fs.readFileSync(file),manifest=JSON.parse(text);
  if(actualRun!==run){
   const reference=JSON.parse(fs.readFileSync(path.join(__dirname,'out',run,'manifest-chromium.json'))).sourceHashes;
   if(Object.keys(reference).length!==Object.keys(manifest.sourceHashes).length||Object.keys(reference).some(k=>reference[k]!==manifest.sourceHashes[k]))throw Error('Replay uses different source hashes');
  }
  hashes[run+'/'+engine]=crypto.createHash('sha256').update(text).digest('hex');
  fs.writeFileSync(path.join(output,run+'-'+engine+'-manifest.json.gz'),require('node:zlib').gzipSync(text),{flag:'wx'});
  for(const portrait of portraits)if(!manifest.runs.some(r=>r.file===portrait+'.jpg'))rows.push({run,actualRun,engine,file:portrait+'.jpg',status:'NOT COMPLETED',reason:'Expected portrait missing from manifest'});
  for(const r of manifest.runs.filter(r=>portraits.some(p=>r.file===p+'.jpg'))){
   const eyes=Object.fromEntries(Object.entries(r.perEye).map(([s,v])=>[s,{
    geometryAccepted:v.tips.filter(t=>t.c>=.6&&v.lengthConfidence>=.25).length,
    appearanceAccepted:v.tips.filter(t=>t.c>=.6&&v.lengthConfidence>=.25&&(!t.appearance||t.appearance.alpha>0)).length,
    appearanceRejected:v.tips.filter(t=>t.c>=.6&&v.lengthConfidence>=.25&&t.appearance&&t.appearance.alpha<=0).map(t=>t.appearance.reason),
    length50:r.renderDiagnostics['new-length50']?.perEye.find(e=>e.side===s),
    length100:r.renderDiagnostics.length100?.perEye.find(e=>e.side===s)
   }]));
   rows.push({run,actualRun,engine,file:r.file,status:'COMPLETED',eyes,pixels:r.pixelEvidence});
   for(const variant of ['original','new-length50','length100'])for(const side of ['left','right'])for(const zoom of [1,2,4]){
    const name=engine+'-'+r.file.replace('.jpg','')+'-'+variant+'-'+side+'-'+zoom+'x.png';
    fs.copyFileSync(path.join(folder,name),path.join(output,run+'-'+name),fs.constants.COPYFILE_EXCL);
   }
  }
 }
}
fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({
 decision:'REJECT 11/12/13; source CV remains b46b285; LENGTH HOLD',hashes,replays,rows,
 notes:['appearanceAccepted is separate from geometryAccepted; neither proves visual usefulness.',
 'lengthAttempts counts drawing attempts; visibleLengthCandidates is overlapping pixel-in-bounds attribution, not isolated candidate proof.',
 'Pixel evidence is native source resolution, not preview efficacy; maxRGBSum is per-pixel RGB L1 0..765.',
 'Full native portraits, differences, traces and frozen source graphs remain under tests/visual/out/<LASH_RUN>.']
},null,2),{flag:'wx'});
let html='<!doctype html><meta charset="utf-8"><title>Rejected Length experiments</title><style>body{background:#222;color:#eee;font:16px sans-serif}table{border-collapse:collapse}td,th{padding:8px;vertical-align:top}img{max-width:none}section{overflow-x:auto}</style><h1>Length: rejected experiments</h1><p>Original / b46 Recovery / 11 measured alpha / 12 linear fade / 13 terminal transport. All experiments remain HOLD. No useful extension confirmed. Native-size crops, no extra sharpening. Both eyes,100/200/400%; scroll each table horizontally. Full portrait matrices remain in their immutable local run directories.</p>';
html+='<p>Explicit engine replays (all source hashes checked): '+JSON.stringify(replays)+'</p>';
for(const engine of ['chromium','webkit'])for(const portrait of portraits)for(const side of ['left','right'])for(const zoom of [1,2,4])for(const variant of ['new-length50','length100']){
 html+=`<section><h2>${engine} ${portrait} ${side} ${zoom*100}% ${variant}</h2><table><tr><th>Original</th>`+runs.map(r=>`<th>${r}</th>`).join('')+'</tr><tr>';
 const names=[runs[0]+'-'+engine+'-'+portrait+'-original-'+side+'-'+zoom+'x.png',...runs.map(r=>r+'-'+engine+'-'+portrait+'-'+variant+'-'+side+'-'+zoom+'x.png')];
 html+=names.map(n=>{
  const file=path.join(output,n);if(!fs.existsSync(file))return '<td>NOT COMPLETED</td>';
  const bytes=fs.readFileSync(file),w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);
  return `<td><a href="${n}"><img loading="lazy" width="${w}" height="${h}" src="${n}"></a></td>`;
 }).join('')+'</tr></table></section>';
}
fs.writeFileSync(path.join(output,'index.html'),html,{flag:'wx'});
console.log('Saved '+output+'; manifests and both-eye100/200/400% comparisons.');
