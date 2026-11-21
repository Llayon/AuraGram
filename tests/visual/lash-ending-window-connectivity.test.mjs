import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectWindowConnectivity,requireConnectedContinuation} from './lash-ending-window-connectivity.mjs';

const grid = lines => lines.map((line,i)=>({ahead:(i-2)*.25,
  samples:[...line].map((value,j)=>({offset:j-1,supported:value==='1'}))}));

test('forward support after a gap is present but disconnected from the observed center',()=>{
 const r=inspectWindowConnectivity(grid(['010','010','010','000','010']));
 assert.equal(r.forward,true);
 assert.equal(r.backToForward,false);
});
test('a connected sideways signal and a central continuation remain distinct',()=>{
 const r=inspectWindowConnectivity(grid(['010','010','011','001','001']));
 assert.equal(r.backToForward,true);
 assert.equal(r.backToForwardCenter,false);
 const central=inspectWindowConnectivity(grid(['010','010','010','010','010']));
 assert.equal(central.backToForwardCenter,true);
});
test('corner contact alone does not connect sampled cells',()=>{
 const r=inspectWindowConnectivity(grid(['010','010','010','001','001']));
 assert.equal(r.forward,true);
 assert.equal(r.backToForward,false);
});

const profile = supports => ({rows:Array.from({length:25},(_,i)=>({ahead:-2+i*.25,
  samples:Array.from({length:25},(_,j)=>({offset:-3+j*.25,supported:supports(i,j)}))}))});
const shared=profile((i,j)=>j===12);
const ending=(narrow,wide)=>({status:'continuing',reasons:['spatial-continuation'],endpointConfirmed:false,profiles:[narrow,wide]});

test('only paired connected central support retains the continuation claim',()=>{
 const solid=ending(shared,shared);
 assert.equal(requireConnectedContinuation(solid),solid);
 const gapped=ending(shared,profile((i,j)=>j===12&&i!==9));
 const result=requireConnectedContinuation(gapped);
 assert.equal(result.status,'ambiguous');
 assert.deepEqual(result.reasons,['unconfirmed-connected-continuation']);
 assert.equal(result.profiles,gapped.profiles);
 assert.equal(result.endpointConfirmed,false);
});
test('missing grid censors a continuation claim and existing refusals remain intact',()=>{
 const bad=profile((i,j)=>j===12);
 delete bad.rows[8].samples[12].supported;
 assert.equal(requireConnectedContinuation(ending(shared,bad)).status,'censored');
 for(const status of ['ambiguous','censored','not-inspected']){
  const refusal={status,endpointConfirmed:false};
  assert.equal(requireConnectedContinuation(refusal),refusal);
 }
});
