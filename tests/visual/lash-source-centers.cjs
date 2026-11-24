'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),{spawn}=require('child_process');
const {chromium,webkit,devices}=require('@playwright/test');
async function main(){
 const name=process.argv[2];if(!name||!/^[\w-]+$/.test(name))throw Error('Supply NEW run name');
 const engine=process.argv.includes('--webkit')?webkit:chromium,root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'out',name);
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,engine.name()+'.started'),new Date().toISOString(),{flag:'wx'});
 const helper=fs.readFileSync(path.join(__dirname,'lash-source-centers.mjs')),modulePath=path.join(out,'source-centers.mjs');
 if(fs.existsSync(modulePath)){if(!fs.readFileSync(modulePath).equals(helper))throw Error('Helper changed between engines');}else fs.writeFileSync(modulePath,helper,{flag:'wx'});
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 const frozenBytes=f=>zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'localization-evidence',f+'.json.gz')));
 const read=f=>JSON.parse(frozenBytes(f));
 // Same fixed traces in both engines: otherwise source sampling is confounded
 // with the earlier engines' slightly different downsampled tracing paths.
 const frozen=read('chromium'),geometry=read('geometry');
 const images=new Map(),imageHashes={};
 for(const r of frozen.runs){const bytes=fs.readFileSync(path.join(__dirname,'out/dataset',r.file));if(hash(bytes)!==frozen.imageHashes[r.file])throw Error('JPEG changed');images.set(r.file,bytes);imageHashes[r.file]=hash(bytes);}
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','inherit']});let browser;
 try{
 const url=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);});server.on('error',reject);});
 browser=await engine.launch();const page=await browser.newPage(engine===webkit?devices['iPhone 11']:{}),requests=[];
 page.on('request',r=>requests.push(new URL(r.url()).pathname));
 await page.route('https://**/*',r=>r.abort());await page.route('**/__source_centers__',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Offline native profiles</title>'}));
 await page.route('**/tests/visual/out/dataset/*',r=>{const f=decodeURIComponent(new URL(r.request().url()).pathname.split('/').at(-1));return images.has(f)?r.fulfill({contentType:'image/jpeg',body:images.get(f)}):r.abort();});
 await page.exposeFunction('saveProfilePNG',(file,data)=>{if(path.basename(file)!==file)throw Error('Invalid name');fs.writeFileSync(path.join(out,file),Buffer.from(data.split(',')[1],'base64'),{flag:'wx'});});
 await page.goto(url+'/__source_centers__');
 const result=await page.evaluate(async({runs,geometry,name,engine})=>{
  const {refineCenters,windowDirections}=await import('/tests/visual/out/'+name+'/source-centers.mjs'),eyes=[];
  for(const run of runs){const image=new Image();image.src='/tests/visual/out/dataset/'+run.file;await image.decode();
   const g=geometry.runs.find(g=>g.file===run.file);if(image.width!==g.W||image.height!==g.H)throw Error('Dimensions changed');
   for(const side of ['left','right']){const roi=g.perEye[side].roi,size=g.budgets.find(b=>b.maxSide===224).eyes[side];
    const rawW=(roi.x1-roi.x0)*g.W,rawH=(roi.y1-roi.y0)*g.H,rx=Math.floor(roi.x0*g.W),ry=Math.floor(roi.y0*g.H),w=Math.ceil(roi.x1*g.W)-rx,h=Math.ceil(roi.y1*g.H)-ry;
    const c=document.createElement('canvas');c.width=w;c.height=h;
    try{const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(image,rx,ry,w,h,0,0,w,h);const rgba=x.getImageData(0,0,w,h).data;
     const luma=Float32Array.from({length:w*h},(_,i)=>(.2126*rgba[i*4]+.7152*rgba[i*4+1]+.0722*rgba[i*4+2])/255);
     const candidates=[];const e=run.eyes[side];
     for(const [index,tip]of e.contextTips.entries()){
      if(tip.c<.6||e.lengthConfidence<.25)continue;
      const points=[];let arc=0,sourceArc=0;
      for(let i=0;i<tip.evidence.points.length;i++){const p=tip.evidence.points[i],last=tip.evidence.points[i-1];if(i)arc+=Math.hypot(p.x-last.x,p.y-last.y);if(arc>tip.evidence.observedLength+1e-8)break;
       const q={x:roi.x0*g.W+(p.x+.5)*rawW/size.rw-rx-.5,y:roi.y0*g.H+(p.y+.5)*rawH/size.rh-ry-.5};
       if(points.length)sourceArc+=Math.hypot(q.x-points.at(-1).x,q.y-points.at(-1).y);points.push(q);if(sourceArc>=10)break;
      }
      const variants=[];
      for(const radius of [1.5,2.5])for(const angleOffset of [-15,0,15]){
       const refined=refineCenters(luma,w,h,points,{radius,angleOffset});
       const anchor=refined[0];
       const freeAnchor=anchor?.accepted?{x:anchor.x+anchor.nx*anchor.proposedShift,y:anchor.y+anchor.ny*anchor.proposedShift}:null;
       const freeAnchorDirections=freeAnchor?windowDirections([{...anchor,...freeAnchor},...refined.slice(1)]):[];
       variants.push({radius,angleOffset,refined,directions:windowDirections(refined),freeAnchorDiagnostic:{point:freeAnchor,directions:freeAnchorDirections,note:'Comparison of anchor bias only; does not move product tip or certify a physical endpoint.'},rejections:refined.map((p,i)=>({i,reason:p.reason,accepted:p.accepted})).filter(p=>!p.accepted)});
      }
      candidates.push({index,recovered:!!tip.evidence.boundaryRecovery,fixedTip:points[0],sourceSupport:sourceArc,rawPoints:points,rawDirections:windowDirections(points),variants});
     }
     if(candidates.length){const display=document.createElement('canvas');display.width=w*4;display.height=h*4;const dx=display.getContext('2d');dx.imageSmoothingEnabled=false;dx.drawImage(c,0,0,display.width,display.height);
      const line=(p,color)=>{dx.strokeStyle=color;dx.lineWidth=2;dx.beginPath();p.forEach((v,i)=>i?dx.lineTo((v.x+.5)*4,(v.y+.5)*4):dx.moveTo((v.x+.5)*4,(v.y+.5)*4));dx.stroke();};
      for(const candidate of candidates){line(candidate.rawPoints,'#00eaff');const v=candidate.variants.find(v=>v.radius===2.5&&v.angleOffset===0);line(v.refined,'#ffdb55');for(const p of v.refined){dx.strokeStyle=p.accepted?'#ffdb55':'#ff4444';dx.beginPath();dx.arc((p.x+.5)*4,(p.y+.5)*4,2,0,Math.PI*2);dx.stroke();}const tip=candidate.fixedTip;dx.strokeStyle='white';dx.beginPath();dx.arc((tip.x+.5)*4,(tip.y+.5)*4,5,0,Math.PI*2);dx.stroke();}
      await window.saveProfilePNG(`${engine}-${run.file.replace('.jpg','')}-${side}-4x.png`,display.toDataURL());display.width=display.height=0;
     }
     const rgbaSHA256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',rgba))).map(v=>v.toString(16).padStart(2,'0')).join('');
     eyes.push({file:run.file,side,width:w,height:h,roi,rgbaSHA256,sourceSupportContract:'Contiguous observed prefix only; no root extension to reach a window. Native luminance, no resizing.',candidates});
    }finally{c.width=c.height=0;}
   }
  }return eyes;
 },{runs:frozen.runs,geometry,name,engine:engine.name()});
 if(requests.some(r=>/\.(wasm|task)$/.test(r)))throw Error('Unexpected inference');
 const manifest={baseline:'9d7d827da5b502c35b478dfec088c21e990ff256',engine:engine.name(),fixedTraceEngine:'chromium',frozenManifestSHA256:hash(frozenBytes('chromium')),geometrySHA256:hash(frozenBytes('geometry')),helperSHA256:hash(helper),harnessSHA256:hash(fs.readFileSync(__filename)),imageHashes,geometrySource:'localization-evidence/geometry.json.gz',fixedAnalysisSourceHashes:frozen.sourceHashes,requests,eyes:result,note:'Offline diagnostic, native original decoded luminance. Frozen tips are not certified physical endpoints. .25px interpolation adds no information. Rejected samples remain unchanged and cannot validate direction.'};
 fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
 for(const e of result)for(const c of e.candidates.filter(c=>c.recovered))console.log(engine.name(),e.file,e.side,'tip',c.index,'raw',c.rawDirections,'refined',c.variants.map(v=>({r:v.radius,a:v.angleOffset,anchor:v.refined[0].reason,angles:v.directions.map(d=>[d.window,+d.angle.toFixed(1),d.allProfilesAccepted]),ok:v.refined.filter(p=>p.accepted).length,total:v.refined.length})));
 }finally{if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
