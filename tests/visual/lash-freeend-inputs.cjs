'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
module.exports=function verify(input,engine){
 const bytes=fs.readFileSync(input),reference=JSON.parse(bytes),base=path.dirname(input),batch=base.includes('freeend2-')?'freeend2':'freeend';assert.equal(reference.engine,engine);
 const freezeFile=`tests/visual/lash-${batch}-freeze.json`,freezeBytes=fs.readFileSync(freezeFile),freeze=JSON.parse(freezeBytes);assert.equal(reference.freezeSHA256,hash(freezeBytes));
 for(const[f,d]of Object.entries(freeze.inputs))assert.equal(hash(fs.readFileSync(f)),d,'Frozen input '+f);
 const checked={referenceSHA256:hash(bytes),freezeSHA256:hash(freezeBytes),sourceHashes:{},moduleHashes:{},baselineHashes:{}};
 for(const r of reference.runs){const s=freeze.sources.find(s=>s.file===r.file);assert.ok(s);assert.equal(r.sha256,s.sha256);assert.equal(r.W,s.width);assert.equal(r.H,s.height);const d=hash(fs.readFileSync(`tests/visual/out/${batch}-01-download/${r.file}`));assert.equal(d,s.sha256);checked.sourceHashes[r.file]={sha256:d,width:s.width,height:s.height};}
 for(const[f,d]of Object.entries(reference.sourceHashes)){assert.equal(hash(fs.readFileSync(path.join(base,'candidate-src',f))),d);checked.moduleHashes[f]=d;}
 const baseline='tests/visual/out/freeend-baseline-src/',b=JSON.parse(fs.readFileSync(baseline+'source-hashes.json'));assert.equal(b.commit,'b883cf5d8cbcc75723b4701e98444fc349db4856');
 for(const[f,d]of Object.entries(b.hashes)){assert.equal(hash(fs.readFileSync(baseline+f.replace(/^src\//,''))),d);assert.equal(hash(execFileSync('git',['show',b.commit+':'+f],{maxBuffer:8*1024*1024})),d);checked.baselineHashes[f]=d;}
 return checked;
};
