import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {evaluateSpatialFiles} from './lash-spatial-evaluate.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const program = fileURLToPath(new URL('./lash-spatial-evaluate.mjs',import.meta.url));
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'lash-spatial-evaluate-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file = name => path.join(dir,name);
  const write = (name,value) => {
    const bytes = JSON.stringify(value);
    fs.writeFileSync(file(name),bytes);
    return hash(bytes);
  };
  const sources = [], annotations = [], artifacts = [], eyes = [], reviewed = [];
  const tips = Array.from({length:5},(_,x)=>({id:`tip-${x}`,region:[[x-.2,-.2],[x+.2,-.2],[x+.2,.2],[x-.2,.2]],
    directionRange:[-10,10],observedPath:[{x:x-.3,y:0},{x,y:0}]}));
  const candidate = x => ({id:`c${x}`,point:{x,y:0},tangent:{x:1,y:0},path:[{x:x-.3,y:0},{x,y:0}],
    status:'terminal',endpointConfirmed:true,proximalConnection:true});
  for (const split of ['development','validation']) for (let i=0;i<6;i++) {
    const name = `${split}-${i}.jpg`, labelPath = `${split}-${i}.labels.json`, positive=i<4;
    sources.push({file:name,split,status:'downloaded',sha256:write(name,{fixture:name}),
      identityGroup:name,faceMesh:{chromium:'ready',webkit:'ready'}});
    const labels = {tips:positive?tips:[],ambiguities:[],protectedRegions:[]};
    const annotation = {file:name,role:positive?'positive':'hard',originalOnly:true,reviewer:'fixture-annotator',
      evaluatedEyes:['left'],excludedEyes:{right:'fixture eye excluded'},eyes:{left:labels}};
    annotations.push({...annotation,frozenSHA256:write(labelPath,annotation)});
    artifacts.push({file:name,path:labelPath});
    if (split==='validation') {
      const id=`${name}/left`, candidates=positive?[0,1,2].map(candidate):[];
      eyes.push({id,baseline:[],candidates});
      reviewed.push({id,reviews:candidates.map(c=>({id:c.id,reviewer:'fixture-critic',continuingShaft:false,switchedStrand:false,protectedArea:false}))});
    }
  }
  const freezeSHA256 = write('freeze.json',{sourcesSHA256:write('sources.json',{sources}),annotationsSHA256:write('annotations.json',{annotations,artifacts}),
    candidate:{file:'candidate.json',sha256:write('candidate.json',{version:'fixture-candidate'})},
    baseline:{file:'baseline.json',sha256:write('baseline.json',{version:'fixture-baseline'})}});
  const runs = {};
  for (const engine of ['chromium','webkit']) {
    const primary=`${engine}-primary.json`,repeat=`${engine}-repeat.json`,review=`${engine}-review.json`;
    const run={engine,freezeSHA256,eyes};
    write(review,{engine,runSHA256:write(primary,run),eyes:reviewed});
    write(repeat,run);
    runs[engine]={primary,repeat,review};
  }
  write('config.json',{sources:'sources.json',annotations:'annotations.json',sourceDirectory:'.',freeze:'freeze.json',runs});
  return {file,write,runs,freezeSHA256,eyes};
}

test('qualified frozen fixture scores all eyes and the CLI preserves an existing report',t=>{
  const f=fixture(t), result=evaluateSpatialFiles(f.file('config.json'));
  assert.equal(result.status,'eye-criteria-passed');
  assert.deepEqual(result.scores.engines.webkit.map(eye=>eye.recall),[.6,.6,.6,.6,null,null]);
  const args=[program,f.file('config.json'),f.file('result.json')];
  assert.equal(spawnSync(process.execPath,args).status,0);
  const before=fs.readFileSync(f.file('result.json'));
  assert.equal(spawnSync(process.execPath,args).status,1);
  assert.deepEqual(fs.readFileSync(f.file('result.json')),before);
});

test('broken qualification refuses before opening benchmark outputs',t=>{
  const f=fixture(t);
  f.write('validation-0.jpg',{changed:true});
  fs.unlinkSync(f.file(f.runs.webkit.primary));
  assert.equal(evaluateSpatialFiles(f.file('config.json')).status,'cohort-unqualified');
});

test('changed frozen artifact, mismatching repeat and review for wrong bytes each refuse',t=>{
  const f=fixture(t), evaluate=()=>evaluateSpatialFiles(f.file('config.json'));
  f.write('candidate.json',{version:'changed'});
  assert.throws(evaluate,/Changed frozen candidate/);
  f.write('candidate.json',{version:'fixture-candidate'});
  const run={engine:'webkit',freezeSHA256:f.freezeSHA256,eyes:f.eyes};
  f.write(f.runs.webkit.repeat,{...run,eyes:[]});
  assert.throws(evaluate,/Nondeterministic webkit/);
  f.write(f.runs.webkit.repeat,run);
  f.write(f.runs.webkit.review,{engine:'webkit',runSHA256:'different'});
  assert.throws(evaluate,/Unbound webkit review/);
});
