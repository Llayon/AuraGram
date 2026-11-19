import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectWindowConnectivity} from './lash-ending-window-connectivity.mjs';

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
