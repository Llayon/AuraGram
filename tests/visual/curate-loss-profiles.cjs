'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),assert=require('assert/strict');
const [input,plots,target]=process.argv.slice(2),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(!target||fs.existsSync(target))throw Error('Supply RESULTS PLOTS NEW_TARGET');
const records={},csv=['engine,case,margin,window,distance_native,accepted,reason,shift_native,on_axis_response,center_response,displaced_support'];
let configurations=0,rows=0,accepted=0,lateral=0;const reasons={};
for(const e of ['chromium','webkit']){
 const b=fs.readFileSync(path.join(input,e+'.json')),r=JSON.parse(b);records[e]=r;
 const prev=zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'native-shaft-evidence','centers-'+e+'.json.gz'))),prior=zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'anchor-probe-evidence',e+'.json.gz')));
 assert.equal(r.centerInputSHA256,hash(prev));assert.equal(r.priorInputSHA256,hash(prior));
 assert.equal(r.protocolSHA256,hash(fs.readFileSync(path.join(__dirname,'lash-loss-protocol.json'))));
 assert.equal(r.harnessSHA256,hash(fs.readFileSync(path.join(__dirname,'lash-loss-profiles.cjs'))));
 assert.equal(r.casesSHA256,hash(fs.readFileSync(path.join(__dirname,'lash-endpoint-cases.json'))));
 assert.equal(r.results.length,3);
 for(const c of r.results){
  assert.equal(c.nativeRGBA_SHA256,JSON.parse(prev).results.find(x=>x.id===c.id).nativeRGBA_SHA256);assert.equal(c.configurations.length,6);
  for(const cfg of c.configurations){configurations++;const p=cfg.inspection;assert.equal(p.outcome,'UNKNOWN');assert.equal(p.endpointConfirmed,false);
   assert.equal(p.rows.length,p.available?5:0);
   for(const row of p.rows){rows++;accepted+=row.accepted?1:0;lateral+=row.displacedSupport?1:0;reasons[row.reason]=(reasons[row.reason]??0)+1;
    assert.equal(row.distanceNative,p.lossNative+row.offset);assert.ok(Math.abs(row.proposedShift)<=row.searchHalf+.125+1e-10);
    csv.push([e,c.id,cfg.margin,cfg.window,row.distanceNative,row.accepted,row.reason,row.proposedShift,row.onAxis.response??'',row.atCenter?.response??'',row.displacedSupport].join(','));
   }
  }
 }
 assert.ok(!r.requests.some(p=>/\.(wasm|task)$/.test(p)));
 for(const [f,digest]of Object.entries(r.helperHashes))assert.equal(digest,hash(fs.readFileSync(path.join(__dirname,f))));
}
function near(a,b){assert.equal(typeof a,typeof b);if(typeof a==='number'){assert.ok(Math.abs(a-b)<1e-10);return;}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(a))near(a[k],b[k]);return;}assert.equal(a,b);}
near(records.chromium.results,records.webkit.results);assert.equal(configurations,36);assert.equal(rows,140);
fs.mkdirSync(target,{recursive:true});fs.mkdirSync(path.join(target,'assets'));
for(const e of ['chromium','webkit'])fs.writeFileSync(path.join(target,e+'.json.gz'),zlib.gzipSync(fs.readFileSync(path.join(input,e+'.json')),{level:9}));
const images=[];for(const f of fs.readdirSync(plots).filter(f=>f.endsWith('.png'))){const b=fs.readFileSync(path.join(plots,f)),name='assets/'+hash(b)+'.png';fs.writeFileSync(path.join(target,name),b);images.push({label:f,file:name,sha256:hash(b)});}assert.equal(images.length,36);
fs.writeFileSync(path.join(target,'images.json'),JSON.stringify(images,null,2));fs.writeFileSync(path.join(target,'profiles.csv'),csv.join('\n')+'\n');
fs.writeFileSync(path.join(target,'validation.json'),JSON.stringify({configurations,rows,accepted,lateral,reasons,matchingFrozenInputs:true,nativePixelsUnchanged:true,engineTolerance:1e-10,endpointApproved:0,runtime:'UNCHANGED',release:'HOLD'},null,2));
const tools={};for(const f of ['lash-loss-protocol.json','lash-loss-profiles.mjs','lash-loss-profiles.cjs','lash-loss-plot.py','lash-native-shaft.mjs','lash-shaft-protocol.json','lash-endpoint-profile.mjs','native-shaft.test.mjs','curate-loss-profiles.cjs']){const b=fs.readFileSync(path.join(__dirname,f));tools[f]={sha256:hash(b),base64:b.toString('base64')};}
fs.writeFileSync(path.join(target,'tools.json.gz'),zlib.gzipSync(JSON.stringify(tools),{level:9}));
fs.writeFileSync(path.join(target,'.gitattributes'),'*.json -text\n*.csv -text\n*.gz -text\nlogs/*.txt -text -whitespace\n');
fs.writeFileSync(path.join(target,'index.html'),'<!doctype html><meta charset="utf-8"><title>Loss-neighborhood profiles — HOLD</title><style>body{background:#222;color:#eee;font:16px sans-serif}img{max-width:100%}a{color:#7ad}</style><h1>Transverse profiles around fixed-axis losses — HOLD</h1><p>Every available/missing axis, both decoders, unchanged old identities. Cyan=old anchor; gray=measured transverse profile; green=unique center; red=unresolved reference. Shaded chart area=mapped search bound; red dashed=.006 inherited floor; vertical line=proposed displacement. Y scales vary: compare labelled values. Pillow source panels illustrate the original pixels; numeric measurements use verified browser RGBA. No new effect, product tip move, adaptive tracing, gap bridge or manual angle.</p><p>Unique background-deficit center is separate from bilateral ridge support. Displaced support is evidence near the tested line, not same-fiber identity, ending or rendering permission. All outcomes UNKNOWN. Native source crops at100/200/400% and full portraits/licenses/effect maps remain in <a href="../native-shaft-evidence/index.html">previous evidence</a>.</p>'+images.map(i=>`<figure><figcaption>${i.label}</figcaption><img loading="lazy" src="${i.file}"></figure>`).join(''));
console.log(JSON.stringify({configurations,rows,accepted,lateral,reasons,endpointApproved:0,release:'HOLD'}));
