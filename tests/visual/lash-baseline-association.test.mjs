import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeBaselineTrace} from './lash-baseline-association.mjs';
const mapping={x:10,y:20,scaleX:2,scaleY:3};
test('anisotropic source arc and distal prefix use measured segments, not a single scale',()=>{
 const tip={evidence:{points:[{x:0,y:0},{x:3,y:0},{x:3,y:4}],observedLength:5,connected:true,rootDistance:1}};
 const a=summarizeBaselineTrace(tip,mapping,20,[],[]);
 assert.equal(a.roiArc,7);assert.equal(a.nativeArc,18);assert.equal(a.distalValleyPrefixNativeArc,12);assert.equal(a.afterDistalValleyPrefixNativeArc,6);
 assert.deepEqual(a.pointsSource[0],{x:10.5,y:21});assert.deepEqual(a.sourceEquivalentRootGateRange,[4,6]);assert.equal(a.nativeExperimentalRootGate,1.5);assert.equal(a.endpointConfirmed,false);
});
test('long coarse connection cannot be relabelled a <=36 native observed trajectory',()=>{
 const tip={evidence:{points:[{x:0,y:0},{x:40,y:0}],observedLength:10,connected:true}};
 const a=summarizeBaselineTrace(tip,{x:0,y:0,scaleX:4,scaleY:4},60,[{index:0,rank:0},{index:40,rank:129}],[{rank:0,status:'ambiguous',proximalConnection:false}]);
 assert.equal(a.nativeArc,160);assert.equal(a.tipToRootDistanceNative,160);assert.equal(a.fullPathExceeds36,true);assert.equal(a.distalPrefixExceeds36,true);assert.equal(a.connectedAtROIScale,true);
 assert.equal(a.sharedAutomaticSeeds[0].proximalConnection,false);assert.equal(a.sharedAutomaticSeeds[1].processed,false);
});
test('missing evidence and an overlong stored prefix never invent extra source support',()=>{
 const empty=summarizeBaselineTrace({},mapping,20,[],[]);assert.equal(empty.nativeArc,0);assert.equal(empty.tipToRootDistanceNative,null);assert.equal(empty.connectedAtROIScale,false);
 const a=summarizeBaselineTrace({evidence:{points:[{x:0,y:0},{x:1,y:0}],observedLength:100}},mapping,20,[],[]);
 assert.equal(a.distalValleyPrefixNativeArc,2);assert.equal(a.afterDistalValleyPrefixNativeArc,0);
});
