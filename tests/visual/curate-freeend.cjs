'use strict';
// Content-addressed evidence. Exact frozen bytes are retained; no failed source is dropped.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),out='tests/visual/out/',target=process.argv[2];
if(!target||fs.existsSync(target))throw Error('Supply NEW evidence directory');
const files=new Map(),add=f=>{if(!fs.existsSync(f))throw Error('Missing '+f);files.set(f,fs.readFileSync(f));},json=f=>JSON.parse(fs.readFileSync(f));
for(const prefix of ['lash-freeend','lash-freeend2']){
 const f=`tests/visual/${prefix}-freeze.json`,freeze=json(f);add(f);
 for(const[p,d]of Object.entries(freeze.inputs)){add(p);assert.equal(hash(files.get(p)),d);}
 const batch=prefix.endsWith('2')?'freeend2':'freeend';
 for(const s of freeze.sources){const p=out+batch+'-01-download/'+s.file;add(p);assert.equal(hash(files.get(p)),s.sha256);}
 const native=out+batch+'-03-native/';for(const v of json(native+'manifest.json')){add(native+v.crop);assert.equal(hash(files.get(native+v.crop)),v.sha256);}
 const labels=json(`tests/visual/${prefix}-independent-labels.json`);for(const v of labels.views)for(const ref of [v.crop,v.labelCoordinateFrame].filter(Boolean)){add(ref.path);assert.equal(hash(files.get(ref.path)),ref.sha256);}
 for(const v of labels.originalOnlyZoomViews||[])add(v.path);
 for(const engine of ['chromium','webkit']){
  const a=out+batch+'-05-analysis/',r=out+batch+'-07-render/',am=json(a+'manifest-'+engine+'.json'),rm=json(r+'manifest-'+engine+'.json');
  add(a+'manifest-'+engine+'.json');add(r+'manifest-'+engine+'.json');assert.equal(am.freezeSHA256,hash(files.get(f)));assert.equal(rm.referenceSHA256,hash(files.get(a+'manifest-'+engine+'.json')));
  assert.equal(am.harnessSHA256,hash(fs.readFileSync(`tests/visual/${prefix}-analysis.cjs`)));assert.equal(rm.harnessSHA256,hash(fs.readFileSync(`tests/visual/${prefix}-render.cjs`)));
  for(const[p,d]of Object.entries(am.sourceHashes)){const file=a+'candidate-src/'+p;add(file);assert.equal(hash(files.get(file)),d);assert.equal(hash(fs.readFileSync('src/'+p)),d);}
  for(const run of am.runs)if(run.geometryFile)add(a+run.geometryFile);
  for(const run of rm.runs){if(run.status!=='ready'){assert.equal(run.render,'SKIPPED_NO_FACE_NO_GEOMETRY');continue;}assert.ok(run.geometryRoundtripMaxError<=1e-12,'Canonical geometry numerical roundtrip');for(const v of run.records){add(r+v.portrait);for(const c of v.crops)add(r+c.file);}}
  assert.ok(!rm.requests.some(p=>/\.(wasm|task)$/.test(p)));
  const verifiedDir=out+batch+'-12-render-verified/',vf=verifiedDir+'verified-'+engine+'.json',vmf=verifiedDir+'manifest-'+engine+'.json',v=json(vf),vm=json(vmf);add(vf);add(vmf);
  const expected=require('./lash-freeend-inputs.cjs')(a+'manifest-'+engine+'.json',engine);
  for(const[k,value]of Object.entries(expected))assert.deepEqual(v[k],value);
  assert.equal(v.beforeAfterIdentical,true);assert.equal(v.manifestSHA256,hash(files.get(vmf)));assert.equal(v.helperSHA256,hash(fs.readFileSync('tests/visual/lash-freeend-inputs.cjs')));
  assert.equal(vm.referenceSHA256,rm.referenceSHA256);assert.equal(vm.harnessSHA256,rm.harnessSHA256);
  for(const run of vm.runs)for(const rec of run.records||[])for(const file of [rec.portrait,...rec.crops.map(c=>c.file)]){add(verifiedDir+file);assert.equal(hash(files.get(verifiedDir+file)),hash(files.get(r+file)),'Verified rerender PNG must match original '+file);}
 }
}
const baseline=out+'freeend-baseline-src/';add(baseline+'source-hashes.json');const b=json(baseline+'source-hashes.json');assert.equal(b.commit,'b883cf5d8cbcc75723b4701e98444fc349db4856');
for(const[p,d]of Object.entries(b.hashes)){const f=baseline+p.replace(/^src\//,'');add(f);assert.equal(hash(files.get(f)),d);assert.equal(hash(execFileSync('git',['show',b.commit+':'+p],{maxBuffer:8*1024*1024})),d);}
add(out+'freeend-10-audit.json');
for(const batch of ['freeend','freeend2'])for(const engine of ['chromium','webkit']){
 const dir=out+'freeend-11-debug/',f=dir+batch+'-'+engine+'.json',d=json(f);add(f);
 assert.equal(d.referenceSHA256,hash(fs.readFileSync(out+batch+'-05-analysis/manifest-'+engine+'.json')));
 assert.equal(d.harnessSHA256,hash(fs.readFileSync('tests/visual/lash-freeend-debug.cjs')));
 assert.ok(!d.requests.some(p=>/\.(wasm|task)$/.test(p)));
 for(const r of d.runs)for(const m of r.maps||[])add(dir+m.file);
}
for(const f of fs.readdirSync('tests/visual'))if(/^lash-freeend.*\.(cjs|json)$/.test(f))add('tests/visual/'+f);
const critic=json('tests/visual/lash-freeend-posthoc-independent-critic.json');for(const item of critic.inspectedArtifacts){add(item.path);assert.equal(hash(files.get(item.path)),item.sha256);}
for(const f of fs.readdirSync(out))if(/^freeend.*\.log$/.test(f))add(out+f);
fs.mkdirSync(path.join(target,'assets'),{recursive:true});const mapping={};
for(const[p,bytes]of files){const compress=!/\.(png|jpg)$/.test(p),digest=hash(bytes),name='assets/'+digest+(compress?'.gz':path.extname(p));if(!fs.existsSync(path.join(target,name)))fs.writeFileSync(path.join(target,name),compress?zlib.gzipSync(bytes,{level:9}):bytes);mapping[p]={asset:name,sha256:digest,bytes:bytes.length,gzip:compress};}
fs.writeFileSync(path.join(target,'files.json'),JSON.stringify(mapping,null,2)+'\n');fs.writeFileSync(path.join(target,'.gitattributes'),'*.json -text\n*.html -text\n*.gz -text\n*.png -text\n*.jpg -text\n');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),link=f=>mapping[f].asset;
let html='<!doctype html><meta charset="utf-8"><title>Free-ending real-photo audit — HOLD</title><style>body{background:#222;color:#eee;font:16px sans-serif;margin:24px}a{color:#8df}.matrix{display:flex;gap:10px;overflow:auto}figure{margin:4px;flex:none}img{image-rendering:pixelated}.portrait img{width:280px;height:auto}.crop img{width:calc(160px * var(--zoom,1));height:auto}figcaption{max-width:250px;font-size:13px}details{margin:16px 0}</style><h1>Real-photo free-ending audit — LENGTH HOLD</h1><p>7 licensed sources; sequential selection disclosed. 8 sparse provisional upper-ending labels are not exhaustive groundtruth. Four sources no_face in both engines; no fabricated geometry. Labels frozen before inference and used only for posthoc measurement/crops. Geometry cyan=upper lid, magenta=lower lid, red/green=ROI. Full portraits below are 1080px previews; native source JPEGs and unresized views are linked. Difference maps are absolute combined-original RGB amplified8×, not effect strength.</p><p>Zoom native crops <select onchange="document.body.style.setProperty(\'--zoom\',this.value)"><option value="1">100%</option><option value="2">200%</option><option value="4">400%</option></select>. Nearest display interpolation adds no analysis detail. Overlapping windows are not independent successes.</p>';
for(const prefix of ['freeend','freeend2']){
 const sources=json(out+prefix+'-01-download/manifest.json');for(const s of sources)html+=`<p><a href="${link(out+prefix+'-01-download/'+s.file)}">Original ${esc(s.file)}</a> — ${esc(s.author)}, <a href="${esc(s.page)}">source</a>, <a href="${esc(s.license)}">${esc(s.licenseName)}</a>. Native source retained; crops/comparisons are derivatives, no endorsement. SHA256 ${s.sha256}.</p>`;
 const native=out+prefix+'-03-native/';for(const v of json(native+'manifest.json'))html+=`<details><summary>Original-only native view ${esc(v.crop)}</summary><a href="${link(native+v.crop)}">Native PNG</a></details>`;
 for(const engine of ['chromium','webkit']){
  const base=out+prefix+'-07-render/',m=json(base+'manifest-'+engine+'.json');for(const r of m.runs){html+=`<h2>${engine} · ${esc(r.file)} · ${r.status}</h2>`;if(r.status!=='ready'){html+='<p>SKIPPED: no actual FaceMesh, no rendered comparison manufactured.</p>';continue;}
   html+='<div class="matrix portrait">'+r.records.map(v=>`<figure><figcaption>${v.name}</figcaption><a href="${link(base+v.portrait)}"><img loading="lazy" src="${link(base+v.portrait)}"></a></figure>`).join('')+'</div>';
   for(const id of [...new Set(r.records.flatMap(v=>v.crops.map(c=>c.id)))]){html+=`<h3>${esc(id)} · native160px context, not exact-tip score</h3><div class="matrix crop">`;for(const v of r.records)for(const c of v.crops.filter(c=>c.id===id))html+=`<figure><figcaption>${esc(v.name)}${c.meaning?' · difference8×':''}<br>context RGB absolute sum ${c.rgbDifference??'n/a'}</figcaption><img loading="lazy" src="${link(base+c.file)}"></figure>`;html+='</div>';}
  }
  const debugBase=out+'freeend-11-debug/',debug=json(debugBase+prefix+'-'+engine+'.json');html+=`<h3>${engine} debug maps</h3><p>${esc(debug.legend)}</p>`;
  for(const r of debug.runs){html+=`<p>${esc(r.file)} ${r.status}</p><div class="matrix">`;for(const m of r.maps||[])html+=`<figure><figcaption>${m.side} ${m.key} · ${m.reason}</figcaption><a href="${link(debugBase+m.file)}"><img loading="lazy" style="width:448px;height:auto" src="${link(debugBase+m.file)}"></a></figure>`;html+='</div>';}
 }
}
html+='<p>Every displayed first-use07 render PNG is byte-identical to its new12 verified rerender. Both manifests and before/after JPEG/module/baseline hash sidecars are archived in files.json. Initial07 runs lacked these execution preconditions; the critic found no actual source drift. Recorded source byte map: files.json. Tile recipe/rectangles/hashes are retained in native manifests; redundant overlapping tile PNGs are omitted. Full native views and source JPEGs are retained. Restore archived paths using replay-freeend.cjs before rerunning source-freeze checks. Actual raw first-use timings are cold/order-dependent observations, not resolution-quality proof or a mobile benchmark. Physical devices UNVERIFIED. No product algorithm, gate or release changed.</p>';
fs.writeFileSync(path.join(target,'index.html'),html);console.log('Archived',files.size,'logical files;',Object.keys(mapping).length,'hash-checked mappings; HOLD.');
