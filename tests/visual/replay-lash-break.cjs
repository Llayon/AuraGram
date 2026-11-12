'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),{hash}=require('./lash-domain-inputs.cjs'),base='tests/visual/break-evidence/',map=JSON.parse(fs.readFileSync(base+'files.json')),root=path.resolve('.');let restored=0;
const cp=base+'ci-compatibility/attestation.json',compat=fs.existsSync(cp)?JSON.parse(fs.readFileSync(cp)):null;
for(const[f,m]of Object.entries(map)){
 const stored=fs.readFileSync(path.resolve(base,m.asset)),bytes=m.gzip?zlib.gunzipSync(stored):stored;if(hash(bytes)!==m.sha256)throw Error('Archive drift '+f);const dst=path.resolve(root,f);if(!dst.startsWith(root+path.sep))throw Error('Path escape');
 if(fs.existsSync(dst)){const current=hash(fs.readFileSync(dst));if(current!==m.sha256){const declared=f==='tests/visual/lash-break.test.mjs'&&compat&&compat.beforeTestSHA256===m.sha256&&compat.afterTestSHA256===current&&compat.readerFile==='tests/visual/lash-break-references.cjs'&&hash(fs.readFileSync(compat.readerFile))===compat.readerSHA256;if(!declared)throw Error('Refuse conflicting input '+f);}}
 else{if(!f.startsWith('tests/visual/out/'))throw Error('Missing tracked input '+f);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,bytes,{flag:'wx'});restored++;}
}console.log('PASS raw archive hashes; restored',restored,'missing ignored files without overwriting existing bytes.');
