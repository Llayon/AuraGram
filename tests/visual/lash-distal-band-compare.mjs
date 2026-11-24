import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {insideRegion} from './lash-spatial-match.mjs';

const [labelFile,baselineDir,auditDir,repeatDir,output] = process.argv.slice(2);
if (!output || fs.existsSync(output)) throw Error('Supply frozen labels, baseline, audit, repeat and NEW output');
const inputs = {};
const read = file => {
  const bytes = fs.readFileSync(file);
  inputs[file] = createHash('sha256').update(bytes).digest('hex');
  return JSON.parse(bytes);
};
const clean = (value, omitted) => Array.isArray(value) ? value.map(item => clean(item,omitted)) :
  value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)
    .filter(([key]) => !omitted.includes(key)).map(([key,item]) => [key,clean(item,omitted)])) : value;
const labels = read(labelFile);
const protocol = read(path.join(auditDir,'protocol.json'));
assert.deepEqual(protocol,read(path.join(repeatDir,'protocol.json')));
assert.equal(protocol.compareDistalBands,true);
assert.equal(protocol.annotationsUsedAsTraceInput,false);
assert.equal(protocol.labelInputs[labelFile],inputs[labelFile]);
assert.equal(protocol.sourceSHA256,labels.sourceSHA256);
const results = {};
for (const engine of ['chromium','webkit']) {
  const [baseline,audit,repeat] = [baselineDir,auditDir,repeatDir].map(dir => read(path.join(dir,engine+'.json')));
  assert.equal(audit.sourceSHA256,labels.sourceSHA256);
  const screening = read(audit.geometryPath);
  assert.equal(inputs[audit.geometryPath],audit.geometrySHA256);
  assert.equal(screening.engine,engine);
  assert.ok(screening.results.some(row => row.sha256 === labels.sourceSHA256 && row.status === 'ready' && row.split === 'development'));
  assert.deepEqual(clean(baseline,['analysisMs']),clean(audit,['analysisMs','distalBandAudit']));
  assert.deepEqual(clean(audit,['analysisMs']),clean(repeat,['analysisMs']));
  results[engine] = {};
  for (const [side,eye] of Object.entries(audit.run)) {
    const {tips = [],ambiguities = []} = labels.eyes[side] ?? {};
    const rows = [];
    for (const record of eye.results ?? []) {
      const points = record.local?.points ?? [];
      assert.equal(Boolean(record.distalBandAudit),points.length > 0);
      assert.equal(record.proximalConnection,false);
      assert.equal(record.endpointConfirmed,false);
      if (!points.length) continue;
      const {response,transverseContrast} = record.distalBandAudit;
      rows.push({rank:record.rank,index:record.index,points:points.length,
        response:response.status,transverseContrast:transverseContrast.status,
        reasons:[response.reason,transverseContrast.reason],
        tipRegionHits:tips.filter(tip => points.some(point => insideRegion(point,tip.region))).map(tip => tip.id),
        insideAmbiguity:ambiguities.some(region => points.some(point => insideRegion(point,region.region)))});
    }
    const count = status => rows.filter(row => row.transverseContrast === status).length;
    const summary = {observed:rows.length,noVeto:count('no-veto'),ambiguous:count('ambiguous'),
      censored:count('censored'),unavailable:count('unavailable'),
      changedStatus:rows.filter(row => row.response !== row.transverseContrast).length,
      tipRegionRecords:rows.filter(row => row.tipRegionHits.length).length,
      ambiguityRegionRecords:rows.filter(row => row.insideAmbiguity).length};
    results[engine][side] = {...summary,rows};
    console.log(engine,side,JSON.stringify(summary));
  }
}
fs.writeFileSync(output,JSON.stringify({source:labels.file,baselinePreserved:true,repeatExactExcludingTiming:true,
  meaning:'Posthoc scan of observed distal sections. No proximal or endpoint approval.',inputs,results},null,2)+'\n',{flag:'wx'});
