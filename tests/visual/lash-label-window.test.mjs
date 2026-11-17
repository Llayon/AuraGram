import test from 'node:test';
import assert from 'node:assert/strict';
import {polygonsOverlap,endingWindow} from './lash-label-window.mjs';
test('crossing windows overlap even with no polygon vertex inside the other',()=>{
 const a=[[-3,-1],[3,-1],[3,1],[-3,1]],b=[[-1,-3],[1,-3],[1,3],[-1,3]];
 assert.equal(polygonsOverlap(a,b),true);assert.equal(polygonsOverlap(b,a),true);
});
test('boundary contact counts but a spatially separate uncertainty region does not',()=>{
 const a=[[0,0],[1,0],[1,1],[0,1]],b=[[1,0],[2,0],[2,1],[1,1]];
 assert.equal(polygonsOverlap(a,b),true);assert.equal(polygonsOverlap(a,b.map(([x,y])=>[x+.1,y])),false);
 assert.equal(polygonsOverlap([],a),false);
});
test('window preserves measured tangent orientation and refuses invalid axes',()=>{
 assert.deepEqual(endingWindow({x:10,y:20},{x:0,y:-1}),[[7,22],[7,16],[13,16],[13,22]]);
 assert.equal(endingWindow({x:10,y:20},{x:0,y:0}),null);
});
test('a rectangle inside a concave polygon notch is not mistaken for overlap',()=>{
 const l=[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]],notch=[[2,2],[3,2],[3,3],[2,3]];
 assert.equal(polygonsOverlap(l,notch),false);
 assert.equal(polygonsOverlap(l,notch.map(([x,y])=>[x-2,y])),true);
});
