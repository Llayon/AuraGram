'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawn}=require('child_process'),{chromium,webkit,devices}=require('@playwright/test'),{loadInputs,hash}=require('./lash-domain-inputs.cjs');
async function main(){
 const[input,name]=process.argv.slice(2),engine=process.argv.includes('--webkit')?webkit:chromium;if(!input||!name||!/^[\w-]+$/.test(name))throw Error('Supply AUDIT NEW_RUN [--webkit]');
 const raw=fs.readFileSync(input),audit=JSON.parse(raw),protocol=JSON.parse(fs.readFileSync('tests/visual/lash-domain-protocol.json')),inputs=loadInputs();
 assert.equal(audit.protocolSHA256,hash(fs.readFileSync('tests/visual/lash-domain-protocol.json')));assert.equal(audit.helperSHA256,hash(fs.readFileSync('tests/visual/lash-domain.mjs')));
 const check=()=>{for(const[f,h]of Object.entries({...protocol.images,...protocol.modules}))assert.equal(hash(fs.readFileSync(f)),h);};check();
 const out='tests/visual/out/'+name;fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/'+engine.name()+'.started','started',{flag:'wx'});
 const result={engine:engine.name(),auditSHA256:hash(raw),harnessSHA256:hash(fs.readFileSync(__filename)),helperSHA256:audit.helperSHA256,legend:'Original images unchanged. Cyan=canonical upper, magenta=canonical lower, red=observed crossing paths (not certified foreign hair), white sparse circles=provisional tips and uncertainty. Mask: red=predicted opening, amber=opening clearance, blue=downward depth.25 probe, purple=additional.5 probe, black=outside probes. Probes exclude corners. Coarse geometry grid (maximum96 columns) is NOT semantic skin or a lash/effect mask. Full portraits1080 are previews; original and annotated eye crops are native pixels. No extension rendered.',runs:[]};
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});let browser;
 try{
  const url=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);});server.on('error',reject);});browser=await engine.launch();const page=await browser.newPage(engine===webkit?devices['iPhone 11']:{}),requests=[];page.on('request',r=>requests.push(new URL(r.url()).pathname));await page.route('https://**/*',r=>r.abort());await page.route('**/__domain_overlay__',r=>r.fulfill({body:'<!doctype html><title>Offline domain audit</title>',contentType:'text/html'}));await page.goto(url+'/__domain_overlay__');
  await page.exposeFunction('saveDomainPNG',(file,png)=>{if(path.basename(file)!==file)throw Error('Path');fs.writeFileSync(out+'/'+file,Buffer.from(png.split(',')[1],'base64'),{flag:'wx'});});
  for(const r of audit.runs.filter(r=>r.engine===engine.name())){
   console.log(engine.name(),r.file);const reference=inputs.runs.find(t=>t.engine===r.engine&&t.file===r.file);
   // No annotation is sent to the actual analysis call.
   await page.evaluate(async({r,reference})=>{
    const {analyzeEye}=await import('/src/retouch/lashAnalysis.mjs'),image=new Image();image.src='/'+r.imagePath;await image.decode();if(image.naturalWidth!==r.W||image.naturalHeight!==r.H)throw Error('Decoded dimension drift');
    for(const side of ['left','right']){const a=analyzeEye(image,reference.geometry[side],side,{maxSide:224});if(a.rw!==r.eyes[side].workingSize.w||a.rh!==r.eyes[side].workingSize.h)throw Error('Grid conversion drift');if(JSON.stringify(a.diagnostics.crossing)!==JSON.stringify(reference.crossing[side]))throw Error('Actual crossing replay changed '+side);}
    image.src='';
   },{r:{file:r.file,imagePath:r.imagePath,W:r.W,H:r.H,eyes:r.eyes},reference});
   const record=await page.evaluate(async({r,engine,options})=>{
    const {measureDomainPoint}=await import('/tests/visual/lash-domain.mjs'),image=new Image();image.src='/'+r.imagePath;await image.decode();const files=[];
    const save=async(c,label)=>{const file=engine+'-'+r.file+'-'+label+'.png';await window.saveDomainPNG(file,c.toDataURL());files.push({label,file,width:c.width,height:c.height});};
    const portrait=document.createElement('canvas');portrait.width=Math.min(1080,r.W);portrait.height=Math.round(portrait.width*r.H/r.W);portrait.getContext('2d').drawImage(image,0,0,portrait.width,portrait.height);await save(portrait,'original-portrait');portrait.width=portrait.height=0;
    for(const[side,e]of Object.entries(r.eyes)){
     const roi=e.roi,rx=Math.floor(roi.x0*r.W),ry=Math.floor(roi.y0*r.H),rw=Math.ceil(roi.x1*r.W)-rx,rh=Math.ceil(roi.y1*r.H)-ry,c=document.createElement('canvas');c.width=rw;c.height=rh;const x=c.getContext('2d');x.drawImage(image,rx,ry,rw,rh,0,0,rw,rh);await save(c,side+'-original-native');
     const arc=(points,color)=>{x.strokeStyle=color;x.lineWidth=1;x.beginPath();points.forEach((p,i)=>i?x.lineTo(p.x-rx,p.y-ry):x.moveTo(p.x-rx,p.y-ry));x.stroke();};arc(e.upper,'#00ffff');arc(e.lower,'#ff00ff');for(const p of e.paths)arc(p.points,'#ff3030');
     for(const l of r.labels.filter(l=>l.side===side)){x.strokeStyle='#ffffff';x.beginPath();x.arc(l.tip.x-rx,l.tip.y-ry,l.uncertainty,0,Math.PI*2);x.stroke();arc([l.tip,...l.shaft.map(s=>s.point)],'#ffffff');}
     await save(c,side+'-geometry-paths-native');c.width=c.height=0;
     const mask=document.createElement('canvas');mask.width=Math.min(96,e.workingSize.w);mask.height=Math.max(1,Math.round(mask.width*e.workingSize.h/e.workingSize.w));const mx=mask.getContext('2d'),pixels=mx.createImageData(mask.width,mask.height);let colors={opening:0,clearance:0,depth025:0,depth050:0,other:0};
     for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){
      const p={x:(roi.x0+(x+.5)/mask.width*(roi.x1-roi.x0))*r.W,y:(roi.y0+(y+.5)/mask.height*(roi.y1-roi.y0))*r.H},d=measureDomainPoint(p,e.upper,e.lower,options);let color=[0,0,0],key='other';
      if(d.polygon.inside){color=[180,25,25];key='opening';}else if(d.polygon.boundaryDistance<=d.clearance){color=[220,160,0];key='clearance';}else if(d.belowProbe[0].contains){color=[40,130,255];key='depth025';}else if(d.belowProbe[1].contains){color=[150,60,210];key='depth050';}
      const i=(y*mask.width+x)*4;pixels.data.set([...color,255],i);colors[key]++;
     }mx.putImageData(pixels,0,0);await save(mask,side+'-geometric-probes');files.at(-1).cellCounts=colors;mask.width=mask.height=0;
    }image.src='';return{file:r.file,actualNativeCrossingReplay:'PASS exact paths/flags and working dimensions',files};
   },{r,engine:engine.name(),options:protocol.geometryOptions});result.runs.push(record);fs.writeFileSync(out+'/manifest-'+engine.name()+'.json',JSON.stringify(result,null,2)+'\n');
  }
  assert.ok(!requests.some(p=>/\.(wasm|task)$/.test(p)));check();result.requests=requests;result.sourceAndModulesUnchangedBeforeAfter=true;fs.writeFileSync(out+'/manifest-'+engine.name()+'.json',JSON.stringify(result,null,2)+'\n');
 }finally{if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
