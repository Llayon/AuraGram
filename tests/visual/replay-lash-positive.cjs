'use strict';
// Restore only into a NEW run; existing source bytes must match, never overwrite.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const target=process.argv[2],evidence=path.join(__dirname,'positive-evidence');if(!target||fs.existsSync(target))throw Error('Supply NEW replay directory');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),packed=n=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(evidence,n+'.json.gz'))));
const safeWrite=(file,bytes,digest)=>{if(hash(bytes)!==digest)throw Error('Bundle bytes corrupt');if(fs.existsSync(file)){if(hash(fs.readFileSync(file))!==digest)throw Error('Existing file differs: '+file);return;}fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});};
fs.mkdirSync(target,{recursive:true});
for(const[name,folder]of[['product',path.join(target,'candidate-src')],['experiment',path.join(target,'experiment-src')],['production',path.join(__dirname,'out/baseline-src')]])for(const[file,entry]of Object.entries(packed(name+'-sources')))safeWrite(path.join(folder,file),Buffer.from(entry.base64,'base64'),entry.sha256);
for(const e of['chromium','webkit']){const b=zlib.gunzipSync(fs.readFileSync(path.join(evidence,'geometry-'+e+'.json.gz')));fs.writeFileSync(path.join(target,'geometry-'+e+'.json'),b,{flag:'wx'});}
for(const s of JSON.parse(fs.readFileSync(path.join(evidence,'sources.json'))).sources)safeWrite(path.join(__dirname,'out/dataset',s.file),fs.readFileSync(path.join(evidence,s.path)),s.sha256);
console.log('Restored frozen geometry, product/experimental/production source graphs and matching source JPEGs. No model run or product change.');
