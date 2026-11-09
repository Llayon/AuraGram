/** Wait for local processing without allowing a photo change to leak into export. */
export async function prepareExport({ isCurrent, needsRetouch, faceStatus, loadRetouch,
  timeoutMs = 35000, now = () => performance.now(), delay = ms => new Promise(r => setTimeout(r, ms)) }) {
  const started = now();
  const assertCurrent = () => {
    if (!isCurrent()) throw new Error('export-superseded');
    if (now() - started >= timeoutMs) throw new Error('export-prepare-timeout');
  };
  assertCurrent();
  if (!needsRetouch) return;
  while (!['ready', 'no_face', 'failed', 'unsupported'].includes(faceStatus())) {
    await delay(25);
    assertCurrent();
  }
  if (faceStatus() !== 'ready') return;
  // Race module loading as well: a stalled network must not leave the UI busy.
  let settled = false, failure;
  Promise.resolve().then(loadRetouch).then(() => { settled = true; }, e => { failure = e; settled = true; });
  while (!settled) {
    await delay(25);
    assertCurrent();
  }
  assertCurrent();
  if (failure) throw failure;
}
