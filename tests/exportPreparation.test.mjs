import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareExport } from '../src/exporting/prepareExport.mjs';

function environment(overrides = {}) {
  let elapsed = 0;
  return { isCurrent: () => true, needsRetouch: true, faceStatus: () => 'ready',
    loadRetouch: async () => {}, timeoutMs: 100, now: () => elapsed,
    delay: async ms => { elapsed += ms; await new Promise(setImmediate); }, ...overrides };
}

test('export waits for face detection and module initialization', async () => {
  let probes = 0, loaded = false;
  await prepareExport(environment({ faceStatus: () => ++probes > 2 ? 'ready' : 'detecting',
    loadRetouch: async () => { loaded = true; } }));
  assert.ok(loaded);
  assert.ok(probes > 2);
});
test('photo change cancels preparation before module load', async () => {
  let probes = 0;
  await assert.rejects(prepareExport(environment({ isCurrent: () => ++probes < 2,
    faceStatus: () => 'detecting', loadRetouch: () => assert.fail('stale module load') })), /superseded/);
});
test('a hung detector has a bounded preparation time', async () => {
  await assert.rejects(prepareExport(environment({ faceStatus: () => 'detecting' })), /timeout/);
});
test('a hung module has a bounded preparation time', async () => {
  await assert.rejects(prepareExport(environment({ loadRetouch: () => new Promise(() => {}) })), /timeout/);
});
test('module errors propagate to the export UI', async () => {
  await assert.rejects(prepareExport(environment({ loadRetouch: async () => { throw new Error('module-failed'); } })), /module-failed/);
});
test('no face and neutral settings do not load retouch', async () => {
  const loadRetouch = () => assert.fail('unnecessary module load');
  await prepareExport(environment({ faceStatus: () => 'no_face', loadRetouch }));
  await prepareExport(environment({ needsRetouch: false, loadRetouch }));
});
