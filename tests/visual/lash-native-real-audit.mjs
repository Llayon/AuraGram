// Post-hoc only: original labels cannot enter the browser tracing process.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {matchRegions,insideRegion} from './lash-spatial-match.mjs';
const [firstDir,repeatDir,labelFile,output]=process.argv.slice(2);
if(!output||fs.existsSync(output))throw Error('Supply first run, repeat run, labels and NEW output JSON');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const labels=JSON.parse(fs.readFileSync(labelFile)),results=[];
const protocol=JSON.parse(fs.readFileSync(firstDir+'/protocol.json'));
if(JSON.stringify(protocol)!==JSON.stringify(JSON.parse(fs.readFileSync(repeatDir+'/protocol.json'))))throw Error('Repeat protocol differs');
if(hash(fs.readFileSync(labelFile))!==protocol.labelInputs[labelFile])throw Error('Labels changed');
const strip=v=>Array.isArray(v)?v.map(strip):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>k!=='analysisMs').map(([k,v])=>[k,strip(v)])):v;
for(const engine of ['chromium','webkit']){
 const files=[firstDir+'/'+engine+'.json',repeatDir+'/'+engine+'.json'];
 const [first,second]=files.map(p=>JSON.parse(fs.readFileSync(p)));
 const deterministic=JSON.stringify(strip(first))===JSON.stringify(strip(second));
 if(!deterministic)throw Error('Nondeterministic '+engine);
 for(const [side,r]of Object.entries(first.run)){
 const m=r.mapping;
 const baseline=(r.baselineTips||[]).map((t,i)=>({id:'baseline-'+i,point:{x:m.x+t.x*r.size.rawW-.5,y:m.y+t.y*r.size.rawH-.5},tangent:{x:t.dx*m.scaleX,y:t.dy*m.scaleY}}));
 const accepted=r.results.filter(c=>c.endpointConfirmed).map(c=>({id:String(c.rank),point:c.path.at(-1),tangent:c.tangent}));
 results.push({engine,side,deterministic,...first.stats[side],analysisMs:undefined,mapping:m,annotatedTips:labels.eyes[side].tips.length,acceptedMatching:matchRegions(accepted,labels.eyes[side].tips),baselineRawCandidateMatching:matchRegions(baseline,labels.eyes[side].tips),automaticSeedRanksInsideAnnotatedTipUncertainty:r.automaticSeeds.filter(s=>labels.eyes[side].tips.some(l=>insideRegion(s,l.region))).map(s=>s.rank),ambiguousRegionPathRecords:r.results.filter(c=>c.path.some(p=>labels.eyes[side].ambiguities.some(a=>insideRegion(p,a.region)))).map(c=>({rank:c.rank,status:c.status,reasons:c.reasons})),sourceArtifacts:files.map(file=>({file,sha256:hash(fs.readFileSync(file))}))});
 }
}
fs.writeFileSync(output,JSON.stringify({kind:'provisional-development-diagnostic-not-acceptance',annotationSHA256:hash(fs.readFileSync(labelFile)),annotationInputToDetector:false,eligiblePositiveEyes:0,independentCritic:'not-completed',browserParity:false,decision:'LENGTH HOLD; no candidate adoption',results},null,2)+'\n',{flag:'wx'});
