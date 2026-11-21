import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {proximalBudgetBound, regionBudgetBound} from './lash-proximal-budget-bound.mjs';

const [runDirectory, labelFile, output] = process.argv.slice(2);
if (!output || fs.existsSync(output)) throw Error('Supply development run, frozen labels and NEW output');
const inputs = {};
const read = file => {
  const bytes = fs.readFileSync(file);
  inputs[file] = createHash('sha256').update(bytes).digest('hex');
  return bytes;
};
const protocol = JSON.parse(read(path.join(runDirectory, 'protocol.json')));
const labels = JSON.parse(read(labelFile));
assert.equal(inputs[labelFile], protocol.labelInputs[labelFile]);
assert.equal(labels.sourceSHA256, protocol.sourceSHA256);
const implementation = 'src/retouch/lashAnalysis.mjs';
read(implementation);
assert.equal(inputs[implementation], protocol.moduleSHA256[implementation]);
read('tests/visual/lash-proximal-budget-bound.mjs');
const engines = {};
for (const engine of ['chromium', 'webkit']) {
  const run = JSON.parse(read(path.join(runDirectory, engine + '.json')));
  assert.equal(run.sourceSHA256, protocol.sourceSHA256);
  const screening = JSON.parse(read(run.geometryPath));
  assert.equal(inputs[run.geometryPath], run.geometrySHA256);
  assert.equal(screening.engine, engine);
  const geometry = screening.results.find(r => r.file === labels.file);
  assert.equal(geometry.split, 'development');
  assert.equal(geometry.status, 'ready');
  assert.equal(geometry.sha256, run.sourceSHA256);
  const sides = {};
  for (const side of ['left', 'right']) {
    const eye = geometry.eyes[side];
    const toNative = p => ({x: p.x * geometry.width - .5, y: p.y * geometry.height - .5});
    const lid = eye.upperLid.map(toNative), lower = eye.lowerLid.map(toNative);
    const regions = labels.eyes[side].tips.map(tip => ({id: tip.id, ...regionBudgetBound(tip.region, lid, lower)}));
    const observedStarts = [];
    for (const record of run.run[side].results) {
      const points = record.local?.points;
      if (!points?.length) continue;
      const bound = proximalBudgetBound(points[0], lid, lower);
      const measuredDistalArc = points.at(-1).arc;
      // A path visiting the observed start must pay for proximal and distal arcs.
      observedStarts.push({rank: record.rank, index: record.index, point: points[0], bound, measuredDistalArc,
        combinedLowerBound: bound === null ? null : bound + measuredDistalArc});
    }
    sides[side] = {regions, observedStarts, regionsBeyond36: regions.filter(r => r.lowerBound > 36 + 1e-8).length,
      observedStartsBeyond36: observedStarts.filter(r => r.bound > 36 + 1e-8).length,
      observedCombinedBeyond36: observedStarts.filter(r => r.combinedLowerBound > 36 + 1e-8).length};
  }
  engines[engine] = sides;
}
fs.writeFileSync(output, JSON.stringify({kind: 'posthoc signed-gate budget lower bounds', inputs, engines,
  limitations: 'Bounds above 36 rule out the specified single native arc. Bounds within 36 are inconclusive. Labels are provisional and were used only for posthoc region bounds.'}, null, 2) + '\n', {flag: 'wx'});
