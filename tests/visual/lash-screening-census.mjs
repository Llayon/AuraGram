// Source-only metadata census. Never imports a decoder, detector or renderer.
// Repeated observations are retained; conflicting results never select a winner.
export function screeningCensus(acquisitions, screenings) {
  const rows = new Map(), errors = [];
  const rowFor = file => {
    if (typeof file !== 'string' || !/^pexels-\d+\.jpg$/.test(file)) throw Error('Invalid source filename');
    if (!rows.has(file)) rows.set(file, {file, splits: new Set(), roles: new Set(), hashes: new Set(), acquisition: [], screening: [], skippedScreening: []});
    return rows.get(file);
  };
  for (const input of acquisitions) for (const record of input.records) {
    const row = rowFor(record.file);
    row.splits.add(record.split); row.roles.add(record.role);
    row.acquisition.push({input: input.path, status: record.status, sha256: record.sha256 ?? null});
    if (record.status === 'downloaded') {
      if (!/^[a-f0-9]{64}$/.test(record.sha256 ?? '')) errors.push('invalid-source-digest:' + record.file);
      else row.hashes.add(record.sha256);
    }
  }
  let validationViewsEmitted = 0;
  for (const input of screenings) {
    if (!['chromium', 'webkit'].includes(input.engine)) throw Error('Unknown engine');
    if (input.detectorExecuted !== false) errors.push('not-source-only:' + input.path);
    const parents = acquisitions.filter(a => a.sha256 === input.inputSHA256);
    if (parents.length !== 1) { errors.push('nonunique-acquisition-link:' + input.path); continue; }
    const seen = new Set();
    for (const record of input.results) {
      if (seen.has(record.file)) errors.push('duplicate-screen-record:' + input.path + ':' + record.file);
      seen.add(record.file);
      const parent = parents[0].records.find(r => r.file === record.file);
      if (parent?.status === 'download-failed' && record.status === 'download-failed' &&
          parent.split === record.split && !record.sha256 && !record.views?.length && !record.eyes && !record.regions) {
        rowFor(record.file).skippedScreening.push({input: input.path, engine: input.engine, reason: 'download-failed'});
        continue;
      }
      if (!parent || parent.status !== 'downloaded' || parent.sha256 !== record.sha256 || parent.split !== record.split) {
        errors.push('screen-source-mismatch:' + input.path + ':' + record.file); continue;
      }
      const row = rowFor(record.file);
      const viewCount = record.views?.length ?? 0;
      if (record.split === 'validation') validationViewsEmitted += viewCount;
      if (!['ready', 'no_face', 'failed', 'unsupported'].includes(record.status)) errors.push('invalid-screen-status:' + record.file);
      row.screening.push({input: input.path, engine: input.engine, status: record.status, viewCount});
    }
    for (const record of parents[0].records.filter(r => r.status === 'downloaded')) {
      if (!seen.has(record.file)) errors.push('missing-screen-record:' + input.path + ':' + record.file);
    }
  }
  if (validationViewsEmitted) errors.push('validation-views-emitted');
  const sources = [...rows.values()].sort((a, b) => a.file.localeCompare(b.file, 'en')).map(row => {
    if (row.splits.size !== 1 || !['development', 'validation'].includes([...row.splits][0])) errors.push('split-conflict:' + row.file);
    if (row.hashes.size > 1) errors.push('source-byte-conflict:' + row.file);
    if (row.roles.size !== 1) errors.push('role-conflict:' + row.file);
    const faceMesh = {};
    for (const engine of ['chromium', 'webkit']) {
      const statuses = [...new Set(row.screening.filter(r => r.engine === engine).map(r => r.status))].sort();
      faceMesh[engine] = statuses.length === 1 ? statuses[0] : statuses.length ? 'conflicting-observations' : 'not-screened';
      if (statuses.length > 1) errors.push('screen-status-conflict:' + engine + ':' + row.file);
    }
    return {file: row.file, split: [...row.splits][0], role: [...row.roles][0],
      downloaded: row.hashes.size === 1, sourceSHA256: row.hashes.size === 1 ? [...row.hashes][0] : null,
      acquisition: row.acquisition, faceMesh, screening: row.screening, skippedScreening: row.skippedScreening,
      bothEnginesReady: Object.values(faceMesh).every(s => s === 'ready')};
  });
  const splits = Object.fromEntries(['development', 'validation'].map(split => {
    const selected = sources.filter(s => s.split === split);
    return [split, {planned: selected.length, downloaded: selected.filter(s => s.downloaded).length,
      bothEnginesReady: selected.filter(s => s.bothEnginesReady).length,
      positiveLeadsBothReady: selected.filter(s => s.role === 'positive-lead' && s.bothEnginesReady).length,
      hardLeadsBothReady: selected.filter(s => s.role === 'hard-lead' && s.bothEnginesReady).length}];
  }));
  return {kind: 'source-only-metadata-census', originalPixelsRead: false, detectorExecuted: false,
    qualification: 'not-assessed; real tips, allowed region, identity separation and independent review are separate requirements',
    consistent: errors.length === 0, errors, planned: sources.length,
    downloaded: sources.filter(s => s.downloaded).length, validationViewsEmitted, splits, sources};
}
