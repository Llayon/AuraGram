'use strict';
// Refuse detector execution until both original-only annotation sets are frozen.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const name=process.argv[2];if(!name||!/^[\w-]+$/.test(name))throw Error('Supply NEW run name');
const freeze=JSON.parse(fs.readFileSync(path.join(__dirname,'lash-positive-freeze.json')));
for(const[file,digest]of Object.entries(freeze.inputs))if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==digest)throw Error('Frozen annotation input changed: '+file);
const sources=JSON.parse(fs.readFileSync(path.join(__dirname,'lash-positive-sources.json'))).sources;
const files=[...sources.map(s=>s.file),'edge900.jpg','pexels-8727422.jpg','pexels-7123010.jpg','hair-occlusion.jpg'];
const args=[path.join(__dirname,'lash-fidelity.cjs')];if(process.argv.includes('--webkit'))args.push('--webkit');
const result=spawnSync(process.execPath,args,{windowsHide:true,stdio:'inherit',env:{...process.env,LASH_RUN:name,LASH_METADATA_ONLY:'1',LASH_FIXTURE:files.join(',')}});
if(result.error)throw result.error;process.exitCode=result.status??1;
