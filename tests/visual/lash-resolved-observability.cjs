'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const hash=b=>createHash('sha256').update(b).digest('hex');
(async()=>{
 const out=process.argv[2];if(!out||fs.existsSync(out))throw Error('Supply NEW output directory');
 const protocolFile='tests/visual/lash-resolved-observability-protocol.json',protocol=JSON.parse(fs.readFileSync(protocolFile));
 const {sampledProfileGrid}=await import('./lash-resolved-observability.mjs'),{inspectResolvedTaper}=await import('./lash-resolved-edges.mjs');
 const files=[protocolFile,'tests/visual/lash-resolved-observability.mjs','tests/visual/lash-resolved-edges.mjs','tests/visual/lash-endpoint-profile.mjs'];
 const hashes=Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(f))]));
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'protocol.json'),JSON.stringify({moduleSHA256:hashes,runnerSHA256:hash(fs.readFileSync(__filename)),parameters:protocol},null,2)+'\n',{flag:'wx'});
 const results=[],inputs=[];
 for(const width of protocol.widths)for(const amplitude of protocol.amplitudes)for(const blurSigma of protocol.blurSigma)for(const noiseAmplitude of protocol.noiseAmplitude)for(const phaseX of protocol.phaseX)for(const kind of protocol.kinds){
  const parameters={kind,width,amplitude,blurSigma,noiseAmplitude,phaseX},grid=sampledProfileGrid(parameters),result=inspectResolvedTaper(grid.rows),id=results.length;
  results.push({id,parameters,...result});inputs.push({id,parameters,...grid});
 }
 const summary={total:results.length,groups:{},stopConditionTriggered:false};
 for(const kind of protocol.kinds){const rows=results.filter(r=>r.parameters.kind===kind),reasons={};for(const r of rows)reasons[r.reason]=(reasons[r.reason]||0)+1;summary.groups[kind]={total:rows.length,taperEvidence:rows.filter(r=>r.status==='resolved-taper-evidence').length,reasons};}
 summary.stopConditionTriggered=summary.groups.taper.taperEvidence===0||summary.groups.fade.taperEvidence>0||summary.groups.continuing.taperEvidence>0;
 fs.writeFileSync(path.join(out,'inputs.json'),JSON.stringify(inputs)+'\n',{flag:'wx'});
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({summary,results},null,2)+'\n',{flag:'wx'});
 for(const [f,digest]of Object.entries(hashes))if(hash(fs.readFileSync(f))!==digest)throw Error('Changed mechanism dependency');
 console.log(JSON.stringify(summary,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
