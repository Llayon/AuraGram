'use strict';
const fs=require('fs'),{spawn}=require('child_process'),{chromium,webkit}=require('@playwright/test');
async function main(){
 const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Supply NEW output JSON');
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});const results=[];
 try{
 const url=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server timeout')),15000);server.once('error',reject);server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(t);resolve(m[0]);}});});
 for(const engine of [chromium,webkit]){const b=await engine.launch();try{const p=await b.newPage();await p.route('https://**/*',r=>r.abort());await p.route('**/__native_mechanism__',r=>r.fulfill({body:'<!doctype html>',contentType:'text/html'}));await p.goto(url+'/__native_mechanism__');
 const result=await p.evaluate(async()=>{
 const {auditSpatialEnding}=await import('/tests/visual/lash-spatial-ending.mjs');
 const {auditNativeSeeds,createNativePatchReader}=await import('/tests/visual/lash-native-path.mjs');
 const c=document.createElement('canvas');c.width=c.height=96;const cx=c.getContext('2d'),rgba=cx.createImageData(96,96);
 for(let y=0;y<96;y++)for(let x=0;x<96;x++){const i=(y*96+x)*4,v=Math.round(255*(.8-.5*Math.exp(-((x-48)**2)/.35)));rgba.data.set([v,v,v,255],i);}cx.putImageData(rgba,0,0);
 const reader=createNativePatchReader(c);try{
 const a=auditNativeSeeds({...reader,seeds:[{rank:0,index:4848,x:48,y:50,tangent:{x:0,y:-1},provenance:'automatic-strong-ridge-before-tip-filter'}],roi:{x:0,y:0,w:96,h:96},lid:[{x:8,y:70},{x:88,y:70}],lower:[{x:8,y:84},{x:88,y:84}]});
 const r=a.results[0];if(!r.proximalConnection||r.status!=='censored'||r.endpointConfirmed)throw Error('Native mechanism invariant');
 const luma=Float32Array.from({length:96*96},(_,i)=>{const x=i%96-48,y=48-Math.floor(i/96);return .8-.5*Math.exp(-(x*x+Math.max(0,y)**2)/.35);});
 const cap=auditSpatialEnding(luma,96,96,[{x:48,y:52},{x:48,y:50},{x:48,y:48}],{x:0,y:-1},{proximalConnection:true});
 if(cap.endpointConfirmed||!cap.profiles.every(p=>p.sideClosure.status==='closure-candidate'))throw Error('Unsafe closure promotion or missing cap');
 return{capClosures:cap.profiles.map(p=>p.sideClosure),capStatus:cap.status,status:r.status,proximalConnection:r.proximalConnection,path:r.path,tangent:r.tangent,reasons:r.reasons,workingBufferBytes:a.workingBufferBytes};
 }finally{reader.dispose();c.width=c.height=0;}
 });results.push({engine:engine.name(),result});
 }finally{await b.close();}}
 if(JSON.stringify(results[0].result)!==JSON.stringify(results[1].result))throw Error('Engine result mismatch');
 fs.writeFileSync(output,JSON.stringify({kind:'synthetic-native-mechanism-not-recognition',engineAgreement:true,results},null,2)+'\n',{flag:'wx'});console.log('Chromium/WebKit native mechanism PASS');
 }finally{server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
