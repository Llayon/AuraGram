'use strict';
// Development diagnostic only. Frozen labels are checked in Node, never passed
// into browser candidate generation, tracing, or tangent estimation.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn,execFileSync}=require('child_process');
const {chromium,webkit}=require('@playwright/test');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const distalBodyStart=process.argv.includes('--distal-body');
 const multiscale=process.argv.includes('--multiscale');
 if(distalBodyStart&&!multiscale)throw Error('Distal-body requires multiscale stage');
 const initializeCell=process.argv.includes('--initialize-cell');
 const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Supply NEW output directory');
 const frozen=JSON.parse(fs.readFileSync('tests/visual/lash-spatial-original-labels-01.freeze.json'));
 for(const [file,digest]of Object.entries(frozen.inputs))if(hash(fs.readFileSync(file))!==digest)throw Error('Frozen labels changed');
 const labels=JSON.parse(fs.readFileSync('tests/visual/lash-spatial-original-labels-01.json'));
 const sourcePath='tests/visual/out/spatial-supplement-02/'+labels.file,source=fs.readFileSync(sourcePath);
 if(hash(source)!==frozen.sourceSHA256||hash(source)!==labels.sourceSHA256)throw Error('Source changed');
 const modules=['src/retouch/lashAnalysis.mjs','src/retouch/eyeGeometry.mjs','src/vision/faceGeometry.mjs','tests/visual/lash-native-path.mjs','tests/visual/lash-coarse-route.mjs','tests/visual/lash-multiscale-path.mjs','tests/visual/lash-scale-correspondence.mjs','tests/visual/lash-distal-body-start.mjs','tests/visual/lash-native-cell.mjs','tests/visual/lash-subpixel-probe.mjs','tests/visual/lash-subpixel-center.mjs','tests/visual/lash-native-shaft.mjs','tests/visual/lash-spatial-ending.mjs','tests/visual/lash-side-closure.mjs','tests/visual/lash-endpoint-profile.mjs'];
 fs.mkdirSync(output,{recursive:true});
 const protocol={distalBodyStart,multiscale,initializeCell,kind:'development-diagnostic-not-acceptance',baseline:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSHA256:hash(source),labelInputs:frozen.inputs,moduleSHA256:Object.fromEntries(modules.map(f=>[f,hash(fs.readFileSync(f))])),runnerSHA256:hash(fs.readFileSync(__filename)),maxSide:224,seedLimit:128,annotationsUsedAsTraceInput:false,independentCritique:'not-completed',eligibility:'unqualified-positive-lead; not held out'};
 fs.writeFileSync(path.join(output,'protocol.json'),JSON.stringify(protocol,null,2)+'\n',{flag:'wx'});
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});
 try{
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),15000);server.once('error',reject);server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});});
 for(const engine of [chromium,webkit]){
 const screenPath='tests/visual/out/spatial-supplement-screen-'+engine.name()+'-02/screening.json';
 const screened=JSON.parse(fs.readFileSync(screenPath)).results.find(r=>r.file===labels.file);
 if(screened.status!=='ready'||screened.sha256!==hash(source)||screened.split!=='development')throw Error('Ineligible geometry');
 const browser=await engine.launch();try{
 const page=await browser.newPage();await page.route('https://**/*',r=>r.abort());
 await page.route('**/__native_real__',r=>r.fulfill({body:'<!doctype html>',contentType:'text/html'}));await page.goto(url+'/__native_real__');
 const run=await page.evaluate(async({data,eyes,W,H,initializeCell,multiscale,distalBodyStart})=>{
 const {auditMultiscaleSeeds}=await import('/tests/visual/lash-multiscale-path.mjs');
 const {analyzeLuma,lumaOf}=await import('/src/retouch/lashAnalysis.mjs');
 const {lashRoiSize}=await import('/src/retouch/eyeGeometry.mjs');
 const {auditNativeSeeds,projectAutomaticSeeds,createNativePatchReader}=await import('/tests/visual/lash-native-path.mjs');
 const image=new Image();image.src=data;await image.decode();if(image.width!==W||image.height!==H)throw Error('Source dimensions');
 const reader=createNativePatchReader(image),results={};
 const simplify=c=>({reason:c.reason,points:c.points,bootstrapFit:c.bootstrapFit,attempts:c.attempts.map(a=>({reason:a.reason,accepted:a.accepted,shift:a.shift,variance:a.variance,center:a.center,tangent:a.tangent,directionFit:a.directionFit,linkAccepted:a.linkAccepted,denseSupported:a.dense?.every(s=>s.supported)}))});
 try{for(const side of ['left','right']){
 const eye=eyes[side],roi=eye.roi,size=lashRoiSize(roi,W,H,{maxSide:224});
 if(!eye.usable||size.status!=='ok'){results[side]={status:'censored',reason:'unusable-or-small-native-roi',size};continue;}
 const c=document.createElement('canvas');c.width=size.w;c.height=size.h;const cx=c.getContext('2d');
 cx.drawImage(image,roi.x0*W,roi.y0*H,size.rawW,size.rawH,0,0,size.w,size.h);
 const bytes=cx.getImageData(0,0,size.w,size.h).data,luma=Float32Array.from({length:size.w*size.h},(_,i)=>lumaOf(bytes[4*i],bytes[4*i+1],bytes[4*i+2])/255);
 const toROI=p=>({x:(p.x-roi.x0)/(roi.x1-roi.x0)*size.w,y:(p.y-roi.y0)/(roi.y1-roi.y0)*size.h});
 const lid=eye.upperLid.map(toROI),lower=eye.lowerLid.map(toROI),mid=lid[Math.floor(lid.length/2)],low=lower[Math.floor(lower.length/2)];
 const bandH=Math.max(3,Math.min(size.h*.45,Math.hypot(mid.x-low.x,mid.y-low.y)*.65));
 const args=[luma,size.w,size.h,lid,lower,bandH,toROI(eye.inner),(eye.browPoints||[]).map(toROI)];
 const baseline=analyzeLuma(...args,{recoverBoundaryTips:true}),a=analyzeLuma(...args,{recoverBoundaryTips:true,structureAudit:true,debug:multiscale});
 for(const field of ['tips','densityRidge','densityConfidenceMap','rootConnectionMap','densityConfidence','lengthConfidence'])if(JSON.stringify(a[field])!==JSON.stringify(baseline[field]))throw Error('Baseline changed: '+field);
 if(!a.structureAudit){results[side]={status:'censored',reason:a.reason,diagnostics:a.diagnostics,seeds:[],baselineTips:baseline.tips};c.width=c.height=0;continue;}
 const mapping={x:roi.x0*W,y:roi.y0*H,scaleX:size.rawW/size.w,scaleY:size.rawH/size.h};
 const seeds=projectAutomaticSeeds(a.structureAudit,mapping),start=performance.now();
 const native=multiscale?auditMultiscaleSeeds({...reader,coarse:{seeds:a.structureAudit.seeds,w:size.w,h:size.h,bandH,ridge:a.ridge,...a.debug},mapping,distalBodyStart}):auditNativeSeeds({...reader,seeds,initializeCell,roi:{x:roi.x0*W,y:roi.y0*H,w:size.rawW,h:size.rawH},lid:eye.upperLid.map(p=>({x:p.x*W-.5,y:p.y*H-.5})),lower:eye.lowerLid.map(p=>({x:p.x*W-.5,y:p.y*H-.5}))});
 results[side]={size,mapping,baselineIdentical:true,baselineTips:baseline.tips,automaticSeeds:seeds,analysisMs:performance.now()-start,...native,results:native.results.map(r=>({...r,...(r.local?{local:{...simplify(r.local),maximumArcNative:r.local.maximumArcNative}}:{}),...(r.proximal?{proximal:simplify(r.proximal),distal:simplify(r.distal)}:{})}))};
 c.width=c.height=0;
 }}finally{reader.dispose();}
 return results;
 },{data:'data:image/jpeg;base64,'+source.toString('base64'),eyes:screened.eyes,W:screened.width,H:screened.height,initializeCell,multiscale,distalBodyStart});
 const stats={};for(const [side,r]of Object.entries(run)){const records=r.results||[];stats[side]={seeds:r.automaticSeeds?.length||0,statusCounts:{},reasons:{},coarseConnected:records.filter(r=>r.coarseProximalConnection).length,proximalConnected:records.filter(r=>r.proximalConnection).length,accepted:records.filter(r=>r.endpointConfirmed).length,baselineTips:r.baselineTips?.length||0,baselineIdentical:r.baselineIdentical??null,analysisMs:r.analysisMs};for(const record of records){stats[side].statusCounts[record.status]=(stats[side].statusCounts[record.status]||0)+1;for(const reason of record.reasons)stats[side].reasons[reason]=(stats[side].reasons[reason]||0)+1;}}
 fs.writeFileSync(path.join(output,engine.name()+'.json'),JSON.stringify({engine:engine.name(),geometryPath:screenPath,geometrySHA256:hash(fs.readFileSync(screenPath)),sourceSHA256:hash(source),stats,run},null,2)+'\n',{flag:'wx'});
 console.log(engine.name(),JSON.stringify(stats));
 }finally{await browser.close();}
 }
 for(const [file,digest]of Object.entries(protocol.moduleSHA256))if(hash(fs.readFileSync(file))!==digest)throw Error('Algorithm changed during run');
 }finally{server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
