const {test,expect} = require('./app-fixtures.cjs');
const path=require('node:path');
const portrait=path.join(__dirname,'fixtures/portrait.jpg');

async function ready(page) {
  await page.goto('/index.html');
  await page.setInputFiles('#fileInput',portrait);
  await page.waitForFunction(()=>window.AuraGram?.loadState.status==='ready');
}
async function settings(page) { return page.evaluate(()=>window.AuraGramEditorState.settingsSnapshot(window.AuraGram.state)); }
async function save(page) {
  await page.locator('#saveSession').check();
  await expect(page.locator('#sessionStatus')).toHaveText('Сохранено на устройстве');
}

test('history groups slider input, skips UI navigation and synchronizes undo/redo',async({page})=>{
  await ready(page);
  const initial=await settings(page);
  await page.locator('#mainSlider').evaluate(el=>{
    for(const value of [90,70,50]){el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}
    el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  expect(await page.evaluate(()=>window.AuraGram.history.info().past)).toBe(1);
  await page.locator('[data-tab="beauty"]').click();
  await page.locator('#btnUndo').click();
  expect(await settings(page)).toEqual(initial);
  expect(await page.evaluate(()=>window.AuraGram.state.currentTab)).toBe('beauty');
  await page.locator('#btnRedo').click();
  expect((await settings(page)).presetIntensity).toBe(50);
  await page.locator('#btnUndo').click();
  await page.locator('[data-tab="fx"]').click();
  await page.locator('#tab-fx button').first().click();
  await expect(page.locator('#btnRedo')).toBeDisabled();
});

test('preset, caption, frame, autostyle and reset are independent undoable actions',async({page})=>{
  await ready(page);
  const initial=await settings(page);
  await page.locator('#tab-filters button').first().click();
  await page.locator('#btnUndo').click(); expect(await settings(page)).toEqual(initial);
  await page.locator('[data-tab="extras"]').click();
  await page.locator('[data-stamp="cinema"]').click();
  await page.locator('#customCaption').fill('Портрет'); await page.locator('#customCaption').blur();
  const edited=await settings(page);
  await page.locator('#btnReset').click();
  await page.locator('#btnUndo').click(); expect(await settings(page)).toEqual(edited);
  await expect(page.locator('#customCaption')).toHaveValue('Портрет');
  await expect(page.locator('[data-stamp="cinema"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#btnMagicAI').click();
  await page.locator('#btnUndo').click(); expect(await settings(page)).toEqual(edited);
  await page.locator('#btnExport').click();
  await page.waitForFunction(()=>!!window.AuraGram.getExportBlob());
  expect(await page.evaluate(()=>window.AuraGram.getExportBlob().type)).toBe('image/png');
});

test('keyboard history preserves native text editing and does not rerun face detection',async({page})=>{
  await ready(page);
  await page.waitForFunction(()=>['ready','no_face','failed'].includes(window.AuraGram.face.status()));
  const imageId=await page.evaluate(()=>window.AuraGram.face.imageId());
  await page.locator('#tab-filters button').first().click();
  await page.keyboard.press('Control+z');
  expect((await settings(page)).activePreset).toBe('vogue');
  await page.keyboard.press('Control+Shift+z');
  expect((await settings(page)).activePreset).toBe('normal');
  await page.locator('[data-tab="extras"]').click();
  await page.locator('#customCaption').focus();
  await page.keyboard.type('hello');
  const count=await page.evaluate(()=>window.AuraGram.history.info().past);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(()=>window.AuraGram.history.info().past)).toBe(count);
  expect(await page.evaluate(()=>window.AuraGram.face.imageId())).toBe(imageId);
});

test('opt-in session restores the original photo and settings with a fresh history',async({page})=>{
  await ready(page);
  await page.locator('#tab-filters button').first().click();
  await page.locator('[data-tab="extras"]').click();
  await page.locator('[data-stamp="date98"]').click();
  await page.locator('#customCaption').fill('Сессия'); await page.locator('#customCaption').blur();
  const before=await settings(page);
  await save(page); await page.reload();
  await page.waitForFunction(()=>window.AuraGram?.loadState.status==='ready');
  expect(await settings(page)).toEqual(before);
  await expect(page.locator('#saveSession')).toBeChecked();
  await expect(page.locator('#btnUndo')).toBeDisabled();
  await page.waitForFunction(()=>window.AuraGram.face.status()==='ready');
  expect(await page.evaluate(()=>window.AuraGram.face.imageId())).toBe(1);
  expect(await page.locator('#mainCanvas').evaluate(c=>[c.width,c.height])).toEqual([256,320]);
});

test('clear deletes persisted photo, cancels pending saving and survives reload',async({page})=>{
  await ready(page); await save(page);
  await page.locator('#tab-filters button').first().click();
  await page.locator('#btnClearSession').click();
  await expect(page.locator('#sessionStatus')).toHaveText('Сохранение выключено');
  await page.waitForTimeout(650);
  await page.reload();
  await expect(page.locator('#saveSession')).not.toBeChecked();
  await page.waitForFunction(()=>window.AuraGram?.loadState.status==='error');
});

test('new photo clears history only after successful decoding',async({page})=>{
  await ready(page); await page.locator('#tab-filters button').first().click();
  await page.setInputFiles('#fileInput',{name:'broken.png',mimeType:'image/png',buffer:Buffer.from('broken')});
  await page.waitForFunction(()=>window.AuraGram.loadState.status==='error');
  expect(await page.evaluate(()=>window.AuraGram.history.info().past)).toBe(1);
  await page.setInputFiles('#fileInput',portrait);
  await page.waitForFunction(()=>window.AuraGram.loadState.status==='ready');
  await expect(page.locator('#btnUndo')).toBeDisabled();
});

test('unavailable storage leaves editing and export usable',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{value:undefined});});
  await ready(page);
  await page.locator('#saveSession').check();
  await expect(page.locator('#sessionStatus')).toContainText('Не удалось');
  await page.locator('#btnReset').click();
  await page.locator('#btnExport').click();
  await page.waitForFunction(()=>!!window.AuraGram.getExportBlob());
});

