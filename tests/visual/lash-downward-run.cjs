'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawn}=require('child_process'),{chromium,webkit,devices}=require('@playwright/test'),{loadInputs,hash,archived}=require('./lash-domain-inputs.cjs');
async function main(){
 const name=process.argv[2],engine=process.argv.includes('--webkit')?webkit:chromium;if(!name||!/^[\w-]+$/.test(name))throw Error('Supply NEW LASH_RUN');const out='tests/visual/out/'+name;fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/'+engine.name()+'.started','started',{flag:'wx'});
 const protocolBytes=fs.readFileSync('tests/visual/lash-downward-protocol.json'),protocol=JSON.parse(protocolBytes),input=loadInputs();
 const check=()=>{for(const[f,h]of Object.entries(protocol.inputs))assert.equal(hash(f.startsWith('tests/visual/out/')?archived(f):fs.readFileSync(f)),h);for(const[f,h]of Object.entries({...protocol.images,...protocol.modules}))assert.equal(hash(fs.readFileSync(f)),h);};check();
 const helpers=['lash-downward.mjs','lash-domain.mjs'],helperHashes=Object.fromEntries(helpers.map(f=>[f,hash(fs.readFileSync('tests/visual/'+f))]));
 const result={engine:engine.name(),protocolSHA256:hash(protocolBytes),fixerSHA256:hash(fs.readFileSync('tests/visual/lash-downward-fixer.json')),refinementSHA256:hash(fs.readFileSync('tests/visual/lash-downward-terminal-refinement.json')),harnessSHA256:hash(fs.readFileSync(__filename)),helperHashes,meaning:'Image-only offline graph observations, no source labels supplied to detector. Root-zone graph attachment is not same-fiber/follicle ownership. Qualified observations are not approved Length. Existing product guard flags retained separately. No model inference or extension render.',runs:[]};
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});let browser;
 try{
  const url=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);});server.on('error',reject);});browser=await engine.launch();const page=await browser.newPage(engine===webkit?devices['iPhone 11']:{}),requests=[];page.on('request',r=>requests.push(new URL(r.url()).pathname));await page.route('https://**/*',r=>r.abort());await page.route('**/__downward__',r=>r.fulfill({body:'<!doctype html><title>Offline downward graph</title>',contentType:'text/html'}));await page.goto(url+'/__downward__');
  await page.exposeFunction('saveDownward',(file,bytes)=>{if(path.basename(file)!==file)throw Error('Path');fs.writeFileSync(out+'/'+file,typeof bytes==='string'?Buffer.from(bytes.split(',')[1],'base64'):Buffer.from(bytes),{flag:'wx'});});
  for(const r of input.runs.filter(r=>r.engine===engine.name())){
   console.log(engine.name(),r.file);
   // Explicit job whitelist: NO input.labels, coordinates or annotated angles.
   const job={file:r.file,W:r.W,H:r.H,imagePath:r.imagePath,geometry:r.geometry,engine:engine.name(),parameters:protocol.parameters};
   const detected=await page.evaluate(async job=>{
    const {traceDownward}=await import('/tests/visual/lash-downward.mjs'),{lashRoiSize}=await import('/src/retouch/eyeGeometry.mjs'),{lumaOf}=await import('/src/retouch/lashAnalysis.mjs'),im=new Image();im.src='/'+job.imagePath;await im.decode();if(im.width!==job.W||im.height!==job.H)throw Error('Native dimensions changed');const eyes={};
    for(const side of ['left','right']){
     const e=job.geometry[side],size=lashRoiSize(e.roi,job.W,job.H,{maxSide:job.parameters.maxSide}),c=document.createElement('canvas');c.width=size.w;c.height=size.h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,e.roi.x0*job.W,e.roi.y0*job.H,size.rawW,size.rawH,0,0,size.w,size.h);
     const rgba=x.getImageData(0,0,size.w,size.h).data,luma=new Float32Array(size.w*size.h);for(let i=0;i<luma.length;i++)luma[i]=lumaOf(rgba[i*4],rgba[i*4+1],rgba[i*4+2])/255;
     const toRoi=p=>({x:(p.x-e.roi.x0)/(e.roi.x1-e.roi.x0)*size.w,y:(p.y-e.roi.y0)/(e.roi.y1-e.roi.y0)*size.h}),upper=e.upperLid.map(toRoi),lower=e.lowerLid.map(toRoi),start=performance.now(),a=traceDownward(luma,size.w,size.h,upper,lower,job.parameters),ms=performance.now()-start;
     const prefix=job.engine+'-'+job.file+'-'+side,bin=prefix+'-luma.f32';await window.saveDownward(bin,Array.from(new Uint8Array(luma.buffer)));const maps=[];
     for(const kind of ['ridge','observed-connected']){const pixels=x.createImageData(size.w,size.h);for(let i=0;i<luma.length;i++){const v=Math.round(Math.min(1,a.response[i]/.15)*255);pixels.data.set(kind==='ridge'?[v,v,v,255]:a.roots[i]?[0,170,255,255]:a.connected[i]?[0,220,90,255]:a.active[i]?[140,140,140,255]:[0,0,0,255],i*4);}x.putImageData(pixels,0,0);const f=prefix+'-'+kind+'.png';await window.saveDownward(f,c.toDataURL());maps.push({kind,file:f});}
     eyes[side]={size,upper,lower,reason:a.reason,frame:a.frame,diagnostics:a.diagnostics,traces:a.traces,ms,lumaFile:bin,maps};c.width=c.height=0;
    }im.src='';return{file:job.file,W:job.W,H:job.H,eyes};
   },job);
   detected.imagePath=r.imagePath;detected.imageSHA256=r.imageSHA256;detected.geometry=r.geometry;
   for(const[side,a]of Object.entries(detected.eyes)){a.lumaSHA256=hash(fs.readFileSync(out+'/'+a.lumaFile));a.productCrossing=r.crossing[side];const e=r.geometry[side],sx=(e.roi.x1-e.roi.x0)*r.W/a.size.w,sy=(e.roi.y1-e.roi.y0)*r.H/a.size.h,point=p=>({x:e.roi.x0*r.W+p.x*sx,y:e.roi.y0*r.H+p.y*sy});for(const t of a.traces){t.nativePoints=t.points.map(point);t.tipNative=point(t.tip);t.rootNative=point(t.root);t.lengthNative=t.nativePoints.reduce((sum,p,i)=>sum+(i?Math.hypot(p.x-t.nativePoints[i-1].x,p.y-t.nativePoints[i-1].y):0),0);t.widthNative=t.width===null?null:t.width*Math.hypot(-t.axis.dy*sx,t.axis.dx*sy);}}
   // Posthoc drawing only; frozen sparse labels never enter detection above.
   const labels=input.labels.filter(l=>l.file===r.file);detected.visuals=await page.evaluate(async({r,engine,labels})=>{
    const im=new Image();im.src='/'+r.imagePath;await im.decode();const files=[],save=async(c,label)=>{const file=engine+'-'+r.file+'-'+label+'.png';await window.saveDownward(file,c.toDataURL());files.push({label,file,width:c.width,height:c.height});};
    const full=document.createElement('canvas');full.width=Math.min(1080,r.W);full.height=Math.round(full.width*r.H/r.W);full.getContext('2d').drawImage(im,0,0,full.width,full.height);await save(full,'original-portrait');full.width=full.height=0;
    for(const[side,a]of Object.entries(r.eyes)){
     const roi=r.geometry[side].roi,rx=Math.floor(roi.x0*r.W),ry=Math.floor(roi.y0*r.H),rw=Math.ceil(roi.x1*r.W)-rx,rh=Math.ceil(roi.y1*r.H)-ry,c=document.createElement('canvas');c.width=rw;c.height=rh;const x=c.getContext('2d');x.drawImage(im,rx,ry,rw,rh,0,0,rw,rh);await save(c,side+'-original-native');
     for(const t of a.traces){x.strokeStyle=t.qualifiedObservation?'#00ff66':t.reasons.includes('protected-or-uncertain-tip')?'#ff9e00':'#ff3333';x.lineWidth=1;x.beginPath();t.nativePoints.forEach((p,i)=>i?x.lineTo(p.x-rx,p.y-ry):x.moveTo(p.x-rx,p.y-ry));x.stroke();x.fillStyle='#00ffff';x.fillRect(t.tipNative.x-rx-1,t.tipNative.y-ry-1,2,2);}
     for(const l of labels){if(l.tip.x<rx||l.tip.x>rx+rw||l.tip.y<ry||l.tip.y>ry+rh)continue;x.strokeStyle='#ffffff';x.beginPath();x.arc(l.tip.x-rx,l.tip.y-ry,l.uncertainty,0,Math.PI*2);x.stroke();}await save(c,side+'-all-hypotheses-native');c.width=c.height=0;
     for(const t of a.traces.slice(0,6)){const cx=Math.max(0,Math.min(r.W-160,Math.floor(t.tipNative.x)-80)),cy=Math.max(0,Math.min(r.H-160,Math.floor(t.tipNative.y)-80)),q=document.createElement('canvas');q.width=q.height=160;const qx=q.getContext('2d');qx.drawImage(im,cx,cy,160,160,0,0,160,160);await save(q,side+'-trace'+t.id+'-original160');q.width=q.height=0;}
    }im.src='';return files;
   },{r:detected,engine:engine.name(),labels});result.runs.push(detected);fs.writeFileSync(out+'/manifest-'+engine.name()+'.json',JSON.stringify(result,null,2)+'\n');
  }
  assert.ok(!requests.some(p=>/\.(wasm|task)$/.test(p)));check();for(const[f,h]of Object.entries(helperHashes))assert.equal(hash(fs.readFileSync('tests/visual/'+f)),h);result.requests=requests;result.inputsUnchangedBeforeAfter=true;fs.writeFileSync(out+'/manifest-'+engine.name()+'.json',JSON.stringify(result,null,2)+'\n');
 }finally{if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
