const {test,expect}=require('./app-fixtures.cjs');
const path=require('node:path');
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
