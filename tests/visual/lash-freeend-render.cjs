'use strict';
// Replay frozen real geometry/analysis; annotations enter only crop extraction.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process'),{chromium,webkit,devices}=require('@playwright/test');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const[input,name]=process.argv.slice(2),engine=process.argv.includes('--webkit')?webkit:chromium;if(!input||!name||!/^[\w-]+$/.test(name))throw Error('Supply ANALYSIS NEW_RUN [--webkit]');
 const reference=JSON.parse(fs.readFileSync(input)),out=path.join(__dirname,'out',name);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,engine.name()+'.started'),'started',{flag:'wx'});
 const freeze=JSON.parse(fs.readFileSync(path.join(__dirname,'lash-freeend-freeze.json')));for(const[f,d]of Object.entries(freeze.inputs))if(hash(fs.readFileSync(f))!==d)throw Error('Frozen labels drift');
 const labels=JSON.parse(fs.readFileSync(path.join(__dirname,'lash-freeend-independent-labels.json'))),moduleURL='/'+path.relative(process.cwd(),path.dirname(input)).replaceAll(path.sep,'/')+'/candidate-src/retouch/',baselineURL='/tests/visual/out/freeend-baseline-src/retouch/';
 const data={engine:engine.name(),referenceSHA256:hash(fs.readFileSync(input)),harnessSHA256:hash(fs.readFileSync(__filename)),meaning:'Pure lash-only comparison, native-source analysis. Same frozen real geometry; no MediaPipe rerun or manual seeds. Labels select output crops only after analysis.',runs:[]};
 let browser;const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});
 try{
  const url=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);});server.on('error',reject);});browser=await engine.launch();const page=await browser.newPage(engine===webkit?devices['iPhone 11']:{}),requests=[];page.on('request',r=>requests.push(new URL(r.url()).pathname));await page.route('https://**/*',r=>r.abort());await page.route('**/__freeend_render__',r=>r.fulfill({body:'<!doctype html><title>Frozen free-end render</title>',contentType:'text/html'}));await page.goto(url+'/__freeend_render__');
  await page.exposeFunction('writeFreeendPNG',(file,png)=>{if(path.basename(file)!==file)throw Error('Path');const b=Buffer.from(png.split(',')[1],'base64');fs.writeFileSync(path.join(out,file),b,{flag:'wx'});});
  for(const run of reference.runs){
   if(run.status!=='ready'){data.runs.push({file:run.file,status:run.status,render:'SKIPPED_NO_FACE_NO_GEOMETRY'});continue;}
   console.log(engine.name(),run.file);
   // No label coordinate, angle, crop or manual status is sent in this call.
   await page.evaluate(async({run,moduleURL,baselineURL})=>{
    const next=await import(moduleURL+'lashAnalysis.mjs'),old=await import(baselineURL+'lashAnalysis.mjs'),oldGeo=await import(baselineURL+'eyeGeometry.mjs'),nextPass=await import(moduleURL+'lashEnhancement.mjs'),oldPass=await import(baselineURL+'lashEnhancement.mjs');
    const im=new Image();im.src='/tests/visual/out/freeend-01-download/'+run.file;await im.decode();const eyes=run.geometry;
    const a=Object.fromEntries(['left','right'].map(s=>[s,next.analyzeEye(im,eyes[s],s,{maxSide:224})]));
    for(const s of ['left','right'])if(JSON.stringify(a[s].tips)!==JSON.stringify(run.budgets[0].eyes[s].tips))throw Error('Frozen analysis replay differs');
    // Invert the verified canonical ring topology; no inferred/manual landmarks.
    const currentGeo=await import(moduleURL+'eyeGeometry.mjs');let roundtripMaxError=0;
    const reconstruct=(side,e)=>{const middle=e.upperLid.slice(1,-1),ring=e.lowerLid.concat(side==='left'?middle.slice().reverse():middle);if(ring.length!==16)throw Error('Canonical ring');const minY=Math.min(...ring.map(p=>p.y));if(!(e.roi.y0>0))throw Error('Need unclipped measured margin for exact face-width recovery');const fw=(minY-e.roi.y0-e.h*1.1)/.012;if(!(fw>=.01))throw Error('Face-width recovery');const replay=currentGeo.describeEye(ring,e.browPoints,fw,side==='left');const check=(a,b)=>{if(typeof a==='number'){const d=Math.abs(a-b);roundtripMaxError=Math.max(roundtripMaxError,d);if(d>1e-12)throw Error('Geometry roundtrip');}else if(a&&typeof a==='object'){for(const k of Object.keys(a))check(a[k],b[k]);}else if(a!==b)throw Error('Geometry roundtrip');};check(replay,e);return oldGeo.describeEye(ring,e.browPoints,fw,side==='left');};
    const oldEyes=Object.fromEntries(['left','right'].map(s=>[s,reconstruct(s,eyes[s])]));
    const b=Object.fromEntries(['left','right'].map(s=>[s,old.analyzeEye(im,oldEyes[s],s)]));
    window.__freeend={im,eyes,oldEyes,a,b,nextPass,oldPass,roundtripMaxError};
   },{run,moduleURL,baselineURL});
   const views=labels.views.filter(v=>v.source===run.file).flatMap(v=>v.labels.map(l=>{const r=(v.labelCoordinateFrame||v.crop).sourceRectXYWH;return{id:l.id,x:Math.floor(r[0]+l.tipNative[0])-80,y:Math.floor(r[1]+l.tipNative[1])-80,w:160,h:160};}));
   for(const[s,a]of Object.entries(run.budgets[0].eyes))for(let i=0;i<a.tips.length;i++){const t=a.tips[i],r=run.geometry[s].roi;views.push({id:'auto-'+s+'-'+i,x:Math.floor((r.x0+t.x*(r.x1-r.x0))*run.W)-80,y:Math.floor((r.y0+t.y*(r.y1-r.y0))*run.H)-80,w:160,h:160});}
   const rendered=await page.evaluate(async({file,engine,views})=>{
    const D=window.__freeend,c=document.createElement('canvas');c.width=D.im.width;c.height=D.im.height;const x=c.getContext('2d'),preview=document.createElement('canvas');preview.width=Math.min(1080,c.width);preview.height=Math.round(preview.width*c.height/c.width);const px=preview.getContext('2d'),records=[],originalCrops=new Map();
    const settings=[['original',null,{}],['production-density50','old',{density:50}],['recovery-density50','new',{density:50}],['production-length50','old',{length:50}],['recovery-length50','new',{length:50}],['definition50','new',{definition:50}],['combined-natural','new',{density:35,length:20,definition:25}]];
    try{for(const[name,which,lashes]of settings){x.drawImage(D.im,0,0);const diagnostics=which?(which==='old'?D.oldPass:D.nextPass).applyLashPass(x,c.width,c.height,which==='old'?D.oldEyes:D.eyes,which==='old'?D.b:D.a,{density:0,length:0,definition:0,...lashes},{}):null;px.drawImage(c,0,0,preview.width,preview.height);const full=engine+'-'+file+'-'+name+'-portrait.png';await window.writeFreeendPNG(full,preview.toDataURL());const crops=[];
     for(const v of views){if(v.x<0||v.y<0||v.x+v.w>c.width||v.y+v.h>c.height)throw Error('Output crop outside source');const q=document.createElement('canvas');q.width=v.w;q.height=v.h;const qx=q.getContext('2d');qx.drawImage(c,v.x,v.y,v.w,v.h,0,0,v.w,v.h);const pixels=qx.getImageData(0,0,v.w,v.h);let difference=0;if(name==='original')originalCrops.set(v.id,pixels.data.slice());else{const base=originalCrops.get(v.id);for(let i=0;i<pixels.data.length;i++)if(i%4!==3)difference+=Math.abs(pixels.data[i]-base[i]);}
      const fn=engine+'-'+file+'-'+v.id+'-'+name+'-native.png';await window.writeFreeendPNG(fn,q.toDataURL());crops.push({...v,file:fn,rgbDifference:difference});
      if(name==='combined-natural'){const base=originalCrops.get(v.id);for(let i=0;i<pixels.data.length;i++)pixels.data[i]=i%4===3?255:Math.min(255,Math.abs(pixels.data[i]-base[i])*8);qx.putImageData(pixels,0,0);const diff=engine+'-'+file+'-'+v.id+'-difference8x.png';await window.writeFreeendPNG(diff,q.toDataURL());crops.push({...v,file:diff,meaning:'Absolute combined-original RGB difference amplified8x'});}q.width=q.height=0;
     }records.push({name,portrait:full,diagnostics,crops});}
    }finally{c.width=c.height=preview.width=preview.height=0;D.im.src='';window.__freeend=null;}
    return{file,status:'ready',records,geometryRoundtripMaxError:D.roundtripMaxError};
   },{file:run.file,engine:engine.name(),views});data.runs.push(rendered);fs.writeFileSync(path.join(out,'manifest-'+engine.name()+'.json'),JSON.stringify(data,null,2));
  }
  if(requests.some(p=>/\.(task|wasm)$/.test(p)))throw Error('Unexpected inference in frozen render');data.requests=requests;fs.writeFileSync(path.join(out,'manifest-'+engine.name()+'.json'),JSON.stringify(data,null,2));
 }finally{if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
