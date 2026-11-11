'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const root=path.join(__dirname,'expanded-evidence'),target=process.argv[2];if(!target||fs.existsSync(target))throw Error('Supply NEW replay directory');
fs.mkdirSync(target,{recursive:true});const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bundle=JSON.parse(zlib.gunzipSync(fs.readFileSync(root+'/candidate-sources.json.gz')));
for(const [file,record]of Object.entries(bundle)){if(path.isAbsolute(file)||file.split('/').includes('..'))throw Error('Unsafe path');const b=Buffer.from(record.base64,'base64');if(hash(b)!==record.sha256)throw Error('Source hash mismatch');const p=path.join(target,'candidate-src',file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b,{flag:'wx'});}
for(const engine of ['chromium','webkit'])fs.writeFileSync(path.join(target,'geometry-'+engine+'.json'),zlib.gunzipSync(fs.readFileSync(`${root}/geometry-${engine}.json.gz`)),{flag:'wx'});
for(const r of JSON.parse(fs.readFileSync(root+'/sources.json')).records){const bytes=fs.readFileSync(root+'/sources/'+r.file);if(hash(bytes)!==r.sha256)throw Error('Fixture hash mismatch');const p=path.join(__dirname,'out/dataset',r.file);fs.mkdirSync(path.dirname(p),{recursive:true});if(fs.existsSync(p)){if(hash(fs.readFileSync(p))!==r.sha256)throw Error('Existing dataset differs; not overwritten');}else fs.writeFileSync(p,bytes,{flag:'wx'});}
console.log('Verified native JPEGs and restored frozen sources/geometry. For rendering choose this replay path as a NEW LASH_RUN under tests/visual/out. Baseline graph must be prepared from git history.');
