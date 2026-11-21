import test from 'node:test';
import assert from 'node:assert/strict';
import {measureResolvedEdges,inspectResolvedTaper} from './lash-resolved-edges.mjs';
const profile=(sigma,amplitude=.4,shift=0)=>Array.from({length:25},(_,i)=>{const offset=-3+i*.25;return{offset,value:.8-amplitude*Math.exp(-(((offset-shift)/sigma)**2))};});
const rows=f=>Array.from({length:5},(_,i)=>({ahead:-2+i*.5,samples:f(i)}));
test('resolved two-sided taper provides positive geometric evidence without endpoint permission',()=>{
 const r=inspectResolvedTaper(rows(i=>profile(.9-i*.15)));
 assert.equal(r.status,'resolved-taper-evidence');assert.equal(r.endpointConfirmed,false);
 assert.deepEqual(r,inspectResolvedTaper(rows(i=>profile(.9-i*.15))));
});
test('constant-width amplitude fade cannot become a taper',()=>{
 for(const floor of [.04,.001]){
  const r=inspectResolvedTaper(rows(i=>profile(.8,.4-i*(.4-floor)/4)));
  assert.notEqual(r.status,'resolved-taper-evidence');assert.equal(r.endpointConfirmed,false);
 }
});
test('continuing shaft and curved translation do not form two-sided convergence',()=>{
 for(const shift of [0,.2])assert.notEqual(inspectResolvedTaper(rows(i=>profile(.8,.4,shift*i))).status,'resolved-taper-evidence');
});
test('parallel or forked profile refuses separate supported bands',()=>{
 const p=profile(.2).map(s=>({...s,value:.8-.4*Math.exp(-(((s.offset-1)/.2)**2))-.4*Math.exp(-(((s.offset+1)/.2)**2))}));
 assert.equal(measureResolvedEdges(p).reason,'multiple-profile-bands');
});
test('missing measurements, weak contrast and one-sided edge refuse',()=>{
 assert.equal(measureResolvedEdges([]).status,'censored');
 assert.equal(measureResolvedEdges(profile(.8,.002)).status,'ambiguous');
 assert.notEqual(measureResolvedEdges(profile(.8).map(s=>({...s,value:s.offset<0?.3:.8}))).status,'resolved-profile');
 const p=profile(.8);p[5].value=NaN;assert.equal(measureResolvedEdges(p).status,'censored');
});
test('a measured gap cannot be bridged by later taper sections',()=>{
 const r=rows(i=>profile(.9-i*.15));r[2].samples=profile(.8,.001);
 assert.equal(inspectResolvedTaper(r).reason,'unresolved-intervening-profile');
});
test('identical pixels with different latent causes receive identical decisions',()=>{
 const cap=rows(i=>profile(.8,.4*Math.exp(-i*i/2)));
 const fade=rows(i=>profile(.8,.4*Math.exp(-i*i/2)));
 assert.deepEqual(inspectResolvedTaper(cap),inspectResolvedTaper(fade));
 assert.notEqual(inspectResolvedTaper(cap).status,'resolved-taper-evidence');
});
test('a fork after resolved taper rows cannot be discarded as an unresolved tail',()=>{
 const r=rows(i=>profile(.9-i*.15));
 r.push({ahead:1,samples:profile(.2).map(s=>({...s,value:.8-.4*Math.exp(-(((s.offset-1)/.2)**2))-.4*Math.exp(-(((s.offset+1)/.2)**2))}))});
 assert.equal(inspectResolvedTaper(r).reason,'multiple-profile-bands');
});
