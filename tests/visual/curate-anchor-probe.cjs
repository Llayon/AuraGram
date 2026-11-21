'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),assert=require('assert/strict');
const root=__dirname,out=path.join(root,'out'),target=process.argv[2],hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(!target||fs.existsSync(target))throw Error('Supply NEW evidence directory');
const records={},rows=['engine,case,margin,window,available,body_supported,association_supported,association_failed,first_forward_loss_native,outcome,transitions'];
for(const e of ['chromium','webkit']){
 const b=fs.readFileSync(path.join(out,'anchor-06-hardened',e+'.json'));records[e]=JSON.parse(b);
 const previous=zlib.gunzipSync(fs.readFileSync(path.join(root,'native-shaft-evidence','centers-'+e+'.json.gz')));
 assert.equal(records[e].centerInputSHA256,hash(previous));
 assert.equal(records[e].protocolSHA256,hash(fs.readFileSync(path.join(root,'lash-anchor-protocol.json'))));
 assert.equal(records[e].results.length,3);
 for(const r of records[e].results){
  const old=JSON.parse(previous).results.find(p=>p.id===r.id);assert.equal(old.nativeRGBA_SHA256,r.nativeRGBA_SHA256);assert.equal(r.configurations.length,6);
  for(const c of r.configurations){const p=c.probe;assert.equal(p.outcome,'UNKNOWN');assert.equal(!!p.endpointConfirmed,false);
   if(p.available){assert.equal(p.forward.length,25);assert.ok(p.association.every((s,i,a)=>!i||s.distanceNative-a[i-1].distanceNative<=.5+1e-10));}
   rows.push([e,r.id,c.margin,c.window,p.available,p.bodySupported??'',p.associationSupported??'',p.association?.filter(s=>!s.supported).length??'',p.firstUnsupportedNative??'',p.outcome,JSON.stringify(p.transitions??[]).replaceAll(',', ';')].join(','));
  }
 }
 assert.ok(!records[e].requests.some(p=>/\.(wasm|task)$/.test(p)));
}
function near(a,b){if(typeof a==='number'&&typeof b==='number'){assert.ok(Math.abs(a-b)<1e-10);return;}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(a))near(a[k],b[k]);return;}assert.equal(a,b);}
near(records.chromium.results,records.webkit.results);
fs.mkdirSync(target,{recursive:true});fs.mkdirSync(path.join(target,'assets'));
for(const e of ['chromium','webkit']){
 fs.writeFileSync(path.join(target,e+'.json.gz'),zlib.gzipSync(fs.readFileSync(path.join(out,'anchor-06-hardened',e+'.json')),{level:9}));
 fs.writeFileSync(path.join(target,'initial-'+e+'.json.gz'),zlib.gzipSync(fs.readFileSync(path.join(out,'anchor-02-native',e+'.json')),{level:9}));
 const original=JSON.parse(fs.readFileSync(path.join(out,'anchor-02-native',e+'.json')));
 const strip=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='firstUnavailableNative'?undefined:v));
 assert.deepEqual(strip(original.results),strip(records[e].results));
}
const images=[];for(const f of fs.readdirSync(path.join(out,'anchor-05-plots')).filter(f=>f.endsWith('.png'))){const b=fs.readFileSync(path.join(out,'anchor-05-plots',f)),name='assets/'+hash(b)+'.png';fs.writeFileSync(path.join(target,name),b);images.push({label:f,file:name,sha256:hash(b)});}
assert.equal(images.length,36);
fs.writeFileSync(path.join(target,'images.json'),JSON.stringify(images,null,2));
fs.writeFileSync(path.join(target,'summary.csv'),rows.join('\n')+'\n');
const helpers={};for(const f of ['lash-anchor-protocol.json','lash-anchor-probe.mjs','lash-anchor-probe.cjs','lash-anchor-plot.py','lash-native-continuity.mjs','lash-endpoint-profile.mjs','native-shaft.test.mjs','curate-anchor-probe.cjs']){const b=fs.readFileSync(path.join(root,f));helpers[f]={sha256:hash(b),base64:b.toString('base64')};}
fs.writeFileSync(path.join(target,'tools.json.gz'),zlib.gzipSync(JSON.stringify(helpers),{level:9}));
fs.writeFileSync(path.join(target,'validation.json'),JSON.stringify({sameFrozenInputs:true,sameNativePixels:true,allConfigurations:36,available:28,chromiumWebkitNumericAgreementTolerance:1e-10,endpointApproved:0,modelRequests:0,runtime:'UNCHANGED',release:'HOLD'},null,2));
fs.writeFileSync(path.join(target,'.gitattributes'),'*.json -text\n*.csv -text\n*.gz -text\n');
fs.writeFileSync(path.join(target,'index.html'),'<!doctype html><meta charset="utf-8"><title>Anchor association — HOLD</title><style>body{background:#222;color:#eee;font:16px sans-serif}img{max-width:100%}a{color:#7ad}</style><h1>Anchor association and bounded continuation — HOLD</h1><p>All 36 configurations, including missing axes, both decoders. Source crop at left; cyan old anchor, green supported samples, red unsupported. Charts are measurements, not native image pixels. Y scales differ: read labelled values before comparing heights. Source panels use Pillow decoding for illustration; numeric probes use verified browser RGBA. Inherited .006 floor is uncalibrated. Contrast loss/reentry is UNKNOWN, never a confirmed endpoint. No manual direction, new seed, refit, anchor move or product effect. Same fixed Chromium cases in both decoders; WebKit104 no_face eligibility remains unchanged.</p><p><a href="../native-shaft-evidence/index.html">Previous source crops with 100/200/400% display</a>; full portraits/licenses and exact prior effect/difference maps remain in earlier evidence. No new effect is rendered by this diagnostic.</p>'+images.map(i=>`<figure><figcaption>${i.label}</figcaption><img loading="lazy" src="${i.file}"></figure>`).join(''));
console.log('PASS: frozen inputs/native pixels/all configurations/both-engine measurements; 36 figures; no approved endpoint.');
