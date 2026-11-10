'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {settingsSnapshot, applySettings, createInitialState} = require('../src/state/editorState.js');
const {createHistory} = require('../src/state/history.js');
const {createSessionController} = require('../src/state/sessionStore.js');
const pause = () => new Promise(resolve => setTimeout(resolve, 15));
const photo = new Blob(['image'], {type:'image/png'});
const record = () => ({version:1, enabled:true, blob:photo, settings:settingsSnapshot(createInitialState())});

test('settings snapshots are independent, bounded and exclude ephemeral state', () => {
  const state = createInitialState(), snapshot = settingsSnapshot(state);
  state.beauty.smooth = 91;
  assert.equal(snapshot.beauty.smooth, 30);
  assert.equal('currentTab' in snapshot, false);
  const invalid = settingsSnapshot({...state, activePreset:'unknown', presetIntensity:Infinity,
    beauty:{smooth:-1,glow:1000}, lashes:{length:NaN}, caption:'x'.repeat(100), stampMode:'cinema'});
  assert.equal(invalid.activePreset, 'normal');
  assert.equal(invalid.beauty.smooth, 0); assert.equal(invalid.beauty.glow, 100);
  assert.equal(invalid.lashes.length, 0); assert.equal(invalid.caption.length, 28);
  assert.equal(invalid.stampMode, 'cinema');
  state.currentTab = 'beauty'; applySettings(state, snapshot);
  assert.equal(state.currentTab, 'beauty'); assert.equal(state.beauty.smooth, 30);
});

test('history groups edits, discards redo, skips no-ops and bounds snapshots', () => {
  let state = {value:0};
  const history = createHistory({read:()=>state, write:s=>{state=s;}, limit:2});
  history.begin(); history.commit(); assert.equal(history.info().past, 0);
  history.begin(); state.value=1; history.begin(); state.value=2; history.commit();
  assert.equal(history.info().past, 1); history.undo(); assert.equal(state.value, 0);
  history.redo(); assert.equal(state.value, 2); history.undo();
  history.begin(); state.value=3; history.commit(); assert.equal(history.redo(), false);
  for (const value of [4,5,6]) {history.begin(); state.value=value; history.commit();}
  assert.equal(history.info().past, 2); history.undo(); history.undo(); assert.equal(state.value,4);
  history.clear(); assert.equal(history.undo(),false);
});

test('session saving is opt-in, coalesces latest settings and reports committed writes', async () => {
  const writes=[], statuses=[];
  const controller=createSessionController({store:{write:async r=>writes.push(r)},snapshot:settingsSnapshot,
    delay:1,onStatus:s=>statuses.push(s)});
  const state=createInitialState(); controller.update(photo,state); await pause(); assert.equal(writes.length,0);
  controller.enable(true); state.caption='latest'; controller.update(photo,state); await pause();
  assert.equal(writes.length,1); assert.equal(writes[0].settings.caption,'latest');
  assert.equal(writes[0].blob,photo); assert.equal(statuses.at(-1),'saved');
});

test('clear wins over an in-flight save and cancels pending timers', async () => {
  let release, stored=null;
  const store={write:r=>new Promise(resolve=>{release=()=>{stored=r;resolve();};}),clear:async()=>{stored=null;}};
  const controller=createSessionController({store,snapshot:settingsSnapshot,delay:1});
  controller.update(photo,createInitialState()); controller.enable(true); await pause();
  const clearing=controller.clear(); release(); await clearing; await pause();
  assert.equal(stored,null); assert.equal(controller.enabled(),false);
  controller.enable(true); controller.update(photo,createInitialState()); await controller.clear(); await pause();
  assert.equal(stored,null);
});

test('storage errors preserve the previous record and never report saved', async () => {
  const previous=record(), statuses=[];
  const controller=createSessionController({store:{read:async()=>previous,write:async()=>{throw Error('QuotaExceededError');}},
    snapshot:settingsSnapshot,delay:1,onStatus:s=>statuses.push(s)});
  await controller.restore(); controller.update(photo,{caption:'new'}); await pause();
  assert.equal(statuses.at(-1),'error'); assert.equal(statuses.includes('saved'),false);
  assert.equal(previous.settings.caption,'');
});

test('restore rejects corrupt records, storage failures and stale reads', async () => {
  for(const value of [{}, {...record(),version:99}, {...record(),blob:new Blob([])}]) {
    const controller=createSessionController({store:{read:async()=>value},snapshot:settingsSnapshot});
    assert.equal(await controller.restore(),null); assert.equal(controller.enabled(),false);
  }
  let release;
  const controller=createSessionController({store:{read:()=>new Promise(r=>{release=r;})},snapshot:settingsSnapshot});
  const restoring=controller.restore(); await Promise.resolve(); controller.cancelRestore(); release(record());
  assert.equal(await restoring,null);
  const failed=createSessionController({store:{read:async()=>{throw Error('denied');}},snapshot:settingsSnapshot});
  assert.equal(await failed.restore(),null);
});

test('editing during deletion still reports deletion complete', async () => {
  let finish;
  const statuses=[];
  const controller=createSessionController({store:{clear:()=>new Promise(resolve=>{finish=resolve;})},
    snapshot:settingsSnapshot,onStatus:s=>statuses.push(s)});
  const clearing=controller.clear(); await Promise.resolve();
  controller.update(photo,{caption:'still editing'});
  finish(); await clearing;
  assert.equal(statuses.at(-1),'off');
});
