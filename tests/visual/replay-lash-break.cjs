'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),{hash}=require('./lash-domain-inputs.cjs'),base='tests/visual/break-evidence/',map=JSON.parse(fs.readFileSync(base+'files.json')),root=path.resolve('.');let restored=0;
for(const[f,m]of Object.entries(map)){
 const stored=fs.readFileSync(path.resolve(base,m.asset)),bytes=m.gzip?zlib.gunzipSync(stored):stored;if(hash(bytes)!==m.sha256)throw Error('Archive drift '+f);const dst=path.resolve(root,f);if(!dst.startsWith(root+path.sep))throw Error('Path escape');
 if(fs.existsSync(dst)){if(hash(fs.readFileSync(dst))!==m.sha256)throw Error('Refuse conflicting input '+f);}
 else{if(!f.startsWith('tests/visual/out/'))throw Error('Missing tracked input '+f);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,bytes,{flag:'wx'});restored++;}
}console.log('PASS raw archive hashes; restored',restored,'missing ignored files without overwriting existing bytes.');
