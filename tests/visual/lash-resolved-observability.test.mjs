import test from 'node:test';
import assert from 'node:assert/strict';
import {sampledProfileGrid} from './lash-resolved-observability.mjs';
import {inspectResolvedTaper} from './lash-resolved-edges.mjs';
const base={width:1.6,amplitude:.32,blurSigma:0,noiseAmplitude:0,phaseX:0};
test('native-sampled resolved taper has positive evidence while paired fade and continuation refuse',()=>{
 const taper=inspectResolvedTaper(sampledProfileGrid({...base,kind:'taper'}).rows);
 assert.equal(taper.status,'resolved-taper-evidence');assert.equal(taper.endpointConfirmed,false);
 for(const kind of ['fade','continuing'])assert.notEqual(inspectResolvedTaper(sampledProfileGrid({...base,kind}).rows).status,'resolved-taper-evidence');
});
test('sampling fixture is deterministic and uses native quantized pixels before interpolation',()=>{
 const parameters={...base,kind:'taper',blurSigma:.4,noiseAmplitude:.003,phaseX:.25};
 const a=sampledProfileGrid(parameters);assert.deepEqual(a,sampledProfileGrid(parameters));
 assert.equal(a.pixelValues.length,a.w*a.h);
 for(const v of a.pixelValues){assert.ok(v>=0&&v<=1);assert.ok(Math.abs(v*255-Math.round(v*255))<1e-5);}
 assert.equal(a.rows.length,25);assert.ok(a.rows.every(r=>r.samples.length===25));
 assert.notDeepEqual(a.pixelValues,sampledProfileGrid({...parameters,phaseX:0}).pixelValues);
});
test('unresolved pixel-scale taper does not inherit continuous-profile certainty',()=>{
 const small=sampledProfileGrid({...base,kind:'taper',width:.6});
 assert.notEqual(inspectResolvedTaper(small.rows).status,'resolved-taper-evidence');
 const blurred=sampledProfileGrid({...base,kind:'taper',blurSigma:.8});
 assert.notEqual(inspectResolvedTaper(blurred.rows).status,'resolved-taper-evidence');
});
test('sampling fixture refuses unrecognized latent cause instead of substituting a structure',()=>{
 assert.throws(()=>sampledProfileGrid({...base,kind:'unknown'}),/Unknown mechanism/);
});
