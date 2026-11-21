'use strict';
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),{hash}=require('./lash-domain-inputs.cjs');
function once(source,needle,replacement){if(source.split(needle).length!==2)throw Error('Instrumentation anchor drift: '+needle);return source.replace(needle,replacement);}
async function instrument(source,version){
 let code=once(source,'parent.fill(-1);','parent.fill(-1);const debugBestIndex=new Uint8Array(n).fill(255);let debugRawActive=null,debugRawRoots=null;');
 code=once(code,'const strength=values[best],shape=','debugBestIndex[i]=best;const strength=values[best],shape=');
 code=version==='V3'?once(code,'const thinned=new Uint8Array(n);','debugRawActive=active.slice();debugRawRoots=roots.slice();const thinned=new Uint8Array(n);'):once(code,'const adjacent=i=>','debugRawActive=active.slice();debugRawRoots=roots.slice();const adjacent=i=>');
 code=once(code,"return{reason:'offline-observations-only',","return{debug:{dx,dy,anisotropy,depth,parent,bestIndex:debugBestIndex,preThinActive:debugRawActive,preThinRoots:debugRawRoots,edge,rawEdge:"+(version==='V3'?'rawEdge':'edge')+"},reason:'offline-observations-only',");
 code=code.replace("'../../src/retouch/lashAnalysis.mjs'",JSON.stringify(pathToFileURL(path.resolve('src/retouch/lashAnalysis.mjs')).href)).replace("'./lash-domain.mjs'",JSON.stringify(pathToFileURL(path.resolve('tests/visual/lash-domain.mjs')).href));
 const module=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));return{module,sourceSHA256:hash(Buffer.from(source)),instrumentedSHA256:hash(Buffer.from(code)),transform:'Exact single-anchor read-only captures plus absolute local import linkage'};
}
module.exports={instrument};
