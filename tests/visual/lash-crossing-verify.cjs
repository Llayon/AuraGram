'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),{spawn}=require('child_process');
const {chromium,webkit,devices}=require('@playwright/test');
async function main(){
 const geometryPath=process.argv[2],name=process.argv[3],engine=process.argv.includes('--webkit')?webkit:chromium;
 if(!geometryPath||!name||!/^[\w-]+$/.test(name))throw Error('Supply real geometry and NEW run name');
 const out=path.join(__dirname,'out',name);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,engine.name()+'.started'),'started',{flag:'wx'});
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),geometryBytes=fs.readFileSync(geometryPath),geometry=JSON.parse(geometryBytes);
 const bundle=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'expanded-evidence/candidate-sources.json.gz'))));
 const reference=path.join(out,'reference-src'),candidate=path.join(out,'candidate-src');
 if(!fs.existsSync(reference))for(const [file,r]of Object.entries(bundle)){const b=Buffer.from(r.base64,'base64');if(hash(b)!==r.sha256)throw Error('Reference hash');fs.mkdirSync(path.dirname(path.join(reference,file)),{recursive:true});fs.writeFileSync(path.join(reference,file),b,{flag:'wx'});}
 if(!fs.existsSync(candidate))for(const folder of ['retouch','vision','rendering'])fs.cpSync(path.join('src',folder),path.join(candidate,folder),{recursive:true});
 const sourceHashes={};for(const[which,folder]of [['reference',reference],['candidate',candidate]])sourceHashes[which]=Object.fromEntries(['retouch','vision','rendering'].flatMap(d=>fs.readdirSync(path.join(folder,d)).map(f=>[d+'/'+f,hash(fs.readFileSync(path.join(folder,d,f)))])));
 const images=new Map(),imageHashes={};for(const r of geometry.runs){const b=fs.readFileSync(path.join(__dirname,'out/dataset',r.file));images.set(r.file,b);imageHashes[r.file]=hash(b);}
 const manifest={engine:engine.name(),geometrySHA256:hash(geometryBytes),sourceHashes,imageHashes,runs:[],excluded:geometry.runs.filter(r=>!r.geometry).map(r=>({file:r.file,status:r.status}))};
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});let browser;
 try{const url=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);});server.on('error',reject);});
 browser=await engine.launch();const page=await browser.newPage(engine===webkit?devices['iPhone 11']:{}),requests=[];
 page.on('request',r=>requests.push(new URL(r.url()).pathname));await page.route('https://**/*',r=>r.abort());await page.route('**/__crossing_verify__',r=>r.fulfill({body:'<!doctype html><title>Crossing regression proof</title>',contentType:'text/html'}));
 await page.route('**/tests/visual/out/dataset/*',r=>r.fulfill({body:images.get(decodeURIComponent(new URL(r.request().url()).pathname.split('/').at(-1))),contentType:'image/jpeg'}));
 await page.exposeFunction('recordStep',row=>fs.appendFileSync(path.join(out,engine.name()+'-steps.jsonl'),JSON.stringify(row)+'\n'));
 await page.exposeFunction('savePNG',(file,data)=>{if(path.basename(file)!==file)throw Error('Path');fs.writeFileSync(path.join(out,file),Buffer.from(data.split(',')[1],'base64'),{flag:'wx'});});
 await page.goto(url+'/__crossing_verify__');
 for(const run of geometry.runs.filter(r=>r.geometry)){console.log(engine.name(),run.file);const result=await page.evaluate(async({run,name,engine})=>{
  const base='/tests/visual/out/'+name+'/',old=await import(base+'reference-src/retouch/lashAnalysis.mjs'),next=await import(base+'candidate-src/retouch/lashAnalysis.mjs');
  if(old.LASH_ANALYSIS_VERSION!=='g1c1-recovery-5-boundary-context'||next.LASH_ANALYSIS_VERSION!=='g1c1-recovery-6-crossing-length-abstention')throw Error('Unexpected algorithm');
  const oldPass=await import(base+'reference-src/retouch/lashEnhancement.mjs'),newPass=await import(base+'candidate-src/retouch/lashEnhancement.mjs');
  const im=new Image();im.src='/tests/visual/out/dataset/'+run.file;await im.decode();const W=im.width,H=im.height,eyes=run.geometry;
  if(W!==run.W||H!==run.H)throw Error('Dimensions');
  const previous=Object.fromEntries(['left','right'].map(s=>[s,old.analyzeEye(im,eyes[s],s)])),current=Object.fromEntries(['left','right'].map(s=>[s,next.analyzeEye(im,eyes[s],s)]));
  const analysisChecks={};
  for(const s of ['left','right']){const a=previous[s],b=current[s],cross=a.diagnostics?.crossing,abstain=!!cross?.paths.length;
   if(JSON.stringify(a.diagnostics?.crossing?.paths)!==JSON.stringify(b.diagnostics?.crossing?.paths))throw Error('Crossing observations changed');
   if(a.densityConfidence!==b.densityConfidence)throw Error('Density confidence changed');
   for(const key of ['densityRidge','densityConfidenceMap','rootConnectionMap'])if(a[key]?.length!==b[key]?.length||a[key]?.some((v,i)=>v!==b[key][i]))throw Error('Density map changed '+key);
   if(!abstain&&JSON.stringify(a.tips)!==JSON.stringify(b.tips))throw Error('Unblocked tip changed');
   if(abstain&&(b.tips.length||b.lengthConfidence))throw Error('Crossing abstention failed');
   analysisChecks[s]={paths:cross?.paths.length||0,coveredAxisFraction:cross?.coveredAxisFraction,oldOccluded:cross?.occluded,abstain,
    previousTips:a.tips.length,currentTips:b.tips.length,previousEligible:a.tips.filter(t=>t.c>=.6&&a.lengthConfidence>=.25).length,currentEligible:b.tips.filter(t=>t.c>=.6&&b.lengthConfidence>=.25).length,densityIdentical:true};
  }
  const bounds=Object.fromEntries(['left','right'].map(s=>{const r=eyes[s].roi;return[s,{x:Math.floor(r.x0*W),y:Math.floor(r.y0*H),w:Math.ceil(r.x1*W)-Math.floor(r.x0*W),h:Math.ceil(r.y1*H)-Math.floor(r.y0*H)}];}));
  const canvas=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(im,0,0);return c;};
  const compare=(a,b)=>{let changed=0,sum=0,outsideVeto=0;const ax=a.getContext('2d'),bx=b.getContext('2d');
   // Bound temporary readbacks: never retain two full native RGBA arrays.
   for(let y=0;y<H;y+=64){const h=Math.min(64,H-y),ad=ax.getImageData(0,y,W,h).data,bd=bx.getImageData(0,y,W,h).data;
    for(let i=0;i<ad.length;i+=4){let d=0;for(let k=0;k<4;k++)d+=Math.abs(ad[i+k]-bd[i+k]);if(d){changed++;sum+=d;const x=(i/4)%W,py=y+Math.floor(i/4/W);if(!Object.entries(bounds).some(([s,r])=>analysisChecks[s].abstain&&x>=r.x&&x<r.x+r.w&&py>=r.y&&py<r.y+r.h))outsideVeto++;}}
   }return {changedPixels:changed,absoluteRGBA:sum,outsideVeto};};
  async function save(label,c){const prefix=engine+'-'+run.file.replace('.jpg','')+'-'+label;
   const p=document.createElement('canvas'),scale=Math.min(1,720/Math.max(W,H));p.width=Math.round(W*scale);p.height=Math.round(H*scale);p.getContext('2d').drawImage(c,0,0,p.width,p.height);await window.savePNG(prefix+'-portrait720.png',p.toDataURL());p.width=p.height=0;
   for(const[s,r]of Object.entries(bounds)){const crop=document.createElement('canvas');crop.width=r.w;crop.height=r.h;crop.getContext('2d').drawImage(c,r.x,r.y,r.w,r.h,0,0,r.w,r.h);await window.savePNG(prefix+'-'+s+'-1x.png',crop.toDataURL());crop.width=crop.height=0;}
  }
  const comparisons=[],render={};
  for(const control of ['density','definition','length'])for(const strength of [0,1,25,50,75,100]){
   const a=canvas(),b=canvas();try{const setting={density:0,length:0,definition:0,[control]:strength};
    const oldResult=oldPass.applyLashPass(a.getContext('2d'),W,H,eyes,previous,setting,{diagnostics:true}),newResult=newPass.applyLashPass(b.getContext('2d'),W,H,eyes,current,setting,{diagnostics:true}),diff=compare(a,b);
    const record={file:run.file,control,strength,...diff};await window.recordStep(record);comparisons.push(record);
    if(control!=='length'&&diff.changedPixels)throw Error('Density/Definition pixel regression');
    if(control==='length'&&diff.outsideVeto)throw Error('Length changed outside vetoed ROI');
    if(control==='length'&&strength===100){render.previous=oldResult;render.current=newResult;await save('previous-length100',a);await save('current-length100',b);}
   }finally{a.width=a.height=b.width=b.height=0;}
  }
  return {file:run.file,W,H,geometry:eyes,analysisChecks,comparisons,render,previous:Object.fromEntries(Object.entries(previous).map(([s,a])=>[s,{tips:a.tips,lengthConfidence:a.lengthConfidence,diagnostics:a.diagnostics}])),current:Object.fromEntries(Object.entries(current).map(([s,a])=>[s,{tips:a.tips,lengthConfidence:a.lengthConfidence,diagnostics:a.diagnostics}]))};
 },{run,name,engine:engine.name()});manifest.runs.push(result);fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify(manifest,null,2));}
 if(requests.some(p=>/\.(wasm|task)$/.test(p)))throw Error('Unexpected model request');manifest.requests=requests;fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify(manifest,null,2));
 }finally{if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
