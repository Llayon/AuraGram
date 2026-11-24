const {test,expect}=require('./app-fixtures.cjs');
const path=require('node:path');

test('licensed real lower-lash macro with no FaceMesh does not invent upper-lash geometry',async({page})=>{
 const fs=require('node:fs');
 const pack=require('./visual/freeend-evidence/files.json');
 const source='tests/visual/out/freeend-01-download/commons-radic-eyelashes.jpg';
 const fixture='tests/visual/freeend-evidence/'+pack[source].asset;
 expect(fs.existsSync(path.resolve(__dirname,'..',fixture))).toBe(true);
 await page.goto('/index.html');await page.waitForFunction(()=>!!window.AuraGram);
 await page.setInputFiles('#fileInput',path.resolve(__dirname,'..',fixture));
 await page.waitForFunction(()=>['ready','no_face','failed','unsupported'].includes(window.AuraGram.face.status()),null,{timeout:100000});
 expect(await page.evaluate(()=>window.AuraGram.face.status())).toBe('no_face');
 const result=await page.evaluate(async()=>{
  const A=window.AuraGram;A.resetAll();
  const pixels=()=>{A.renderStudioCanvas();return document.getElementById('mainCanvas').toDataURL();};
  const neutral=pixels();A.state.activePreset='vogue';const preset=pixels();
  A.state.lashes={density:100,length:100,definition:100};pixels();
  // Settle the lazy retouch module before the final real app render.
  await import('/src/retouch/retouch.mjs');
  const enhanced=pixels();
  return{presetActive:neutral!==preset,lashIdentity:preset===enhanced,status:A.face.status()};
 });
 expect(result.presetActive,'no-face fallback must retain global preset processing').toBe(true);
 expect(result.lashIdentity,'lower-lash macro must not receive invented upper lashes').toBe(true);
 expect(result.status).toBe('no_face');
});

