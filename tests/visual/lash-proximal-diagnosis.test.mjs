import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseProximal} from './lash-proximal-diagnosis.mjs';
const lid=[{x:0,y:50},{x:80,y:50}],lower=[{x:0,y:65},{x:80,y:65}];
const ambiguity={region:[[35,35],[45,35],[45,46],[35,46]]};
const record=(points,reason='unconfirmed-dense-link')=>({rank:0,index:9,status:'ambiguous',proximalConnection:false,reasons:[reason],patch:{x:10,y:10},proximal:{reason,points,attempts:[{center:{x:30,y:39},linkAccepted:false,denseSupported:false}]}});
test('nearby refused attempt never becomes an observed root or association',()=>{
 const r=diagnoseProximal([record([{x:40,y:30,arc:0},{x:40,y:40,arc:10}])],lid,lower,[ambiguity]);
 const row=r.rows[0];assert.equal(row.end.signedLidDistance,10);assert.equal(row.classification,'stopped-inside-marked-ambiguity');
 assert.equal(row.unacceptedAttempt.signedLidDistance,1);assert.equal(row.unacceptedAttempt.linkAccepted,false);assert.equal(row.proximalConnection,false);
 assert.equal(row.observedGateButUnconfirmed,false);
});
test('observed geometric gate entry remains distinct from confirmed ownership',()=>{
 const a=diagnoseProximal([record([{x:40,y:49,arc:0}])],lid,lower);
 assert.equal(a.rows[0].classification,'observed-proximal-gate');assert.equal(a.summary.observedGateButUnconfirmed,1);assert.equal(a.rows[0].proximalConnection,false);
});
test('bootstrap failures and unprocessed seeds retain distinct census categories',()=>{
 const empty=record([],'bootstrap-search-boundary');
 const budget={rank:128,index:10,status:'censored',proximalConnection:false,reasons:['seed-budget']};
 const a=diagnoseProximal([empty,budget],lid,lower);
 assert.equal(a.summary.classifications['no-observed-proximal-path'],1);assert.equal(a.summary.classifications['unprocessed-seed-budget'],1);
 assert.equal(a.summary.endpointSignedDistance.count,0);assert.equal(a.summary.endpointSignedDistance.min,null);
});
test('conservative half-plane budget bound is not inferred from local endpoint distance alone',()=>{
 const a=diagnoseProximal([record([{x:40,y:0,arc:0}])],lid,lower);
 assert.equal(a.rows[0].gateReachabilityLowerBound,48.5);assert.equal(a.rows[0].impossibleWithin36FromObservedStart,true);
 const curved=[{x:0,y:70},{x:40,y:50},{x:80,y:70}];
 const b=diagnoseProximal([record([{x:40,y:30,arc:0}])],curved,lower);
 assert.ok(b.rows[0].gateReachabilityLowerBound<=b.rows[0].start.gateClearance);
});
