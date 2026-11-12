'use strict';
// Replay measured geometry only; labels are neither read nor supplied.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process'),{chromium,webkit}=require('@playwright/test');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const[input,name]=process.argv.slice(2),engine=process.argv.includes('--webkit')?webkit:chromium;if(!input||!name||!/^[\w-]+$/.test(name))throw Error('Supply ANALYSIS NEW_RUN [--webkit]');
 const verifiedInputs=require('./lash-freeend-inputs.cjs')(input,engine.name());
 const reference=JSON.parse(fs.readFileSync(input));if(reference.engine!==engine.name())throw Error('Engine mismatch');
 const base=path.dirname(input),batch=base.includes('freeend2-')?'freeend2':'freeend',out=path.join(__dirname,'out',name);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,batch+'-'+engine.name()+'.started'),'started',{flag:'wx'});
 for(const[f,d]of Object.entries(reference.sourceHashes))if(hash(fs.readFileSync(path.join(base,'candidate-src',f)))!==d)throw Error('Snapshot drift');
 const result={engine:engine.name(),referenceSHA256:hash(fs.readFileSync(input)),harnessSHA256:hash(fs.readFileSync(__filename)),legend:'Maps: grayscale engineering response/confidence0..255, not calibrated probabilities. Black after early occlusion gate means NOT ANALYZED, not no hair. Traces: green=accepted, red=rejected, cyan=tip, yellow=measured tangent. Tiny working-grid plots contain no new detail. Extension diagnostics are native-image coordinates/lengths at Length50.',runs:[]};
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});let browser;
 try{
  const url=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);});server.on('error',reject);});browser=await engine.launch();const page=await browser.newPage(),requests=[];page.on('request',r=>requests.push(new URL(r.url()).pathname));await page.route('https://**/*',r=>r.abort());await page.route('**/__freeend_debug__',r=>r.fulfill({body:'<!doctype html><title>Frozen debug only</title>',contentType:'text/html'}));await page.goto(url+'/__freeend_debug__');
  await page.exposeFunction('saveFreeendDebug',(file,png)=>{if(path.basename(file)!==file)throw Error('Path');fs.writeFileSync(path.join(out,file),Buffer.from(png.split(',')[1],'base64'),{flag:'wx'});});
  for(const run of reference.runs){if(run.status!=='ready'){result.runs.push({file:run.file,status:run.status});continue;}
   const record=await page.evaluate(async({run,base,batch,engine})=>{
    const mods='/'+base.replaceAll('\\','/')+'/candidate-src/retouch/',{analyzeEye}=await import(mods+'lashAnalysis.mjs'),{applyLashPass}=await import(mods+'lashEnhancement.mjs');const im=new Image();im.src='/tests/visual/out/'+batch+'-01-download/'+run.file;await im.decode();const eyes={},maps=[];
    for(const side of ['left','right']){const a=analyzeEye(im,run.geometry[side],side,{maxSide:224});eyes[side]=a;if(JSON.stringify(a.tips)!==JSON.stringify(run.budgets[0].eyes[side].tips))throw Error('Analysis replay differs');
     const c=document.createElement('canvas');c.width=a.rw;c.height=a.rh;const x=c.getContext('2d');
     for(const key of ['ridgeResponseMap','densityConfidenceMap','densityRidge']){const p=x.createImageData(c.width,c.height);for(let i=0;i<a.rw*a.rh;i++){p.data[i*4]=p.data[i*4+1]=p.data[i*4+2]=a[key]?.[i]||0;p.data[i*4+3]=255;}x.putImageData(p,0,0);const f=engine+'-'+run.file+'-'+side+'-'+key+'.png';await window.saveFreeendDebug(f,c.toDataURL());maps.push({side,key,file:f,reason:a.reason});}
     x.drawImage(im,run.geometry[side].roi.x0*im.width,run.geometry[side].roi.y0*im.height,(run.geometry[side].roi.x1-run.geometry[side].roi.x0)*im.width,(run.geometry[side].roi.y1-run.geometry[side].roi.y0)*im.height,0,0,c.width,c.height);
     for(const t of a.traces){x.strokeStyle=t.reason==='ok'?'#00ff55':'#ff3344';x.lineWidth=.5;x.beginPath();t.points.forEach((p,i)=>i?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y));x.stroke();}
     for(const t of a.tips){const px=t.x*a.rw,py=t.y*a.rh;x.strokeStyle='#ffff00';x.beginPath();x.moveTo(px,py);x.lineTo(px+t.dx*6,py+t.dy*6);x.stroke();x.fillStyle='#00ffff';x.fillRect(px-.5,py-.5,1,1);}
     const f=engine+'-'+run.file+'-'+side+'-traces.png';await window.saveFreeendDebug(f,c.toDataURL());maps.push({side,key:'traces',file:f,reason:a.reason});c.width=c.height=0;
    }
    const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);let diagnostics;try{diagnostics=applyLashPass(x,c.width,c.height,run.geometry,eyes,{density:0,length:50,definition:0},{diagnostics:true});}finally{c.width=c.height=0;im.src='';}return{file:run.file,status:'ready',maps,diagnostics};
   },{run,base,batch,engine:engine.name()});result.runs.push(record);
  }
  if(requests.some(p=>/\.(wasm|task)$/.test(p)))throw Error('Unexpected model inference');if(JSON.stringify(require('./lash-freeend-inputs.cjs')(input,engine.name()))!==JSON.stringify(verifiedInputs))throw Error('Input drift during debug');result.verifiedInputs=verifiedInputs;result.requests=requests;fs.writeFileSync(path.join(out,batch+'-'+engine.name()+'.json'),JSON.stringify(result,null,2)+'\n');
 }finally{if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
