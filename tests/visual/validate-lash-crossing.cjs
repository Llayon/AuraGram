'use strict';
// Offline integrity checks; this does not rerun or replace visual/browser QA.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const assert = require('node:assert/strict'), crypto = require('crypto');
const root = path.join(__dirname, 'crossing-evidence');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const json = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const packed = name => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, name + '.json.gz'))));
let images = 0, sources = 0, controls = 0, crossing = 0;
for (const entry of json('images.json')) {
  const b = fs.readFileSync(path.join(root, entry.file));
  assert.equal(hash(b), entry.sha256); assert.equal(b.readUInt32BE(16), entry.width);
  assert.equal(b.readUInt32BE(20), entry.height); images++;
}
for (const entry of json('sources.json').sources) {
  assert.equal(hash(fs.readFileSync(path.join(root, entry.path))), entry.sha256); sources++;
}
for (const name of ['candidate', 'reference']) {
  for (const entry of Object.values(packed(name + '-sources'))) {
    assert.equal(hash(Buffer.from(entry.base64, 'base64')), entry.sha256);
  }
}
for (const name of ['nominal-chromium', 'nominal-webkit', 'legacy-webkit']) {
  const manifest = packed(name);
  for (const run of manifest.runs) {
    for (const check of Object.values(run.analysisChecks)) {
      assert.equal(check.densityIdentical, true);
      if (check.abstain) assert.equal(check.currentTips, 0);
      else assert.equal(check.currentTips, check.previousTips);
    }
    for (const check of run.comparisons) {
      assert.equal(check.outsideVeto, 0);
      if (check.control !== 'length') {
        assert.equal(check.changedPixels, 0); assert.equal(check.absoluteRGBA, 0); controls++;
      }
    }
  }
}
for (const engine of ['chromium', 'webkit']) {
  const manifest = packed('final-sweep-' + engine);
  for (const run of manifest.results) for (const eye of run.eyes) for (const sample of eye.samples) {
    if (!sample.crossing.paths.length) continue;
    assert.ok(sample.actualLengthVerification);
    assert.equal(sample.actualLengthVerification.densityIdentical, true); crossing++;
  }
}
assert.equal(controls, 372); assert.equal(crossing, 124);
console.log(JSON.stringify({images, sources, densityDefinitionIdentities: controls, verifiedCrossingSamples: crossing}));
