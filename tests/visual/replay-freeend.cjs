'use strict';
// Restore ignored inputs only; never overwrite a conflicting working file.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const base=path.join(__dirname,'freeend-evidence'),map=JSON.parse(fs.readFileSync(path.join(base,'files.json'))),root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');let restored=0;
for(const [relative,m]of Object.entries(map)){
 const dst=path.resolve(root,relative);if(!dst.startsWith(root+path.sep))throw Error('Path escape');
 const stored=fs.readFileSync(path.join(base,m.asset)),bytes=m.gzip?zlib.gunzipSync(stored):stored;if(hash(bytes)!==m.sha256)throw Error('Archive drift '+relative);
 if(fs.existsSync(dst)){if(hash(fs.readFileSync(dst))!==m.sha256)throw Error('Refuse conflicting input '+relative);}
 else{if(!relative.startsWith('tests/visual/out/'))throw Error('Tracked input missing '+relative);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,bytes,{flag:'wx'});restored++;}
}
console.log('PASS archive hashes; restored',restored,'missing ignored inputs. No existing bytes overwritten.');
