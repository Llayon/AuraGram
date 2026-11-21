import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectReview} from './lash-development-review-intake.mjs';

const source = {file:'test.jpg',sha256:'test-digest',width:80,height:30};
const tip = x => ({id:`tip-${x}`,region:[[x,8],[x+1,8],[x+1,9],[x,9]],observedPath:[[x,12],[x+.5,9]],directionRange:[-110,-70]});
const review = count => ({file:source.file,sourceSHA256:source.sha256,coordinateSpace:'original-source-pixels',
  originalOnly:true,role:'positive',reviewer:'fixture-reviewer',evaluatedEyes:['left'],excludedEyes:{right:'not visible'},
  eyes:{left:{tips:Array.from({length:count},(_,i)=>tip(10+2*i)),ambiguities:[],protectedRegions:[]},
    right:{tips:[],ambiguities:[],protectedRegions:[]}}});

test('a blank form remains pending and mismatching source bytes are invalid',()=>{
  const blank={...review(0),role:null,reviewer:'',evaluatedEyes:[]};
  assert.equal(inspectReview(blank,source).status,'pending');
  assert.equal(inspectReview({...blank,sourceSHA256:'different'},source).status,'invalid');
});
test('four tips preserve a data deficit rather than qualifying the eye',()=>{
  assert.deepEqual(inspectReview(review(4),source),{status:'data-insufficient',role:'positive',issues:['fewer-than-five:left'],tipCounts:{left:4,right:0}});
  assert.equal(inspectReview(review(5),source).status,'review-recorded');
});
test('out-of-image geometry, invalid directions and undocumented exclusions are refused',()=>{
  const broken=review(5);
  broken.excludedEyes={};
  broken.eyes.left.tips[0].region[0]=[80,8];
  broken.eyes.left.tips[0].directionRange=[181,200];
  assert.deepEqual(inspectReview(broken,source).issues,['missing-exclusion:right','invalid-tip-region:left','invalid-direction-range:left']);
});
