'use strict';
// Integrity/recorded invariants only: never a visual-quality or release gate.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),assert=require('node:assert/strict');
const root=path.join(__dirname,'positive-evidence'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),json=f=>JSON.parse(fs.readFileSync(f)),packed=n=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,n+'.json.gz'))));
for(const[f,d]of Object.entries(json(path.join(__dirname,'lash-positive-freeze.json')).inputs))assert.equal(hash(fs.readFileSync(f)),d,'Frozen labels/source list changed');
const images=json(path.join(root,'images.json'));assert.equal(images.length,598);
for(const i of images){const b=fs.readFileSync(path.join(root,i.file));assert.equal(hash(b),i.sha256);assert.equal(b.readUInt32BE(16),i.width);assert.equal(b.readUInt32BE(20),i.height);}
for(const s of json(path.join(root,'sources.json')).sources)assert.equal(hash(fs.readFileSync(path.join(root,s.path))),s.sha256);
for(const which of['product','experiment','production'])for(const e of Object.values(packed(which+'-sources')))assert.equal(hash(Buffer.from(e.base64,'base64')),e.sha256);
for(const view of json(path.join(__dirname,'lash-positive-independent-labels.json')).views){const name=path.basename(view.crop),image=images.find(i=>i.label==='positive-02-crops/'+name);assert.ok(image);assert.equal(image.sha256,view.cropSHA256);}
let maps=0,pngs=0;
for(const engine of['chromium','webkit']){
 const full=packed('full-endpoint-'+engine),before=packed('v6-render-'+engine),after=packed('fixed-render-'+engine);
 assert.equal(after.fixedEndpointSubset,true);assert.ok(!full.requests.some(p=>/\.(wasm|task)$/.test(p)));
 for(const c of full.checks){assert.equal(c.densityIdentical,true);maps++;for(const t of c.fixedPreviousEligible)if(t.boundaryRecovery){const old=t.tip.evidence.endpointRidgeProfile;assert.ok(old);for(let i=0;i<old.length;i++)assert.ok(Math.abs(old[i].response-t.profile[i].response)<1e-12,'Endpoint helper diverged from existing boundary measurement');}}
 for(const run of full.runs.filter(r=>r.geometry))if(run.file==='pexels-7123010.jpg'||run.file==='hair-occlusion.jpg')for(const b of run.budgets)for(const side of run.file==='hair-occlusion.jpg'?['left']:['left','right'])assert.equal(b.eyes[side].tips.length,0);
 for(const run of before.runs){const a=after.runs.find(r=>r.file===run.file);assert.ok(a);for(const side of['left','right']){const key=t=>JSON.stringify([t.x,t.y,t.dx,t.dy,t.c,t.length,t.width]),keys=new Set(run.eyes[side].tips.map(key));for(const t of a.eyes[side].tips)assert.ok(keys.has(key(t)),'New identity in fixed subset');
   for(const control of['current-density50','definition50']){const file=engine+'-'+run.file.replace('.jpg','')+'-'+control+'-'+side+'-1x.png',first=images.find(i=>i.label==='positive-10-render/'+file),last=images.find(i=>i.label==='positive-17-fixed-render/'+file);assert.ok(first&&last);assert.equal(first.sha256,last.sha256);pngs++;}
  }
 }
}
assert.equal(maps,78);assert.equal(pngs,28);
console.log(JSON.stringify({imageViews:images.length,densityMapIdentities:maps,densityDefinitionPNGIdentities:pngs,labels:'frozen source-only; provisional coated structures',product:'UNCHANGED',quality:'HOLD — no naturalness approval'}));
