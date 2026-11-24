'use strict';
// Annotation bytes are checked here; only image names/dimensions reach inference.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process'),{chromium,webkit,devices}=require('@playwright/test');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),root=path.resolve(__dirname,'../..');
async function main(){
 const name=process.argv[2],engine=process.argv.includes('--webkit')?webkit:chromium;if(!name||!/^[\w-]+$/.test(name))throw Error('Supply NEW run');
 const freezeBytes=fs.readFileSync(path.join(__dirname,'lash-freeend-freeze.json')),freeze=JSON.parse(freezeBytes);
 for(const[f,d]of Object.entries(freeze.inputs))if(hash(fs.readFileSync(path.join(root,f)))!==d)throw Error('Frozen original-only input drift: '+f);
 const sources=JSON.parse(fs.readFileSync(path.join(__dirname,'out/freeend-01-download/manifest.json'))).filter(s=>s.status==='downloaded');
 for(const s of sources)if(hash(fs.readFileSync(path.join(__dirname,'out/freeend-01-download',s.file)))!==s.sha256)throw Error('Source drift');
 const out=path.join(__dirname,'out',name);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,engine.name()+'.started'),'started',{flag:'wx'});
 const graph=path.join(out,'candidate-src');if(!fs.existsSync(graph))for(const dir of ['retouch','rendering','vision'])fs.cpSync(path.join(root,'src',dir),path.join(graph,dir),{recursive:true});
 const sourceHashes={};for(const dir of ['retouch','rendering','vision'])for(const f of fs.readdirSync(path.join(graph,dir)))if(fs.statSync(path.join(graph,dir,f)).isFile())sourceHashes[dir+'/'+f]=hash(fs.readFileSync(path.join(graph,dir,f)));
 const manifest={engine:engine.name(),baseline:freeze.baseline,freezeSHA256:hash(freezeBytes),harnessSHA256:hash(fs.readFileSync(__filename)),sourceHashes,meaning:'First-use source-frozen real FaceMesh/analysis. No annotation coordinates or angles enter inference; provisional labels are audited only after outputs.',runs:[]};
 let browser;const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});
 try{
  const url=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);});server.on('error',reject);});browser=await engine.launch();const page=await browser.newPage(engine===webkit?devices['iPhone 11']:{}),requests=[];page.on('request',r=>requests.push(new URL(r.url()).pathname));await page.route('https://**/*',r=>r.abort());
  await page.exposeFunction('saveOriginalGeometry',(file,data)=>{if(path.basename(file)!==file)throw Error('Path');fs.writeFileSync(path.join(out,file),Buffer.from(data.split(',')[1],'base64'),{flag:'wx'});});
  for(const s of sources){
   console.log(engine.name(),s.file);await page.goto(url+'/index.html');await page.waitForFunction(()=>!!window.AuraGram);await page.setInputFiles('#fileInput',path.join(__dirname,'out/freeend-01-download',s.file));await page.waitForFunction(()=>['ready','no_face','failed','unsupported'].includes(window.AuraGram.face.status()),null,{timeout:100000});
   const status=await page.evaluate(()=>window.AuraGram.face.status());
   if(status!=='ready'){manifest.runs.push({file:s.file,W:s.width,H:s.height,sha256:s.sha256,status,reason:'No usable actual FaceMesh; no fabricated geometry or oracle seed',eyes:[]});}
   else{
    const job={file:s.file,width:s.width,height:s.height,run:name,engine:engine.name()};
    const result=await page.evaluate(async job=>{
     const base='/tests/visual/out/'+job.run+'/candidate-src/retouch/',{describeEyes}=await import(base+'eyeGeometry.mjs'),{analyzeEye,LASH_ANALYSIS_VERSION}=await import(base+'lashAnalysis.mjs');
     const source=new Image();source.src='/tests/visual/out/freeend-01-download/'+job.file;await source.decode();if(source.width!==job.width||source.height!==job.height)throw Error('Source dimensions/orientation');
     const store=window.AuraGram.face.store(),regs=store.faces[0].regions,eyes=describeEyes(regs,Math.max(...regs.faceOval.map(p=>p.x))-Math.min(...regs.faceOval.map(p=>p.x))),budgets=[];
     for(const maxSide of [224,320,384]){const start=performance.now(),pair=Object.fromEntries(['left','right'].map(side=>[side,analyzeEye(source,eyes[side],side,{maxSide})]));budgets.push({maxSide,analysisMs:performance.now()-start,eyes:Object.fromEntries(Object.entries(pair).map(([side,a])=>[side,{rw:a.rw,rh:a.rh,size:a.size,reason:a.reason,confidence:a.confidence,densityConfidence:a.densityConfidence,lengthConfidence:a.lengthConfidence,tips:a.tips,traces:a.traces,diagnostics:a.diagnostics,typedArrayBytes:a.typedArrayBytes}]))});}
     const c=document.createElement('canvas');c.width=Math.min(1080,source.width);c.height=Math.round(c.width*source.height/source.width);const x=c.getContext('2d');x.drawImage(source,0,0,c.width,c.height);
     for(const [side,e]of Object.entries(eyes)){const r=e.roi;if(r){x.strokeStyle=side==='left'?'#00dd77':'#ff5555';x.lineWidth=1;x.strokeRect(r.x0*c.width,r.y0*c.height,(r.x1-r.x0)*c.width,(r.y1-r.y0)*c.height);}for(const[key,color]of[['upper','#00ffff'],['lower','#ff00ff']]){const points=e[key]||e[key+'Lid']||[];if(Array.isArray(points)&&points.length){x.strokeStyle=color;x.beginPath();points.forEach((p,i)=>i?x.lineTo(p.x*c.width,p.y*c.height):x.moveTo(p.x*c.width,p.y*c.height));x.stroke();}}}
     const geometryFile=job.engine+'-'+job.file+'-geometry.png';await window.saveOriginalGeometry(geometryFile,c.toDataURL());c.width=c.height=0;source.src='';
     return{file:job.file,W:job.width,H:job.height,status:'ready',faceCount:store.faces.length,geometry:eyes,analysisVersion:LASH_ANALYSIS_VERSION,budgets,geometryFile};
    },job);result.sha256=s.sha256;manifest.runs.push(result);
   }
   fs.writeFileSync(path.join(out,'manifest-'+engine.name()+'.json'),JSON.stringify(manifest,null,2));
  }
  manifest.requests=requests;fs.writeFileSync(path.join(out,'manifest-'+engine.name()+'.json'),JSON.stringify(manifest,null,2));
 }finally{if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