// Conservative abstention requirement for this frozen closed/white-liner
// photograph: original-only reviewers could not establish upper endpoints.
// This is not ground truth that eyelashes are absent, or a ban on all closed eyes.
test('unresolved closed white-liner fixture abstains from Length after real analysis',async({page},testInfo)=>{
 const fixture='tests/visual/expanded-evidence/sources/pexels-7123010.jpg';
 await page.goto('/index.html');await page.waitForFunction(()=>!!window.AuraGram);
 await page.setInputFiles('#fileInput',path.resolve(__dirname,'..',fixture));
 await page.waitForFunction(()=>['ready','no_face','failed'].includes(window.AuraGram.face.status()),null,{timeout:100000});
 expect(await page.evaluate(()=>window.AuraGram.face.status()),'must exercise real FaceMesh, not no_face fallback').toBe('ready');
 const result=await page.evaluate(async fixture=>{
  const {describeEyes}=await import('/src/retouch/eyeGeometry.mjs');
  const {analyzeEye,LASH_ANALYSIS_VERSION}=await import('/src/retouch/lashAnalysis.mjs');
  const {applyLashPass}=await import('/src/retouch/lashEnhancement.mjs');
  const regions=window.AuraGram.face.store().faces[0].regions;
  const eyes=describeEyes(regions,Math.max(...regions.faceOval.map(p=>p.x))-Math.min(...regions.faceOval.map(p=>p.x)));
  const image=new Image();image.src='/'+fixture;await image.decode();
  const analysis=Object.fromEntries(['left','right'].map(s=>[s,analyzeEye(image,eyes[s],s)]));
  const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
  try{const x=c.getContext('2d');x.drawImage(image,0,0);const before=x.getImageData(0,0,c.width,c.height).data;
   const applied=applyLashPass(x,c.width,c.height,eyes,analysis,{density:0,length:100,definition:0},{diagnostics:true});
   const after=x.getImageData(0,0,c.width,c.height).data;let difference=0;
   for(let i=0;i<after.length;i++)difference+=Math.abs(after[i]-before[i]);
   return {analysisVersion:LASH_ANALYSIS_VERSION,analyzedEyes:Object.values(analysis).filter(a=>a.rw>0&&a.rh>0).length,difference,
    attempts:applied.perEye.reduce((n,e)=>n+(e.lengthAttempts||0),0),ran:applied.ran,
    eyes:Object.fromEntries(Object.entries(analysis).map(([s,a])=>[s,{reason:a.reason,lengthConfidence:a.lengthConfidence,tips:a.tips.length,crossing:a.diagnostics.crossing}]))};
  }finally{c.width=c.height=0;}
 },fixture);
 console.log('Closed white-liner abstention '+JSON.stringify(result));
 await testInfo.attach('closed-white-liner-abstention.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});
 expect(result.analyzedEyes,'actual native lash analysis ran for both eyes').toBe(2);
 expect(result.attempts,'unknown tips must not generate even clipped/invisible strokes').toBe(0);
 expect(result.ran).not.toContain('length');
 expect(result.difference,'Length-only must preserve this unresolved source').toBe(0);
});

test('LF16 LF17 LF20 real native analysis, active render and scaled geometry',async({page},testInfo)=>{
 await page.goto('/index.html');await page.waitForFunction(()=>!!window.AuraGram);
 await page.setInputFiles('#fileInput',path.join(__dirname,'fixtures/edge-source.jpg'));
 await page.waitForFunction(()=>window.AuraGram.face.status()==='ready',null,{timeout:100000});
 const result=await page.evaluate(async()=>{
  const {describeEyes}=await import('/src/retouch/eyeGeometry.mjs');
  const {analyzeEye}=await import('/src/retouch/lashAnalysis.mjs');
  const {applyLashPass}=await import('/src/retouch/lashEnhancement.mjs');
  const regs=window.AuraGram.face.store().faces[0].regions;
  const eyes=describeEyes(regs,Math.max(...regs.faceOval.map(p=>p.x))-Math.min(...regs.faceOval.map(p=>p.x)));
  const im=new Image();im.src='/tests/fixtures/edge-source.jpg';await im.decode();
  const a={left:analyzeEye(im,eyes.left,'left'),right:analyzeEye(im,eyes.right,'right')};
  const summaries=Object.fromEntries(Object.entries(a).map(([s,v])=>[s,{rw:v.rw,rh:v.rh,confidence:v.confidence,coverage:v.coverage,contrast:v.contrast01,sharp:v.sharp01,tips:v.tips.length,maxRidge:Math.max(...v.ridge||[]),ridgePixels:Array.from(v.ridge||[]).filter(v=>v>64).length,ms:v.ms,reason:v.reason}]));
  const perf=[];
  for(const width of [450,900]){
   const c=document.createElement('canvas');c.width=width;c.height=Math.round(width*im.height/im.width);const x=c.getContext('2d'),scratch={};let times=[],res,changed=0;
   for(let i=0;i<9;i++){x.drawImage(im,0,0,c.width,c.height);const before=x.getImageData(0,0,c.width,c.height).data;const t=performance.now();res=applyLashPass(x,c.width,c.height,eyes,a,{density:50,length:50,definition:30},scratch);times.push(performance.now()-t);const after=x.getImageData(0,0,c.width,c.height).data;changed=0;for(let j=0;j<after.length;j+=4)if(after[j]!==before[j]||after[j+1]!==before[j+1]||after[j+2]!==before[j+2])changed++;}
   perf.push({width,changed,times,ran:res.ran});
  }
  return {summaries,perf};
 });
 console.log('LF real analysis',JSON.stringify(result));
 await testInfo.attach('native-analysis.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});
 expect(result.summaries.left.rw).toBeGreaterThan(35);
 for(const p of result.perf){expect(p.ran).toContain('density');expect(p.ran).toContain('definition');expect(p.changed).toBeGreaterThan(0);}
});

test('Recovery rejects the real hair-covered eye while retaining visible-eye evidence',async({page},testInfo)=>{
 await page.goto('/index.html');await page.waitForFunction(()=>!!window.AuraGram);
 await page.setInputFiles('#fileInput',path.join(__dirname,'visual/recovery-evidence/hair-occlusion-original.jpg'));
 await page.waitForFunction(()=>window.AuraGram.face.status()==='ready',null,{timeout:100000});
 const result=await page.evaluate(async()=>{
  const {describeEyes}=await import('/src/retouch/eyeGeometry.mjs'),{analyzeEye}=await import('/src/retouch/lashAnalysis.mjs');
  const {applyLashPass}=await import('/src/retouch/lashEnhancement.mjs');
  const regs=window.AuraGram.face.store().faces[0].regions;
  const eyes=describeEyes(regs,Math.max(...regs.faceOval.map(p=>p.x))-Math.min(...regs.faceOval.map(p=>p.x)));
  const im=new Image();im.src='/tests/visual/recovery-evidence/hair-occlusion-original.jpg';await im.decode();
  const an={left:analyzeEye(im,eyes.left,'left'),right:analyzeEye(im,eyes.right,'right')};
  const c=document.createElement('canvas');c.width=900;c.height=Math.round(im.height/im.width*900);const x=c.getContext('2d');
  x.drawImage(im,0,0,c.width,c.height);const before=x.getImageData(0,0,c.width,c.height).data;
  applyLashPass(x,c.width,c.height,eyes,an,{density:100,length:100,definition:100},{});
  const after=x.getImageData(0,0,c.width,c.height).data,r=eyes.left.roi;let hiddenDifference=0;
  for(let y=Math.ceil(r.y0*c.height);y<Math.floor(r.y1*c.height);y++)for(let ix=Math.ceil(r.x0*c.width);ix<Math.floor(r.x1*c.width);ix++){
   const i=(y*c.width+ix)*4;for(let k=0;k<3;k++)hiddenDifference+=Math.abs(after[i+k]-before[i+k]);}
  return {hiddenDifference,left:{confidence:an.left.confidence,reason:an.left.reason,tips:an.left.tips.length,crossing:an.left.diagnostics?.crossing},
   right:{confidence:an.right.confidence,densityPixels:an.right.diagnostics?.densityPixels}};
 });
 console.log('Recovery real occlusion '+JSON.stringify({hiddenDifference:result.hiddenDifference,
  left:{confidence:result.left.confidence,reason:result.left.reason,tips:result.left.tips,
   crossingPaths:result.left.crossing.paths.length,axisCoverage:result.left.crossing.coveredAxisFraction},right:result.right}));
 await testInfo.attach('real-occlusion.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});
 expect(result.left.confidence).toBe(0);expect(result.left.tips).toBe(0);expect(result.left.reason).toBe('crossing-structures');
 expect(result.hiddenDifference).toBe(0);expect(result.right.confidence).toBeGreaterThan(0);expect(result.right.densityPixels).toBeGreaterThan(0);
});

test('Recovery active Length survives real preview and full PNG in both engines',async({page},testInfo)=>{
 const file=path.join(__dirname,'visual/g1c1-evidence/natural-full-original.jpg');
 await page.goto('/index.html');await page.waitForFunction(()=>!!window.AuraGram);
 await page.setInputFiles('#fileInput',file);
 await page.waitForFunction(()=>window.AuraGram.face.status()==='ready',null,{timeout:100000});
 await page.waitForFunction(()=>window.AuraGram.retouch.ready());
 const preview=await page.evaluate(()=>{
  const A=window.AuraGram;A.resetAll();A.renderStudioCanvas();
  const c=document.getElementById('mainCanvas'),x=c.getContext('2d'),base=x.getImageData(0,0,c.width,c.height).data.slice();
  A.state.lashes.length=100;const t=performance.now();A.renderStudioCanvas();const renderMs=performance.now()-t;
  const after=x.getImageData(0,0,c.width,c.height).data;let difference=0;
  for(let i=0;i<after.length;i++)if(i%4!==3)difference+=Math.abs(after[i]-base[i]);
  return {difference,renderMs,ran:A.stats.retouchRan,key:A.lash.info().key};
 });
 expect(preview.ran).toContain('length');expect(preview.difference).toBeGreaterThan(10);
 await page.click('#btnExport');await page.waitForFunction(()=>!!window.AuraGram.getExportBlob(),null,{timeout:60000});
 const exported=await page.evaluate(async()=>{
  const A=window.AuraGram,blob=A.getExportBlob(),url=URL.createObjectURL(blob);
  try{
   const output=new Image();output.src=url;await output.decode();
   const source=new Image();source.src='/tests/visual/g1c1-evidence/natural-full-original.jpg';await source.decode();
   const c=document.createElement('canvas');c.width=output.width;c.height=output.height;
   const x=c.getContext('2d');x.drawImage(source,0,0,c.width,c.height);const before=x.getImageData(0,0,c.width,c.height).data;
   x.drawImage(output,0,0);const after=x.getImageData(0,0,c.width,c.height).data;let difference=0,changed=0;
   for(let i=0;i<after.length;i+=4){let d=0;for(let k=0;k<3;k++)d+=Math.abs(after[i+k]-before[i+k]);difference+=d;if(d)changed++;}
   return {difference,changed,width:c.width,height:c.height,bytes:blob.size,ran:A.stats.retouchRan,key:A.lash.info().key,renderMs:A.stats.lastExportMs};
  }finally{URL.revokeObjectURL(url);}
 });
 expect(exported.difference).toBeGreaterThan(10);expect(exported.ran).toContain('length');
 expect(exported.key).toBe(preview.key);expect(exported.width).toBe(2400);expect(exported.height).toBe(3600);
 delete preview.key;delete exported.key;
 console.log('Recovery real preview/export '+JSON.stringify({preview,exported}));
 await testInfo.attach('active-preview-export.json',{body:JSON.stringify({preview,exported},null,2),contentType:'application/json'});
});

test('Boundary context recovers real terminal structures and keeps their analysis stable on sliders',async({page},testInfo)=>{
 await page.goto('/index.html');await page.waitForFunction(()=>!!window.AuraGram);
 await page.setInputFiles('#fileInput',path.join(__dirname,'visual/g1c1-evidence/natural-full-original.jpg'));
 await page.waitForFunction(()=>window.AuraGram.face.status()==='ready',null,{timeout:100000});
 await page.waitForFunction(()=>window.AuraGram.retouch.ready());
 const result=await page.evaluate(()=>{
  const A=window.AuraGram;A.resetAll();A.state.lashes.length=100;A.renderStudioCanvas();
  const canvas=document.getElementById('mainCanvas'),context=canvas.getContext('2d');
  const firstPixels=context.getImageData(0,0,canvas.width,canvas.height).data;
  const first=A.lash.info(),analysisMs=A.retouch.timings().lashAnalyseMs;
  const recovered=info=>(info.left.recoveredTips||0)+(info.right.recoveredTips||0);
  const samples=[25,50,75,100].map(length=>{
   A.state.lashes.length=length;A.renderStudioCanvas();
   const info=A.lash.info();
   return {length,keyStable:info.key===first.key,recoveredTips:recovered(info),analysisMs:A.retouch.timings().lashAnalyseMs,ran:A.stats.retouchRan};
  });
  const lastPixels=context.getImageData(0,0,canvas.width,canvas.height).data;
  let repeatedPixelDifference=0;for(let index=0;index<lastPixels.length;index++)repeatedPixelDifference+=Math.abs(lastPixels[index]-firstPixels[index]);
  return {recoveredTips:recovered(first),analysisMs,samples,repeatedPixelDifference};
 });
 expect(result.recoveredTips).toBeGreaterThan(0);
 expect(result.repeatedPixelDifference).toBe(0);
 for(const sample of result.samples){
  expect(sample.keyStable).toBe(true);expect(sample.analysisMs).toBe(result.analysisMs);
  expect(sample.recoveredTips).toBe(result.recoveredTips);expect(sample.ran).toContain('length');
 }
 console.log('Boundary context real cache '+JSON.stringify(result));
 await testInfo.attach('boundary-context-real-cache.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});
});

test('Boundary recovery preserves a monochrome grade without brightening pixels',async({page},testInfo)=>{
 await page.goto('/index.html');await page.waitForFunction(()=>!!window.AuraGram);
 await page.setInputFiles('#fileInput',path.join(__dirname,'visual/g1c1-evidence/natural-full-original.jpg'));
 await page.waitForFunction(()=>window.AuraGram.face.status()==='ready',null,{timeout:100000});
 const result=await page.evaluate(async()=>{
  const {describeEyes}=await import('/src/retouch/eyeGeometry.mjs');
  const {analyzeEye}=await import('/src/retouch/lashAnalysis.mjs');
  const {applyLashPass}=await import('/src/retouch/lashEnhancement.mjs');
  const regions=window.AuraGram.face.store().faces[0].regions;
  const eyes=describeEyes(regions,Math.max(...regions.faceOval.map(p=>p.x))-Math.min(...regions.faceOval.map(p=>p.x)));
  const image=new Image();image.src='/tests/visual/g1c1-evidence/natural-full-original.jpg';await image.decode();
  const analysis=Object.fromEntries(['left','right'].map(side=>{
   const value=analyzeEye(image,eyes[side],side);
   return [side,{...value,tips:value.tips.filter(tip=>tip.evidence?.boundaryRecovery)}];
  }));
  const recoveredTips=analysis.left.tips.length+analysis.right.tips.length;
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  try{
   const context=canvas.getContext('2d');context.drawImage(image,0,0);
   window.AuraGramCanvasFilters.applyPixelsFilter(context,'saturate(0%)');
   const before=context.getImageData(0,0,canvas.width,canvas.height).data;
   const applied=applyLashPass(context,canvas.width,canvas.height,eyes,analysis,{density:0,length:100,definition:0},{});
   const after=context.getImageData(0,0,canvas.width,canvas.height).data;
   let difference=0,coloredPixels=0,brightenedChannels=0;
   for(let index=0;index<after.length;index+=4){
    if(after[index]!==after[index+1]||after[index+1]!==after[index+2])coloredPixels++;
    for(let channel=0;channel<3;channel++){
     difference+=Math.abs(after[index+channel]-before[index+channel]);
     if(after[index+channel]>before[index+channel])brightenedChannels++;
    }
   }
   return {recoveredTips,difference,coloredPixels,brightenedChannels,ran:applied.ran};
  }finally{canvas.width=canvas.height=0;}
 });
 expect(result.recoveredTips).toBeGreaterThan(0);expect(result.difference).toBeGreaterThan(10);
 expect(result.coloredPixels).toBe(0);expect(result.brightenedChannels).toBe(0);expect(result.ran).toContain('length');
 console.log('Boundary monochrome protection '+JSON.stringify(result));
 await testInfo.attach('boundary-monochrome-protection.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});
});
