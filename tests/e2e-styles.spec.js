const {test,expect}=require('./app-fixtures.cjs');
const path=require('node:path');
async function ready(page){await page.goto('/index.html');await page.setInputFiles('#fileInput',path.join(__dirname,'fixtures/portrait.jpg'));
  await page.waitForFunction(()=>window.AuraGram?.loadState.status==='ready');}
async function open(page){await page.locator('#btnOpenStyles').click();await expect(page.locator('#styleDialog')).toBeVisible();}
async function save(page,name){await page.locator('#styleName').fill(name);await page.locator('#btnSaveStyle').click();await expect(page.locator('#styleStatus')).toHaveText('Стиль сохранён на устройстве.');}
const settings=page=>page.evaluate(()=>window.AuraGramEditorState.settingsSnapshot(window.AuraGram.state));

test('saved style survives reload, applies in one undo step and retains the current caption',async({page})=>{
  await ready(page);await page.locator('#tab-filters button').first().click();
  await page.locator('[data-tab="extras"]').click();await page.locator('[data-stamp="cinema"]').click();
  await page.locator('#customCaption').fill('Не сохранять');await page.locator('#customCaption').blur();
  const saved=await settings(page);await open(page);await save(page,'Мягкий портрет');
  await page.locator('#btnCloseStyles').click();await page.reload();
  await page.setInputFiles('#fileInput',path.join(__dirname,'fixtures/portrait.jpg'));
  await page.waitForFunction(()=>window.AuraGram.loadState.status==='ready');
  const before=await settings(page),count=await page.evaluate(()=>window.AuraGram.history.info().past);
  await open(page);await page.getByRole('button',{name:'Применить стиль «Мягкий портрет»',exact:true}).click();
  const actual=await settings(page);expect(actual).toEqual({...saved,caption:before.caption});
  expect(await page.evaluate(()=>window.AuraGram.history.info().past)).toBe(count+1);
  await expect(page.locator('#styleDialog')).not.toBeVisible();
  await page.locator('#btnUndo').click();expect(await settings(page)).toEqual(before);
  await page.locator('#btnRedo').click();expect(await settings(page)).toEqual(actual);
});

test('rename, update and delete change the library without editing the photo',async({page})=>{
  await ready(page);await open(page);await save(page,'Один');
  await page.getByRole('button',{name:'Переименовать стиль «Один»',exact:true}).click();
  await page.locator('#styleName').fill('Два');await page.locator('#btnSaveStyle').click();
  await expect(page.getByRole('button',{name:'Применить стиль «Два»',exact:true})).toBeVisible();
  await page.locator('#btnCloseStyles').click();await page.locator('#btnReset').click();
  const current=await settings(page),count=await page.evaluate(()=>window.AuraGram.history.info().past);
  await open(page);await page.getByRole('button',{name:'Обновить стиль «Два» текущими настройками',exact:true}).click();
  await expect(page.locator('#styleStatus')).toHaveText('Настройки стиля обновлены.');
  await page.locator('#btnCloseStyles').click();
  await page.locator('#tab-filters button').nth(1).click();await open(page);
  await page.getByRole('button',{name:'Применить стиль «Два»',exact:true}).click();expect(await settings(page)).toEqual(current);
  await open(page);const before=await settings(page),past=await page.evaluate(()=>window.AuraGram.history.info().past);
  await page.getByRole('button',{name:'Удалить стиль «Два»',exact:true}).click();
  await expect(page.locator('#styleList')).toContainText('Пока нет');
  expect(await settings(page)).toEqual(before);expect(await page.evaluate(()=>window.AuraGram.history.info().past)).toBe(past);
  expect(count).toBeGreaterThanOrEqual(1);
});

test('duplicate names are rejected and markup names remain literal text',async({page})=>{
  await ready(page);await open(page);await save(page,'Портрет');
  await page.locator('#styleName').fill('ПОРТРЕТ');await page.locator('#btnSaveStyle').click();
  await expect(page.locator('#styleStatus')).toContainText('уже есть');
  await save(page,'<img src=x onerror=alert(1)>');expect(await page.locator('#styleList img').count()).toBe(0);
  expect(await page.locator('#styleList .style-row').count()).toBe(2);
});

test('storage denial and quota failure keep photo editing available and preserve saved styles',async({page})=>{
  await ready(page);await open(page);await save(page,'Есть');
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){
    if(key==='auragram.styles.v1')throw new DOMException('Full','QuotaExceededError');return set.call(this,key,value);
  };});
  await page.locator('#styleName').fill('Нет');await page.locator('#btnSaveStyle').click();
  await expect(page.locator('#styleStatus')).toContainText('Не хватает места');
  expect(await page.locator('#styleList .style-row').count()).toBe(1);
  await page.locator('#btnCloseStyles').click();await page.locator('#btnReset').click();
  await page.evaluate(()=>Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Denied','SecurityError');}}));
  await open(page);await expect(page.locator('#styleStatus')).toContainText('недоступно');
  await page.locator('#btnCloseStyles').click();await page.locator('#btnExport').click();
  await page.waitForFunction(()=>!!window.AuraGram.getExportBlob());
});

test('invalid library can only be replaced by explicit clearing and session deletion keeps styles',async({page})=>{
  await ready(page);await page.evaluate(()=>localStorage.setItem('auragram.styles.v1','{broken'));await open(page);
  await expect(page.locator('#btnSaveStyle')).toBeDisabled();await expect(page.locator('#styleStatus')).toContainText('повреждена');
  await page.locator('#btnResetStyleLibrary').click();await save(page,'Новый');await page.locator('#btnCloseStyles').click();
  await page.locator('#btnClearSession').click();await expect(page.locator('#sessionStatus')).toHaveText('Сохранение выключено');
  await open(page);await expect(page.getByRole('button',{name:'Применить стиль «Новый»',exact:true})).toBeVisible();
});

test('style dialog fits 320px, scrolls long libraries and restores keyboard focus',async({page})=>{
  await ready(page);await page.evaluate(()=>{
    const library=window.AuraGramStyles.createStyleLibrary({getStorage:()=>localStorage,snapshot:window.AuraGramEditorState.settingsSnapshot});
    for(let i=0;i<20;i++)library.add('Стиль '+i,window.AuraGram.state);
  });
  await page.setViewportSize({width:320,height:568});await open(page);
  const box=await page.locator('#styleDialog').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320);
  expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(568);
  await page.getByRole('button',{name:'Применить стиль «Стиль 19»',exact:true}).click();
  await expect(page.locator('#btnOpenStyles')).toBeFocused();
  await open(page);await page.keyboard.press('Escape');await expect(page.locator('#styleDialog')).not.toBeVisible();
});
