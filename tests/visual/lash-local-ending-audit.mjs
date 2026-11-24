import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {matchRegions,insideRegion,directionAllowed} from './lash-spatial-match.mjs';
const [firstDir,repeatDir,labelFile,freezeFile,out]=process.argv.slice(2);
if(!out||fs.existsSync(out))throw Error('Supply first/repeat endpoint runs, frozen labels, freeze and NEW summary');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),freeze=JSON.parse(fs.readFileSync(freezeFile)),labels=JSON.parse(fs.readFileSync(labelFile));
if(hash(fs.readFileSync(labelFile))!==freeze.inputs[labelFile])throw Error('Labels changed');
const protocol=JSON.parse(fs.readFileSync(path.join(firstDir,'protocol.json')));
if(protocol.sourceSHA256!==freeze.sourceSHA256||JSON.stringify(protocol)!==JSON.stringify(JSON.parse(fs.readFileSync(path.join(repeatDir,'protocol.json')))))throw Error('Source/repeat protocol differs');
const results=[];
for(const engine of ['chromium','webkit']){
 const files=[firstDir,repeatDir].map(dir=>path.join(dir,engine+'.json')),[a,b]=files.map(f=>JSON.parse(fs.readFileSync(f)));
 if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Repeat differs '+engine);
 const inputFile=path.join(protocol.inputDir,engine+'.json');if(hash(fs.readFileSync(inputFile))!==a.inputSHA256)throw Error('Saved input changed');
 for(const [side,records]of Object.entries(a.results)){
 const candidates=records.filter(r=>r.lastSourcePoint).map(r=>({id:String(r.rank),point:r.lastSourcePoint,tangent:r.measuredTangent}));
 const eligible=candidates.filter(c=>records.find(r=>String(r.rank)===c.id).endpointConfirmed);
 const intersections=records.filter(r=>r.lastSourcePoint).map(r=>({rank:r.rank,status:r.status,reasons:r.reasons,coarseConnected:r.coarseConnected,broadRoot:r.broadRoot,correspondence:r.correspondence,sourcePoint:r.lastSourcePoint,tangent:r.measuredTangent,tipRegions:labels.eyes[side].tips.filter(l=>insideRegion(r.lastSourcePoint,l.region)).map(l=>({id:l.id,directionAgrees:directionAllowed(r.measuredTangent,l.directionRange)}))})).filter(r=>r.tipRegions.length);
 results.push({engine,side,deterministic:true,...a.stats[side],locallyConsistentRecords:records.filter(r=>r.correspondence==='consistent-local-evidence').map(r=>({rank:r.rank,status:r.status,reasons:r.reasons,coarseConnected:r.coarseConnected,broadRoot:r.broadRoot})),unacceptedStopMatching:matchRegions(candidates,labels.eyes[side].tips),acceptedMatching:matchRegions(eligible,labels.eyes[side].tips),tipRegionIntersections:intersections,artifacts:files.map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
 console.log(engine,side,'unaccepted stop-label matches',results.at(-1).unacceptedStopMatching.matches.length,'accepted',results.at(-1).acceptedMatching.matches.length);
 }
}
fs.writeFileSync(out,JSON.stringify({date:'2026-11-14',kind:'posthoc-local-ending-diagnostic-not-recognition',labelsInputToDetection:false,annotationSHA256:hash(fs.readFileSync(labelFile)),results,decision:'No closure candidates or approved endings; LENGTH HOLD'},null,2)+'\n',{flag:'wx'});
