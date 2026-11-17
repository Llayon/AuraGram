'use strict';
// Saved development measurements only; never initializes paths or reads labels.
const fs=require('node:fs'),{createHash}=require('node:crypto');
const hash=b=>createHash('sha256').update(b).digest('hex');
(async()=>{
 const [output,...files]=process.argv.slice(2);
 if(!output||!files.length||fs.existsSync(output))throw Error('Supply NEW output.json and saved ending JSON files');
 const {inspectResolvedTaper}=await import('./lash-resolved-edges.mjs');
 const result={kind:'development-profile-replay-not-terminal-detection',operatorSHA256:hash(fs.readFileSync('tests/visual/lash-resolved-edges.mjs')),protocolSHA256:hash(fs.readFileSync('tests/visual/lash-resolved-edges-protocol.json')),runs:[]};
 for(const input of files){
  const bytes=fs.readFileSync(input),saved=JSON.parse(bytes),records=[];
  for(const [side,rows]of Object.entries(saved.results))for(const r of rows)if(r.profiles?.length)records.push({side,rank:r.rank,originalStatus:r.status,profiles:r.profiles.map(p=>({radius:p.radius,...inspectResolvedTaper(p.rows)}))});
  const reasons={};for(const r of records)for(const p of r.profiles)reasons[p.reason]=(reasons[p.reason]||0)+1;
  result.runs.push({input,sha256:hash(bytes),engine:saved.engine,records,reasons});console.log(input,records.length,JSON.stringify(reasons));
 }
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
})().catch(e=>{console.error(e);process.exitCode=1;});
