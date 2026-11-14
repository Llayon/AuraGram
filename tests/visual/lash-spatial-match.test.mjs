import test from 'node:test';
import assert from 'node:assert/strict';
import {insideRegion,directionAllowed,matchRegions} from './lash-spatial-match.mjs';
const region=[[0,0],[2,0],[2,2],[0,2]];
test('region uncertainty includes boundary but excludes outside points',()=>{
 assert.equal(insideRegion({x:0,y:1},region),true);assert.equal(insideRegion({x:3,y:1},region),false);
});
test('direction scoring handles wraparound and refuses missing tangents',()=>{
 assert.equal(directionAllowed({x:-1,y:0},[170,-170]),true);assert.equal(directionAllowed({x:1,y:0},[170,-170]),false);assert.equal(directionAllowed({x:1,y:0},[-180,180]),true);assert.equal(directionAllowed({x:0,y:0},[-180,180]),false);
});
test('one-to-one matching avoids double counting and greedy loss',()=>{
 const labels=[{id:'a',region,directionRange:[-10,10]},{id:'b',region:[[1,0],[3,0],[3,2],[1,2]],directionRange:[-10,10]}];
 const candidates=[{id:'overlap',point:{x:1.5,y:1},tangent:{x:1,y:0}},{id:'only-a',point:{x:.5,y:1},tangent:{x:1,y:0}},{id:'duplicate',point:{x:.5,y:1},tangent:{x:1,y:0}}];
 const r=matchRegions(candidates,labels);assert.equal(r.matches.length,2);assert.equal(r.unmatchedCandidates.length,1);
 assert.equal(matchRegions([],labels).unmatchedLabels.length,2);
});
