'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),{spawn}=require('child_process');
const {chromium,webkit,devices}=require('@playwright/test');
async function main(){
 const name=process.argv[2],engine=process.argv.includes('--webkit')?webkit:chromium;
 if(!name||!/^[\w-]+$/.test(name))throw Error('Supply NEW run name');
 const out=path.join(__dirname,'out',name);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,engine.name()+'.started'),'started',{flag:'wx'});
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
 const oldPath=path.join(__dirname,'localization-evidence/geometry.json.gz'),expanded={};
 for(const e of ['chromium','webkit'])expanded[e]=read(path.join(__dirname,'expanded-evidence/geometry-'+e+'.json.gz'));
 const jobs=[];
 for(const file of ['light.jpg','natural.jpg','hair-occlusion.jpg','light-rotated25.jpg']){const r=read(oldPath).runs.find(r=>r.file===file);if(!r?.geometry)throw Error('Missing old geometry');jobs.push({...r,geometryLabel:'older-chromium-control'});}
 for(const file of ['pexels-8727422.jpg','pexels-12367370.jpg','pexels-7859838.jpg']){const r=expanded[engine.name()].runs.find(r=>r.file===file);jobs.push({...r,geometryLabel:'actual-'+engine.name()});}
 for(const e of ['chromium','webkit']){const r=expanded[e].runs.find(r=>r.file==='pexels-7123010.jpg');jobs.push({...r,geometryLabel:'closed-'+e});}
 const source=process.env.CROSSING_SOURCE||'src/retouch/lashAnalysis.mjs',moduleURL='/'+path.relative(process.cwd(),path.resolve(source)).replaceAll(path.sep,'/');
 const reference=process.env.CROSSING_REFERENCE||'tests/visual/out/crossing-09-verify/reference-src/retouch/lashAnalysis.mjs';
 const referenceURL=fs.existsSync(reference)?'/'+path.relative(process.cwd(),path.resolve(reference)).replaceAll(path.sep,'/'):null;
 const images=new Map(),imageHashes={};for(const r of jobs){const b=fs.readFileSync(path.join(__dirname,'out/dataset',r.file));images.set(r.file,b);imageHashes[r.file]=hash(b);}
 const geometryHashes={older:hash(fs.readFileSync(oldPath)),...Object.fromEntries(['chromium','webkit'].map(e=>[e,hash(fs.readFileSync(path.join(__dirname,'expanded-evidence/geometry-'+e+'.json.gz')))]))};
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});let browser;
 try{const url=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);});server.on('error',reject);});
 browser=await engine.launch();const page=await browser.newPage(engine===webkit?devices['iPhone 11']:{}),requests=[];
 page.on('request',r=>requests.push(new URL(r.url()).pathname));await page.route('https://**/*',r=>r.abort());await page.route('**/__crossing_sweep__',r=>r.fulfill({body:'<!doctype html><title>Crossing sampling stability</title>',contentType:'text/html'}));
 await page.route('**/tests/visual/out/dataset/*',r=>r.fulfill({body:images.get(decodeURIComponent(new URL(r.request().url()).pathname.split('/').at(-1))),contentType:'image/jpeg'}));
 await page.exposeFunction('savePerturbationPNG',(file,data)=>{if(path.basename(file)!==file)throw Error('Invalid image name');fs.writeFileSync(path.join(out,file),Buffer.from(data.split(',')[1],'base64'),{flag:'wx'});});
 await page.goto(url+'/__crossing_sweep__');const results=[];
 for(const job of jobs){console.log(engine.name(),job.file,job.geometryLabel);const result=await page.evaluate(async({job,moduleURL,referenceURL,engineName})=>{
  const {crossingHairEvidence,lumaOf,analyzeLuma}=await import(moduleURL),source=new Image();source.src='/tests/visual/out/dataset/'+job.file;await source.decode();if(source.width!==job.W||source.height!==job.H)throw Error('Dimensions');
  const old=referenceURL?await import(referenceURL):null,output=[];
  for(const side of ['left','right']){const e=job.geometry[side],r=e.roi,size=job.budgets.find(b=>b.maxSide===224).eyes[side],w=size.rw,h=size.rh,rawW=(r.x1-r.x0)*job.W,rawH=(r.y1-r.y0)*job.H;
   const c=document.createElement('canvas');c.width=w;c.height=h;
   try{const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(source,r.x0*job.W,r.y0*job.H,rawW,rawH,0,0,w,h);const d=cx.getImageData(0,0,w,h).data,luma=Float32Array.from({length:w*h},(_,i)=>lumaOf(d[i*4],d[i*4+1],d[i*4+2])/255);
    const to=p=>({x:(p.x-r.x0)/(r.x1-r.x0)*w,y:(p.y-r.y0)/(r.y1-r.y0)*h});
    const lid=e.upperLid.map(to),lower=e.lowerLid.map(to),ax=(e.upperLid.at(-1).x-e.upperLid[0].x)*job.W,ay=(e.upperLid.at(-1).y-e.upperLid[0].y)*job.H,len=Math.hypot(ax,ay),tx=ax/len,ty=ay/len;
    const mean=a=>({x:a.reduce((n,p)=>n+p.x*job.W,0)/a.length,y:a.reduce((n,p)=>n+p.y*job.H,0)/a.length});
    const up=mean(e.upperLid),lo=mean(e.lowerLid);let nx=-ty,ny=tx;if(nx*(up.x-lo.x)+ny*(up.y-lo.y)<0){nx=-nx;ny=-ny;}
    const conditions=[];for(const t of [-1,0,1])for(const n of [-1,0,1])conditions.push({mode:'both-arcs',tangentNative:t,normalNative:n});
    for(const n of [-1,1])conditions.push({mode:'lower-only',tangentNative:0,normalNative:n});
    const samples=[];
    for(const condition of conditions){const dx=(tx*condition.tangentNative+nx*condition.normalNative)*w/rawW,dy=(ty*condition.tangentNative+ny*condition.normalNative)*h/rawH;
     const shift=a=>a.map(p=>({x:p.x+dx,y:p.y+dy})),a=condition.mode==='both-arcs'?shift(lid):lid.map(p=>({...p})),b=shift(lower);
     const crossing=crossingHairEvidence(luma,w,h,a,b),eyeW=Math.hypot(a.at(-1).x-a[0].x,a.at(-1).y-a[0].y),seedCount=Math.min(96,Math.max(12,Math.ceil(eyeW/2)));
     // Counterfactual engineering sensitivity estimate, not a statistical or
     // guaranteed bound: half seed spacing at each endpoint + existing±1px search.
     const seedSpacing=.8*eyeW/seedCount,margin=(seedSpacing+2)/eyeW,upper=Math.min(1,crossing.coveredAxisFraction+margin);
     const ambiguous=crossing.paths.length>=2&&!crossing.occluded&&upper>=.25;
     const mid=a[Math.floor(a.length/2)],low=b[Math.floor(b.length/2)],band=Math.max(3,Math.min(h*.45,Math.hypot(mid.x-low.x,mid.y-low.y)*.65));
     // Verify the candidate's real analysis contract too, not only the new
     // policy flag. This remains offline and does not alter app landmarks.
     const actual=crossing.lengthAbstain?analyzeLuma(luma,w,h,a,b,band,to(e.inner),(e.browPoints||[]).map(to),{recoverBoundaryTips:true}):null;
     if(actual&&(actual.tips.length||actual.lengthConfidence))throw Error('Crossing veto failed to suppress candidate Length');
     const previous=actual&&old?old.analyzeLuma(luma,w,h,a,b,band,to(e.inner),(e.browPoints||[]).map(to),{recoverBoundaryTips:true}):null;
     if(previous){if(previous.densityConfidence!==actual.densityConfidence)throw Error('Jitter Density confidence changed');for(const k of ['densityRidge','densityConfidenceMap','rootConnectionMap'])if(previous[k].some((v,i)=>v!==actual[k][i]))throw Error('Jitter Density evidence changed');}
     const previousEligible=previous?.tips.filter(t=>t.c>=.6&&previous.lengthConfidence>=.25)||[];
     if(previousEligible.length){const rx=Math.floor(r.x0*job.W),ry=Math.floor(r.y0*job.H),cw=Math.ceil(r.x1*job.W)-rx,ch=Math.ceil(r.y1*job.H)-ry,display=document.createElement('canvas');display.width=cw;display.height=ch;const context=display.getContext('2d');context.drawImage(source,rx,ry,cw,ch,0,0,cw,ch);
      const stroke=(points,color)=>{context.strokeStyle=color;context.lineWidth=1;context.beginPath();points.forEach((p,i)=>{const x=r.x0*job.W+(p.x+.5)*rawW/w-rx,y=r.y0*job.H+(p.y+.5)*rawH/h-ry;i?context.lineTo(x,y):context.moveTo(x,y);});context.stroke();};
      previousEligible.forEach(t=>stroke(t.evidence.points,'#00eaff'));crossing.paths.forEach(p=>stroke(p.points,'#ff4040'));
      await window.savePerturbationPNG(`${engineName}-${job.file.replace('.jpg','')}-${job.geometryLabel}-${side}-${condition.mode}-t${condition.tangentNative}-n${condition.normalNative}.png`,display.toDataURL());display.width=display.height=0;
     }
     samples.push({...condition,analysisShift:{x:dx,y:dy},eyeWidthAnalysis:eyeW,seedCount,seedSpacingAnalysis:seedSpacing,coverageMargin:margin,coverageUpperEstimate:upper,proposedAmbiguous:ambiguous,proposedLengthAbstain:crossing.occluded||ambiguous,crossing,
      actualLengthVerification:actual?{tips:actual.tips.length,lengthConfidence:actual.lengthConfidence,densityConfidence:actual.densityConfidence,reason:actual.reason,
       previousTips:previous?.tips.length,previousEligible:previousEligible.length,previousCandidates:previousEligible,densityIdentical:!!previous}:null});
    }
    output.push({side,width:w,height:h,roi:r,sourceDimensions:{width:job.W,height:job.H},sourceScale:{x:w/rawW,y:h/rawH},axisNative:{tx,ty,nx,ny},samples});
   }finally{c.width=c.height=0;}
  }return {file:job.file,geometryLabel:job.geometryLabel,eyes:output};
 },{job,moduleURL,referenceURL,engineName:engine.name()});results.push(result);fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify({engine:engine.name(),source,sourceSHA256:hash(fs.readFileSync(source)),reference:referenceURL?reference:null,referenceSHA256:referenceURL?hash(fs.readFileSync(reference)):null,imageHashes,geometryHashes,results,requests,meaning:'Offline native±1px translations in eye frame and separate lower-normal aperture jitter. Original app landmarks unchanged. Coverage estimate cannot bound path-count/identity changes.'},null,2));}
 if(requests.some(p=>/\.(wasm|task)$/.test(p)))throw Error('Unexpected model request');
 }finally{if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
