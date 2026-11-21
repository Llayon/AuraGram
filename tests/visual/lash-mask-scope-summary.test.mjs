import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyMaskSamples,summarizeMaskScope} from './lash-mask-scope-summary.mjs';

const samples = (total,positive,full) => ({id:'tip',sourcePixelSamples:total,positiveSamples:positive,fullSamples:full});
test('integer mask samples preserve partial and unmeasured cases',()=>{
  assert.equal(classifyMaskSamples(samples(4,4,2)),'inside');
  assert.equal(classifyMaskSamples(samples(4,2,2)),'partial');
  assert.equal(classifyMaskSamples(samples(4,0,0)),'outside');
  assert.equal(classifyMaskSamples(samples(0,0,0)),'unmeasured');
  assert.throws(()=>classifyMaskSamples(samples(4,0,1)),/Invalid mask/);
});

test('a recovery envelope and the other browser cannot replace a missing baseline measurement',()=>{
  const labels={evaluatedEyes:['left'],eyes:{left:{tips:[{id:'tip'}]}}};
  const rows=['preview720long','native'].flatMap(target=>['baselineLength','maximumRecoveryLength'].map(group=>({
    side:'left',target,group,tips:[samples(4,4,4)]})));
  const chromium={engine:'chromium',status:'ready',results:rows};
  const webkit={engine:'webkit',status:'no_face'};
  const [eye]=summarizeMaskScope(labels,{chromium,webkit});
  assert.equal(eye.insideAllBaselineMasks,0);
  assert.equal(eye.tips[0].measurements.filter(row=>row.status==='unmeasured').length,4);
  const partial={engine:'webkit',status:'ready',results:[{...rows[0],tips:[samples(4,2,2)]},...rows.slice(1)]};
  assert.equal(summarizeMaskScope(labels,{chromium,webkit:partial})[0].insideAllBaselineMasks,0);
  assert.equal(summarizeMaskScope(labels,{chromium,webkit:{...partial,results:rows}})[0].insideAllBaselineMasks,1);
});
