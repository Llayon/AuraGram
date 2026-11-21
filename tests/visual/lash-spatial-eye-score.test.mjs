import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreSpatialEye,scoreSpatialEyes} from './lash-spatial-eye-score.mjs';

const square = x => [[x-.4,-.4],[x+.4,-.4],[x+.4,.4],[x-.4,.4]];
const tips = Array.from({length:5},(_,i)=>({id:`t${i}`,region:square(i),directionRange:[-10,10]}));
const terminal = (i, id=`c${i}`) => ({id,status:'terminal',point:{x:i,y:0},tangent:{x:1,y:0},
  path:[{x:i-.5,y:0},{x:i,y:0}],proximalConnection:true,endpointConfirmed:true});
const review = id => ({id,reviewer:'independent-fixture-reviewer',continuingShaft:false,switchedStrand:false,protectedArea:false});
function score(candidates,overrides={}) {
  return scoreSpatialEye({positive:true,labels:{tips,ambiguities:[],protectedRegions:[]},
    baseline:[terminal(4,'legacy')],candidates,reviews:candidates.map(c=>review(c.id)),...overrides});
}

test('five labels require three distinct matches and baseline losses are retained',()=>{
  const insufficient=score([terminal(0),terminal(1)]);
  assert.equal(insufficient.recall,.4);
  assert.equal(insufficient.passesEyeCriteria,false);
  const sufficient=score([terminal(0),terminal(1),terminal(2)]);
  assert.equal(sufficient.recall,.6);
  assert.equal(sufficient.passesEyeCriteria,true);
  assert.deepEqual(sufficient.baselineLosses,[{label:'t4',candidate:'legacy'}]);
});

test('wrong direction and duplicate terminal coordinates cannot be counted as matched tips',()=>{
  const wrong={...terminal(1),tangent:{x:-1,y:0}};
  const r=score([terminal(0),terminal(0,'duplicate'),wrong,terminal(2),terminal(3)]);
  assert.equal(r.matching.matches.length,3);
  assert.equal(r.passesEyeCriteria,false);
  assert.deepEqual(r.blockers,[{reason:'duplicate-terminal-point',id:'duplicate'},{reason:'unmatched-terminal',id:'c1'}]);
});

test('matched terminals still fail on missing review or a recorded critic defect',()=>{
  const r=score([terminal(0),terminal(1),terminal(2)],{reviews:[review('c0'),{...review('c1'),switchedStrand:true}]});
  assert.equal(r.recall,.6);
  assert.deepEqual(r.blockers,[{reason:'critic-switchedStrand',id:'c1'},{reason:'incomplete-independent-review',id:'c2'}]);
});

test('protected and ambiguous regions veto matched tips while a hard control can safely refuse',()=>{
  const labels={tips,ambiguities:[{region:square(0)}],protectedRegions:[{region:square(1)}]};
  const r=score([terminal(0),terminal(1),terminal(2)],{labels});
  assert.deepEqual(r.blockers,[{reason:'terminal-in-ambiguous-region',id:'c0'},{reason:'terminal-in-protected-region',id:'c1'}]);
  const hard={positive:false,labels:{...labels,tips:[]}};
  assert.equal(score([{id:'c0',status:'censored',endpointConfirmed:false}],hard).passesEyeCriteria,true);
  assert.equal(score([terminal(0)],hard).passesEyeCriteria,false);
});

test('a missing observed path and an inconsistent status both block the eye',()=>{
  const r=score([terminal(0),terminal(1),terminal(2),{...terminal(3),path:[]},{...terminal(4),status:'censored'}]);
  assert.deepEqual(r.blockers,[{reason:'invalid-terminal-evidence',id:'c3'},{reason:'inconsistent-ending-status',id:'c4'}]);
});

test('each eye and each engine must pass independently and missing eyes fail closed',()=>{
  const labels={tips,ambiguities:[],protectedRegions:[]};
  const eyes=[{id:'left',positive:true,labels},{id:'right',positive:true,labels}];
  const row=(id,n)=>({id,baseline:[],candidates:Array.from({length:n},(_,i)=>terminal(i)),
    reviews:Array.from({length:n},(_,i)=>review(`c${i}`))});
  const chromium=[row('left',5),row('right',3)],webkit=[row('right',2),row('left',5)];
  const result=scoreSpatialEyes(eyes,{chromium,webkit});
  assert.equal(result.passesScoredEyes,false);
  assert.deepEqual(result.engines.webkit.map(eye=>eye.recall),[1,.4]);
  assert.equal(scoreSpatialEyes(eyes,{chromium,webkit:chromium}).passesScoredEyes,true);
  assert.throws(()=>scoreSpatialEyes(eyes,{chromium,webkit:[row('left',5)]}),/eye coverage/);
});
