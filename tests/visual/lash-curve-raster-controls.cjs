'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const target=process.argv[2];if(!target||fs.existsSync(target))throw Error('Supply NEW result file');
 const cb=fs.readFileSync(path.join(__dirname,'lash-curve-raster-controls.json')),pb=fs.readFileSync(path.join(__dirname,'lash-curve-protocol.json')),c=JSON.parse(cb),p=JSON.parse(pb),{followCurve}=await import('./lash-curve-probe.mjs'),results=[];
 for(const shape of c.shapes)for(const sigma of c.sigmasNative)for(const phase of c.phasesNative)for(const mode of c.samplingModes){
  const center=y=>c.baseX+phase+shape.k*(c.seedY-y)**2;
  const sample=(x,y)=>c.background-c.amplitude*Math.exp(-((x-center(y))**2)/(2*sigma**2));
  const luma=Float32Array.from({length:c.width*c.height},(_,i)=>{const x=i%c.width,y=Math.floor(i/c.width);if(mode==='point')return sample(x,y);let total=0;for(let j=0;j<8;j++)for(let k=0;k<8;k++)total+=sample(x+(j+.5)/8-.5,y+(k+.5)/8-.5);return total/64;});
  for(const margin of c.marginsNative){const angle=(-90+shape.error)*Math.PI/180,axis={available:true,tx:Math.cos(angle),ty:Math.sin(angle)},seed={x:c.baseX+phase,y:c.seedY},result=followCurve(luma,c.width,c.height,seed,axis,{body:true,association:true},{margin,protocol:p});
   assert.equal(result.endpointConfirmed,false);assert.equal(result.outcome,'UNKNOWN');assert.ok(result.attempts.length<=p.maximumSteps);assert.ok(result.points.at(-1).arc<=12+1e-10);
   results.push({...shape,sigma,phase,mode,margin,maximumHorizontalTruthError:Math.max(...result.points.map(q=>Math.abs(q.x-center(q.y)))),result});
  }
 }
 fs.writeFileSync(target,JSON.stringify({meaning:c.meaning,protocolSHA256:hash(pb),controlsSHA256:hash(cb),helperSHA256:hash(fs.readFileSync(path.join(__dirname,'lash-curve-probe.mjs'))),results},null,2),{flag:'wx'});
 const counts={};for(const r of results){const key=[r.kind,r.error,r.k,r.mode].join('/');counts[key]??={};counts[key][r.result.reason]=(counts[key][r.result.reason]??0)+1;}console.log(JSON.stringify({total:results.length,counts},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
