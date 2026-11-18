import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {insideRegion} from './lash-spatial-match.mjs';

const [caseFile, baselineDir, probeDir, repeatDir, output] = process.argv.slice(2);
if (!output || fs.existsSync(output)) throw Error('Supply case, baseline, probe, repeat and NEW output');
const inputs = {};
const read = file => {
  const bytes = fs.readFileSync(file);
  inputs[file] = createHash('sha256').update(bytes).digest('hex');
  return JSON.parse(bytes);
};
const clean = (value, excluded) => {
  if (Array.isArray(value)) return value.map(item => clean(item, excluded));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !excluded.includes(key)).map(([key, item]) => [key, clean(item, excluded)]));
  return value;
};
const manifest = read(caseFile), freeze = read(manifest.freeze), labels = read(manifest.labels);
assert.equal(inputs[manifest.labels], freeze.inputs[manifest.labels]);
assert.equal(labels.sourceSHA256, freeze.sourceSHA256 ?? freeze.sourceHashes[labels.file]);
const directories = [baselineDir, probeDir, repeatDir];
const [base, probe, repeat] = directories.map(dir => read(path.join(dir, 'protocol.json')));
assert.equal(base.sharedArcProximal, false);
assert.equal(probe.sharedArcProximal, true);
assert.deepEqual({...base, sharedArcProximal: true}, probe);
assert.deepEqual(probe, repeat);
assert.equal(probe.caseManifestSHA256, inputs[caseFile]);
assert.equal(probe.sourceSHA256, labels.sourceSHA256);
const engines = {};
for (const engine of ['chromium', 'webkit']) {
  const [original, treatment, repeated] = directories.map(dir => read(path.join(dir, engine + '.json')));
  assert.equal(treatment.engine, engine);
  assert.equal(treatment.sourceSHA256, labels.sourceSHA256);
  assert.deepEqual(clean(original, ['analysisMs']), clean(treatment, ['analysisMs', 'proximalAudit']));
  assert.deepEqual(clean(treatment, ['analysisMs']), clean(repeated, ['analysisMs']));
  const geometry = read(treatment.geometryPath);
  assert.equal(geometry.engine, engine);
  assert.equal(inputs[treatment.geometryPath], treatment.geometrySHA256);
  assert.ok(geometry.results.some(row => row.sha256 === labels.sourceSHA256 && row.status === 'ready' && row.split === 'development'));
  engines[engine] = {};
  for (const [side, eye] of Object.entries(treatment.run)) {
    const ambiguities = labels.eyes[side]?.ambiguities ?? [];
    const observed = (eye.results ?? []).filter(record => record.local?.points.length);
    const attempts = [], reasons = {};
    let observedInAmbiguity = 0;
    for (const record of observed) {
      const audit = record.proximalAudit;
      assert.equal(record.proximalConnection, false);
      assert.equal(record.endpointConfirmed, false);
      assert.equal(audit.distalArc, record.local.points.at(-1).arc);
      assert.ok(audit.distalArc + (audit.proximalArc ?? 0) <= 36 + 1e-8);
      reasons[audit.reason] = (reasons[audit.reason] ?? 0) + 1;
      const startInAmbiguity = ambiguities.some(a => insideRegion(record.local.points[0], a.region));
      if (startInAmbiguity) observedInAmbiguity++;
      if (audit.reason === 'proximal-gate-beyond-budget') continue;
      const enteredAmbiguity = audit.points?.some(point => ambiguities.some(a => insideRegion(point, a.region))) ?? false;
      attempts.push({rank: record.rank, index: record.index, ...audit, startInAmbiguity, enteredAmbiguity});
    }
    engines[engine][side] = {observedStarts: observed.length, reasons, observedInAmbiguity,
      attempted: attempts.length, gateArrivals: attempts.filter(a => a.status === 'gate-observed').length,
      maxAcceptedProximalArc: Math.max(0, ...attempts.map(a => a.proximalArc ?? 0)), attempts};
  }
}
fs.writeFileSync(output, JSON.stringify({source: labels.file, originalRecordsPreserved: true,
  stableExcludingTiming: true, labelsUsedPosthocOnly: true, inputs, engines}, null, 2) + '\n', {flag: 'wx'});
for (const [engine, eyes] of Object.entries(engines)) for (const [side, {attempts, ...summary}] of Object.entries(eyes))
  console.log(engine, side, JSON.stringify(summary));
