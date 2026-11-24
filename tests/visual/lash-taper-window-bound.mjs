import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectResolvedTaper} from './lash-resolved-edges.mjs';

const output = process.argv[2];
if (!output || fs.existsSync(output)) throw Error('Supply NEW output JSON');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = {};
const read = file => {
  const bytes = fs.readFileSync(file);
  inputs[file] = hash(bytes);
  return JSON.parse(bytes);
};
const rule = read('tests/visual/lash-resolved-edges-protocol.json');
const engineManifest = read('tests/visual/spatial-ending-evidence/followup-ending-join-20261119.json');
const syntheticManifest = read('tests/visual/spatial-ending-evidence/followup-20261117-02.json');
const windows = read('tests/visual/lash-ending-window-diagnosis-summary.json');
const out = 'tests/visual/out/';

// Enumerate a superset of possible taper intervals. The witness must keep the
// original width thresholds and both levels, while this feasibility check omits
// monotonicity and directional edge convergence. It never changes a verdict.
function widthFeasibility(rows) {
  const runs = [];
  let run = [];
  for (const row of rows) {
    if (row.status === 'resolved-profile') run.push(row);
    else if (run.length) { runs.push(run); run=[]; }
  }
  if (run.length) runs.push(run);
  let intervals = 0, feasible = 0, best = null;
  for (const group of runs) for (let i=0;i<group.length;i++) {
    for (let j=i+rule.minimumResolvedRows-1;j<group.length;j++) {
      const first = group[i], last = group[j];
      const levels = first.edges.map((edge,k) => {
        assert.equal(edge.level,rule.levels[k]);
        assert.equal(edge.level,last.edges[k].level);
        const final = last.edges[k].width;
        return {level:edge.level,initial:edge.width,final,ratio:final/edge.width,reduction:edge.width-final};
      });
      intervals++;
      const worstRatio = Math.max(...levels.map(level=>level.ratio));
      if (!best || worstRatio<best.worstRatio) best={from:first.ahead,to:last.ahead,worstRatio,levels};
      if (levels.every(level=>level.ratio<=rule.maximumFinalWidthRatio && level.reduction>=rule.minimumWidthReductionPixels)) feasible++;
    }
  }
  return {resolvedRows:runs.reduce((sum,group)=>sum+group.length,0),longestRun:Math.max(0,...runs.map(group=>group.length)),intervals,feasible,best};
}

const photo = {};
for (const engine of ['chromium','webkit']) {
  const relative = `bounded-ending-14297936-${engine}-02/${engine}.json`;
  const file = out+relative, ending = read(file);
  assert.equal(inputs[file],engineManifest.members[relative]);
  assert.equal(inputs[file],windows.inputs[file]);
  photo[engine] = windows.results[engine].right.map(group => {
    const record = ending.results.right.find(row=>row.rank===group.ranks[0]);
    assert.deepEqual(record.lastSourcePoint,group.point);
    assert.deepEqual(record.measuredTangent,group.tangent);
    const replay = inspectResolvedTaper(record.profiles[0].rows);
    assert.deepEqual(replay,record.resolvedEdges);
    return {point:group.point,tangent:group.tangent,ranks:group.ranks,recordedReason:replay.reason,...widthFeasibility(replay.rows)};
  });
}

const relative = 'resolved-observability-01/inputs.json';
const cases = read(out+relative);
assert.equal(inputs[out+relative],syntheticManifest.members.find(row=>row.path===relative).sha256);
const synthetic = {};
for (const {parameters,rows} of cases) {
  const replay = inspectResolvedTaper(rows), measured = widthFeasibility(replay.rows);
  const counters = synthetic[parameters.kind] ??= {cases:0,resolvedTaper:0,widthFeasible:0};
  counters.cases++;
  if (measured.feasible>0) counters.widthFeasible++;
  if (replay.status==='resolved-taper-evidence') {
    counters.resolvedTaper++;
    assert.ok(measured.feasible>0);
  }
}
fs.writeFileSync(output,JSON.stringify({inputs,rule:{levels:rule.levels,minimumRows:rule.minimumResolvedRows,
  minimumReduction:rule.minimumWidthReductionPixels,maximumRatio:rule.maximumFinalWidthRatio},photo,synthetic,
  meaning:'Upper bound on feasible taper intervals within saved profiles, not a detector or endpoint decision.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({photo:Object.fromEntries(Object.entries(photo).map(([engine,rows])=>[engine,rows.map(r=>({resolvedRows:r.resolvedRows,longestRun:r.longestRun,intervals:r.intervals,feasible:r.feasible,bestRatio:r.best?.worstRatio}))])),synthetic}));
