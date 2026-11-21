import test from 'node:test';
import assert from 'node:assert/strict';
import {screeningCensus} from './lash-screening-census.mjs';
const digest = 'a'.repeat(64), other = 'b'.repeat(64);
const source = {file:'pexels-1.jpg',split:'development',role:'positive-lead',status:'downloaded',sha256:digest};
const acquisition = {path:'download.json',sha256:other,records:[source]};
const screen = (engine, status='ready', extra={}) => ({path:engine+'.json',engine,detectorExecuted:false,inputSHA256:other,
  results:[{...source,status,views:[],...extra}]});
test('retries count one downloaded original while retaining failed attempts', () => {
  const failed={path:'failed.json',sha256:digest,records:[{...source,status:'download-failed',sha256:undefined}]};
  const r=screeningCensus([failed,acquisition],[screen('chromium'),screen('webkit')]);
  assert.equal(r.consistent,true); assert.equal(r.downloaded,1); assert.equal(r.sources[0].acquisition.length,2);
  assert.equal(r.sources[0].bothEnginesReady,true); assert.match(r.qualification,/not-assessed/);
});
test('per-engine no_face is never replaced by ready geometry from another engine', () => {
  const r=screeningCensus([acquisition],[screen('chromium'),screen('webkit','no_face')]);
  assert.equal(r.consistent,true); assert.equal(r.sources[0].bothEnginesReady,false);
  assert.equal(r.sources[0].faceMesh.webkit,'no_face'); assert.equal(r.splits.development.positiveLeadsBothReady,0);
});
test('conflicting repeated statuses retain refusal instead of selecting a ready run', () => {
  const r=screeningCensus([acquisition],[screen('chromium'),{...screen('chromium','no_face'),path:'retry.json'},screen('webkit')]);
  assert.equal(r.consistent,false); assert.equal(r.sources[0].faceMesh.chromium,'conflicting-observations');
  assert.equal(r.sources[0].bothEnginesReady,false);
});
test('changed source digest and missing acquisition link fail metadata integrity', () => {
  assert.equal(screeningCensus([acquisition],[screen('chromium','ready',{sha256:other})]).consistent,false);
  assert.equal(screeningCensus([acquisition],[{...screen('chromium'),inputSHA256:digest}]).consistent,false);
});
test('held-out metadata is allowed but any emitted held-out image view fails', () => {
  const a={...acquisition,records:[{...source,split:'validation'}]};
  const clean=screen('chromium','ready',{split:'validation'});
  assert.equal(screeningCensus([a],[clean]).consistent,true);
  const r=screeningCensus([a],[screen('chromium','ready',{split:'validation',views:[{file:'portrait.png'}]})]);
  assert.equal(r.consistent,false); assert.equal(r.validationViewsEmitted,1);
});
test('duplicate files, cross-split reuse and source byte changes cannot silently collapse', () => {
  assert.equal(screeningCensus([acquisition],[{...screen('chromium'),results:[...screen('chromium').results,...screen('chromium').results]}]).consistent,false);
  assert.equal(screeningCensus([acquisition,{...acquisition,path:'second',records:[{...source,split:'validation'}]}],[]).consistent,false);
  assert.equal(screeningCensus([acquisition,{...acquisition,path:'second',records:[{...source,sha256:other}]}],[]).consistent,false);
});
test('missing engine and skipped download failure never become FaceMesh ready', () => {
  const a={...acquisition,records:[{...source,status:'download-failed',sha256:undefined}]};
  const s=screen('chromium','download-failed',{sha256:undefined});
  const r=screeningCensus([a],[s]);
  assert.equal(r.consistent,true); assert.equal(r.downloaded,0); assert.equal(r.sources[0].bothEnginesReady,false);
  assert.equal(r.sources[0].faceMesh.chromium,'not-screened'); assert.equal(r.sources[0].skippedScreening.length,1);
  assert.equal(screeningCensus([a],[screen('chromium','ready')]).consistent,false);
});
test('non-source-only records, missing observations and unknown engine fail', () => {
  assert.equal(screeningCensus([acquisition],[{...screen('chromium'),detectorExecuted:true}]).consistent,false);
  assert.equal(screeningCensus([acquisition],[{...screen('chromium'),results:[]}]).consistent,false);
  assert.throws(()=>screeningCensus([acquisition],[screen('unknown')]),/Unknown engine/);
  assert.throws(()=>screeningCensus([{...acquisition,records:[{...source,file:'../private.jpg'}]}],[]),/Invalid source/);
});
