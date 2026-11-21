import {test} from 'node:test';
import assert from 'node:assert/strict';
import {distalFits} from './lash-tangent-fit.mjs';

test('diagnostic fit preserves observed straight direction through rotation',()=>{
  for(const degrees of [-170,-115,-60,15,90]){
    const a=degrees*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a);
    const points=Array.from({length:16},(_,i)=>({x:34-dx*i*.8,y:80-dy*i*.8}));
    const fit=distalFits(points).quadratic;
    assert.ok(fit&&fit.dx*dx+fit.dy*dy>1-1e-10);
    assert.ok(fit.endpointShift<1e-9&&fit.maxResidual<1e-9);
  }
});
test('diagnostic cannot infer a quadratic from repeated or insufficient observations',()=>{
  assert.equal(distalFits(Array(6).fill({x:1,y:1})).quadratic,null);
  assert.equal(distalFits([{x:1,y:1},{x:1,y:2},{x:1,y:3}]).quadratic,null);
});
test('distal fit ignores a diverging merged root beyond its observed window',()=>{
  const distal=Array.from({length:10},(_,i)=>({x:10,y:10+i}));
  const root=Array.from({length:9},(_,i)=>({x:9-i,y:20+i}));
  assert.deepEqual(distalFits(distal.concat(root)),distalFits(distal));
});
