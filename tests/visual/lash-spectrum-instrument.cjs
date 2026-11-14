'use strict';
const path=require('path'),{pathToFileURL}=require('url'),{hash}=require('./lash-domain-inputs.cjs');
function once(s,a,b){if(s.split(a).length!==2)throw Error('Spectrum anchor drift: '+a);return s.replace(a,b);}
async function capture(source,version){
 let code=once(source,'parent.fill(-1);','parent.fill(-1);const capturedSpectra=new Float64Array(n*8).fill(NaN),capturedBest=new Uint8Array(n).fill(255);let capturedRawActive=null;');
 code=once(code,'const strength=values[best],shape=','for(let k=0;k<8;k++)capturedSpectra[i*8+k]=values[k]===null?NaN:values[k];capturedBest[i]=best;const strength=values[best],shape=');
 code=version==='V3'?once(code,'const thinned=new Uint8Array(n);','capturedRawActive=active.slice();const thinned=new Uint8Array(n);'):once(code,'const adjacent=i=>','capturedRawActive=active.slice();const adjacent=i=>');
 code=once(code,"return{reason:'offline-observations-only',","return{debug:{dx,dy,depth,anisotropy,spectra:capturedSpectra,bestIndex:capturedBest,preThinActive:capturedRawActive,edge,rawEdge:"+(version==='V3'?'rawEdge':'edge')+"},reason:'offline-observations-only',");
 code=code.replace("'../../src/retouch/lashAnalysis.mjs'",JSON.stringify(pathToFileURL(path.resolve('src/retouch/lashAnalysis.mjs')).href)).replace("'./lash-domain.mjs'",JSON.stringify(pathToFileURL(path.resolve('tests/visual/lash-domain.mjs')).href));
 const module=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));return{module,sourceSHA256:hash(Buffer.from(source)),linkedSHA256:hash(Buffer.from(code))};
}
module.exports={capture};
