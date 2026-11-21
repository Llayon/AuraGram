'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),{spawnSync}=require('child_process');
const name=process.argv[2];if(!name||!/^[\w-]+$/.test(name))throw Error('Supply NEW metadata run name');
const older=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'localization-evidence/geometry.json.gz'))));
const expanded=JSON.parse(fs.readFileSync(path.join(__dirname,'expanded-evidence/sources.json')));
const files=[...new Set([...older.runs.map(r=>r.file),...expanded.records.map(r=>r.file)])];
const args=[path.join(__dirname,'lash-fidelity.cjs')];if(process.argv.includes('--webkit'))args.push('--webkit');
const result=spawnSync(process.execPath,args,{cwd:path.resolve(__dirname,'../..'),windowsHide:true,stdio:'inherit',env:{...process.env,LASH_RUN:name,LASH_FIXTURE:files.join(','),LASH_METADATA_ONLY:'1'}});
if(result.error)throw result.error;process.exitCode=result.status??1;
