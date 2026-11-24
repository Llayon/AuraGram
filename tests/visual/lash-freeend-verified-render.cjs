'use strict';
// Bind source/module/baseline bytes before AND after rendering. Preserve first-use runs.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{spawnSync}=require('child_process'),verify=require('./lash-freeend-inputs.cjs');
const[input,name]=process.argv.slice(2),engine=process.argv.includes('--webkit')?'webkit':'chromium';if(!input||!name||!/^[\w-]+$/.test(name))throw Error('Supply ANALYSIS NEW_RUN [--webkit]');
const before=verify(input,engine),batch=input.includes('freeend2-')?'freeend2':'freeend',script=path.join(__dirname,'lash-'+batch+'-render.cjs');
const result=spawnSync(process.execPath,[script,input,name,...(engine==='webkit'?['--webkit']:[])],{stdio:'inherit',windowsHide:true});if(result.status!==0)process.exit(result.status||1);
assert.deepEqual(verify(input,engine),before);const file=path.join(__dirname,'out',name,'manifest-'+engine+'.json');
fs.writeFileSync(path.join(path.dirname(file),'verified-'+engine+'.json'),JSON.stringify({...before,helperSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'lash-freeend-inputs.cjs'))).digest('hex'),manifestSHA256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),beforeAfterIdentical:true},null,2)+'\n',{flag:'wx'});
