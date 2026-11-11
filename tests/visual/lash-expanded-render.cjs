'use strict';
// Frozen real geometry; no new model calls. Native applicator + eye crops,
// small full-frame viewing PNGs. Original native JPEGs remain authoritative.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process');
const {chromium,webkit,devices}=require('@playwright/test');
async function main(){
 const geometryPath=process.argv[2],name=process.argv[3],engine=process.argv.includes('--webkit')?webkit:chromium;
 if(!geometryPath||!name||!/^[\w-]+$/.test(name))throw Error('Supply frozen geometry and NEW run name');
 const out=path.join(__dirname,'out',name),geometryBytes=fs.readFileSync(geometryPath),geometry=JSON.parse(geometryBytes),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,engine.name()+'.started'),'started',{flag:'wx'});
 const snapshot=path.join(out,'candidate-src');if(!fs.existsSync(snapshot))for(const f of ['retouch','vision','rendering'])fs.cpSync(path.join('src',f),path.join(snapshot,f),{recursive:true});
 const images=new Map(),imageHashes={};for(const r of geometry.runs){const b=fs.readFileSync(path.join(__dirname,'out/dataset',r.file));images.set(r.file,b);imageHashes[r.file]=hash(b);}
 const sourceHashes={};for(const d of ['retouch','vision','rendering'])for(const f of fs.readdirSync(path.join(snapshot,d)))sourceHashes[d+'/'+f]=hash(fs.readFileSync(path.join(snapshot,d,f)));
 const manifest={geometryPath,geometrySHA256:hash(geometryBytes),engine:engine.name(),imageHashes,sourceHashes,runs:[],excluded:geometry.runs.filter(r=>!r.geometry).map(r=>({file:r.file,status:r.status,reason:r.excludedReason})),note:'Frozen real FaceMesh geometry. Original ring recovered by inverse of canonical topology and roundtrip checked. Native effects; full-frame viewing previews are720px. No model rerun or new geometry.'};
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});let browser;
 try{const url=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);});server.on('error',reject);});
 browser=await engine.launch();const page=await browser.newPage(engine===webkit?devices['iPhone 11']:{}),requests=[];
 page.on('request',r=>requests.push(new URL(r.url()).pathname));await page.route('https://**/*',r=>r.abort());await page.route('**/__expanded_render__',r=>r.fulfill({body:'<!doctype html><title>Frozen real portrait matrix</title>',contentType:'text/html'}));
 await page.route('**/tests/visual/out/dataset/*',r=>{const f=decodeURIComponent(new URL(r.request().url()).pathname.split('/').at(-1));return r.fulfill({body:images.get(f),contentType:'image/jpeg'});});
 await page.exposeFunction('savePNG',(file,data)=>{if(path.basename(file)!==file)throw Error('Bad path');fs.writeFileSync(path.join(out,file),Buffer.from(data.split(',')[1],'base64'),{flag:'wx'});});
 await page.goto(url+'/__expanded_render__');
 for(const run of geometry.runs.filter(r=>r.geometry)){console.log(engine.name(),run.file);const result=await page.evaluate(async({run,name,engine})=>{
  const prefix='/tests/visual/out/'+name+'/candidate-src/retouch/',geo=await import(prefix+'eyeGeometry.mjs'),an=await import(prefix+'lashAnalysis.mjs'),pass=await import(prefix+'lashEnhancement.mjs');
  const oldPrefix='/tests/visual/out/baseline-src/retouch/',oldGeo=await import(oldPrefix+'eyeGeometry.mjs'),oldAn=await import(oldPrefix+'lashAnalysis.mjs'),oldPass=await import(oldPrefix+'lashEnhancement.mjs');
  const eyes=run.geometry,oldEyes={},roundtrip={};
  for(const side of ['left','right']){const e=eyes[side],ring=e.lowerLid.map(p=>({...p}));
   const indices=side==='left'?[0,15,14,13,12,11,10,9,8]:[0,9,10,11,12,13,14,15,8];
   indices.forEach((index,i)=>{ring[index]={...e.upperLid[i]};});if(ring.length!==16||ring.some(p=>!p))throw Error('Incomplete actual ring');
   const x0=Math.min(...ring.map(p=>p.x)),x1=Math.max(...ring.map(p=>p.x)),y0=Math.min(...ring.map(p=>p.y));
   const fw=e.roi.x0>0?(x0-e.roi.x0-e.w*.28)/.008:e.roi.x1<1?(e.roi.x1-x1-e.w*.28)/.008:(y0-e.roi.y0-e.h*1.1)/.012;
   const reconstructed=geo.describeEye(ring,e.browPoints,fw,side==='left');
   const error=Math.max(...['x0','x1','y0','y1'].map(k=>Math.abs(reconstructed.roi[k]-e.roi[k])),Math.abs(reconstructed.cx-e.cx),Math.abs(reconstructed.cy-e.cy));
   if(error>1e-12)throw Error('Canonical roundtrip mismatch');
   oldEyes[side]=oldGeo.describeEye(ring,e.browPoints,fw,side==='left');
   if(Math.max(...['x0','x1','y0','y1'].map(k=>Math.abs(oldEyes[side].roi[k]-e.roi[k])))>1e-12)throw Error('Legacy ROI formula changed');
   oldEyes[side].roi={...e.roi};roundtrip[side]={maxNormalizedError:error,faceWidthRecovered:fw};
  }
  const source=new Image();source.src='/tests/visual/out/dataset/'+run.file;await source.decode();const W=source.width,H=source.height;if(W!==run.W||H!==run.H)throw Error('Dimensions');
  const analysis=Object.fromEntries(['left','right'].map(s=>[s,an.analyzeEye(source,eyes[s],s)])),old=Object.fromEntries(['left','right'].map(s=>[s,oldAn.analyzeEye(source,oldEyes[s],s)]));
  const canvas=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(source,0,0);return c;};
  const bounds=Object.fromEntries(['left','right'].map(s=>{const r=eyes[s].roi;return [s,{x:Math.floor(r.x0*W),y:Math.floor(r.y0*H),w:Math.ceil(r.x1*W)-Math.floor(r.x0*W),h:Math.ceil(r.y1*H)-Math.floor(r.y0*H)}];}));
  const base=canvas(),original={};for(const[s,b]of Object.entries(bounds))original[s]=base.getContext('2d').getImageData(b.x,b.y,b.w,b.h).data;base.width=base.height=0;
  const pixels={},diagnostics={};
  async function save(label,c){const stem=engine+'-'+run.file.replace('.jpg','')+'-'+label;
   const p=document.createElement('canvas'),k=Math.min(1,720/Math.max(W,H));p.width=Math.round(W*k);p.height=Math.round(H*k);p.getContext('2d').drawImage(c,0,0,p.width,p.height);await window.savePNG(stem+'-portrait720.png',p.toDataURL());p.width=p.height=0;
   for(const[s,b]of Object.entries(bounds))for(const zoom of [1,2,4]){const crop=document.createElement('canvas');crop.width=b.w*zoom;crop.height=b.h*zoom;const x=crop.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(c,b.x,b.y,b.w,b.h,0,0,crop.width,crop.height);await window.savePNG(stem+'-'+s+'-'+zoom+'x.png',crop.toDataURL());crop.width=crop.height=0;}
  }
  const variants=[['original',{}],['production-density50',{density:50}],['current-density50',{density:50}],['production-length50',{length:50}],['current-length50',{length:50}],['current-length100',{length:100}],['definition50',{definition:50}],['combined',{density:25,length:25,definition:20}]];
  for(const[label,setting]of variants){const c=canvas();try{const isOld=label.startsWith('production'),module=isOld?oldPass:pass;
   diagnostics[label]=module.applyLashPass(c.getContext('2d'),W,H,isOld?oldEyes:eyes,isOld?old:analysis,{density:0,length:0,definition:0,...setting},{diagnostics:true});pixels[label]={};
   for(const[s,b]of Object.entries(bounds)){const after=c.getContext('2d').getImageData(b.x,b.y,b.w,b.h).data,before=original[s];let changed=0,sum=0;for(let i=0;i<after.length;i+=4){let d=0;for(let j=0;j<3;j++)d+=Math.abs(after[i+j]-before[i+j]);if(d)changed++;sum+=d;}pixels[label][s]={changedPixels:changed,absoluteRGB:sum};}
   await save(label,c);
   if(label==='combined'){for(const[s,b]of Object.entries(bounds)){const x=c.getContext('2d'),d=x.getImageData(b.x,b.y,b.w,b.h),before=original[s];for(let i=0;i<d.data.length;i+=4)for(let j=0;j<3;j++)d.data[i+j]=Math.min(255,Math.abs(d.data[i+j]-before[i+j])*8);x.putImageData(d,b.x,b.y);}await save('difference8x',c);}
  }finally{c.width=c.height=0;}}
  for(const type of ['ridge','density-confidence','accepted-traces','rejected-traces']){const c=canvas();try{const x=c.getContext('2d');for(const[s,a]of Object.entries(analysis)){const roi=eyes[s].roi,rawW=(roi.x1-roi.x0)*W,rawH=(roi.y1-roi.y0)*H;
   const map=type==='ridge'?a.ridgeResponseMap:type==='density-confidence'?a.densityConfidenceMap:null;
   if(map?.length){const b=document.createElement('canvas');b.width=a.rw;b.height=a.rh;const bx=b.getContext('2d'),d=bx.createImageData(a.rw,a.rh);for(let i=0;i<map.length;i++){d.data[i*4]=type==='ridge'?0:255;d.data[i*4+1]=255;d.data[i*4+3]=map[i];}bx.putImageData(d,0,0);x.drawImage(b,roi.x0*W,roi.y0*H,rawW,rawH);b.width=b.height=0;}
   const traces=type==='accepted-traces'?a.tips.filter(t=>t.c>=.6&&a.lengthConfidence>=.25).map(t=>t.evidence):type==='rejected-traces'?a.traces.filter(t=>t.reason!=='ok'):[];
   for(const trace of traces){x.strokeStyle=type==='accepted-traces'?'#00eaff':'#ff4444';x.lineWidth=1;x.beginPath();trace.points.forEach((p,i)=>{const px=roi.x0*W+(p.x+.5)/a.rw*rawW,py=roi.y0*H+(p.y+.5)/a.rh*rawH;i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();}
  }await save(type,c);}finally{c.width=c.height=0;}}
  return {file:run.file,W,H,roundtrip,geometry:eyes,pixels,diagnostics,eyes:Object.fromEntries(Object.entries(analysis).map(([s,a])=>[s,{rw:a.rw,rh:a.rh,roi:eyes[s].roi,confidence:a.confidence,densityConfidence:a.densityConfidence,lengthConfidence:a.lengthConfidence,tips:a.tips,traces:a.traces,diagnostics:a.diagnostics}]))};
 },{run,name,engine:engine.name()});manifest.runs.push(result);fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify(manifest,null,2));}
 if(requests.some(r=>/\.(wasm|task)$/.test(r)))throw Error('Unexpected model call');manifest.requests=requests;fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify(manifest,null,2));
 }finally{if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
