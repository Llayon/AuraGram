const { test, expect } = require('./app-fixtures.cjs');
const path = require('node:path');

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.setInputFiles('#fileInput', path.join(__dirname, 'fixtures/portrait.jpg'));
  await page.waitForFunction(() => window.AuraGram?.loadState.status === 'ready');
});

test('offline UI has local styling, readable icons and a usable lash panel', async ({ page }) => {
  await expect(page.locator('#exportModal')).toBeHidden();
  await page.getByRole('button', {name:'Бьюти', exact:true}).click();
  await page.getByRole('button', {name:/Ресницы/}).click();
  await expect(page.locator('#lashPanel')).toBeVisible();
  for (const id of ['lashDensity','lashLength','lashDefinition']) {
    await expect(page.locator('#'+id)).toBeVisible();
    const box = await page.locator('#'+id).boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
  }
  const ui = await page.evaluate(async () => {
    const text = 'AuraGram Портрет';
    const icon = getComputedStyle(document.querySelector('i.ph-fill'), '::before').content.replaceAll('"','');
    await document.fonts.load('400 12px Inter', text);
    await document.fonts.load('12px Phosphor-Fill', icon);
    await document.fonts.ready;
    return {display:getComputedStyle(document.body).display,
      inter:document.fonts.check('400 12px Inter', text),
      icon:document.fonts.check('12px Phosphor-Fill', icon)};
  });
  expect(ui).toEqual({display:'flex',inter:true,icon:true});
});

for (const width of [320,375]) test(`header and compare controls fit at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:667});
  await page.evaluate(()=>{
    window.AuraGram.state.activePreset='normal';
    window.AuraGram.state.lashes={density:50,length:30,definition:40};
    window.AuraGram.renderStudioCanvas();
  });
  for(const selector of ['#btnExport','label[for="fileInput"]','#btnReset','#btnCompare','#btnMagicAI']){
    const box=await page.locator(selector).boundingBox();
    expect(box.x,selector).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width,selector).toBeLessThanOrEqual(width);
  }
});

test('caption field remains reachable and compare restores the edit', async ({ page }) => {
  await page.getByRole('button', {name:'Рамки',exact:true}).click();
  await page.locator('#customCaption').fill('Портрет');
  await expect(page.locator('#customCaption')).toHaveValue('Портрет');
  await page.locator('#customCaption').blur();
  if (page.viewportSize().width <= 640) {
    expect(await page.locator('#customCaption').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  }
  await page.locator('#btnCompare').dispatchEvent('pointerdown');
  expect(await page.evaluate(()=>window.AuraGram.state.isComparing)).toBe(true);
  await page.locator('#btnCompare').dispatchEvent('pointercancel');
  expect(await page.evaluate(()=>window.AuraGram.state.isComparing)).toBe(false);
});

test('offline export produces a downloadable PNG', async ({ page }) => {
  await page.locator('#btnExport').click();
  await page.waitForFunction(()=>!!window.AuraGram.getExportBlob());
  await expect(page.locator('#exportModal')).toBeVisible();
  const signature = await page.evaluate(async ()=>Array.from(new Uint8Array(await window.AuraGram.getExportBlob().arrayBuffer()).slice(0,8)));
  expect(signature).toEqual([137,80,78,71,13,10,26,10]);
  const download = page.waitForEvent('download');
  await page.locator('#btnDownloadImage').click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
});

test('system share receives the completed PNG', async ({ page }) => {
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{
      window.sharedFile={type:data.files[0].type,size:data.files[0].size};
    }});
  });
  await page.locator('#btnExport').click();
  await page.waitForFunction(()=>!!window.AuraGram.getExportBlob());
  await page.locator('#btnShareImage').click();
  const file = await page.evaluate(()=>window.sharedFile);
  expect(file.type).toBe('image/png');
  expect(file.size).toBeGreaterThan(8);
});

for(const viewport of [{width:320,height:568},{width:375,height:667}])test(`export dialog fits ${viewport.width}x${viewport.height}`,async({page})=>{
  await page.setViewportSize(viewport);
  await page.locator('#btnExport').click();
  await page.waitForFunction(()=>!!window.AuraGram.getExportBlob());
  const box=await page.locator('#exportModal > div').boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(15);
  expect(box.y+box.height).toBeLessThanOrEqual(viewport.height-15);
  await page.locator('#btnCloseModal').click();
  await expect(page.locator('#exportModal')).toBeHidden();
});
