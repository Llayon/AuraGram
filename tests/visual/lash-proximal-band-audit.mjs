import {measureAt} from './lash-endpoint-profile.mjs';

// One fixed cross-section at each observed point. A clear scan leaves ownership open.
export function auditProximalBands(luma, width, height, points) {
  if (points.length < 2) return {status:'unavailable', reason:'no-measured-direction'};
  let edgeWitness = null;
  for (let index = 0; index < points.length; index++) {
    const a = points[Math.max(0,index - 1)], b = points[Math.min(points.length - 1,index + 1)];
    const length = Math.hypot(b.x - a.x,b.y - a.y);
    if (!Number.isFinite(length) || length < 1e-8) return {status:'unavailable',reason:'no-measured-direction',index};
    const tangent = {x:(b.x - a.x) / length,y:(b.y - a.y) / length};
    const normal = {x:-tangent.y,y:tangent.x};
    const center = points[index];
    for (const radius of [.75,1.5]) {
      const samples = [];
      for (let i = -12; i <= 12; i++) {
        const offset = i * .25;
        const point = {x:center.x + normal.x * offset,y:center.y + normal.y * offset};
        let response;
        try { response = measureAt(luma,width,height,point,tangent,normal,[radius]).response; }
        catch (error) {
          if (error.message !== 'Profile outside measured bitmap') throw error;
          return {status:'censored',reason:'unavailable-band-sample',index,radius,offset};
        }
        if (!Number.isFinite(response)) return {status:'censored',reason:'unavailable-band-sample',index,radius,offset};
        samples.push({offset,response,supported:response >= .006});
      }
      const bands = samples.filter((s,j) => s.supported && !samples[j-1]?.supported).length;
      const witness = {index,center,tangent,radius,bands,samples};
      if (bands > 1) return {status:'ambiguous',reason:'multiple-supported-bands',...witness};
      if (!edgeWitness && (samples[0].supported || samples.at(-1).supported)) edgeWitness = witness;
    }
  }
  if (edgeWitness) return {status:'censored',reason:'supported-band-at-side-boundary',...edgeWitness};
  return {status:'no-veto',reason:'no-separated-band-observed'};
}
