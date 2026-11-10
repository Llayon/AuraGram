'use strict';
const { chromium, webkit, devices } = require('@playwright/test');
const path = require('node:path');
const expectedVersion = require('../package.json').version;
const site = new URL(process.argv[2] || 'https://llayon.github.io/AuraGram/');
if (site.protocol !== 'https:') throw new Error('Published-site verification requires HTTPS');

async function verifyContrast(page) {
  const png = await page.evaluate(() => {
    const c=document.createElement('canvas');c.width=c.height=128;
    const x=c.getContext('2d');x.fillStyle='rgb(96,96,96)';x.fillRect(0,0,128,128);return c.toDataURL().split(',')[1];
  });
  await page.setInputFiles('#fileInput',{name:'contrast.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(()=>window.AuraGram.loadState.status==='ready');
  await page.locator('#btnReset').click();await page.locator('[data-tab="adjust"]').click();
  await page.locator('[data-adjustment="contrast"]').click();
  await page.locator('#mainSlider').evaluate(el=>{el.value=50;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>document.getElementById('mainCanvas').getContext('2d').getImageData(64,64,1,1).data[0]<82);
  await page.locator('#btnExport').click();await page.waitForFunction(()=>!!window.AuraGram.getExportBlob());
  const result=await page.evaluate(async()=>{
    const url=URL.createObjectURL(window.AuraGram.getExportBlob());
    try {const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});
      const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.drawImage(img,0,0);
      return {preview:document.getElementById('mainCanvas').getContext('2d').getImageData(64,64,1,1).data[0],
        exported:x.getImageData(64,64,1,1).data[0],backend:window.AuraGram.stats.canvasFilterBackend};
    }finally{URL.revokeObjectURL(url);}
  });
  if(result.preview<79||result.preview>81||result.exported!==result.preview)throw new Error('Live contrast failed: '+JSON.stringify(result));
  await page.locator('#btnCloseModal').click();await page.locator('#btnUndo').click();await page.locator('#btnUndo').click();
  return result;
}

async function verify(name, engine, options) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage(options);
    const errors = [], uploads = [], assetRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const asset = new URL(request.url());
      if(asset.origin===site.origin && asset.pathname.includes('/src/') && /\.(?:js|mjs|css)$/.test(asset.pathname)) assetRequests.push(asset);
      if (['POST','PUT','PATCH'].includes(request.method()) && request.postData()) uploads.push(request.url());
    });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin === site.origin || ['blob:','data:'].includes(url.protocol)
        ? route.continue() : route.abort();
    });
    const url = new URL(site);
    url.searchParams.set('verify', Date.now().toString());
    const response = await page.goto(url.href, {timeout:60000});
    if (!response?.ok()) throw new Error('Published page failed: '+response?.status());
    await page.waitForFunction(() => !!window.AuraGram);
    const version = await page.evaluate(() => ({runtime:window.AuraGram.version,
      html:document.querySelector('meta[name="auragram-version"]')?.content}));
    if (version.runtime !== expectedVersion || version.html !== expectedVersion) {
      throw new Error('Published version mismatch: '+JSON.stringify({expectedVersion,...version}));
    }
    const contrast = await verifyContrast(page);
    await page.setInputFiles('#fileInput',path.join(__dirname,'../tests/fixtures/edge-source.jpg'));
    await page.waitForFunction(() => window.AuraGram.loadState.status === 'ready');
    await page.waitForFunction(() => ['ready','no_face','failed','unsupported'].includes(window.AuraGram.face.status()),null,{timeout:120000});
    if (await page.evaluate(() => window.AuraGram.face.status()) !== 'ready') throw new Error('Live face detection did not become ready');
    await page.locator('[data-tab="beauty"]').click();
    await page.locator('#tab-beauty button').last().click();
    for (const [id,value] of [['lashDensity',50],['lashLength',30],['lashDefinition',40]]) {
      await page.locator('#'+id).evaluate((el,value) => {el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
    }
    await page.waitForFunction(() => window.AuraGram.stats.retouchRan.includes('lashes'),null,{timeout:60000});
    // Finish the synthetic slider gesture before testing the disabled-state UI.
    await page.locator('#lashDefinition').dispatchEvent('change');
    await page.locator('#btnUndo').click();
    if (await page.evaluate(() => Object.values(window.AuraGram.state.lashes).some(Boolean))) throw new Error('Live undo failed');
    await page.locator('#btnRedo').click();
    if (await page.evaluate(() => window.AuraGram.state.lashes.definition) !== 40) throw new Error('Live redo failed');
    await page.locator('#btnCompare').dispatchEvent('pointerdown');
    if (!await page.evaluate(() => window.AuraGram.state.isComparing)) throw new Error('Compare did not start');
    await page.locator('#btnCompare').dispatchEvent('pointercancel');
    if (await page.evaluate(() => window.AuraGram.state.isComparing)) throw new Error('Compare did not restore the edit');
    await page.locator('#btnExport').click();
    await page.waitForFunction(() => !!window.AuraGram.getExportBlob(),null,{timeout:60000});
    const exported = await page.evaluate(async () => {
      const A=window.AuraGram,blob=A.getExportBlob();
      return {type:blob.type,bytes:blob.size,signature:Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0,8)),
        width:A.stats.exportW,height:A.stats.exportH,faceCount:A.stats.faceCount,passes:A.stats.retouchRan};
    });
    if (exported.type!=='image/png'||exported.signature.join(',')!=='137,80,78,71,13,10,26,10'||exported.faceCount!==1||!exported.passes.includes('lashes')) {
      throw new Error('Invalid live export: '+JSON.stringify(exported));
    }
    const [download] = await Promise.all([page.waitForEvent('download'),page.locator('#btnDownloadImage').click()]);
    const failure = await download.failure();
    if (failure || !download.suggestedFilename().endsWith('.png')) throw new Error('PNG download failed: '+failure);
    await page.locator('#btnCloseModal').click();
    await page.locator('#btnOpenStyles').click();await page.locator('#styleName').fill('Live verification');
    await page.locator('#btnSaveStyle').click();
    await page.waitForFunction(()=>document.getElementById('styleStatus').textContent==='Стиль сохранён на устройстве.');
    await page.locator('#btnCloseStyles').click();
    const savedSettings = await page.evaluate(() => JSON.stringify(window.AuraGramEditorState.settingsSnapshot(window.AuraGram.state)));
    await page.locator('#saveSession').check();
    await page.waitForFunction(() => document.getElementById('sessionStatus').textContent === 'Сохранено на устройстве');
    await page.reload();
    await page.waitForFunction(() => window.AuraGram?.loadState.status === 'ready');
    const restored = await page.evaluate(() => ({settings:JSON.stringify(window.AuraGramEditorState.settingsSnapshot(window.AuraGram.state)),
      history:window.AuraGram.history.info().past, width:document.getElementById('mainCanvas').width}));
    if (restored.settings !== savedSettings || restored.history !== 0 || restored.width !== 864) throw new Error('Live session recovery failed');
    await page.locator('#btnClearSession').click();
    await page.waitForFunction(() => document.getElementById('sessionStatus').textContent === 'Сохранение выключено');
    await page.reload();
    await page.waitForFunction(() => window.AuraGram?.loadState.status === 'error');
    if (await page.locator('#saveSession').isChecked()) throw new Error('Live session deletion failed');
    await page.setInputFiles('#fileInput',path.join(__dirname,'../tests/fixtures/edge-source.jpg'));
    await page.waitForFunction(()=>window.AuraGram.loadState.status==='ready');
    await page.locator('#btnOpenStyles').click();
    await page.getByRole('button',{name:'Применить стиль «Live verification»',exact:true}).click();
    const appliedStyle = await page.evaluate(()=>window.AuraGram.state.lashes.definition);
    if(appliedStyle!==40)throw new Error('Live style recovery failed');
    if(assetRequests.some(asset=>asset.searchParams.get('v')!==expectedVersion))throw new Error('Unversioned first-party asset');
    if (errors.length || uploads.length) throw new Error(JSON.stringify({errors,uploads}));
    console.log(JSON.stringify({browser:name,url:site.href,version:expectedVersion,...exported,download:download.suggestedFilename(),
      contrast,styles:true,history:true,sessionRestored:true,sessionDeleted:true,errors:0,photoUploads:0}));
  } finally {await browser.close();}
}
module.exports = {verifyContrast};
if (require.main === module) (async () => {
  await verify('chromium',chromium,{viewport:{width:1280,height:800}});
  await verify('webkit-mobile',webkit,{...devices['iPhone 11']});
})().catch(error=>{console.error(error);process.exitCode=1;});
