'use strict';
// Independent endpoint measurements on saved paths. No labels enter browser.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process'),{chromium,webkit}=require('@playwright/test');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const [inputDir,sourceFile,out]=process.argv.slice(2);if(!out||fs.existsSync(out))throw Error('Supply saved run, original and NEW output');
 const source=fs.readFileSync(sourceFile),oldProtocol=JSON.parse(fs.readFileSync(path.join(inputDir,'protocol.json')));
 if(hash(source)!==oldProtocol.sourceSHA256)throw Error('Source changed');
 const modules=['tests/visual/lash-native-path.mjs','tests/visual/lash-native-cell.mjs','tests/visual/lash-subpixel-probe.mjs','tests/visual/lash-subpixel-center.mjs','tests/visual/lash-native-shaft.mjs','tests/visual/lash-spatial-ending.mjs','tests/visual/lash-side-closure.mjs','tests/visual/lash-endpoint-profile.mjs','src/retouch/lashAnalysis.mjs','src/retouch/eyeGeometry.mjs','src/vision/faceGeometry.mjs'];
 const moduleSHA256=Object.fromEntries(modules.map(f=>[f,hash(fs.readFileSync(f))]));
 for(const f of modules)if(oldProtocol.moduleSHA256[f]&&oldProtocol.moduleSHA256[f]!==moduleSHA256[f])throw Error('Old path dependency changed '+f);
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'protocol.json'),JSON.stringify({kind:'saved-path-spatial-ending-audit',inputDir,sourceSHA256:hash(source),moduleSHA256,runnerSHA256:hash(fs.readFileSync(__filename)),annotationInput:false,grantsTerminal:false,window:{along:[-2,4],across:[-3,3],step:.25},wholeROI:'End kernels conservatively require +/-8px of available source ROI',maxLocalArcNative:36},null,2)+'\n',{flag:'wx'});
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});
 try{
 const url=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server timeout')),15000);server.once('error',reject);server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(t);resolve(m[0]);}});});
 for(const engine of [chromium,webkit]){
 const inputFile=path.join(inputDir,engine.name()+'.json'),saved=JSON.parse(fs.readFileSync(inputFile));
 if(hash(fs.readFileSync(saved.geometryPath))!==saved.geometrySHA256)throw Error('Geometry changed');
 const geometry=JSON.parse(fs.readFileSync(saved.geometryPath)).results.find(r=>r.sha256===hash(source));
 if(geometry?.status!=='ready'||geometry.split!=='development')throw Error('No actual development FaceMesh');
 const browser=await engine.launch();try{
 const page=await browser.newPage();await page.route('https://**/*',r=>r.abort());await page.route('**/__ending_audit__',r=>r.fulfill({body:'<!doctype html>',contentType:'text/html'}));await page.goto(url+'/__ending_audit__');
 const results=await page.evaluate(async({data,saved,geometry})=>{
 const {createNativePatchReader}=await import('/tests/visual/lash-native-path.mjs');const {auditSpatialEnding}=await import('/tests/visual/lash-spatial-ending.mjs');
 const image=new Image();image.src=data;await image.decode();const reader=createNativePatchReader(image),buffer=new Float32Array(256*256),results={};
 try{for(const side of ['left','right']){
 const input=saved.run[side],eye=geometry.eyes[side],roi={x:eye.roi.x0*geometry.width,y:eye.roi.y0*geometry.height,w:input.size.rawW,h:input.size.rawH};
 results[side]=input.results.map(r=>{
 const base={rank:r.rank,index:r.index,originalStatus:r.status,coarseConnected:r.coarse.connected,broadRoot:r.coarse.broadSupport,correspondence:r.correspondence.status,proximalConnection:r.proximalConnection,endpointConfirmed:false};
 if(!r.local)return{...base,status:'not-inspected',reasons:[r.reasons.includes('seed-budget')?'original-seed-budget':'no-native-local-record']};
 const curve=r.local,last=curve.points.at(-1),fit=curve.attempts.filter(a=>a.linkAccepted).at(-1)?.directionFit??curve.bootstrapFit;
 if(!last||!fit?.available)return{...base,status:'ambiguous',reasons:['no-observed-native-path-or-tangent'],localStop:curve.reason};
 const budget=['arc-budget','step-budget'].includes(curve.reason),outside=[-8,8].some(dx=>[-8,8].some(dy=>last.x+dx<roi.x||last.y+dy<roi.y||last.x+dx>roi.x+roi.w-1||last.y+dy>roi.y+roi.h-1));
 const rect=r.patch,luma=buffer.subarray(0,rect.w*rect.h);reader.readPatch(rect,luma);
 const points=curve.points.map(p=>({...p,x:p.x-rect.x,y:p.y-rect.y})),tangent={x:fit.tx,y:fit.ty};
 const ending=auditSpatialEnding(luma,rect.w,rect.h,points,tangent,{proximalConnection:r.proximalConnection,budgetExhausted:budget,roiClipped:outside||curve.reason==='local-roi-boundary'});
 if(ending.endpointConfirmed||ending.status==='terminal')throw Error('Unexpected terminal authorization');
 return{...base,...ending,patch:rect,coordinateSpace:'patch-local-source-pixels',localStop:curve.reason,lastSourcePoint:last,measuredTangent:tangent,localAcceptedArc:last.arc};
 });
 }}finally{reader.dispose();}return results;
 },{data:'data:image/jpeg;base64,'+source.toString('base64'),saved,geometry});
 const stats={};for(const [side,records]of Object.entries(results)){const statuses={},reasons={},closure={};for(const r of records){statuses[r.status]=(statuses[r.status]||0)+1;for(const reason of r.reasons)reasons[reason]=(reasons[reason]||0)+1;for(const p of r.profiles||[]){const k=p.sideClosure.status;closure[k]=(closure[k]||0)+1;}}stats[side]={records:records.length,statuses,reasons,closureProfileCounts:closure,accepted:records.filter(r=>r.endpointConfirmed).length};}
 fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify({engine:engine.name(),inputSHA256:hash(fs.readFileSync(inputFile)),stats,results},null,2)+'\n',{flag:'wx'});console.log(engine.name(),JSON.stringify(stats));
 }finally{await browser.close();}
 }
 for(const [f,digest]of Object.entries(moduleSHA256))if(hash(fs.readFileSync(f))!==digest)throw Error('Module changed during run');
 }finally{server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
