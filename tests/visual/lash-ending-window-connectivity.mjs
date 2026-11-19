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
