// Post-hoc development audit. Labels never enter image measurement or tracing.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {summarizeBaselineTrace} from './lash-baseline-association.mjs';
import {endingWindow, polygonsOverlap} from './lash-label-window.mjs';
import {directionAllowed, insideRegion, matchRegions} from './lash-spatial-match.mjs';

const [archiveManifest, nativeDirectory, endingDirectoryPattern, labelFile, output] = process.argv.slice(2);
if (!output || fs.existsSync(output) || !endingDirectoryPattern.includes('{engine}'))
  throw Error('Supply archive manifest, native directory, ending directory with {engine}, labels and NEW output');

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const portable = file => file.split(path.sep).join('/');
const manifestBytes = fs.readFileSync(archiveManifest);
const manifest = JSON.parse(manifestBytes);
const labelPath = portable(path.relative('.', labelFile));
const inputSHA256 = {};
function readArchived(file, member = portable(path.relative(manifest.restoreDirectory, file))) {
  const bytes = fs.readFileSync(file);
  const sha = digest(bytes);
  if (manifest.members[member] !== sha) throw Error('File differs from archive manifest: ' + member);
  inputSHA256[portable(path.relative('.', file))] = sha;
  return JSON.parse(bytes);
}

const labels = readArchived(labelFile, 'source-snapshots/' + labelPath);
const protocol = readArchived(path.join(nativeDirectory, 'protocol.json'));
assert.equal(labels.originalOnly, true);
assert.equal(labels.detectorExecuted, false);
assert.equal(protocol.annotationsUsedAsTraceInput, false);
assert.equal(protocol.labelInputs[labelPath], inputSHA256[labelPath]);
assert.equal(protocol.sourceSHA256, labels.sourceSHA256);

function cellOverlaps(point, width, height, region) {
  const {x, y} = point;
  return polygonsOverlap([
    [x - width / 2, y - height / 2], [x + width / 2, y - height / 2],
    [x + width / 2, y + height / 2], [x - width / 2, y + height / 2]
  ], region);
}

function stages(record) {
  return {
    rank: record.rank,
    index: record.index,
    seedStatus: record.seed.scheduled ? 'scheduled' : 'seed-budget',
    resultReason: record.reason,
    localStart: record.localStart?.reason ?? null,
    localStartCellIndex: record.localStart?.roiCell?.index ?? null,
    initialization: record.initialization?.reason ?? null,
    nativeStop: record.local?.reason ?? null,
    nativePointCount: record.local?.points.length ?? 0,
    reverseStop: record.proximalAudit?.reason ?? null
  };
}

const engines = {};
for (const engine of ['chromium', 'webkit']) {
  const nativeFile = path.join(nativeDirectory, engine + '.json');
  const native = readArchived(nativeFile);
  const ending = readArchived(path.join(endingDirectoryPattern.replace('{engine}', engine), engine + '.json'));
  const screening = readArchived(native.geometryPath);
  assert.equal(native.engine, engine);
  assert.equal(ending.engine, engine);
  assert.equal(screening.engine, engine);
  assert.equal(native.sourceSHA256, labels.sourceSHA256);
  assert.equal(native.geometrySHA256, inputSHA256[portable(path.relative('.', native.geometryPath))]);
  assert.equal(ending.inputSHA256, inputSHA256[portable(path.relative('.', nativeFile))]);
  assert.ok(screening.results.some(r => r.file === labels.file && r.sha256 === labels.sourceSHA256 &&
    r.status === 'ready' && r.split === 'development'));

  const eyes = {};
  for (const [side, {tips}] of Object.entries(labels.eyes)) {
    const eye = native.run[side];
    const {mapping: m, size, automaticSeeds, results, baselineTips} = eye;
    assert.equal(eye.baselineIdentical, true);
    assert.equal(results.length, automaticSeeds.length);
    for (const [i, seed] of automaticSeeds.entries()) {
      assert.equal(results[i].rank, seed.rank);
      assert.equal(results[i].index, seed.index);
      assert.equal(results[i].seed.scheduled, seed.scheduled);
    }
    const baseline = baselineTips.map((t, i) => ({id:'baseline-' + i,
      point:{x:m.x + t.x * size.rawW - .5, y:m.y + t.y * size.rawH - .5},
      tangent:{x:t.dx * m.scaleX, y:t.dy * m.scaleY}}));
    const ends = ending.results[side];
    assert.equal(ends.length, results.length);
    for (const [i, end] of ends.entries()) {
      assert.equal(end.rank, results[i].rank);
      assert.equal(end.index, results[i].index);
    }
    const accepted = ends.filter(e => e.endpointConfirmed).map(e =>
      ({id:'rank-' + e.rank, point:e.lastSourcePoint, tangent:e.measuredTangent}));
    const baselineMatch = matchRegions(baseline, tips);
    const candidateMatch = matchRegions(accepted, tips);
    const losses = baselineMatch.matches.filter(m => candidateMatch.unmatchedLabels.includes(m.label)).map(match => {
      const i = baseline.findIndex(tip => tip.id === match.candidate);
      const trace = summarizeBaselineTrace(baselineTips[i], m, size.w, automaticSeeds, results);
      return {...match, point:baseline[i].point, tangent:baseline[i].tangent, trace};
    });
    const regions = tips.map(({id, region, directionRange}) => ({
      id,
      baselinePointHits:baseline.filter(t => insideRegion(t.point, region)).map(t =>
        ({...t, directionAgrees:directionAllowed(t.tangent, directionRange)})),
      seedCellContacts:results.filter(r => {
        const s = r.seed;
        return cellOverlaps(s, s.nativeCell.w, s.nativeCell.h, region);
      }).map(stages),
      scheduledCoarseRouteCellContacts:results.filter(r => r.seed.scheduled && r.coarseDistal?.points.some(p =>
        cellOverlaps(p, p.uncertaintyCell.width, p.uncertaintyCell.height, region))).map(stages),
      nativePathPointRanks:results.filter(r => r.local?.points.some(p => insideRegion(p, region))).map(r => r.rank),
      stopWindows:ends.filter(e => {
        const window = endingWindow(e.lastSourcePoint, e.measuredTangent);
        return window && polygonsOverlap(window, region);
      }).map(e => ({rank:e.rank, status:e.status, reasons:e.reasons,
        stopInRegion:insideRegion(e.lastSourcePoint, region), directionAgrees:directionAllowed(e.measuredTangent, directionRange)}))
    }));
    eyes[side] = {baselineTipCount:baseline.length, acceptedCount:accepted.length, baselineMatch, candidateMatch,
      losses, regions};
  }
  engines[engine] = eyes;
}

fs.writeFileSync(output, JSON.stringify({
  kind:'posthoc-development-stage-coverage', source:labels.file, sourceSHA256:labels.sourceSHA256,
  archiveManifestSHA256:digest(manifestBytes), inputSHA256, engines,
  interpretation:'Contacts with a source cell or measurement window are geometric. Provisional matches and losses do not establish endpoint accuracy or cohort recall.'
}, null, 2) + '\n', {flag:'wx'});
