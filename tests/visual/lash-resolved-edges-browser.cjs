'use strict';
// Same serialized measurements in Node/Chromium/WebKit. No labels or tracing.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{spawn}=require('node:child_process');
const {chromium,webkit}=require('@playwright/test');
const hash=b=>createHash('sha256').update(b).digest('hex');
async function main(){
 const [out,...files]=process.argv.slice(2);
 if(!out||fs.existsSync(out))throw Error('Supply NEW output directory and optional saved ending JSON files');
 const {inspectResolvedTaper}=await import('./lash-resolved-edges.mjs');
 const profile=(sigma,amplitude=.4,shift=0)=>Array.from({length:25},(_,i)=>{const offset=-3+i*.25;return{offset,value:.8-amplitude*Math.exp(-(((offset-shift)/sigma)**2))};});
 const rows=f=>Array.from({length:5},(_,i)=>({ahead:-2+i*.5,samples:f(i)}));
 const fork=()=>profile(.2).map(s=>({...s,value:.8-.4*Math.exp(-(((s.offset-1)/.2)**2))-.4*Math.exp(-(((s.offset+1)/.2)**2))}));
 const cases=[
  {id:'resolved-taper',positive:true,rows:rows(i=>profile(.9-i*.15))},
  {id:'constant-width',rows:rows(()=>profile(.8))},
  {id:'amplitude-fade',rows:rows(i=>profile(.8,.4-i*.09))},
  {id:'weak-fade',rows:rows(i=>profile(.8,.4-i*.09975))},
  {id:'translated-shaft',rows:rows(i=>profile(.8,.4,.2*i))},
  {id:'parallel-bands',rows:rows(fork)},
  {id:'one-sided-step',rows:rows(()=>profile(.8).map(s=>({...s,value:s.offset<0?.3:.8})))},
  {id:'weak-noise',rows:rows(()=>profile(.8).map(s=>({...s,value:.8+.001*Math.sin(s.offset*7)})))},
  {id:'intervening-gap',rows:rows(i=>profile(.9-i*.15,i===2?.001:.4))},
  {id:'fork-after-taper',rows:[...rows(i=>profile(.9-i*.15)),{ahead:1,samples:fork()}]},
  {id:'missing-sample',rows:rows(()=>profile(.8).map((s,i)=>i===5?{offset:s.offset,unavailable:true}:s))}
 ];
 const inputs=[];
 for(const file of files){
  const bytes=fs.readFileSync(file),saved=JSON.parse(bytes);inputs.push({path:file,sha256:hash(bytes),engine:saved.engine});
  for(const [side,records]of Object.entries(saved.results))for(const r of records)for(const p of r.profiles||[])cases.push({id:file+':'+side+':'+r.rank+':'+p.radius,rows:p.rows});
 }
 // Build all data before browser execution. Transcendental generation differences
 // cannot contaminate the comparison: each engine receives identical numbers.
 const payload=JSON.parse(JSON.stringify(cases)),expected=payload.map(c=>({id:c.id,...inspectResolvedTaper(c.rows)}));
 for(let i=0;i<11;i++)assert.equal(expected[i].status==='resolved-taper-evidence',!!payload[i].positive,payload[i].id);
 fs.mkdirSync(out,{recursive:true});
 const modules=['tests/visual/lash-resolved-edges.mjs','tests/visual/lash-resolved-edges-protocol.json'];
 const protocol={kind:'identical-input-runtime-parity-not-photo-decoder-parity',inputs,caseCount:payload.length,annotationsUsed:false,comparison:'exact JSON numeric equality; two repetitions per engine; all inputs serialized before browser launch',moduleSHA256:Object.fromEntries(modules.map(f=>[f,hash(fs.readFileSync(f))])),runnerSHA256:hash(fs.readFileSync(__filename))};
 fs.writeFileSync(path.join(out,'protocol.json'),JSON.stringify(protocol,null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(path.join(out,'inputs.json'),JSON.stringify(payload)+'\n',{flag:'wx'});
 fs.writeFileSync(path.join(out,'node.json'),JSON.stringify(expected)+'\n',{flag:'wx'});
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});
 try{
  const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),15000);server.once('error',e=>{clearTimeout(timer);reject(e);});server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});});
  for(const engine of [chromium,webkit]){
   const browser=await engine.launch();try{
    const page=await browser.newPage();await page.route('https://**/*',r=>r.abort());await page.route('**/__edges_parity__',r=>r.fulfill({body:'<!doctype html>',contentType:'text/html'}));await page.goto(url+'/__edges_parity__');
    const runs=[];for(let i=0;i<2;i++)runs.push(await page.evaluate(async cases=>{const {inspectResolvedTaper}=await import('/tests/visual/lash-resolved-edges.mjs');return cases.map(c=>({id:c.id,...inspectResolvedTaper(c.rows)}));},payload));
    fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify(runs)+'\n',{flag:'wx'});
    assert.deepEqual(runs[0],runs[1]);assert.deepEqual(runs[0],expected);
    console.log(engine.name(),payload.length,'cases: exact Node parity and deterministic repeat PASS');
   }finally{await browser.close();}
  }
  for(const [file,digest]of Object.entries(protocol.moduleSHA256))assert.equal(hash(fs.readFileSync(file)),digest);
 }finally{server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
