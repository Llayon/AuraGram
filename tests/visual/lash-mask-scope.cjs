'use strict';
// Actual mask helper, exported only in a served diagnostic module. No detector,
// fake tips, confidence bypass, stroke rendering or production-source edit.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process'),{chromium,webkit}=require('@playwright/test');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const [labelFile,freezeFile,sourceFile,screenDir,out]=process.argv.slice(2);
 if(!out||fs.existsSync(out))throw Error('Supply frozen labels, freeze, original, screening directory and NEW output');
 const frozen=JSON.parse(fs.readFileSync(freezeFile)),labels=JSON.parse(fs.readFileSync(labelFile));
 if(hash(fs.readFileSync(labelFile))!==frozen.inputs[labelFile]||hash(fs.readFileSync(sourceFile))!==frozen.sourceSHA256)throw Error('Frozen input mismatch');
 const original=fs.readFileSync('src/retouch/lashEnhancement.mjs','utf8');
 if(original.split('function buildBandMask(').length!==2)throw Error('Mask helper identity changed');
 const instrumented=original.replace('function buildBandMask(','export function buildBandMask(');
 fs.mkdirSync(out,{recursive:true});
 const dependencies=Object.fromEntries(['src/retouch/lashEnhancement.mjs','src/rendering/canvasFilters.js','src/retouch/eyeGeometry.mjs','src/vision/faceGeometry.mjs','tests/visual/lash-endpoint-profile.mjs','tests/visual/lash-spatial-match.mjs'].map(f=>[f,hash(fs.readFileSync(f))]));
 const protocol={dependencies,runnerSHA256:hash(fs.readFileSync(__filename)),date:'2026-11-14',kind:'actual-mask-geometric-scope-not-recognition',labelSHA256:hash(fs.readFileSync(labelFile)),sourceSHA256:frozen.sourceSHA256,rendererSHA256:hash(Buffer.from(original)),instrumentedSHA256:hash(Buffer.from(instrumented)),instrumentation:'export keyword only; helper body identical',recovery:'maximum geometrically possible envelope, not evidence that recovery activates',maxSide:224,photoAnalysisExecuted:false};
 fs.writeFileSync(path.join(out,'protocol.json'),JSON.stringify(protocol,null,2)+'\n',{flag:'wx'});
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});
 try{
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),15000);server.once('error',reject);server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});});
 for(const engine of [chromium,webkit]){
 const screenFile=path.join(screenDir.replace('{engine}',engine.name()),'screening.json'),screen=JSON.parse(fs.readFileSync(screenFile));
 const r=screen.results.find(r=>r.file===labels.file);if(!r||r.sha256!==frozen.sourceSHA256)throw Error('Source geometry identity differs');
 if(r.status!=='ready'){
 fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify({engine:engine.name(),status:r.status,reason:'No actual FaceMesh; no geometry substitution',screenSHA256:hash(fs.readFileSync(screenFile))},null,2)+'\n',{flag:'wx'});console.log(engine.name(),r.status);continue;}
 const b=await engine.launch();try{
 const page=await b.newPage();await page.route('https://**/*',r=>r.abort());await page.route('**/__mask_scope__',r=>r.fulfill({body:'<!doctype html>',contentType:'text/html'}));
 await page.route('**/src/retouch/__mask_scope__.mjs',r=>r.fulfill({body:instrumented,contentType:'application/javascript'}));await page.goto(url+'/__mask_scope__');
 const results=await page.evaluate(async({geometry,labels})=>{
 const {buildBandMask}=await import('/src/retouch/__mask_scope__.mjs');
 const {lashRoiSize}=await import('/src/retouch/eyeGeometry.mjs');
 const {sampleBilinear}=await import('/tests/visual/lash-endpoint-profile.mjs');
 const {insideRegion}=await import('/tests/visual/lash-spatial-match.mjs');
 const output=[];
 for(const side of labels.evaluatedEyes??['left','right']){
 const desc=geometry.eyes[side],size=lashRoiSize(desc.roi,geometry.width,geometry.height,{maxSide:224});
 const toAnalysis=p=>({x:(p.x-desc.roi.x0)/(desc.roi.x1-desc.roi.x0)*size.w,y:(p.y-desc.roi.y0)/(desc.roi.y1-desc.roi.y0)*size.h});
 const la=desc.upperLid.map(toAnalysis),lo=desc.lowerLid.map(toAnalysis),mid=la[Math.floor(la.length/2)],low=lo[Math.floor(lo.length/2)];
 const bandH=Math.max(3,Math.min(size.h*.45,Math.hypot(mid.x-low.x,mid.y-low.y)*.65));
 const recoveryMax=Math.min(size.h*.45,bandH+4);
 for(const target of ['preview720long','native']){
 const factor=target==='native'?1:Math.min(1,720/Math.max(geometry.width,geometry.height)),W=Math.round(geometry.width*factor),H=Math.round(geometry.height*factor),scale=Math.min(W,H)/720;
 const rx0=Math.max(0,Math.round(desc.roi.x0*W)),ry0=Math.max(0,Math.round(desc.roi.y0*H)),rw=Math.min(W,Math.round(desc.roi.x1*W))-rx0,rh=Math.min(H,Math.round(desc.roi.y1*H))-ry0;
 const toOut=p=>({x:(p.x-desc.roi.x0)/(desc.roi.x1-desc.roi.x0)*rw,y:(p.y-desc.roi.y0)/(desc.roi.y1-desc.roi.y0)*rh});
 const lid=desc.upperLid.map(toOut),lower=desc.lowerLid.map(toOut),brow=(desc.browPoints||[]).map(toOut),inner=toOut(desc.inner);
 const maxLen=Math.min(3*rw/size.w,desc.h*H*.12),baseHeight=bandH/size.h*rh;
 for(const [group,height]of [['baselineLength',baseHeight+maxLen],['maximumRecoveryLength',Math.max(baseHeight,recoveryMax/size.h*rh)+maxLen]]){
 const c=document.createElement('canvas');c.width=rw;c.height=rh;const ctx=c.getContext('2d');
 if(!buildBandMask(ctx,rw,rh,lid,height,brow,inner,lower,scale))throw Error('Mask failed');
 const rgba=ctx.getImageData(0,0,rw,rh).data,alpha=Float32Array.from({length:rw*rh},(_,i)=>rgba[i*4+3]);
 const at=p=>{if(p.x<0||p.y<0||p.x>rw-1||p.y>rh-1)return 0;return sampleBilinear(alpha,rw,rh,p.x,p.y);};
 const sourceToMask=p=>({x:(p.x+.5)/geometry.width*W-rx0-.5,y:(p.y+.5)/geometry.height*H-ry0-.5});
 const tips=labels.eyes[side].tips.map(t=>{
 const cx=t.region.reduce((s,p)=>s+p[0],0)/t.region.length,cy=t.region.reduce((s,p)=>s+p[1],0)/t.region.length;
 const xs=t.region.map(p=>p[0]),ys=t.region.map(p=>p[1]),values=[];
 for(let y=Math.ceil(Math.min(...ys));y<=Math.floor(Math.max(...ys));y++)for(let x=Math.ceil(Math.min(...xs));x<=Math.floor(Math.max(...xs));x++)if(insideRegion({x,y},t.region))values.push(at(sourceToMask({x,y})));
 return{id:t.id,centerAlpha:at(sourceToMask({x:cx,y:cy})),sourcePixelSamples:values.length,minAlpha:Math.min(...values),maxAlpha:Math.max(...values),positiveSamples:values.filter(v=>v>0).length,fullSamples:values.filter(v=>v>=255-1e-6).length};
 });
 const lowerProbe=toOut(desc.lowerLid[Math.floor(desc.lowerLid.length/2)]),probes={lowerLidAlpha:at(lowerProbe),innerAlpha:at(inner),browAlphas:brow.map(at)};
 if(probes.lowerLidAlpha!==0||probes.innerAlpha!==0||probes.browAlphas.some(v=>v!==0))throw Error('Protected-probe leakage');
 output.push({side,target,W,H,roi:{rx0,ry0,rw,rh},group,height,maxLen,analysisSize:size,bandH,recoveryMax,tips,probes,png:c.toDataURL()});c.width=c.height=0;
 }
 }
 }
 return output;
 },{geometry:r,labels});
 for(const record of results){const file=engine.name()+'-'+record.side+'-'+record.target+'-'+record.group+'.png';fs.writeFileSync(path.join(out,file),Buffer.from(record.png.split(',')[1],'base64'),{flag:'wx'});delete record.png;record.maskFile=file;}
 fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify({engine:engine.name(),status:'ready',screenSHA256:hash(fs.readFileSync(screenFile)),results},null,2)+'\n',{flag:'wx'});
 console.log(engine.name(),JSON.stringify(results.map(r=>({target:r.target,group:r.group,tips:r.tips}))));
 }finally{await b.close();}
 }
 for(const [f,digest]of Object.entries(dependencies))if(hash(fs.readFileSync(f))!==digest)throw Error('Dependency changed '+f);
 if(hash(Buffer.from(fs.readFileSync('src/retouch/lashEnhancement.mjs','utf8')))!==protocol.rendererSHA256)throw Error('Renderer changed');
 }finally{server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