test('session controls fit narrow screens and status explains unavailable retouch',async({page})=>{
  await ready(page);
  for(const width of [320,375]) {
    await page.setViewportSize({width,height:667});
    for(const id of ['btnUndo','btnRedo','saveSession','btnClearSession','toolStatus']) {
      const box=await page.locator('#'+id).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(width);
      expect(box.y+box.height).toBeLessThanOrEqual(667);
    }
  }
  // Uniform image reliably produces no face; values remain untouched.
  const before=await settings(page);
  const png=await page.evaluate(async()=>{
    const c=document.createElement('canvas'); c.width=c.height=128;
    c.getContext('2d').fillRect(0,0,128,128); return c.toDataURL().split(',')[1];
  });
  await page.setInputFiles('#fileInput',{name:'blank.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(()=>window.AuraGram.face.status()==='no_face');
  await expect(page.locator('#toolStatus')).toContainText('Лицо не найдено');
  expect(await settings(page)).toEqual(before);
});

test('corrupt records and quota errors do not block editing',async({page})=>{
  await ready(page);
  await page.evaluate(async()=>{
    const store=window.AuraGramSession.createIndexedDBStore(window.indexedDB);
    await store.write({version:99,enabled:true,blob:new Blob(['broken']),settings:{}});
  });
  await page.reload();
  await expect(page.locator('#sessionStatus')).toHaveText('Сохранённая сессия повреждена');
  await page.setInputFiles('#fileInput',portrait);
  await page.waitForFunction(()=>window.AuraGram.loadState.status==='ready');
  await page.evaluate(()=>{
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args){
      if(this.name==='session')throw new DOMException('Full','QuotaExceededError');
      return put.apply(this,args);
    };
  });
  await page.locator('#saveSession').check();
  await expect(page.locator('#sessionStatus')).toContainText('Не удалось');
  await page.locator('#tab-filters button').first().click();
  expect((await settings(page)).activePreset).toBe('normal');
});

test('upload takes precedence over a delayed saved-session read',async({page})=>{
  await ready(page); await save(page);
  const fs=require('node:fs');
  const source=fs.readFileSync(path.join(__dirname,'../src/state/sessionStore.js'),'utf8');
  await page.route('**/src/state/sessionStore.js',route=>route.fulfill({contentType:'text/javascript',body:source+`
    const adapter = window.AuraGramSession.createIndexedDBStore;
    window.AuraGramSession.createIndexedDBStore = (...args) => {
      const store = adapter(...args), read = store.read;
      store.read = async () => { const result = await read(); await new Promise(r=>setTimeout(r,700)); return result; };
      return store;
    };`}));
  await page.reload();
  await page.setInputFiles('#fileInput',path.join(__dirname,'fixtures/edge-source.jpg'));
  await page.waitForFunction(()=>window.AuraGram.loadState.status==='ready');
  await page.waitForTimeout(850);
  expect(await page.locator('#mainCanvas').evaluate(c=>[c.width,c.height])).toEqual([864,1080]);
  expect(await page.evaluate(()=>window.AuraGram.face.imageId())).toBe(1);
  await expect(page.locator('#sessionStatus')).toHaveText('Сохранено на устройстве');
  await page.reload();
  await page.waitForFunction(()=>window.AuraGram?.loadState.status==='ready');
  expect(await page.locator('#mainCanvas').evaluate(c=>[c.width,c.height])).toEqual([864,1080]);
});

test('retouch cache matches fresh renders across grade, size and photo changes',async({page})=>{
  await ready(page);
  await page.waitForFunction(()=>window.AuraGram.face.status()==='ready');
  const differences=await page.evaluate(async()=>{
    const {createRetouchSession}=await import(new URL('src/retouch/retouch.mjs',document.baseURI));
    const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src='tests/fixtures/portrait.jpg';});
    const cached=createRetouchSession(), face=window.AuraGram.retouch.snapshot();
    const canvas=()=>document.createElement('canvas');
    function draw(session,W,H,grade,id) {
      const c=canvas();c.width=W;c.height=H;
      const ctx=c.getContext('2d');ctx.filter=grade;ctx.drawImage(img,0,0,W,H);ctx.filter='none';
      const detailBuffer=canvas(),detailCtx=detailBuffer.getContext('2d');
      session.applyPasses(ctx,W,H,{face:{...face,imageId:id},src:img,gradeFilter:grade,gradeSig:grade,
        beauty:{smooth:60,antired:45,glow:50,eyes:0,blush:0,sculpt:0},lashes:{density:0,length:0,definition:0},
        buffers:{detailBuffer,detailCtx}});
      const bytes=ctx.getImageData(0,0,W,H).data; c.width=c.height=0;return bytes;
    }
    const results=[];
    for(const [W,H,grade,id] of [[256,320,'none',1],[256,320,'none',1],[256,320,'contrast(120%)',1],
      [512,640,'contrast(120%)',1],[256,320,'none',2],[256,320,'none',2]]) {
      const a=draw(cached,W,H,grade,id),b=draw(createRetouchSession(),W,H,grade,id);
      results.push(a.reduce((sum,value,i)=>sum+(value!==b[i]),0));
    }
    return results;
  });
  expect(differences).toEqual([0,0,0,0,0,0]);
});
