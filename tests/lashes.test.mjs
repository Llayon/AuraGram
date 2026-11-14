/* AuraGram G1c — lash unit tests (pure geometry/math, no DOM, no network).
 * Run: node --test tests/lashes.test.mjs
 * Covers eye-geometry mapping (L1/L2 foundations), confidence gates (L11),
 * strength curves + determinism (L6/L9 foundations) and state plumbing.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../src/state/editorState.js');

import {
  describeEye, describeEyes, hash01, lashRoiSize,
  LASH_ROI_MAX_DIM, LASH_MIN_EYE_W
} from '../src/retouch/eyeGeometry.mjs';
import { lumaOf, lidYAt, scoreConfidence } from '../src/retouch/lashAnalysis.mjs';
import {
  lashDensityCurve, lashLengthCurve, lashDefinitionCurve,
  isNeutralLashes, lashCorrectionCount, fillDensityRGBA
} from '../src/retouch/lashEnhancement.mjs';
import {sampleObservedTipColor} from '../src/retouch/lashEnhancement.mjs';

test('recovered tip sampling preserves the applied monochrome grade and source-pixel centres',()=>{
 const data=new Uint8ClampedArray([20,20,20,255,40,40,40,255,60,60,60,255,80,80,80,255]);
 const analysis={rw:2,rh:2},tip={evidence:{points:[{x:0,y:0},{x:0,y:0},{x:1,y:1}]}};
 assert.deepEqual(sampleObservedTipColor(data,2,2,analysis,tip),[80,80,80]);
 tip.evidence.points[2]={x:.5,y:.5};
 assert.deepEqual(sampleObservedTipColor(data,2,2,analysis,tip),[50,50,50]);
 assert.deepEqual(sampleObservedTipColor(data,2,2,analysis,tip,{x:.25,y:-.25,width:2,height:2}),[45,45,45]);
});

test('measured tip coordinates and widths scale through fractional preview/export ROI boundaries',()=>{
 const tip={x:.25,y:.75,dx:0,dy:-1,c:.8,length:100,width:1};
 const analysis={rw:100,rh:80},values=[];
 for(const width of [300,1000]){
  const height=width*1.5,roi={x0:.1013,y0:.4027,x1:.2782,y1:.515};
  const originX=Math.round(roi.x0*width),originY=Math.round(roi.y0*height);
  const rectangle={x:roi.x0*width-originX,y:roi.y0*height-originY,width:(roi.x1-roi.x0)*width,height:(roi.y1-roi.y0)*height};
  const geometry=lengthGeometry(tip,analysis,Math.round(rectangle.width),Math.round(rectangle.height),width*.1,100,rectangle);
  assert.ok(Math.abs(geometry.x+originX-.145525*width)<1e-10);
  assert.ok(Math.abs(geometry.y+originY-.486925*height)<1e-10);
  assert.ok(geometry.analysisLength<=3);
  values.push(geometry);
 }
 assert.ok(Math.abs(values[1].width/values[0].width-1000/300)<1e-10);
 assert.ok(Math.abs(values[1].length/values[0].length-1000/300)<1e-10);
});

test('density target preserves source brightness and scales with strength/confidence', () => {
  const ridge=new Uint8Array([255,255,255,255]), data=new Uint8ClampedArray(8*8*4);
  const minima=[];
  for(const strength of [0,25,50,100]) {
    fillDensityRGBA(data,8,8,ridge,2,2,strength,1);
    const rgb=Array.from(data).filter((value,index)=>index%4!==3);
    minima.push(Math.min(...rgb));assert.ok(Math.min(...rgb)>=166);
    for(let i=3;i<data.length;i+=4)assert.equal(data[i],255);
  }
  assert.equal(minima[0],255);assert.ok(minima[1]>minima[2]&&minima[2]>minima[3]);
  fillDensityRGBA(data,8,8,ridge,2,2,100,0);assert.ok(data.every(value=>value===255));
  fillDensityRGBA(data,8,8,ridge,2,2,100,.5);assert.ok(data[0]>minima[3]);
});

test('density interpolates ridge edges rather than drawing opaque pixel rectangles', () => {
  const data=new Uint8ClampedArray(16*2*4);
  fillDensityRGBA(data,16,2,new Uint8Array([255,0,255,0]),2,2,100,1);
  const values=Array.from({length:16},(_,x)=>data[x*4]);
  assert.ok(values.some(value=>value>166&&value<255));
  for(let x=1;x<16;x++){assert.ok(values[x]>=values[x-1]);assert.ok(values[x]-values[x-1]<=20);}
  fillDensityRGBA(data,16,2,new Uint8Array(),2,2,100);assert.ok(data.every(value=>value===255));
});

// Same mock face shape as the retouch suite (normalized, centered).
function mockRegions(cx = 0.5, cy = 0.5, w = 0.4, h = 0.5) {
  const ell = (ex, ey, rx, ry, n) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: ex + Math.cos(a) * rx, y: ey + Math.sin(a) * ry, z: 0 };
  });
  return {
    faceOval: ell(cx, cy, w / 2, h / 2, 36),
    leftEye: eyeRing(cx + w * 0.18, cy - h * 0.08, w * 0.06, h * 0.03, true),
    rightEye: eyeRing(cx - w * 0.18, cy - h * 0.08, w * 0.06, h * 0.03, false),
    leftEyebrow: ell(cx + w * 0.18, cy - h * 0.16, w * 0.07, h * 0.02, 10),
    rightEyebrow: ell(cx - w * 0.18, cy - h * 0.16, w * 0.07, h * 0.02, 10),
    lips: ell(cx, cy + h * 0.22, w * 0.11, h * 0.05, 20),
    nose: Array.from({ length: 8 }, (_, i) => ({ x: cx, y: cy - h * 0.12 + (i / 7) * h * 0.24, z: 0 }))
  };
}

describe('L1 geometry mapping — ROI follows the real eye', () => {
  test('ROI contains the eye bbox with face-relative margins', () => {
    const r = mockRegions();
    const eyes = describeEyes(r, 0.4);
    for (const side of ['left', 'right']) {
      const e = eyes[side];
      assert.equal(e.usable, true);
      assert.ok(e.roi.x0 < e.cx && e.roi.x1 > e.cx, `${side} roi spans the eye center`);
      assert.ok(e.roi.y0 < e.cy && e.roi.y1 > e.cy, `${side} roi spans the eye vertically`);
      assert.ok(e.upperLid.length >= 3, `${side} upper lid polyline`);
      assert.ok(e.lidNormal.y < 0, `${side} lid normal points up/out of the eye`);
    }
  });
  test('margins scale with the face (no fixed pixels)', () => {
    const small = describeEyes(mockRegions(0.5, 0.5, 0.2, 0.25), 0.2);
    const big = describeEyes(mockRegions(0.5, 0.5, 0.4, 0.5), 0.4);
    const margin = (e) => (e.roi.x1 - e.roi.x0) - e.w;
    const ratio = margin(big.left) / margin(small.left);
    assert.ok(ratio > 1.6 && ratio < 2.5, `margins scale ~2x, got ${ratio}`);
  });
  test('off-center / edge eyes stay usable and clipped to the frame', () => {
    const r = mockRegions(0.8, 0.5, 0.4, 0.5);
    const eyes = describeEyes(r, 0.4);
    assert.ok(eyes.left.usable || eyes.right.usable, 'at least the visible eye works');
    for (const e of [eyes.left, eyes.right]) {
      assert.ok(e.roi.x0 >= 0 && e.roi.x1 <= 1 && e.roi.y0 >= 0 && e.roi.y1 <= 1, 'roi clipped');
    }
  });
  test('tiny eyes are reported unusable (low-res guard)', () => {
    const r = mockRegions(0.5, 0.5, 0.03, 0.04);
    const eyes = describeEyes(r, 0.03);
    assert.equal(eyes.left.usable, false);
    assert.equal(eyes.right.usable, false);
  });
  test('ROI bitmap stays small (LASH_ROI_MAX_DIM cap)', () => {
    assert.ok(LASH_ROI_MAX_DIM <= 224, 'roi cap must stay small');
    const s = lashRoiSize({ x0: 0.3, y0: 0.3, x1: 0.7, y1: 0.6 }, 1080, 1350);
    assert.ok(Math.max(s.w, s.h) <= LASH_ROI_MAX_DIM, `capped, got ${s.w}x${s.h}`);
    assert.ok(s.w >= 24 && s.h >= 16, 'minimum sane');
  });
});

describe('L2 left/right consistency — never mirrored', () => {
  test('outer corners sit on the ear side of each eye', () => {
    const eyes = describeEyes(mockRegions(), 0.4);
    // Subject-left eye is image-right: outer = larger x.
    assert.ok(eyes.left.outer.x > eyes.left.inner.x, 'left eye outer is image-right');
    assert.ok(eyes.right.outer.x < eyes.right.inner.x, 'right eye outer is image-left');
    // Centers differ — the two descriptions are not copies.
    assert.ok(Math.abs(eyes.left.cx - eyes.right.cx) > 0.05, 'eyes keep asymmetry');
    assert.ok(eyes.left.angle !== eyes.right.angle || Math.abs(eyes.left.cx - eyes.right.cx) > 0, 'per-eye axes');
  });
  test('hash01 is deterministic in [0,1)', () => {
    assert.equal(hash01('left:7'), hash01('left:7'));
    assert.ok(hash01('left:7') !== hash01('right:7'), 'sides differ');
    assert.ok(hash01('x') >= 0 && hash01('x') < 1, 'range');
  });
});

describe('confidence gates (L11 blurry-eye guard foundations)', () => {
  test('unusable eye short-circuits', () => {
    assert.deepEqual(
      scoreConfidence({ sharp01: 1, coverage: 1, contrast01: 1, usable: false }),
      { confidence: 0, reason: 'eye-unusable' });
  });
  test('blurry eyes are rejected', () => {
    const s = scoreConfidence({ sharp01: 0.002, coverage: 0.8, contrast01: 0.2, usable: true });
    assert.equal(s.reason, 'blurry');
    assert.equal(s.confidence, 0);
  });
  test('sparse ridges are rejected', () => {
    const s = scoreConfidence({ sharp01: 0.5, coverage: 0.02, contrast01: 0.2, usable: true });
    assert.equal(s.reason, 'sparse');
    assert.equal(s.confidence, 0);
  });
  test('pale lashes weaken but are not fully rejected', () => {
    const s = scoreConfidence({ sharp01: 0.5, coverage: 0.5, contrast01: 0.01, usable: true });
    assert.equal(s.reason, 'low-contrast');
    assert.ok(s.confidence >= 0 && s.confidence < 0.4, `weakened, got ${s.confidence}`);
  });
  test('good eyes pass with reason ok', () => {
    const s = scoreConfidence({ sharp01: 0.6, coverage: 0.6, contrast01: 0.2, usable: true });
    assert.equal(s.reason, 'ok');
    assert.ok(s.confidence > 0.5, `confident, got ${s.confidence}`);
  });
  test('luma + lid interpolation math', () => {
    assert.ok(Math.abs(lumaOf(255, 255, 255) - 255) < 1e-9);
    assert.ok(lumaOf(0, 0, 0) === 0);
    const lid = [{ x: 0, y: 10 }, { x: 10, y: 20 }];
    assert.equal(lidYAt(lid, 5), 15);
    assert.equal(lidYAt(lid, -3), 10);
    assert.equal(lidYAt(lid, 99), 20);
  });
});

describe('lash curves + state (L3/L6/L9 foundations)', () => {
  test('zero is zero, clamped, monotonic, conservative', () => {
    for (const [fn, max] of [[lashDensityCurve, 0.5], [lashLengthCurve, 1.0], [lashDefinitionCurve, 0.45]]) {
      assert.equal(fn(0), 0);
      assert.equal(fn(-3), 0);
      assert.ok(fn(100) <= max + 1e-9, `capped at ${max}`);
      assert.equal(fn(999), fn(100), 'clamped above 100');
      let prev = -1;
      for (let v = 0; v <= 100; v += 5) {
        const cur = fn(v);
        assert.ok(cur >= prev - 1e-12, 'monotonic');
        prev = cur;
      }
    }
    // Conservative: small values stay subtle.
    assert.ok(lashDensityCurve(20) < 0.1, 'density20 subtle');
    assert.ok(lashDefinitionCurve(15) < 0.12, 'definition15 subtle');
  });
  test('neutral helpers + app state plumbing', () => {
    assert.equal(isNeutralLashes(null), true);
    assert.equal(isNeutralLashes({ density: 0, length: 0, definition: 0 }), true);
    assert.equal(isNeutralLashes({ density: 1, length: 0, definition: 0 }), false);
    assert.equal(lashCorrectionCount({ density: 20, length: 0, definition: 15 }), 2);
    assert.deepEqual(api.createLashesState(), { density: 0, length: 0, definition: 0 });
    assert.equal(api.isNeutralLashes(api.createInitialState().lashes), true);
    assert.equal(api.isNeutralLashes(api.createNeutralState().lashes), true);
    assert.equal(api.isStateNeutral(api.createNeutralState()), true);
    assert.equal(api.isStateNeutral(api.createInitialState()), false);
    const st = api.createNeutralState();
    st.lashes.density = 10;
    assert.equal(api.isStateNeutral(st), false, 'lashes break neutrality');
    assert.equal(api.getActiveCorrectionCount(st), 1, 'one lash correction counted');
  });
  test('LASH_MIN_EYE_W sane', () => {
    assert.ok(LASH_MIN_EYE_W > 0 && LASH_MIN_EYE_W < 0.05, `min eye ${LASH_MIN_EYE_W}`);
  });
});

// Synthetic landmarks follow FACE_REGIONS, rather than arbitrary ellipse order.
function eyeRing(cx,cy,rx,ry,left) {
  const p=Array.from({length:16},(_,i)=>({x:cx+rx*Math.cos(Math.PI-i*Math.PI/8),y:cy+ry*Math.sin(Math.PI-i*Math.PI/8)}));
  // p[0..8] lower arc, p[9..15] upper arc, both corners shared.
  if(!left) return [p[0],...p.slice(1,9),...p.slice(9).reverse()];
  return p;
}

// G1c.1: native resolution and measurable ridge evidence.
import { analyzeLuma, lidFrame, crossingHairEvidence } from '../src/retouch/lashAnalysis.mjs';
import { lengthGeometry } from '../src/retouch/lashEnhancement.mjs';

describe('LF1-LF5 native ROI and topology',()=>{
 test('five source sizes provide more real samples up to cap, without upscale',()=>{
  const roi={x0:.3,y0:.3,x1:.45,y1:.4};
  let previous=0;
  for(const [W,H] of [[320,400],[720,900],[1080,1350],[3000,2400],[4032,3024]]){
   const s=lashRoiSize(roi,W,H);
   assert.ok(s.w>=previous); previous=s.w;
   assert.ok(s.w<=s.rawW&&s.h<=s.rawH&&s.scale<=1);
   assert.ok(s.w*s.h<=224*224&&Math.max(s.w,s.h)<=224);
   assert.ok(Math.abs(s.w-s.rawW*s.scale)<1.001&&Math.abs(s.h-s.rawH*s.scale)<1.001);
  }
  assert.equal(lashRoiSize(roi,40,50).status,'low-resolution');
  assert.equal(lashRoiSize(roi,0,50).w,0);
 });
 test('area budget and upper bound survive hostile budgets',()=>{
  for(const budget of [{maxSide:224,maxPixels:4096},{maxSide:10000,maxPixels:1e9}]){
   const s=lashRoiSize({x0:0,y0:0,x1:1,y1:1},4032,3024,budget);
   assert.ok(s.w*s.h<=Math.min(budget.maxPixels,384*384));assert.ok(s.w<=384&&s.h<=384);
  }
 });
 test('canonical arcs stay upper/lower through +/-60 degree roll and partial crop',()=>{
  for(const left of [true,false])for(const angle of [-60,-30,0,30,60]){
   const ring=eyeRing(.5,.5,.1,.03,left),rad=angle*Math.PI/180;
   const rotate=p=>({x:.5+(p.x-.5)*Math.cos(rad)-(p.y-.5)*Math.sin(rad),y:.5+(p.x-.5)*Math.sin(rad)+(p.y-.5)*Math.cos(rad)});
   const pts=ring.map(rotate),before=JSON.stringify(pts),e=describeEye(pts,[],.4,left);
   const expected=rotate({x:.5,y:.47});
   assert.ok(e.upperLid.some(p=>Math.hypot(p.x-expected.x,p.y-expected.y)<1e-6));
   const indices=left?[0,15,14,13,12,11,10,9,8]:[0,9,10,11,12,13,14,15,8];
   assert.deepEqual(e.upperLid.map(p=>({x:p.x,y:p.y})),indices.map(i=>pts[i]));
   assert.ok(e.lidNormal.x*Math.sin(rad)+e.lidNormal.y*(-Math.cos(rad))>.99);
   assert.equal(JSON.stringify(pts),before);
   const cropped=describeEye(pts.map(p=>({...p,x:p.x-.45})),[],.4,left);
   assert.ok(cropped.roi.x0>=0&&cropped.roi.x1<=1);
  }
 });
});

function ridgeFixture(mode='hair',options={}){
 const w=64,h=48,luma=new Float32Array(w*h).fill(.8);
 if(mode==='hair')for(let y=12;y<=30;y++)luma[y*w+32]=.15;
 if(mode==='eyeliner')for(let x=8;x<55;x++)luma[30*w+x]=.15;
 if(mode==='disconnected')for(let y=12;y<=24;y++)luma[y*w+32]=.15;
 if(mode==='blur')for(let y=10;y<=30;y++)for(let x=20;x<=44;x++)luma[y*w+x]=.8-.3*Math.exp(-(((x-32)/5)**2));
 return analyzeLuma(luma,w,h,[{x:4,y:32},{x:60,y:32}],[{x:4,y:40},{x:60,y:40}],24,{x:4,y:32},[],options);
}

describe('LF6-LF9 real structure evidence',()=>{
 test('a connected thin valley yields a measured tangent and audit evidence',()=>{
  const a=ridgeFixture();assert.ok(a.tips.length>0);
  for(const t of a.tips){assert.ok(t.evidence.connected);assert.ok(t.dy<-.95);assert.ok(Math.abs(t.dx)<.1);
   const ps=t.evidence.points;for(let i=1;i<ps.length;i++)assert.ok(Math.hypot(ps[i].x-ps[i-1].x,ps[i].y-ps[i-1].y)<=Math.SQRT2);
  }
  assert.deepEqual(ridgeFixture().tips,a.tips);
 });
 test('eyeliner, disconnected hairs and blur never produce length candidates',()=>{
  for(const mode of ['eyeliner','disconnected','blur'])assert.equal(ridgeFixture(mode).tips.length,0,mode);
  assert.ok(ridgeFixture('eyeliner').ridge.every(v=>v===0),'best orientation rejects lid-parallel line before density');
 });
 test('normal points away from eye after rotating pixel geometry',()=>{
  const f=lidFrame([{x:5,y:20},{x:35,y:40}],[{x:0,y:30},{x:30,y:50}],25,20);
  assert.ok(f.distance>0&&f.ny<0&&f.nx>0);
 });
});

describe('Recovery evidence separation and observed endpoints',()=>{
 function boundaryFixture(continues=false) {
  const width=64,height=64,luma=new Float32Array(width*height).fill(.8);
  for(let y=20;y<=30;y++)luma[y*width+20]=.15;
  for(let y=continues?3:11;y<=30;y++)luma[y*width+42]=.15;
  const parameters=[luma,width,height,[{x:4,y:32},{x:60,y:32}],[{x:4,y:42},{x:60,y:42}],22,{x:4,y:32},[]];
  return {base:analyzeLuma(...parameters),recovered:analyzeLuma(...parameters,{recoverBoundaryTips:true})};
 }
 test('boundary context recovers a real connected end while preserving Density and baseline tips',()=>{
  const {base,recovered}=boundaryFixture();
  assert.equal(base.tips.length,1);assert.equal(recovered.tips.length,2);
  assert.deepEqual(recovered.tips.slice(0,base.tips.length),base.tips);
  for(const field of ['densityRidge','densityConfidenceMap','rootConnectionMap'])assert.deepEqual(recovered[field],base[field]);
  assert.equal(recovered.densityConfidence,base.densityConfidence);
  assert.equal(recovered.baselineLengthConfidence,base.lengthConfidence);
  const tip=recovered.tips.at(-1);
  assert.ok(tip.evidence.boundaryRecovery&&tip.evidence.connected&&tip.c>=.6);
  assert.ok(tip.evidence.tipDistance>=22-1.5);
  assert.ok(tip.evidence.searchBandH<=22+4);
  assert.ok(tip.evidence.endpointRidgeProfile.filter(point=>point.offset>=1&&point.offset<=2).every(point=>point.response<.006));
  assert.equal(recovered.diagnostics.boundaryContext.recoveredTips,1);
  assert.equal(recovered.typedArrayBytes,base.typedArrayBytes);
  assert.equal(recovered.retainedTypedArrayBytes,base.retainedTypedArrayBytes);
 });
 test('context cannot turn a line continuing beyond available evidence into a tip',()=>{
  const {base,recovered}=boundaryFixture(true);
  assert.deepEqual(recovered.tips,base.tips);
  assert.equal(recovered.diagnostics.boundaryContext.recoveredTips,0);
 });
 test('boundary recovery retains blur, eyeliner and disconnected-structure rejection',()=>{
  for(const mode of ['blur','eyeliner','disconnected'])assert.equal(ridgeFixture(mode,{recoverBoundaryTips:true}).tips.length,0,mode);
 });
 function line({weak=false,clipped=false}={}) {
  const w=64,h=48,luma=new Float32Array(w*h).fill(.8);
  for(let y=clipped?3:12;y<=30;y++)luma[y*w+32]=.15;
  if(weak)for(let y=8;y<12;y++)luma[y*w+32]=.765;
  return analyzeLuma(luma,w,h,[{x:4,y:32},{x:60,y:32}],[{x:4,y:40},{x:60,y:40}],26,{x:4,y:32});
 }
 test('density retains coherent local faint ridges without inventing Length',()=>{
  const w=64,h=48,luma=new Float32Array(w*h).fill(.8);
  for(let y=12;y<=25;y++)luma[y*w+32]=.765;
  const a=analyzeLuma(luma,w,h,[{x:4,y:32},{x:60,y:32}],[{x:4,y:40},{x:60,y:40}],26,{x:4,y:32});
  assert.ok(a.densityConfidenceMap.some(v=>v>0));
  assert.equal(a.tips.length,0,'disconnected faint details are never Length candidates');
  const rgba=new Uint8ClampedArray(w*h*4);
  fillDensityRGBA(rgba,w,h,a.densityRidge,w,h,100,1);
  assert.ok(rgba.some((v,i)=>i%4!==3&&v<255),'legacy cutoff does not erase the local supported signal');
 });
 test('horizontal liner and isolated dark noise receive no density support',()=>{
  assert.ok(ridgeFixture('eyeliner').densityConfidenceMap.every(v=>v===0));
  const a=new Float32Array(64*48).fill(.8);a[20*64+32]=.1;
  const v=analyzeLuma(a,64,48,[{x:4,y:32},{x:60,y:32}],[{x:4,y:40},{x:60,y:40}],26,{x:4,y:32});
  assert.ok(v.densityConfidenceMap.every(v=>v===0));
 });
 test('density uses supported local contrast rather than raw illumination',()=>{
  const values=[];
  for(const scale of [1,.5]){
   const luma=new Float32Array(64*48).fill(.8*scale);
   for(let y=12;y<=30;y++)luma[y*64+32]=.72*scale;
   const a=analyzeLuma(luma,64,48,[{x:4,y:32},{x:60,y:32}],[{x:4,y:40},{x:60,y:40}],26,{x:4,y:32});
   values.push(a.densityConfidenceMap[24*64+32]);
  }
  assert.ok(values[0]>0);assert.ok(Math.abs(values[0]-values[1])<=1);
 });
 test('tip follows the observed faint distal continuation beyond the strong seed',()=>{
  const a=line({weak:true});assert.ok(a.tips.length>0);
  assert.ok(a.tips.some(t=>t.y*48<12),'tip reaches faint visible end');
  for(const t of a.tips)assert.ok(t.evidence.measuredCount>=4&&t.evidence.connected);
 });
 test('line continuing beyond the analysis boundary is never a valid tip',()=>{
  const a=line({clipped:true});assert.equal(a.tips.length,0);
  assert.ok(a.diagnostics.rejectionCounts['clipped-tip']>0);
 });
 test('crossing-line guard requires observed continuation beyond the lower lid',()=>{
  const w=80,h=64,upper=[{x:6,y:22},{x:74,y:22}],lower=[{x:6,y:36},{x:74,y:36}];
  const lashes=new Float32Array(w*h).fill(.8),hair=new Float32Array(w*h).fill(.8);
  for(const x of [22,54])for(let y=10;y<60;y++){hair[y*w+x]=.1;if(y<22)lashes[y*w+x]=.1;}
  assert.equal(crossingHairEvidence(lashes,w,h,upper,lower).occluded,false);
  const crossing=crossingHairEvidence(hair,w,h,upper,lower);
  assert.ok(crossing.paths.length>=2);assert.equal(crossing.occluded,true);
  for(const p of crossing.paths)assert.ok(p.points.at(-1).y>36+4);
 });
 test('one observed crossing vetoes Length without suppressing distant local Density',()=>{
  const w=80,h=64,upper=[{x:6,y:22},{x:74,y:22}],lower=[{x:6,y:36},{x:74,y:36}];
  const clear=new Float32Array(w*h).fill(.8),mixed=new Float32Array(w*h).fill(.8);
  for(let y=8;y<=22;y++)clear[y*w+54]=mixed[y*w+54]=.1;
  for(let y=8;y<60;y++)mixed[y*w+22]=.1;
  const crossing=crossingHairEvidence(mixed,w,h,upper,lower);
  assert.equal(crossing.occluded,false,'strong whole-eye coverage rule unchanged');
  assert.equal(crossing.lengthAbstain,true);
  const a=analyzeLuma(clear,w,h,upper,lower,18,{x:6,y:22});
  const b=analyzeLuma(mixed,w,h,upper,lower,18,{x:6,y:22},[],{recoverBoundaryTips:true});
  assert.ok(a.tips.length>0);assert.equal(b.tips.length,0);assert.equal(b.lengthConfidence,0);
  assert.equal(b.diagnostics.lengthAbstention,'observed-crossing-continuation');
  assert.ok(b.densityConfidence>0);
  for(let y=8;y<22;y++)for(let x=50;x<59;x++)assert.equal(b.densityConfidenceMap[y*w+x],a.densityConfidenceMap[y*w+x]);
 });
 test('zero tangent component is preserved and Length scales continuously',()=>{
  const a=line(),tip=a.tips[0];assert.equal(tip.dx,0);assert.ok(tip.dy<-.99);
  const an={rw:64,rh:48},g=lengthGeometry(tip,an,128,96,40,50),g2=lengthGeometry(tip,an,256,192,80,50);
  assert.equal(g2.length,g.length*2);assert.equal(g2.width,g.width*2);
  assert.ok(lengthGeometry(tip,an,128,96,40,51).length>g.length);
  assert.equal(lengthGeometry(tip,an,128,96,40,0).length,0);
  assert.ok(g.analysisLength<=tip.length*.12&&g.analysisLength<=3);
 });
});
