'use strict';
// Saved-evidence audit only. A failed hypothesis remains failed.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),assert=require('node:assert/strict');
const root=path.join(__dirname,'root-evidence'),prior=path.join(__dirname,'crossing-evidence');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const packed=f=>JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
const sources=JSON.parse(fs.readFileSync(path.join(prior,'sources.json'))).sources;
const images=JSON.parse(fs.readFileSync(path.join(root,'images.json')));
for(const i of images){const b=fs.readFileSync(path.join(root,i.file));assert.equal(hash(b),i.sha256);assert.equal(b.readUInt32BE(16),i.width);assert.equal(b.readUInt32BE(20),i.height);}
let candidates=0,conditions=0;
for(const e of ['chromium','webkit']){
 const m=packed(path.join(root,e+'.json.gz'));
 assert.equal(m.scriptSHA256,hash(fs.readFileSync(path.join(__dirname,'lash-root-continuation.cjs'))));
 assert.equal(m.sweepSHA256,hash(fs.readFileSync(path.join(prior,'final-sweep-'+e+'.json.gz'))));
 assert.equal(m.bundleSHA256,hash(fs.readFileSync(path.join(prior,'candidate-sources.json.gz'))));
 for(const [file,digest] of Object.entries(m.imageHashes)){const s=sources.find(s=>s.file===file);assert.ok(s);assert.equal(hash(fs.readFileSync(path.join(prior,s.path))),digest);}
 for(const [key,file] of Object.entries({older:'localization-evidence/geometry.json.gz',chromium:'expanded-evidence/geometry-chromium.json.gz',webkit:'expanded-evidence/geometry-webkit.json.gz'}))assert.equal(hash(fs.readFileSync(path.join(__dirname,file))),m.geometryHashes[key]);
 assert.ok(!m.requests.some(p=>/\.(wasm|task)$/.test(p)));
 for(const r of m.results)for(const eye of r.eyes)for(const row of eye.rows){conditions++;assert.ok(images.some(i=>i.label===row.png));for(const t of row.tested){candidates++;assert.equal(t.crossed,false);assert.equal(t.stop,'no-observed-valley');assert.equal(t.interpretation,'unresolved');assert.equal(t.counterfactualWouldPermit,true);}}
}
assert.equal(images.length,30);assert.equal(conditions,30);assert.equal(candidates,70);
console.log(JSON.stringify({views:images.length,conditions,candidateObservations:candidates,observedCrossing:0,unresolved:candidates,hypothesis:'REJECTED',product:'UNCHANGED — LENGTH HOLD'}));
