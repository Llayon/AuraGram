import test from 'node:test';
import assert from 'node:assert/strict';
import {lidFrame} from '../../src/retouch/lashAnalysis.mjs';
import {proximalBudgetBound, regionBudgetBound} from './lash-proximal-budget-bound.mjs';

const lid = [{x:0,y:0},{x:100,y:0},{x:100,y:30}], lower = [{x:50,y:10}];

test('distant segment supporting line cannot make a nearby signed gate reachable', () => {
  const point = {x:20,y:-40};
  assert.equal(lidFrame(lid, lower, point.x, point.y).distance, 40);
  assert.equal(proximalBudgetBound(point, lid, lower), (Math.hypot(80,40) - 40) / 2);
  assert.equal(proximalBudgetBound({x:20,y:0}, lid, lower), 0);
});

test('sampled signed gate points around a curved lid never violate the bound', () => {
  for (const start of [{x:-12,y:-30},{x:30,y:-50},{x:120,y:-15},{x:110,y:42}]) {
    const bound = proximalBudgetBound(start,lid,lower);
    for(let x=-50;x<=150;x+=2) for(let y=-70;y<=70;y+=2)
      if (lidFrame(lid,lower,x,y).distance<=1.5)
        assert.ok(bound<=Math.hypot(start.x-x,start.y-y)+1e-9);
  }
});

test('enclosing disk subtracts label uncertainty from the center bound', () => {
  const straight=lid.slice(0,2);
  const result=regionBudgetBound([[15,-54],[25,-54],[25,-46],[15,-46]],straight,lower);
  assert.equal(result.centerBound,48.5);
  assert.equal(result.lowerBound,48.5-Math.hypot(5,4));
  assert.equal(proximalBudgetBound({x:0,y:0},[lid[0],lid[0]],lower),null);
});
