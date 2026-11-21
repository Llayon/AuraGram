'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const target=process.argv[2];if(!target||fs.existsSync(target))throw Error('Supply NEW result file');
 const pb=fs.readFileSync(path.join(__dirname,'lash-curve-protocol.json')),cb=fs.readFileSync(path.join(__dirname,'lash-curve-controls.json')),p=JSON.parse(pb),controls=JSON.parse(cb),{followCurve}=await import('./lash-curve-probe.mjs');
 const jobs=[...controls.straightInitialErrorsDegrees.map(error=>({kind:'straight',error,k:0})),...controls.quadraticCurvatures.map(k=>({kind:'quadratic',error:0,k}))],results=[];
 for(const job of jobs)for(const margin of controls.marginsNative){
  const {width:w,height:h,seed}=controls,center=y=>seed.x+job.k*(seed.y-y)**2;
  const luma=Float32Array.from({length:w*h},(_,i)=>controls.background-controls.amplitude*Math.exp(-((i%w-center(Math.floor(i/w)))**2)/(2*controls.sigmaNative**2)));
  const angle=(-90+job.error)*Math.PI/180,axis={available:true,tx:Math.cos(angle),ty:Math.sin(angle)},result=followCurve(luma,w,h,seed,axis,{body:true,association:true},{margin,protocol:p});
  assert.equal(result.endpointConfirmed,false);assert.equal(result.outcome,'UNKNOWN');assert.ok(result.attempts.length<=p.maximumSteps);assert.ok(result.points.at(-1).arc<=p.maximumArcNative+1e-10);
  const errors=result.points.map(point=>Math.abs(point.x-center(point.y)));
  results.push({...job,margin,maximumHorizontalTruthError:Math.max(...errors),result});
 }
 const data={meaning:controls.meaning,protocolSHA256:hash(pb),controlsSHA256:hash(cb),helperSHA256:hash(fs.readFileSync(path.join(__dirname,'lash-curve-probe.mjs'))),results};
 fs.writeFileSync(target,JSON.stringify(data,null,2),{flag:'wx'});
 for(const r of results)console.log(r.kind,r.error,r.k,r.margin,r.result.reason,r.result.points.at(-1).arc,r.maximumHorizontalTruthError);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
