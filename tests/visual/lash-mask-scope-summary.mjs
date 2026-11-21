const engines = ['chromium','webkit'];
const targets = ['preview720long','native'];
const groups = ['baselineLength','maximumRecoveryLength'];

export function classifyMaskSamples({sourcePixelSamples:total, positiveSamples:positive, fullSamples:full}) {
  if (![total,positive,full].every(Number.isSafeInteger) || full<0 || positive<full || total<positive)
    throw Error('Invalid mask sample counts');
  if (total===0) return 'unmeasured';
  if (positive===0) return 'outside';
  if (positive===total) return 'inside';
  return 'partial';
}

export function summarizeMaskScope(labels, runs) {
  const eyes = labels.evaluatedEyes ?? ['left','right'];
  return eyes.map(side=>{
    const tips = labels.eyes[side].tips.map(tip=>{
      const measurements = [];
      for (const engine of engines) for (const target of targets) for (const group of groups) {
        const run = runs[engine];
        if (run?.engine!==engine) throw Error(`Wrong mask engine: ${engine}`);
        let mask;
        if (run.status==='ready') {
          const rows = run.results.filter(row=>row.side===side && row.target===target && row.group===group);
          if (rows.length!==1) throw Error(`Wrong mask coverage: ${engine} ${side} ${target} ${group}`);
          const samples = rows[0].tips.filter(row=>row.id===tip.id);
          if (samples.length!==1) throw Error(`Missing or repeated mask samples: ${tip.id}`);
          mask = samples[0];
        }
        measurements.push({engine,target,group,status:mask?classifyMaskSamples(mask):'unmeasured',
          ...(mask?{samples:mask.sourcePixelSamples,positive:mask.positiveSamples,full:mask.fullSamples}:{reason:run.status})});
      }
      const baseline = measurements.filter(row=>row.group==='baselineLength');
      return {id:tip.id,insideAllBaselineMasks:baseline.every(row=>row.status==='inside'),measurements};
    });
    return {side,insideAllBaselineMasks:tips.filter(tip=>tip.insideAllBaselineMasks).length,tips};
  });
}
