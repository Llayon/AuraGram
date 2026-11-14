'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),assert=require('assert/strict'),crypto=require('crypto');
const [input,plots,controlFile,controlPlot,target]=process.argv.slice(2),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(!target||fs.existsSync(target))throw Error('Supply RESULTS PLOTS CONTROLS CONTROL_PNG NEW_TARGET');
const records={},summary=[],csv=['engine,case,margin,window,available,reason,accepted_points,accepted_arc,first_fit_turn,first_fit_span'];let available=0,links=0;
for(const e of ['chromium','webkit']){
 const r=JSON.parse(fs.readFileSync(path.join(input,e+'.json')));records[e]=r;
 const centers=zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'native-shaft-evidence','centers-'+e+'.json.gz'))),prior=zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'anchor-probe-evidence',e+'.json.gz')));
 assert.equal(r.centerInputSHA256,hash(centers));assert.equal(r.priorInputSHA256,hash(prior));assert.equal(r.protocolSHA256,hash(fs.readFileSync(path.join(__dirname,'lash-curve-protocol.json'))));assert.equal(r.harnessSHA256,hash(fs.readFileSync(path.join(__dirname,'lash-curve-probe.cjs'))));
 assert.equal(r.results.length,3);
 for(const c of r.results){const old=JSON.parse(centers).results.find(x=>x.id===c.id);assert.equal(old.nativeRGBA_SHA256,c.nativeRGBA_SHA256);assert.equal(c.configurations.length,6);
  for(const cfg of c.configurations){const p=cfg.curve;available+=p.available?1:0;assert.equal(p.outcome,'UNKNOWN');assert.equal(p.endpointConfirmed,false);assert.ok(p.attempts.length<=r.protocol.maximumSteps);
   const accepted=p.attempts.filter(a=>a.linkAccepted);links+=accepted.length;assert.equal(p.points.length,p.available?accepted.length+1:0);assert.ok(!p.points.length||p.points.at(-1).arc<=12);
   for(const a of accepted)assert.ok(a.dense.length>1&&a.dense.every(d=>d.supported));
   const firstFit=p.attempts.find(a=>a.directionFit),record={engine:e,id:c.id,margin:cfg.margin,window:cfg.window,available:p.available,reason:p.reason,points:p.points.length,arc:p.points.at(-1)?.arc??0,firstTurn:firstFit?.turnDegrees??null,firstSpan:firstFit?.directionFit?.span??null};summary.push(record);
   csv.push([e,c.id,cfg.margin,cfg.window,p.available,p.reason,p.points.length,record.arc,record.firstTurn??'',record.firstSpan??''].join(','));
  }
 }
 assert.ok(!r.requests.some(p=>/\.(wasm|task)$/.test(p)));for(const[f,digest]of Object.entries(r.helperHashes))assert.equal(digest,hash(fs.readFileSync(path.join(__dirname,f))));
}
function near(a,b){assert.equal(typeof a,typeof b);if(typeof a==='number'){assert.ok(Math.abs(a-b)<1e-10);return;}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(a))near(a[k],b[k]);return;}assert.equal(a,b);}
near(records.chromium.results,records.webkit.results);assert.equal(summary.length,36);
const controls=JSON.parse(fs.readFileSync(controlFile));assert.equal(controls.results.length,14);assert.equal(controls.protocolSHA256,records.chromium.protocolSHA256);assert.equal(controls.controlsSHA256,hash(fs.readFileSync(path.join(__dirname,'lash-curve-controls.json'))));
fs.mkdirSync(target,{recursive:true});fs.mkdirSync(path.join(target,'assets'));
for(const e of ['chromium','webkit'])fs.writeFileSync(path.join(target,e+'.json.gz'),zlib.gzipSync(fs.readFileSync(path.join(input,e+'.json')),{level:9}));
fs.writeFileSync(path.join(target,'controls.json.gz'),zlib.gzipSync(fs.readFileSync(controlFile),{level:9}));
const images=[];for(const file of fs.readdirSync(plots).filter(f=>f.endsWith('.png'))){const b=fs.readFileSync(path.join(plots,file)),name='assets/'+hash(b)+'.png';fs.writeFileSync(path.join(target,name),b);images.push({label:file,file:name,sha256:hash(b)});}
assert.equal(images.length,36);const b=fs.readFileSync(controlPlot),name='assets/'+hash(b)+'.png';fs.writeFileSync(path.join(target,name),b);images.push({label:'ANALYTIC CONTROLS ONLY — not portrait proof',file:name,sha256:hash(b)});
fs.writeFileSync(path.join(target,'images.json'),JSON.stringify(images,null,2));fs.writeFileSync(path.join(target,'paths.csv'),csv.join('\n')+'\n');fs.writeFileSync(path.join(target,'summary.json'),JSON.stringify(summary,null,2));
fs.writeFileSync(path.join(target,'validation.json'),JSON.stringify({configurations:summary.length,available,acceptedLinks:links,analyticControls:14,engineTolerance:1e-10,frozenInputs:true,nativePixelsUnchanged:true,endpointApproved:0,runtime:'UNCHANGED',release:'HOLD'},null,2));
const tools={};for(const f of ['lash-curve-protocol.json','lash-curve-probe.mjs','lash-curve-probe.cjs','lash-curve-plot.py','lash-curve-controls.json','lash-curve-controls.cjs','lash-curve-controls-plot.py','lash-native-shaft.mjs','lash-endpoint-profile.mjs','native-shaft.test.mjs','curate-curve-probe.cjs']){const b=fs.readFileSync(path.join(__dirname,f));tools[f]={sha256:hash(b),base64:b.toString('base64')};}
fs.writeFileSync(path.join(target,'tools.json.gz'),zlib.gzipSync(JSON.stringify(tools),{level:9}));fs.writeFileSync(path.join(target,'.gitattributes'),'*.json -text\n*.csv -text\n*.gz -text\nlogs/*.txt -text -whitespace\n');
fs.writeFileSync(path.join(target,'index.html'),'<!doctype html><meta charset="utf-8"><title>Bounded curve experiment — rejected</title><style>body{background:#222;color:#eee;font:16px sans-serif}img{max-width:100%}a{color:#7ad}</style><h1>Bounded curve experiment — rejected / HOLD</h1><p>Every36real-photo configuration plus the14analytic controls. Cyan=old anchor; white=prior measured seed; green=accepted sampled prefix; red/orange=rejected predicted/proposed point, never accepted into the trace. Y scales vary. Source panels use Pillow for illustration; numeric probes use verified browser RGBA. Seed lies about2nativepx before the old anchor. No path reaches a demonstrated ending and no new product effect is rendered.</p><p>C104 stops on initial-vs-local direction mismatch;22degrees is not a verified physical bend. R1 stops at search boundary; R2 is not seeded. Analytic controls show false controller stop on a straight shaft with25degree initial error and failures on gently curved shafts. Conservative stopping does not establish same-fiber ownership or a general branch detector. Previous full portraits/licenses/effect maps and native100/200/400% crops remain in <a href="../native-shaft-evidence/index.html">earlier evidence</a>.</p>'+images.map(i=>`<figure><figcaption>${i.label}</figcaption><img loading="lazy" src="${i.file}"></figure>`).join(''));
console.log(JSON.stringify({configurations:summary.length,available,acceptedLinks:links,analyticControls:14,endpointApproved:0,verdict:'REJECTED/HOLD'}));
