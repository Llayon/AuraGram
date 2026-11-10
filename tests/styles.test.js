'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createStyleLibrary,STORAGE_KEY,MAX_STYLES}=require('../src/state/styleLibrary.js');
const {settingsSnapshot,createInitialState}=require('../src/state/editorState.js');
const Filters=require('../src/rendering/canvasFilters.js');
const {versionAssets}=require('../scripts/asset-versions.cjs');
function setup(){let saved=null,count=0;const storage={getItem:()=>saved,setItem:(key,value)=>{saved=value;},removeItem:()=>{saved=null;}};
  return {storage, library:createStyleLibrary({getStorage:()=>storage,snapshot:settingsSnapshot,makeId:()=> 'style-'+(++count)})};}

test('styles persist independent processing settings and never photos, captions or UI state',()=>{
  const {library,storage}=setup(),state=createInitialState();state.caption='Private';state.photo='secret';
  const result=library.add('  Мягкий   портрет  ',state);state.beauty.glow=99;
  const item=library.list()[0];assert.equal(item.name,'Мягкий портрет');assert.equal(item.settings.beauty.glow,38);
  assert.equal('caption' in item.settings,false);assert.equal('photo' in item.settings,false);assert.equal('currentTab' in item.settings,false);
  result.settings.beauty.glow=77;assert.equal(library.list()[0].settings.beauty.glow,38);
  assert.equal(storage.getItem(STORAGE_KEY).includes('Private'),false);
});
test('names are unique after normalization, and empty or oversized names are rejected',()=>{
  const {library}=setup();library.add('Портрет',{});
  for(const name of ['ПОРТРЕТ',' Портрет '])assert.throws(()=>library.add(name,{}),{code:'duplicate-name'});
  for(const name of ['', '   ', 'a'.repeat(33)])assert.throws(()=>library.add(name,{}),{code:'invalid-name'});
  const other=library.add('Другой',{});assert.throws(()=>library.rename(other.id,'портрет'),{code:'duplicate-name'});
  library.rename(other.id,'Новое имя');assert.equal(library.list()[1].name,'Новое имя');
});
test('update and deletion preserve unrelated styles and enforce the library limit',()=>{
  const {library}=setup();for(let i=0;i<MAX_STYLES;i++)library.add('Стиль '+i,{});
  assert.throws(()=>library.add('Переполнение',{}),{code:'library-full'});
  const first=library.list()[0];library.update(first.id,{presetIntensity:42});
  assert.equal(library.list()[0].settings.presetIntensity,42);assert.equal(library.list()[1].settings.presetIntensity,100);
  library.remove(first.id);assert.equal(library.list().length,MAX_STYLES-1);
  assert.throws(()=>library.update(first.id,{}),{code:'missing-style'});library.clear();assert.deepEqual(library.list(),[]);
});
test('quota failure preserves the previous library and corrupt data requires explicit clearing',()=>{
  const {library,storage}=setup();library.add('Сохранённый',{});const original=storage.getItem(STORAGE_KEY);
  const set=storage.setItem;storage.setItem=()=>{const error=new Error();error.name='QuotaExceededError';throw error;};
  assert.throws(()=>library.add('Не сохранится',{}),{code:'storage-full'});assert.equal(storage.getItem(STORAGE_KEY),original);
  storage.setItem=set;storage.setItem(STORAGE_KEY,'{invalid');assert.throws(()=>library.list(),{code:'invalid-library'});
  assert.throws(()=>library.add('No overwrite',{}),{code:'invalid-library'});
  library.clear();library.add('Новый',{});assert.equal(library.list().length,1);
  const denied=createStyleLibrary({getStorage:()=>{throw Error('Denied');},snapshot:settingsSnapshot});
  assert.throws(()=>denied.list(),{code:'storage-unavailable'});
});
test('software contrast and saturation have mathematically verifiable pixel output',()=>{
  const gray=new Uint8ClampedArray([96,96,96,255]);Filters.transformPixels(gray,Filters.compileFilter('contrast(200%)').stages);
  assert.deepEqual(Array.from(gray),[64,64,64,255]);
  const red=new Uint8ClampedArray([200,30,70,120]);Filters.transformPixels(red,Filters.compileFilter('saturate(0%)').stages);
  assert.equal(red[0],red[1]);assert.equal(red[1],red[2]);assert.equal(red[3],120);
});
test('software blur feathers alpha without leaking hidden RGB or changing a zero blur',()=>{
  const W=15,H=15,pixels=new Uint8ClampedArray(W*H*4);const middle=(7*W+7)*4;
  pixels[middle]=255;pixels[middle+3]=255;
  Filters.blurPixels(pixels,W,H,1);
  assert.ok(pixels[middle+3]>0&&pixels[middle+3]<255);assert.ok(pixels[middle+4+3]>0);
  for(let i=0;i<pixels.length;i+=4)if(!pixels[i+3])assert.equal(pixels[i]+pixels[i+1]+pixels[i+2],0);
  const before=pixels.slice();Filters.blurPixels(pixels,W,H,0);assert.deepEqual(pixels,before);
});

test('packaging versions first-party scripts, styles and module imports without rewriting external assets',()=>{
  const html='<script src="./src/app.js"></script><link href="./src/styles.css"><script src="https://example.test/sdk.js"></script>';
  assert.equal(versionAssets(html,'0.5.0',true),'<script src="./src/app.js?v=0.5.0"></script><link href="./src/styles.css?v=0.5.0"><script src="https://example.test/sdk.js"></script>');
  const module="import '../rendering/canvasFilters.js'; import {x} from './skinMask.mjs'; const url=new URL('src/retouch/retouch.mjs',document.baseURI); const worker=new URL('faceWorker.js',import.meta.url);";
  const built=versionAssets(module,'0.5.0');
  assert.ok(built.includes("'../rendering/canvasFilters.js?v=0.5.0'"));assert.ok(built.includes("'./skinMask.mjs?v=0.5.0'"));
  assert.ok(built.includes("'src/retouch/retouch.mjs?v=0.5.0'"));assert.ok(built.includes("'faceWorker.js?v=0.5.0'"));
  assert.equal(versionAssets(built,'0.5.0'),built);
  assert.equal(versionAssets("new URL('https://example.test/lib.js',location.href)",'0.5.0'),"new URL('https://example.test/lib.js',location.href)");
});
