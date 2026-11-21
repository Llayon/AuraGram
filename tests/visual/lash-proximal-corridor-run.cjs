'use strict';
// Independent diagnostic over saved automatic paths. No annotations enter it.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process'),{chromium,webkit}=require('@playwright/test');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const [inputDir,sourceFile,out]=process.argv.slice(2);if(!out||fs.existsSync(out))throw Error('Supply saved run, original and NEW output');
 const source=fs.readFileSync(sourceFile),oldProtocol=JSON.parse(fs.readFileSync(path.join(inputDir,'protocol.json')));
 if(hash(source)!==oldProtocol.sourceSHA256)throw Error('Source changed');
 const modules=['tests/visual/lash-proximal-corridor.mjs','tests/visual/lash-native-path.mjs','tests/visual/lash-native-cell.mjs','tests/visual/lash-subpixel-probe.mjs','tests/visual/lash-subpixel-center.mjs','tests/visual/lash-native-shaft.mjs','tests/visual/lash-spatial-ending.mjs','tests/visual/lash-side-closure.mjs','tests/visual/lash-endpoint-profile.mjs','src/retouch/lashAnalysis.mjs','src/retouch/eyeGeometry.mjs'];
 fs.mkdirSync(out,{recursive:true});
 const moduleSHA256=Object.fromEntries(modules.map(f=>[f,hash(fs.readFileSync(f))]));
 for(const f of modules)if(oldProtocol.moduleSHA256[f]&&oldProtocol.moduleSHA256[f]!==moduleSHA256[f])throw Error('Old path dependency changed '+f);
 fs.writeFileSync(path.join(out,'protocol.json'),JSON.stringify({kind:'saved-path-contrast-corridor-diagnostic',inputDir,sourceSHA256:hash(source),moduleSHA256,runnerSHA256:hash(fs.readFileSync(__filename)),maxSharedArcNative:36,stepNative:.25,halfWidthNative:3,contrastFloor:.006,annotationInput:false,grantsAssociation:false},null,2)+'\n',{flag:'wx'});
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});
 try{
 const url=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server timeout')),15000);server.once('error',reject);server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(t);resolve(m[0]);}});});
 for(const engine of [chromium,webkit]){
 const file=path.join(inputDir,engine.name()+'.json'),saved=JSON.parse(fs.readFileSync(file));
 if(hash(fs.readFileSync(saved.geometryPath))!==saved.geometrySHA256)throw Error('Geometry changed');
 const geometry=JSON.parse(fs.readFileSync(saved.geometryPath)).results.find(r=>r.sha256===hash(source));
 if(geometry?.status!=='ready'||geometry.split!=='development')throw Error('Missing actual development FaceMesh');
 const browser=await engine.launch();try{
 const page=await browser.newPage();await page.route('https://**/*',r=>r.abort());await page.route('**/__corridor__',r=>r.fulfill({body:'<!doctype html>',contentType:'text/html'}));await page.goto(url+'/__corridor__');
 const results=await page.evaluate(async({data,saved,geometry})=>{
 const {createNativePatchReader}=await import('/tests/visual/lash-native-path.mjs');const {inspectProximalCorridor}=await import('/tests/visual/lash-proximal-corridor.mjs');
 const image=new Image();image.src=data;await image.decode();const reader=createNativePatchReader(image),buffer=new Float32Array(256*256),results={};
 try{for(const side of ['left','right']){
 const input=saved.run[side],eye=geometry.eyes[side],records=[];
 for(const r of input.results){
 const last=r.proximal?.points.at(-1),fit=r.proximal?.attempts.filter(a=>a.linkAccepted).at(-1)?.directionFit??r.proximal?.bootstrapFit;
 const identity={rank:r.rank,index:r.index,originalStatus:r.status,originalProximalConnection:r.proximalConnection};
 if(!last||!fit?.available){records.push({...identity,status:'not-inspected',reason:r.reasons.includes('seed-budget')?'original-seed-budget':'no-observed-proximal-axis'});continue;}
 const budget=Math.max(0,36-(last.arc||0)-(r.distal?.points.at(-1)?.arc||0));
 if(budget<=1e-8){records.push({...identity,status:'censored',reason:'shared-arc-budget',budget});continue;}
 const rect=r.patch,luma=buffer.subarray(0,rect.w*rect.h);reader.readPatch(rect,luma);
 const local=p=>({x:p.x*geometry.width-.5-rect.x,y:p.y*geometry.height-.5-rect.y});
 const a=inspectProximalCorridor(luma,rect.w,rect.h,{start:{x:last.x-rect.x,y:last.y-rect.y},tangent:{x:fit.tx,y:fit.ty},lid:eye.upperLid.map(local),lower:eye.lowerLid.map(local),roi:{x:eye.roi.x0*geometry.width-rect.x,y:eye.roi.y0*geometry.height-rect.y,w:input.size.rawW,h:input.size.rawH},budget});
 records.push({...identity,budget,patch:rect,coordinateSpace:'patch-local-source-pixels',...a});
 }
 results[side]=records;
 }}finally{reader.dispose();}return results;
 },{data:'data:image/jpeg;base64,'+source.toString('base64'),saved,geometry});
 const stats={};for(const [side,records]of Object.entries(results)){stats[side]={records:records.length,statusCounts:{},reasons:{}};for(const r of records){stats[side].statusCounts[r.status]=(stats[side].statusCounts[r.status]||0)+1;stats[side].reasons[r.reason]=(stats[side].reasons[r.reason]||0)+1;}}
 fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify({engine:engine.name(),inputSHA256:hash(fs.readFileSync(file)),stats,results},null,2)+'\n',{flag:'wx'});console.log(engine.name(),JSON.stringify(stats));
 }finally{await browser.close();}
 }
 for(const [f,digest]of Object.entries(moduleSHA256))if(hash(fs.readFileSync(f))!==digest)throw Error('Module changed during run');
 }finally{server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
