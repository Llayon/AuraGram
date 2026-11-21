// Post-hoc connectivity on already measured support. No interpolation or gap fill.
export function inspectWindowConnectivity(rows) {
  const width = rows[0]?.samples.length;
  if (!width || rows.some(row => row.samples.length !== width)) throw Error('Expected a rectangular measurement grid');
  const seen = new Set();
  const components = [];
  const supported = (i,j) => rows[i]?.samples[j]?.supported === true;
  for (let i=0;i<rows.length;i++) for (let j=0;j<width;j++) {
    const key = i*width+j;
    if (!supported(i,j) || seen.has(key)) continue;
    const queue = [[i,j]];
    seen.add(key);
    const component = {samples:0,behindCenter:false,stopCenter:false,forward:false,forwardCenter:false};
    for (let index=0;index<queue.length;index++) {
      const [r,c] = queue[index], {ahead,samples} = rows[r];
      const central = Math.abs(samples[c].offset)<=.5;
      component.samples++;
      component.behindCenter ||= ahead<=-.5 && central;
      component.stopCenter ||= ahead===0 && central;
      component.forward ||= ahead>=.5;
      component.forwardCenter ||= ahead>=.5 && central;
      for (const [u,v] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
        const next = u*width+v;
        if (!supported(u,v) || seen.has(next)) continue;
        seen.add(next);
        queue.push([u,v]);
      }
    }
    components.push(component);
  }
  return {components,forward:components.some(c=>c.forward),
    backToForward:components.some(c=>c.behindCenter&&c.stopCenter&&c.forward),
    backToForwardCenter:components.some(c=>c.behindCenter&&c.stopCenter&&c.forwardCenter)};
}

export function intersectWindowSupport(narrow, wide) {
  if (!Array.isArray(narrow) || !Array.isArray(wide) || narrow.length !== wide.length || !narrow.length) return null;
  const paired = [];
  for (let i=0;i<narrow.length;i++) {
    const a=narrow[i], b=wide[i];
    if (a.ahead!==b.ahead || !Array.isArray(a.samples) || !Array.isArray(b.samples) || a.samples.length!==b.samples.length) return null;
    const samples=[];
    for (let j=0;j<a.samples.length;j++) {
      const x=a.samples[j], y=b.samples[j];
      if (x.offset!==y.offset || x.unavailable || y.unavailable || typeof x.supported!=='boolean' || typeof y.supported!=='boolean') return null;
      samples.push({...x,supported:x.supported && y.supported});
    }
    paired.push({ahead:a.ahead,samples});
  }
  return paired;
}

/** Experimental restriction on a continuation claim. Other outcomes are retained. */
export function requireConnectedContinuation(ending) {
  if (ending.status !== 'continuing') return ending;
  const [narrow,wide] = ending.profiles ?? [];
  const paired = intersectWindowSupport(narrow?.rows,wide?.rows);
  if (!paired || paired.length!==25 || paired.some((row,i)=>row.ahead!==-2+i*.25 || row.samples.length!==25 ||
      row.samples.some((sample,j)=>sample.offset!==-3+j*.25))) {
    return {...ending,status:'censored',reasons:['unavailable-paired-continuation-grid']};
  }
  if (inspectWindowConnectivity(paired).backToForwardCenter) return ending;
  return {...ending,status:'ambiguous',reasons:['unconfirmed-connected-continuation']};
}
