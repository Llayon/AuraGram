'use strict';
const { chromium, webkit, devices } = require('@playwright/test');
const path = require('node:path');
const expectedVersion = require('../package.json').version;
const site = new URL(process.argv[2] || 'https://llayon.github.io/AuraGram/');
if (site.protocol !== 'https:') throw new Error('Published-site verification requires HTTPS');

async function verify(name, engine, options) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage(options);
    const errors = [], uploads = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
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
    if (errors.length || uploads.length) throw new Error(JSON.stringify({errors,uploads}));
    console.log(JSON.stringify({browser:name,url:site.href,version:expectedVersion,...exported,download:download.suggestedFilename(),errors:0,photoUploads:0}));
  } finally {await browser.close();}
}
(async () => {
  await verify('chromium',chromium,{viewport:{width:1280,height:800}});
  await verify('webkit-mobile',webkit,{...devices['iPhone 11']});
})().catch(error=>{console.error(error);process.exitCode=1;});
