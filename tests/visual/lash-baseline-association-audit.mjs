import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {summarizeBaselineTrace} from './lash-baseline-association.mjs';
import {matchRegions} from './lash-spatial-match.mjs';
const [runDir,labelFile,out]=process.argv.slice(2);if(!out||fs.existsSync(out))throw Error('Supply saved native run, frozen labels and NEW output');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),protocol=JSON.parse(fs.readFileSync(path.join(runDir,'protocol.json')));
if(hash(fs.readFileSync(labelFile))!==protocol.labelInputs[labelFile])throw Error('Labels changed');
const labels=JSON.parse(fs.readFileSync(labelFile)),results=[];
for(const engine of ['chromium','webkit']){
 const file=path.join(runDir,engine+'.json'),run=JSON.parse(fs.readFileSync(file));
 if(run.sourceSHA256!==protocol.sourceSHA256||hash(fs.readFileSync(run.geometryPath))!==run.geometrySHA256)throw Error('Source/geometry mismatch');
 for(const [side,r]of Object.entries(run.run)){
 const traces=r.baselineTips.map((t,i)=>({id:'baseline-'+i,...summarizeBaselineTrace(t,r.mapping,r.size.w,r.automaticSeeds,r.results)}));
 const candidates=r.baselineTips.map((t,i)=>({id:'baseline-'+i,point:{x:r.mapping.x+t.x*r.size.rawW-.5,y:r.mapping.y+t.y*r.size.rawH-.5},tangent:{x:t.dx*r.mapping.scaleX,y:t.dy*r.mapping.scaleY}}));
 const matches=matchRegions(candidates,labels.eyes[side].tips);
 const direct=traces.map(t=>t.tipToRootDistanceNative);
 const lengths=traces.map(t=>t.nativeArc),tails=traces.map(t=>t.afterDistalValleyPrefixNativeArc);
 results.push({engine,side,baselineTips:traces.length,matches,summary:{directTipRootRange:direct.length?[Math.min(...direct),Math.max(...direct)]:null,coarseConnected:traces.filter(t=>t.connectedAtROIScale).length,fullPathsExceed36:traces.filter(t=>t.fullPathExceeds36).length,distalPrefixesExceed36:traces.filter(t=>t.distalPrefixExceeds36).length,nativeArcRange:lengths.length?[Math.min(...lengths),Math.max(...lengths)]:null,afterDistalValleyPrefixRange:tails.length?[Math.min(...tails),Math.max(...tails)]:null,sharedSeedRecords:traces.reduce((n,t)=>n+t.sharedAutomaticSeeds.length,0),sharedProcessedRecords:traces.reduce((n,t)=>n+t.sharedAutomaticSeeds.filter(s=>s.processed).length,0)},traces,sourceArtifact:{file,sha256:hash(fs.readFileSync(file))}});
 console.log(engine,side,JSON.stringify(results.at(-1).summary));
 }
}
fs.writeFileSync(out,JSON.stringify({date:'2026-11-14',kind:'baseline-association-census-not-recognition',annotationInputToTracing:false,interpretation:'Coarse root support, native valley tracking, gate units and total arc budgets differ; do not label a coarse route as verified native ownership.',runnerSHA256:hash(fs.readFileSync('tests/visual/lash-baseline-association-audit.mjs')),helperSHA256:hash(fs.readFileSync('tests/visual/lash-baseline-association.mjs')),labelSHA256:hash(fs.readFileSync(labelFile)),results,decision:'LENGTH HOLD'},null,2)+'\n',{flag:'wx'});
