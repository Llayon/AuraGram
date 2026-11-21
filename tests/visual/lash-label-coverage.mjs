// Labels enter this post-hoc tool only, never source measurement or tracing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {insideRegion} from './lash-spatial-match.mjs';
import {polygonsOverlap,endingWindow} from './lash-label-window.mjs';
import {inspectResolvedTaper} from './lash-resolved-edges.mjs';
const [nativeDir,endingDir,labelFile,freezeFile,out,evidenceManifest='tests/visual/spatial-ending-evidence/manifest.json']=process.argv.slice(2);
if(!out||fs.existsSync(out))throw Error('Supply saved native/ending directories, frozen labels, freeze and NEW output');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const frozen=JSON.parse(fs.readFileSync(freezeFile)),labels=JSON.parse(fs.readFileSync(labelFile));
const manifestBytes=fs.readFileSync(evidenceManifest),manifest=JSON.parse(manifestBytes);
const verifyArchived=file=>{
 const relative=path.relative(path.resolve('tests/visual/out'),path.resolve(file)).split(path.sep).join('/');
 const row=manifest.members.find(r=>(r.archivePath??r.path)===relative);
 if(!row||hash(fs.readFileSync(file))!==row.sha256)throw Error('Saved file differs from archived evidence: '+relative);
};
if(hash(fs.readFileSync(labelFile))!==frozen.inputs[labelFile])throw Error('Frozen labels changed');
const protocol=JSON.parse(fs.readFileSync(path.join(endingDir,'protocol.json')));
if(protocol.sourceSHA256!==frozen.sourceSHA256||path.resolve(protocol.inputDir)!==path.resolve(nativeDir))throw Error('Input/source mismatch');
const result={kind:'posthoc-coverage-not-recognition',annotationSHA256:hash(fs.readFileSync(labelFile)),archiveManifestSHA256:hash(manifestBytes),labelsInputToDetection:false,engines:{}};
for(const engine of ['chromium','webkit']){
 const nativeFile=path.join(nativeDir,engine+'.json'),endingFile=path.join(endingDir,engine+'.json');
 verifyArchived(nativeFile);verifyArchived(endingFile);
 const native=JSON.parse(fs.readFileSync(nativeFile)),ending=JSON.parse(fs.readFileSync(endingFile));
 if(hash(fs.readFileSync(nativeFile))!==ending.inputSHA256||native.sourceSHA256!==frozen.sourceSHA256)throw Error('Saved native changed');
 const sides={};
 for(const side of ['left','right']){
  const nativeRows=native.run[side].results||[],ends=ending.results[side]||[];
  sides[side]=labels.eyes[side].tips.map(label=>{
   const touches=points=>points?.some(p=>insideRegion(p,label.region));
   const coarse=nativeRows.filter(r=>touches(r.coarseDistal?.points)),local=nativeRows.filter(r=>touches(r.local?.points));
   const startReasons={};for(const r of coarse.filter(r=>r.rank<128)){const reason=r.local?.reason??r.reason;startReasons[reason]=(startReasons[reason]||0)+1;}
   const windows=ends.filter(r=>{const window=endingWindow(r.lastSourcePoint,r.measuredTangent);return window&&polygonsOverlap(window,label.region);});
   const measured=windows.filter(r=>r.profiles?.length===2);
   return{id:label.id,nominalCoarseRouteRanks:coarse.map(r=>r.rank),scheduledCoarseRouteRanks:coarse.filter(r=>r.rank<128).map(r=>r.rank),scheduledRouteLocalReasons:startReasons,nativePathPointRanks:local.map(r=>r.rank),overlappingStopWindows:windows.map(r=>({rank:r.rank,status:r.status,reasons:r.reasons,measured:!!r.profiles?.length})),measuredWindowCount:measured.length,uncensoredWindowCount:measured.filter(r=>r.status!=='censored').length,taperEvidenceRanks:measured.filter(r=>inspectResolvedTaper(r.profiles[0].rows).status==='resolved-taper-evidence').map(r=>r.rank)};
  });
 }
 result.engines[engine]={nativeSHA256:hash(fs.readFileSync(nativeFile)),endingSHA256:hash(fs.readFileSync(endingFile)),sides};
 console.log(engine,JSON.stringify(sides));
}
result.limitations='Nominal coarse-cell centers are not native paths. Path-point hits and polygon/window overlaps are coverage only, not ownership, endpoint or recall. Labels are provisional and non-exhaustive.';
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
