'use strict';
// Inspect frozen, real-image candidates without running FaceMesh again.
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('@playwright/test');
async function main(){
 const input=process.argv[2]||'tests/visual/out/recovery-final-09-streamed/manifest-chromium.json';
 const output=process.argv[3];if(!output)throw Error('Supply NEW output JSON path');
 if(fs.existsSync(output))throw Error('Output already exists');
 const manifest=JSON.parse(fs.readFileSync(input,'utf8'));
 const imageInputs={},imageBytes=new Map();
 for(const run of manifest.runs.filter(r=>r.perEye)){
  if(path.basename(run.file)!==run.file)throw Error('Invalid source filename');
  const bytes=fs.readFileSync(path.join(__dirname,'out/dataset',run.file));
  imageBytes.set(run.file,bytes);
  imageInputs[run.file]={sha256:require('node:crypto').createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
 }
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});let browser;
 try{
  const url=await new Promise(resolve=>server.stdout.on('data',d=>{const m=String(d).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);}));
  browser=await chromium.launch();const page=await browser.newPage(),requests=[];
  page.on('request',r=>requests.push(new URL(r.url()).pathname));
  await page.route('https://**/*',r=>r.abort());
  await page.route('**/tests/visual/out/dataset/*',r=>{
   const name=decodeURIComponent(new URL(r.request().url()).pathname.split('/').at(-1));
   return imageBytes.has(name)?r.fulfill({contentType:'image/jpeg',body:imageBytes.get(name)}):r.abort();
  });
  await page.route('**/__lash_profile__',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Inert RGB profile audit</title>'}));
  await page.goto(url+'/__lash_profile__');
  const rows=await page.evaluate(async runs=>{
   const rows=[];const luma=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
   for(const run of runs){if(!run.perEye)continue;
    const im=new Image();im.src='/tests/visual/out/dataset/'+run.file;await im.decode();
    if(im.width!==run.W||im.height!==run.H)throw Error('Source dimensions differ from frozen geometry: '+run.file);
    for(const [side,eye] of Object.entries(run.perEye)){
     const size=run.budgets.find(b=>b.maxSide===224).eyes[side],w=size.rw,h=size.rh,r=eye.roi;
     if(!w||!h){rows.push({file:run.file,sourceWidth:im.width,sourceHeight:im.height,side,tips:[],reason:'no-analysis-buffer'});continue;}
     const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(im,r.x0*im.width,r.y0*im.height,(r.x1-r.x0)*im.width,(r.y1-r.y0)*im.height,0,0,w,h);
     const data=x.getImageData(0,0,w,h).data;
     const sample=(x,y)=>{x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
      return [0,1,2].map(k=>[[x0,y0,(1-fx)*(1-fy)],[Math.min(w-1,x0+1),y0,fx*(1-fy)],[x0,Math.min(h-1,y0+1),(1-fx)*fy],[Math.min(w-1,x0+1),Math.min(h-1,y0+1),fx*fy]].reduce((a,[xx,yy,v])=>a+data[(yy*w+xx)*4+k]*v,0));};
     const tips=eye.tips.filter(t=>t.c>=.6&&eye.lengthConfidence>=.25).map(t=>{
      const points=t.evidence.points,px=-t.dy,py=t.dx,radius=t.width/2+1;
      const profile=points.slice(0,3).map(p=>{const center=sample(p.x,p.y),a=sample(p.x+px*radius,p.y+py*radius),b=sample(p.x-px*radius,p.y-py*radius),background=a.map((v,k)=>(v+b[k])/2);
       return {center,background,contrast:luma(background)-luma(center),sideDifference:Math.abs(luma(a)-luma(b))};});
      return {x:t.x,y:t.y,c:t.c,width:t.width,observedLength:t.length,color:t.color,profile,legacyStartAlpha:.26*t.c,legacyPredictedContrast:(luma(profile[0].background)-luma(t.color))*.26*t.c};
     });rows.push({file:run.file,sourceWidth:im.width,sourceHeight:im.height,side,tips});c.width=c.height=0;
    }
   }return rows;
  },manifest.runs);
  if(await page.evaluate(()=>!!window.AuraGram)||requests.some(p=>/\.(?:js|mjs|wasm|task)$/.test(p)))throw Error('Audit unexpectedly loaded app/model code');
  fs.writeFileSync(output,JSON.stringify({input,sourceHashes:manifest.sourceHashes,imageInputs,requests,
   auditorSHA256:require('node:crypto').createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
   geometryEngine:manifest.engine,decoderEngine:'chromium',
   context:'Chromium inert same-origin document, no app.js or FaceMesh; external requests blocked',rows},null,2),{flag:'wx'});
  console.log(rows.map(r=>({file:r.file,side:r.side,tips:r.tips.length,profiles:r.tips.map(t=>({contrast:t.profile.map(p=>+p.contrast.toFixed(2)),legacy:+t.legacyPredictedContrast.toFixed(2)}))})));
 }finally{if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
