import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {endingWindow,polygonsOverlap} from './lash-label-window.mjs';

const [nativeDir,endingPrefix,labelFile,freezeFile,output,attempt = '01'] = process.argv.slice(2);
if (!output || fs.existsSync(output)) throw Error('Supply native run, ending directory prefix, frozen labels, freeze and NEW output');
const inputs = {};
const read = file => {
  const bytes = fs.readFileSync(file);
  inputs[file] = createHash('sha256').update(bytes).digest('hex');
  return JSON.parse(bytes);
};
const archived = read('tests/visual/lash-proximal-band-bounded-summary.json');
const labels = read(labelFile), freeze = read(freezeFile);
assert.equal(inputs[labelFile],freeze.inputs[labelFile]);
const sourceDigest = freeze.sourceSHA256 ?? freeze.sourceHashes[labels.file];
assert.equal(labels.sourceSHA256,sourceDigest);
const verifyNative = file => {
  const record = read(file);
  const relative = path.relative('tests/visual/out',file).split(path.sep).join('/');
  assert.equal(inputs[file],archived.members[relative],`Archived native record ${relative}`);
  return record;
};
const protocol = verifyNative(path.join(nativeDir,'protocol.json'));
assert.equal(protocol.sourceSHA256,sourceDigest);
assert.equal(protocol.compareDistalBands,true);
const engines = {};
for (const engine of ['chromium','webkit']) {
  const nativeFile = path.join(nativeDir,engine+'.json');
  const native = verifyNative(nativeFile);
  const directory = `${endingPrefix}-${engine}-${attempt}`;
  const endingProtocol = read(path.join(directory,'protocol.json'));
  assert.equal(path.resolve(endingProtocol.inputDir),path.resolve(nativeDir));
  assert.equal(endingProtocol.sourceSHA256,sourceDigest);
  assert.equal(endingProtocol.annotationInput,false);
  const ending = read(path.join(directory,engine+'.json'));
  assert.equal(ending.engine,engine);
  assert.equal(ending.inputSHA256,inputs[nativeFile]);
  engines[engine] = {};
  for (const [side,eye] of Object.entries(native.run)) {
    const tips = labels.eyes[side]?.tips ?? [];
    const local = (eye.results ?? []).filter(r => r.local?.points.length);
    const rows = local.map(record => {
      const end = ending.results[side].find(r => r.rank === record.rank);
      assert.equal(end.index,record.index);
      assert.equal(end.endpointConfirmed,false);
      assert.equal(end.proximalConnection,false);
      assert.notEqual(end.status,'terminal');
      const status = record.distalBandAudit.transverseContrast.status;
      const window = endingWindow(end.lastSourcePoint,end.measuredTangent);
      const overlaps = window ? tips.filter(tip => polygonsOverlap(window,tip.region)).map(tip => tip.id) : [];
      const compact = {rank:record.rank,index:record.index,bandStatus:status,endingStatus:end.status,reasons:end.reasons,
        measuredWindow:end.profiles?.length === 2,taperStatus:end.resolvedEdges?.status ?? null,overlaps};
      for (const score of ['response','transverseContrast']) if (record.distalBandAudit[score].status === 'no-veto') {
        compact[`${score}NoVeto`] = true;
      }
      return compact;
    });
    const noVeto = rows.filter(r => r.bandStatus === 'no-veto');
    const summary = {observed:rows.length,noVeto:noVeto.length,measuredWindows:noVeto.filter(r => r.measuredWindow).length,
      taperEvidence:noVeto.filter(r => r.taperStatus === 'resolved-taper-evidence').length,
      taperEvidenceAll:rows.filter(r => r.taperStatus === 'resolved-taper-evidence').length,
      regionsWithNoVetoMeasuredWindow:[...new Set(noVeto.filter(r => r.measuredWindow).flatMap(r => r.overlaps))],
      endings:{}};
    for (const row of noVeto) summary.endings[row.endingStatus] = (summary.endings[row.endingStatus] ?? 0) + 1;
    engines[engine][side] = {...summary,rows};
    console.log(engine,side,JSON.stringify(summary));
  }
}
fs.writeFileSync(output,JSON.stringify({source:labels.file,kind:'posthoc development evidence join',inputs,engines,
  meaning:'Window overlap and taper evidence are diagnostic. No same-fiber or terminal approval.'},null,2)+'\n',{flag:'wx'});
