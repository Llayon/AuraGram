'use strict';
// Immutable native-resolution audit. Every PNG is written immediately; keeping
// a whole portrait matrix as data URLs can exhaust WebKit/Node memory.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {chromium,webkit,devices}=require('@playwright/test');
const root=path.resolve(__dirname,'../..'),runName=process.env.LASH_RUN;
if(!runName||!/^[\w-]+$/.test(runName))throw new Error('Set a NEW simple LASH_RUN name');
const out=path.join(__dirname,'out',runName),engine=process.argv.includes('--webkit')?webkit:chromium;
const legends={
 ridge:'Green opacity: raw directional valley response;255=response0.15 or higher. Not a probability.',
 'density-confidence':'Yellow opacity: supported local density strength0..1; transparent=rejected. Not statistically calibrated.',
 traces:'Green=analysis-accepted, red=rejected. Renderer eligibility is separately recorded.',
 'accepted-traces':'Green=candidates meeting renderer confidence and connectivity gates.',
 'rejected-traces':'Red=rejected traces; reasons and counts are recorded in perEye JSON.',
 orientation:'Cyan=measured tangent, display arrow5 analysis-px, NOT product extension.',
 'tip-width-extension':'Cyan=measured tangent; yellow=half-contrast width; magenta=actual Length100 geometry, not exaggerated.',
 'crossing-structures':'Orange=observed lines crossing the predicted opening and continuing beyond the lower lid; negative occlusion evidence.',
 difference:'Absolute natural-minus-original RGB difference amplified8x; black=identity. JSON maxRGBSum is per-pixel RGB L1,0..765.'
};
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const snapshot=path.join(out,'candidate-src'),sourceHashes={};
 for(const folder of ['retouch','rendering','vision']){
  const target=path.join(snapshot,folder);
  if(!fs.existsSync(target))fs.cpSync(path.join(root,'src',folder),target,{recursive:true});
  for(const name of fs.readdirSync(target)){const file=path.join(target,name);if(fs.statSync(file).isFile())sourceHashes[folder+'/'+name]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
 }
 fs.writeFileSync(path.join(out,engine.name()+'.started.json'),JSON.stringify({startedAt:new Date().toISOString(),sourceHashes}),{flag:'wx'});
 const manifest={baseline:'b02fac3c684f2a7e3178933cb66ded925ab8bce8',candidateBaseline:'f496403afdd4b8399dcb492ecb83e9e304f0c0d3',sourceHashes,legends,
  engine:engine.name(),context:engine.name()==='webkit'?'iPhone11 emulation':'Desktop Chromium',runs:[]};
 const server=spawn(process.execPath,[path.join(root,'tests/static-server.cjs'),'0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});
 let browser;
 try{
  const url=await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{const m=String(d).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);});server.on('error',reject);});
  browser=await engine.launch();
  const page=await browser.newPage(engine.name()==='webkit'?devices['iPhone 11']:{});
  await page.route('https://**/*',r=>r.abort());
  await page.exposeFunction('auditWritePng',(name,data)=>{if(path.basename(name)!==name)throw new Error('Invalid filename');fs.writeFileSync(path.join(out,name),Buffer.from(data.split(',')[1],'base64'));});
  const folder=path.join(__dirname,'out/dataset');
  const files=process.env.LASH_FIXTURE?process.env.LASH_FIXTURE.split(','):fs.readdirSync(folder).filter(f=>/\.jpg$/.test(f));
  for(const file of files){
   console.log(engine.name(),file);
   await page.goto(url+'/index.html');await page.waitForFunction(()=>!!window.AuraGram);
   await page.setInputFiles('#fileInput',path.join(folder,file));
   await page.waitForFunction(()=>['ready','no_face','failed','unsupported'].includes(window.AuraGram.face.status()),null,{timeout:100000});
   const status=await page.evaluate(()=>window.AuraGram.face.status());
   if(status!=='ready')manifest.runs.push({file,status,excludedReason:'No usable real FaceMesh; no invented geometry'});
   else manifest.runs.push(await page.evaluate(async({file,runName,engine,metadataOnly})=>{
    const source=new Image();source.src='/tests/visual/out/dataset/'+file;await source.decode();
    const W=source.width,H=source.height,regs=window.AuraGram.face.store().faces[0].regions;
    const faceW=Math.max(...regs.faceOval.map(p=>p.x))-Math.min(...regs.faceOval.map(p=>p.x));
    const frozen='/tests/visual/out/'+runName+'/candidate-src/retouch/';
    const geo=await import(frozen+'eyeGeometry.mjs'),an=await import(frozen+'lashAnalysis.mjs'),pass=await import(frozen+'lashEnhancement.mjs');
    const oldGeo=await import('/tests/visual/out/baseline-src/retouch/eyeGeometry.mjs'),oldAn=await import('/tests/visual/out/baseline-src/retouch/lashAnalysis.mjs'),oldPass=await import('/tests/visual/out/baseline-src/retouch/lashEnhancement.mjs');
    const holdAn=await import('/tests/visual/out/recovery-baseline-src/retouch/lashAnalysis.mjs'),holdPass=await import('/tests/visual/out/recovery-baseline-src/retouch/lashEnhancement.mjs');
    const eyes=geo.describeEyes(regs,faceW),oldEyes=oldGeo.describeEyes(regs,faceW);
    const analyze=(module,descs,budget)=>({left:module.analyzeEye(source,descs.left,'left',budget),right:module.analyzeEye(source,descs.right,'right',budget)});
    const old=analyze(oldAn,oldEyes),hold=analyze(holdAn,eyes),analysis={},budgets=[];
    for(const maxSide of [224,320,384]){
     const times=[];let value;
     for(let i=0;i<5;i++){const t=performance.now();value=analyze(an,eyes,{maxSide});times.push(performance.now()-t);}
     budgets.push({maxSide,times,eyes:Object.fromEntries(Object.entries(value).map(([s,v])=>[s,{rw:v.rw,rh:v.rh,size:v.size,confidence:v.confidence,densityConfidence:v.densityConfidence,lengthConfidence:v.lengthConfidence,
      tips:v.tips.map(t=>({x:t.x,y:t.y,dx:t.dx,dy:t.dy,c:t.c,width:t.width,length:t.length})),diagnostics:v.diagnostics,typedArrayBytes:v.typedArrayBytes,retainedTypedArrayBytes:v.retainedTypedArrayBytes}]))});
     if(maxSide===224)Object.assign(analysis,value);
    }
    const perEye=Object.fromEntries(Object.entries(analysis).map(([s,v])=>[s,{roi:eyes[s].roi,confidence:v.confidence,reason:v.reason,densityConfidence:v.densityConfidence,lengthConfidence:v.lengthConfidence,diagnostics:v.diagnostics,tips:v.tips,traces:v.traces}]));
    if(metadataOnly)return {file,engine,W,H,budgets,perEye,images:[]};
    const canvas=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(source,0,0);return c;};
    const base=canvas(),before=base.getContext('2d').getImageData(0,0,W,H).data;base.width=base.height=0;
    const images=[],renderDiagnostics={},pixelEvidence={};
    async function save(name,c){
     const prefix=engine+'-'+file.replace('.jpg','')+'-'+name,crops=[];
     await window.auditWritePng(prefix+'.png',c.toDataURL());
     for(const side of ['left','right'])for(const zoom of [1,2,4]){
      const r=eyes[side].roi,w=Math.ceil((r.x1-r.x0)*W),h=Math.ceil((r.y1-r.y0)*H),crop=document.createElement('canvas');
      crop.width=w*zoom;crop.height=h*zoom;const x=crop.getContext('2d');x.imageSmoothingEnabled=false;
      x.drawImage(c,Math.floor(r.x0*W),Math.floor(r.y0*H),w,h,0,0,crop.width,crop.height);
      await window.auditWritePng(prefix+'-'+side+'-'+zoom+'x.png',crop.toDataURL());crops.push({side,zoom});crop.width=crop.height=0;
     }
     images.push({name,crops});
    }
    function evidence(name,c,res){
     const after=c.getContext('2d').getImageData(0,0,W,H).data;pixelEvidence[name]={};
     for(const side of ['left','right']){const r=eyes[side].roi;let changed=0,absolute=0,max=0;
      for(let y=Math.floor(r.y0*H);y<Math.ceil(r.y1*H);y++)for(let x=Math.floor(r.x0*W);x<Math.ceil(r.x1*W);x++){
       const i=(y*W+x)*4;let d=0;for(let k=0;k<3;k++)d+=Math.abs(after[i+k]-before[i+k]);if(d)changed++;absolute+=d;max=Math.max(max,d);
      }
      pixelEvidence[name][side]={changedPixels:changed,absoluteRGB:absolute,maxRGBSum:max};
     }
     if(name==='new-length50'||name==='length100')for(const eye of res.perEye){let visible=0;
      for(const g of eye.extensions||[]){let count=0;
       const x0=Math.max(0,Math.floor(Math.min(g.x,g.ex)-g.width-1)),x1=Math.min(W,Math.ceil(Math.max(g.x,g.ex)+g.width+1));
       const y0=Math.max(0,Math.floor(Math.min(g.y,g.ey)-g.width-1)),y1=Math.min(H,Math.ceil(Math.max(g.y,g.ey)+g.width+1));
       for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*W+x)*4;if(after[i]!==before[i]||after[i+1]!==before[i+1]||after[i+2]!==before[i+2])count++;}
       g.changedPixelsInBounds=count;if(count)visible++;
      }eye.visibleLengthCandidates=visible;
     }
    }
    const variants=[['original',null],['old-density50',{density:50}],['hold-density50',{density:50}],['new-density50',{density:50}],['old-length50',{length:50}],['hold-length50',{length:50}],['new-length50',{length:50}],['definition50',{definition:50}],['natural',{density:25,length:25,definition:20}],
     ...[1,25,50,75,100].map(v=>['density'+v,{density:v}]),...[25,49,50,51,75,100].map(v=>['length'+v,{length:v}])];
    for(const [name,setting] of variants){const c=canvas();try{
     if(setting){const module=name.startsWith('old')?oldPass:name.startsWith('hold')?holdPass:pass;
      renderDiagnostics[name]=module.applyLashPass(c.getContext('2d'),W,H,name.startsWith('old')?oldEyes:eyes,name.startsWith('old')?old:name.startsWith('hold')?hold:analysis,{density:0,length:0,definition:0,...setting},{diagnostics:true});}
     if(['new-density50','new-length50','length100','natural'].includes(name))evidence(name,c,renderDiagnostics[name]);
     await save(name,c);
     if(name==='natural'){const x=c.getContext('2d'),d=x.getImageData(0,0,W,H);for(let i=0;i<d.data.length;i+=4)for(let k=0;k<3;k++)d.data[i+k]=Math.abs(d.data[i+k]-before[i+k])*8;x.putImageData(d,0,0);await save('difference',c);}
    }finally{c.width=c.height=0;}}
    for(const name of ['ridge','density-confidence','traces','accepted-traces','rejected-traces','orientation','tip-width-extension','crossing-structures']){
     const c=canvas(),ctx=c.getContext('2d');try{
      for(const side of ['left','right']){const v=analysis[side],r=eyes[side].roi,rw=(r.x1-r.x0)*W,rh=(r.y1-r.y0)*H;
       if((name==='ridge'||name==='density-confidence')&&v.ridge){const map=name==='ridge'?(v.ridgeResponseMap||v.ridge):v.densityConfidenceMap,rc=document.createElement('canvas');rc.width=v.rw;rc.height=v.rh;
        const x=rc.getContext('2d'),d=x.createImageData(v.rw,v.rh);for(let i=0;i<map.length;i++){d.data[i*4]=name==='ridge'?0:255;d.data[i*4+1]=255;d.data[i*4+2]=name==='ridge'?100:0;d.data[i*4+3]=map[i];}x.putImageData(d,0,0);ctx.drawImage(rc,r.x0*W,r.y0*H,rw,rh);rc.width=rc.height=0;
       }
       const selected=name==='accepted-traces'?v.tips.filter(t=>t.c>=.6&&v.lengthConfidence>=.25).map(t=>t.evidence):name==='rejected-traces'?v.traces.filter(t=>t.reason!=='ok'):name==='traces'?v.traces:name==='crossing-structures'?(v.diagnostics?.crossing?.paths||[]):[];
       for(const t of selected){ctx.strokeStyle=name==='crossing-structures'?'#ff9800':t.reason==='ok'?'#00ff80':'#ff3040';ctx.lineWidth=1;ctx.beginPath();t.points.forEach((p,i)=>{const x=r.x0*W+(p.x+.5)/v.rw*rw,y=r.y0*H+(p.y+.5)/v.rh*rh;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
       if(name==='orientation'||name==='tip-width-extension')for(const t of v.tips){const x=r.x0*W+t.x*rw,y=r.y0*H+t.y*rh;ctx.strokeStyle='#00ffff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+t.dx*rw/v.rw*5,y+t.dy*rh/v.rh*5);ctx.stroke();
        if(name==='tip-width-extension'){ctx.strokeStyle='#ffff00';ctx.beginPath();ctx.arc(x,y,t.width*rw/v.rw/2,0,Math.PI*2);ctx.stroke();}}
       if(name==='tip-width-extension')for(const e of (renderDiagnostics.length100?.perEye||[]).filter(e=>e.side===side))for(const g of e.extensions||[]){ctx.strokeStyle='#ff00ff';ctx.beginPath();ctx.moveTo(g.x,g.y);ctx.lineTo(g.ex,g.ey);ctx.stroke();}
      }
      await save(name,c);
     }finally{c.width=c.height=0;}
    }
    const perf=[];
    for(const width of [900,W]){const c=document.createElement('canvas');c.width=width;c.height=Math.round(H*width/W);const x=c.getContext('2d'),scratch={};let ms=[],ran=[];
     for(let i=0;i<9;i++){x.drawImage(source,0,0,c.width,c.height);const t=performance.now();const res=pass.applyLashPass(x,c.width,c.height,eyes,analysis,{density:35,length:30,definition:25},scratch);ms.push(performance.now()-t);ran=res.ran;}
     perf.push({width,height:c.height,ms,ran});c.width=c.height=0;
    }
    return {file,engine,W,H,old:Object.fromEntries(Object.entries(old).map(([s,v])=>[s,{rw:v.rw,rh:v.rh,tips:v.tips.length,confidence:v.confidence}])),budgets,perEye,renderDiagnostics,pixelEvidence,perf,images};
   },{file,runName,engine:engine.name(),metadataOnly:!!process.env.LASH_METADATA_ONLY}));
   fs.writeFileSync(path.join(out,'manifest-'+engine.name()+'.json'),JSON.stringify(manifest,null,2));
  }
 }finally{if(browser)await browser.close();server.kill();}
 const files=fs.readdirSync(out).filter(f=>f.endsWith('.png'));
 fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><meta charset="utf-8"><title>Recovery evidence</title><style>body{background:#222;color:#eee;font:14px sans-serif}article{display:inline-block;vertical-align:top;max-width:700px;margin:8px}img{max-width:700px}</style><h1>Original / Production0.5.1 / HOLD / Recovery</h1><p>Both eyes100/200/400%. Open each PNG for native size. Arrows are diagnostic labels, not product pixels.</p>'+Object.entries(legends).map(([k,v])=>`<p><b>${k}</b>: ${v}</p>`).join('')+files.map(f=>`<article><p>${f}</p><p>${Object.entries(legends).find(([k])=>f.includes('-'+k+'-'))?.[1]||''}</p><a href="${f}"><img loading="lazy" src="${f}"></a></article>`).join(''));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
