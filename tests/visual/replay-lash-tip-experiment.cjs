'use strict';
// Reconstruct a rejected experiment in the audit directory, never in src/.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {execFileSync,spawnSync}=require('node:child_process');
const names={11:'recovery-tip-profile-11',12:'recovery-tip-profile-12-linear',13:'recovery-tip-transport-13'};
const experiment=names[process.argv[2]],run=process.argv[3];
if(!experiment||!run||!/^[\w-]+$/.test(run))throw Error('Usage: node tests/visual/replay-lash-tip-experiment.cjs 11|12|13 NEW_LASH_RUN [--webkit]');
const evidence=path.join(__dirname,'recovery-followup-evidence');
const input=path.join(evidence,experiment,'manifest-chromium.json.gz');
const original=JSON.parse(zlib.gunzipSync(fs.readFileSync(input)).toString('utf8'));
const destination=path.join(__dirname,'out',run);
if(fs.existsSync(destination))throw Error('Run already exists');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const [relative,expected] of Object.entries(original.sourceHashes)){
 if(!/^(retouch|rendering|vision)\/[\w.-]+$/.test(relative))throw Error('Invalid frozen path');
 const candidate=path.join(evidence,experiment,'experimental-src',path.basename(relative));
 let bytes=relative.startsWith('retouch/')&&fs.existsSync(candidate)?fs.readFileSync(candidate):execFileSync('git',['show','b46b2855f3b8cbd4e0fd990c420bfbdf15151557:src/'+relative]);
 // Preserve the original raw hashes, including checkout CRLF when applicable.
 if(hash(bytes)!==expected)bytes=Buffer.from(bytes.toString('utf8').replace(/\r?\n/g,'\r\n'));
 if(hash(bytes)!==expected)throw Error('Frozen source mismatch: '+relative);
 const target=path.join(destination,'candidate-src',relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});
}
if(process.argv.includes('--prepare-only')){
 console.log('Frozen source graph verified; no browser launched: '+destination);
}else{
const result=spawnSync(process.execPath,[path.join(__dirname,'lash-fidelity.cjs'),...(process.argv.includes('--webkit')?['--webkit']:[])],{
 env:{...process.env,LASH_RUN:run,LASH_FIXTURE:process.env.LASH_FIXTURE||'light.jpg,natural.jpg'},stdio:'inherit',windowsHide:true
});
process.exitCode=result.status??1;
}
