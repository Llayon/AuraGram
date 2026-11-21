'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{spawn}=require('node:child_process');
const {chromium,webkit}=require('@playwright/test');
const hash=b=>createHash('sha256').update(b).digest('hex');
let createdOut=null,stage='initial';
async function bounded(promise,label,ms=20000){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timeout: '+label)),ms);})]);}finally{clearTimeout(timer);}
}
async function main(){
 const [inputDir,sourceFile,out]=process.argv.slice(2),ei=process.argv.indexOf('--engine'),engineName=ei<0?null:process.argv[ei+1];
 if(!out||fs.existsSync(out))throw Error('Supply saved native run, original JPEG and NEW output');
 if(ei>=0&&!['chromium','webkit'].includes(engineName))throw Error('Supply --engine chromium|webkit');
 const source=fs.readFileSync(sourceFile),old=JSON.parse(fs.readFileSync(path.join(inputDir,'protocol.json'))),specFile='tests/visual/lash-dense-link-protocol.json',spec=JSON.parse(fs.readFileSync(specFile));
 assert.equal(hash(source),old.sourceSHA256);
 for(const [f,h]of Object.entries(old.moduleSHA256))assert.equal(hash(fs.readFileSync(f)),h,'Changed native dependency '+f);
 fs.mkdirSync(out,{recursive:true});
 createdOut=out;
 const progress=label=>{stage=label;fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({stage,updatedUTC:new Date().toISOString()})+'\n');};
 fs.writeFileSync(path.join(out,'protocol.json'),JSON.stringify({kind:'same-point-axis-dense-diagnostic',inputDir,sourceSHA256:hash(source),inputProtocolSHA256:hash(fs.readFileSync(path.join(inputDir,'protocol.json'))),moduleSHA256:{...old.moduleSHA256,[specFile]:hash(fs.readFileSync(specFile))},runnerSHA256:hash(fs.readFileSync(__filename)),spec,engineSelection:engineName,annotationsUsed:false,grantsTerminal:false},null,2)+'\n',{flag:'wx'});
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});
 try{
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),15000);server.once('error',e=>{clearTimeout(timer);reject(e);});server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});});
 for(const engine of [chromium,webkit].filter(e=>!engineName||engineName===e.name())){
  const file=path.join(inputDir,engine.name()+'.json'),bytes=fs.readFileSync(file),saved=JSON.parse(bytes);
  assert.equal(saved.sourceSHA256,hash(source));
  progress(engine.name()+':launch');
  const browser=await engine.launch({timeout:15000});try{
   progress(engine.name()+':new-page');const page=await bounded(browser.newPage(),'new page');
   await page.route('https://**/*',r=>r.abort());await page.route('**/__dense_link__',r=>r.fulfill({body:'<!doctype html>',contentType:'text/html'}));
   progress(engine.name()+':navigation');await page.goto(url+'/__dense_link__',{timeout:15000});
   progress(engine.name()+':measurement');
   const records=await bounded(page.evaluate(async({data,saved,spec})=>{
    const {createNativePatchReader,NATIVE_PATH_PROTOCOL:p}=await import('/tests/visual/lash-native-path.mjs');
    const {measureCentroid}=await import('/tests/visual/lash-subpixel-center.mjs');
    const {measureAt}=await import('/tests/visual/lash-endpoint-profile.mjs');
    if(p.observationFloor!==spec.floor)throw Error('Observation floor changed');
    const image=new Image();image.src=data;await image.decode();const reader=createNativePatchReader(image),buffer=new Float32Array(256*256),results=[];
    try{for(const [side,eye]of Object.entries(saved.run))for(const r of eye.results||[]){
     if(r.local?.reason!=='unconfirmed-dense-link')continue;
     const failed=r.local.attempts.at(-1),previous=r.local.attempts.filter(a=>a.linkAccepted).at(-1)?.center??r.local.bootstrap.find(b=>b.distance===0)?.center;
     if(!previous||!failed?.accepted||failed.linkAccepted)throw Error('Missing original failed-link endpoints');
     const rect=r.patch,luma=buffer.subarray(0,rect.w*rect.h);reader.readPatch(rect,luma);
     const prior=failed.tangent,reference={x:previous.x+prior.x*p.stepNative,y:previous.y+prior.y*p.stepNative};
     const m=measureCentroid(luma,rect.w,rect.h,reference,prior,1.5,p);
     const errors=[Math.abs(m.center?.x-failed.center.x),Math.abs(m.center?.y-failed.center.y),Math.abs(m.shift-failed.shift),Math.abs(m.variance-failed.variance)];
     if(!m.accepted||errors.some(v=>!Number.isFinite(v)||v>spec.candidateReproductionTolerance))throw Error('Candidate measurement differs');
     const dx=m.center.x-previous.x,dy=m.center.y-previous.y,length=Math.hypot(dx,dy),segment={x:dx/length,y:dy/length},count=Math.ceil(length/p.denseStepNative),samples=[];
     if(!Number.isFinite(length)||length<=0)throw Error('Degenerate measured link');
     for(let k=0;k<=count;k++){
      const t=k/count,point={x:previous.x+dx*t,y:previous.y+dy*t};
      const read=u=>measureAt(luma,rect.w,rect.h,point,u,{x:-u.y,y:u.x},p.radiiNative);
      samples.push({position:k===0?'start':k===count?'end':'interior',point,segment:read(segment),prior:read(prior)});
     }
     if(samples.every(s=>s.segment.response>=spec.floor))throw Error('Original failed link no longer fails');
     results.push({side,rank:r.rank,index:r.index,patch:rect,coordinateSpace:'patch-local-source-pixels',previous,candidate:m.center,prior,segment,length,angleDegrees:Math.acos(Math.max(-1,Math.min(1,prior.x*segment.x+prior.y*segment.y)))*180/Math.PI,reproductionMaximumError:Math.max(...errors),segmentSupported:false,priorSupported:samples.every(s=>s.prior.response>=spec.floor),samples,endpointConfirmed:false});
    }}finally{reader.dispose();}return results;
   },{data:'data:image/jpeg;base64,'+source.toString('base64'),saved,spec}),'native dense measurement');
   const summary={records:records.length,distinctLinks:new Set(records.map(r=>JSON.stringify([r.side,r.patch,r.previous,r.candidate,r.prior]))).size,priorSupportedRecords:records.filter(r=>r.priorSupported).length,byPosition:{}};
   for(const pos of ['start','interior','end']){const samples=records.flatMap(r=>r.samples.filter(s=>s.position===pos));summary.byPosition[pos]={samples:samples.length,segmentBelowFloor:samples.filter(s=>s.segment.response<spec.floor).length,priorBelowFloor:samples.filter(s=>s.prior.response<spec.floor).length,segmentTransverseBelowFloor:samples.filter(s=>s.segment.transverseContrast<spec.floor).length};}
   fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify({engine:engine.name(),inputSHA256:hash(bytes),summary,records},null,2)+'\n',{flag:'wx'});console.log(engine.name(),JSON.stringify(summary));
   progress(engine.name()+':measured');
  }finally{await bounded(browser.close(),'browser close',5000);}
 }
 for(const [f,h]of Object.entries(old.moduleSHA256))assert.equal(hash(fs.readFileSync(f)),h,'Changed dependency during diagnosis');
 }finally{server.kill();}
}
main().catch(e=>{if(createdOut)fs.writeFileSync(path.join(createdOut,'failure.json'),JSON.stringify({stage,message:e.message,notAPass:true},null,2)+'\n',{flag:'wx'});console.error(e);process.exitCode=1;});
