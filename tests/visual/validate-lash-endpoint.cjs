'use strict';
// Integrity and reproduction of the existing scalar operator, not naturalness.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),assert=require('node:assert/strict');
const root=path.join(__dirname,'endpoint-evidence'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),packed=(dir,n)=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,n+'.json.gz'))));
const casesBytes=fs.readFileSync(path.join(__dirname,'lash-endpoint-cases.json')),cases=JSON.parse(casesBytes),c=packed(root,'chromium'),w=packed(root,'webkit');
assert.equal(c.casesSHA256,hash(casesBytes));assert.equal(w.casesSHA256,hash(casesBytes));assert.equal(hash(fs.readFileSync(path.join(__dirname,'lash-positive-independent-labels.json'))),cases.inputHashes.independentLabels);
const old=packed(path.join(__dirname,'positive-evidence'),'full-endpoint-chromium');let configurations=0,operatorMatches=0,nativeEqual=0;
const key=t=>JSON.stringify([t.x,t.y,t.dx,t.dy,t.c,t.length,t.width]);
for(const a of c.results){const b=w.results.find(r=>r.id===a.id);assert.ok(b);assert.equal(a.nativeRGBA_SHA256,b.nativeRGBA_SHA256);nativeEqual++;
 const spec=cases.cases.find(s=>s.id===a.id),check=old.checks.find(r=>r.file===a.file&&r.side===a.side&&r.maxSide===224),ref=check.fixedPreviousEligible.find(r=>key(r.tip)===key(spec.tip));assert.ok(ref,'Old identity changed');
 const current=a.budgets.find(b=>b.cap===224).configurations.find(r=>r.direction==='stored-render-tangent'&&r.mode==='analysis');assert.equal(current.interpretation,ref.reason);
 for(let i=0;i<ref.profile.length;i++){assert.ok(Math.abs(current.profile[i].response-ref.profile[i].response)<1e-10);operatorMatches++;}
 for(const result of[a,b])for(const budget of result.budgets)for(const cfg of budget.configurations){configurations++;assert.equal(cfg.profile.length,8);assert.equal(cfg.phases.length,9);assert.equal(cfg.curves.length,73);for(const p of cfg.curves)assert.ok(Number.isFinite(p.response)&&Number.isFinite(p.transverseContrast));}
}
for(const i of JSON.parse(fs.readFileSync(path.join(root,'images.json')))){const b=fs.readFileSync(path.join(root,i.file));assert.equal(hash(b),i.sha256);if(i.file.endsWith('.png')){assert.equal(b.readUInt32BE(16),i.width);assert.equal(b.readUInt32BE(20),i.height);}}
for(const entry of Object.values(packed(root,'qa-tools')))assert.equal(hash(Buffer.from(entry.base64,'base64')),entry.sha256);
assert.equal(configurations,108);assert.equal(operatorMatches,24);assert.equal(nativeEqual,3);
console.log(JSON.stringify({fixedCases:3,configurations,oldOperatorScalarMatches:operatorMatches,nativeRGBAEqualCases:nativeEqual,product:'UNCHANGED',release:'LENGTH HOLD'}));
