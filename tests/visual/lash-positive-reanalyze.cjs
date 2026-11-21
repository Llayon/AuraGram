'use strict';
// Offline ablation on frozen real geometry; no MediaPipe rerun.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process');
const {chromium,webkit,devices}=require('@playwright/test');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){const[input,name,graph]=process.argv.slice(2),engine=process.argv.includes('--webkit')?webkit:chromium;if(!input||!name||!graph||!/^[\w-]+$/.test(name))throw Error('Supply reference manifest, NEW run and candidate module graph');
 const out=path.join(__dirname,'out',name);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,engine.name()+'.started'),'started',{flag:'wx'});
 const frozen=path.join(out,'candidate-src');if(!fs.existsSync(frozen))fs.cpSync(graph,frozen,{recursive:true});
 const reference=path.dirname(input)+'/candidate-src',m=JSON.parse(fs.readFileSync(input));
 const moduleURL='/'+path.relative(process.cwd(),frozen).replaceAll(path.sep,'/')+'/retouch/lashAnalysis.mjs',referenceURL='/'+path.relative(process.cwd(),reference).replaceAll(path.sep,'/')+'/retouch/lashAnalysis.mjs';
 const output={...m,sourceHashes:{},referenceManifestSHA256:hash(fs.readFileSync(input)),runs:[],checks:[]};
 for(const dir of['retouch','vision','rendering'])for(const file of fs.readdirSync(path.join(frozen,dir)))output.sourceHashes[dir+'/'+file]=hash(fs.readFileSync(path.join(frozen,dir,file)));
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});let browser;
 try{const url=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);});server.on('error',reject);});browser=await engine.launch();const page=await browser.newPage(engine===webkit?devices['iPhone 11']:{}),requests=[];
 page.on('request',r=>requests.push(new URL(r.url()).pathname));await page.route('https://**/*',r=>r.abort());await page.route('**/__positive_ablation__',r=>r.fulfill({body:'<!doctype html><title>Frozen endpoint ablation</title>',contentType:'text/html'}));await page.goto(url+'/__positive_ablation__');
 for(const run of m.runs){if(!run.geometry){output.runs.push(run);continue;}console.log(engine.name(),run.file);
  const result=await page.evaluate(async({run,moduleURL,referenceURL})=>{const next=await import(moduleURL),old=await import(referenceURL),{endpointProfile}=await import('/tests/visual/lash-positive-endpoint-profile.mjs'),source=new Image();source.src='/tests/visual/out/dataset/'+run.file;await source.decode();if(source.width!==run.W||source.height!==run.H)throw Error('Dimensions');const budgets=[],checks=[];let perEye;
   for(const maxSide of[224,320,384]){const eyes={},full={};for(const side of['left','right']){const a=next.analyzeEye(source,run.geometry[side],side,{maxSide}),b=old.analyzeEye(source,run.geometry[side],side,{maxSide});if(a.densityConfidence!==b.densityConfidence)throw Error('Density confidence changed');for(const k of['densityRidge','densityConfidenceMap','rootConnectionMap'])if(a[k].some((v,i)=>v!==b[k][i]))throw Error('Density map changed');
    const roi=run.geometry[side].roi,c=document.createElement('canvas');c.width=b.rw;c.height=b.rh;const cx=c.getContext('2d');cx.drawImage(source,roi.x0*run.W,roi.y0*run.H,(roi.x1-roi.x0)*run.W,(roi.y1-roi.y0)*run.H,0,0,b.rw,b.rh);const rgba=cx.getImageData(0,0,b.rw,b.rh).data,luma=Float32Array.from({length:b.rw*b.rh},(_,i)=>old.lumaOf(rgba[i*4],rgba[i*4+1],rgba[i*4+2])/255);
    const fixed=b.tips.filter(t=>t.c>=.6&&b.lengthConfidence>=.25).map(t=>({tip:t,boundaryRecovery:!!t.evidence.boundaryRecovery,...endpointProfile(luma,b.rw,b.rh,t)}));c.width=c.height=0;
    const key=t=>JSON.stringify([t.x,t.y,t.dx,t.dy,t.c,t.length,t.width]),oldKeys=new Set(b.tips.map(key)),newKeys=new Set(a.tips.map(key));
    checks.push({file:run.file,side,maxSide,densityIdentical:true,previousTips:b.tips.length,currentTips:a.tips.length,fixedPreviousEligible:fixed,newCandidates:a.tips.filter(t=>!oldKeys.has(key(t))),removedCandidates:b.tips.filter(t=>!newKeys.has(key(t)))});full[side]=a;eyes[side]={rw:a.rw,rh:a.rh,size:a.size,confidence:a.confidence,densityConfidence:a.densityConfidence,lengthConfidence:a.lengthConfidence,tips:a.tips,diagnostics:a.diagnostics,typedArrayBytes:a.typedArrayBytes,retainedTypedArrayBytes:a.retainedTypedArrayBytes};}
    budgets.push({maxSide,times:[],eyes});if(maxSide===224)perEye=Object.fromEntries(Object.entries(full).map(([side,a])=>[side,{roi:run.geometry[side].roi,confidence:a.confidence,reason:a.reason,densityConfidence:a.densityConfidence,lengthConfidence:a.lengthConfidence,diagnostics:a.diagnostics,tips:a.tips,traces:a.traces}]));
   }return{run:{...run,budgets,perEye},checks};
  },{run,moduleURL,referenceURL});output.runs.push(result.run);output.checks.push(...result.checks);fs.writeFileSync(path.join(out,'manifest-'+engine.name()+'.json'),JSON.stringify(output,null,2));
 }if(requests.some(p=>/\.(wasm|task)$/.test(p)))throw Error('Unexpected model');output.requests=requests;fs.writeFileSync(path.join(out,'manifest-'+engine.name()+'.json'),JSON.stringify(output,null,2));
 }finally{if(browser)await browser.close();server.kill();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
