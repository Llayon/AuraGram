'use strict';
// Offline qualification only: no detector, renderer, image decoder or network.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {verifyCohortArtifacts}=require('./lash-spatial-cohort-gate.cjs');
const hash=b=>createHash('sha256').update(b).digest('hex');
function qualifyFiles(sourceManifest,annotationManifest,sourceDirectory){
 const sourceBytes=fs.readFileSync(sourceManifest),sources=JSON.parse(sourceBytes).sources;
 if(!Array.isArray(sources))throw Error('Source manifest requires sources array');
 const manifestBytes=annotationManifest==='-'?null:fs.readFileSync(annotationManifest);
 const manifest=manifestBytes?JSON.parse(manifestBytes):{annotations:[],artifacts:[]};
 if(!Array.isArray(manifest.annotations)||!Array.isArray(manifest.artifacts))throw Error('Annotation manifest requires annotations and artifacts arrays');
 const artifacts=new Map(),readErrors=[],byteChecks=[];
 for(const s of sources){
  // Source names are flat filenames, as in the existing acquisition manifests.
  if(typeof s.file!=='string'||s.file!==path.basename(s.file)||/[\\/]/.test(s.file)||['.','..'].includes(s.file))throw Error('Invalid source filename');
  const artifact={};
  try{artifact.sourceBytes=fs.readFileSync(path.join(sourceDirectory,s.file));}catch(e){readErrors.push({file:s.file,kind:'source',code:e.code});}
  const entries=manifest.artifacts.filter(a=>a.file===s.file);
  if(entries.length>1)readErrors.push({file:s.file,kind:'annotation',code:'DUPLICATE_ARTIFACT'});
  if(entries.length===1){
   const p=entries[0].path;
   if(typeof p!=='string'||!p)throw Error('Annotation artifact requires path');
   try{artifact.annotationBytes=fs.readFileSync(path.resolve(path.dirname(annotationManifest),p));}catch(e){readErrors.push({file:s.file,kind:'annotation',code:e.code});}
  }
  artifacts.set(s.file,artifact);
  byteChecks.push({file:s.file,sourceDigestMatches:!!artifact.sourceBytes&&hash(artifact.sourceBytes)===s.sha256});
 }
 const result=verifyCohortArtifacts(sources,manifest.annotations,artifacts);
 return{stage:'offline-cohort-qualification',detectorExecuted:false,
  sourceManifestSHA256:hash(sourceBytes),annotationManifestSHA256:manifestBytes?hash(manifestBytes):null,
  ...result,eligible:result.eligible&&readErrors.length===0,readErrors,byteChecks,
  limitations:'Byte integrity and metadata only; licensing, annotation quality, independent review and chronology require separate evidence.'};
}
if(require.main===module){
 try{
  const [sourceManifest,annotationManifest,sourceDirectory,output]=process.argv.slice(2);
  if(!output)throw Error('Usage: node lash-spatial-qualify.cjs source-summary.json annotation-manifest.json|- source-directory NEW-output.json');
  const result=qualifyFiles(sourceManifest,annotationManifest,sourceDirectory);
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({eligible:result.eligible,integrityVerified:result.integrityVerified,errors:result.errors.length,metadataErrors:result.metadataErrors.length,readErrors:result.readErrors.length}));
  process.exitCode=result.eligible?0:2;
 }catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={qualifyFiles};
