'use strict';
// Fixed-section measurements only. Never retries tracing or authorizes tips.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{spawn}=require('node:child_process');
const {chromium,webkit}=require('@playwright/test');
const hash=b=>createHash('sha256').update(b).digest('hex');
async function main(){
 const [inputDir,sourceFile,out]=process.argv.slice(2);
 if(!out||fs.existsSync(out))throw Error('Supply saved run, original JPEG and NEW output directory');
 const source=fs.readFileSync(sourceFile),protocol=JSON.parse(fs.readFileSync(path.join(inputDir,'protocol.json')));
 if(hash(source)!==protocol.sourceSHA256)throw Error('Source digest mismatch');
 // Check every algorithm dependency captured by the original tracing run.
 for(const [file,digest]of Object.entries(protocol.moduleSHA256))if(hash(fs.readFileSync(file))!==digest)throw Error('Changed dependency: '+file);
 const {NATIVE_PATH_PROTOCOL:nativeProtocol}=await import('./lash-native-path.mjs');
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'protocol.json'),JSON.stringify({kind:'fixed-bootstrap-sections-not-tracing',sourceSHA256:hash(source),inputDir,inputProtocolSHA256:hash(fs.readFileSync(path.join(inputDir,'protocol.json'))),runnerSHA256:hash(fs.readFileSync(__filename)),moduleSHA256:protocol.moduleSHA256,annotationsUsed:false,grantsTerminal:false,policy:'All original bootstrap distances, original prior axis and margin1.5. Continue measurements after refusal for diagnosis only. For fully supported sections, measure original dense links with both fixed radii and retain the along penalty. Never resume or replace a rejected trace.'},null,2)+'\n',{flag:'wx'});
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});
 try{
 const url=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server timeout')),15000);server.once('error',e=>{clearTimeout(t);reject(e);});server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(t);resolve(m[0]);}});});
 for(const engine of [chromium,webkit]){
  const inputFile=path.join(inputDir,engine.name()+'.json'),inputBytes=fs.readFileSync(inputFile),saved=JSON.parse(inputBytes);
  if(saved.sourceSHA256!==hash(source))throw Error('Saved run source mismatch');
  const browser=await engine.launch();
  try{
   const page=await browser.newPage();await page.route('https://**/*',r=>r.abort());await page.route('**/__bootstrap_diagnosis__',r=>r.fulfill({body:'<!doctype html>',contentType:'text/html'}));await page.goto(url+'/__bootstrap_diagnosis__');
   const results=await page.evaluate(async({data,saved})=>{
    const {createNativePatchReader,NATIVE_PATH_PROTOCOL:p}=await import('/tests/visual/lash-native-path.mjs');
    const {measureCentroid}=await import('/tests/visual/lash-subpixel-center.mjs');
    const {measureAt}=await import('/tests/visual/lash-endpoint-profile.mjs');
    const image=new Image();image.src=data;await image.decode();const reader=createNativePatchReader(image),buffer=new Float32Array(256*256),output={};
    try{for(const side of ['left','right']){
     output[side]=saved.run[side].results.filter(r=>r.local).map(r=>{
      const rect=r.patch,luma=buffer.subarray(0,rect.w*rect.h);reader.readPatch(rect,luma);
      const seed=r.initialization?.center;if(!seed)throw Error('Saved measured initialization center required');
      const prior=r.localStart.tangent,norm=Math.hypot(prior.x,prior.y),axis={x:prior.x/norm,y:prior.y/norm};
      const rows=p.bootstrapDistancesNative.map(distance=>({distance,...measureCentroid(luma,rect.w,rect.h,{x:seed.x+axis.x*distance,y:seed.y+axis.y*distance},axis,1.5,p)}));
      // Prefix must reproduce every bootstrap observation captured by tracing.
      const prefix=r.local.bootstrap||[];
      for(let i=0;i<prefix.length;i++)if(JSON.stringify(prefix[i])!==JSON.stringify(rows[i]))throw Error('Bootstrap observation mismatch');
      const denseLinks=[];
      if(rows.every(row=>row.accepted))for(let i=1;i<rows.length;i++){
       const a=rows[i-1].center,b=rows[i].center,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
       if(!Number.isFinite(len)||len===0)throw Error('Degenerate bootstrap link');
       const along={x:dx/len,y:dy/len},normal={x:-along.y,y:along.x},samples=[];
       for(let k=0,n=Math.ceil(len/p.denseStepNative);k<=n;k++){
        const t=k/n,point={x:a.x+dx*t,y:a.y+dy*t},m=measureAt(luma,rect.w,rect.h,point,along,normal,p.radiiNative);
        samples.push({point,response:m.response,supported:m.response>=p.observationFloor,measurement:m});
       }
       const link={supported:samples.every(s=>s.supported),samples};
       const original=r.local.bootstrapLinks?.[i-1];
       if(original&&JSON.stringify(original)!==JSON.stringify({supported:link.supported,samples:samples.map(({measurement,...s})=>s)}))throw Error('Dense bootstrap link mismatch');
       denseLinks.push(link);
      }
      return{rank:r.rank,index:r.index,patch:rect,coordinateSpace:'patch-local-source-pixels',originalLocalStop:r.local.reason,originalPrefixLength:prefix.length,originalSeed:seed,priorAxis:axis,rows,denseLinks};
     });
    }}finally{reader.dispose();}return output;
   },{data:'data:image/jpeg;base64,'+source.toString('base64'),saved});
   const stats={};for(const [side,records]of Object.entries(results)){
    const reasons={},centerReasons={};for(const r of records){const first=r.rows.find(row=>!row.accepted),center=r.rows.find(row=>row.distance===0);const k=first?first.distance+':'+first.reason:'all-five-supported';reasons[k]=(reasons[k]||0)+1;centerReasons[center.reason]=(centerReasons[center.reason]||0)+1;}
    const denseSamples=records.flatMap(r=>r.denseLinks.flatMap(l=>l.samples)),unsupported=denseSamples.filter(s=>!s.supported);
    stats[side]={records:records.length,firstRefusals:reasons,centerReasons,allFiveSupported:records.filter(r=>r.rows.every(row=>row.accepted)).length,
     denseSamples:denseSamples.length,unsupportedDenseSamples:unsupported.length,
     unsupportedWithoutPenalty:unsupported.filter(s=>s.measurement.transverseContrast<nativeProtocol.observationFloor).length,
     supportedTransverseButPenaltyRefusal:unsupported.filter(s=>s.measurement.transverseContrast>=nativeProtocol.observationFloor).length};
   }
   fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify({engine:engine.name(),inputSHA256:hash(inputBytes),stats,results},null,2)+'\n',{flag:'wx'});console.log(engine.name(),JSON.stringify(stats));
  }finally{await browser.close();}
 }
 for(const [file,digest]of Object.entries(protocol.moduleSHA256))if(hash(fs.readFileSync(file))!==digest)throw Error('Dependency changed during run: '+file);
 }finally{server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
