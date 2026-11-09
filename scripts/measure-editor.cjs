'use strict';
const { chromium } = require('@playwright/test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'test-results', 'measurements');

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = spawn(process.execPath, [path.join(root, 'tests/static-server.cjs'), '8143'], {
    windowsHide: true, stdio: ['ignore','pipe','pipe']
  });
  let browser;
  const fixture = path.join(out, 'large.jpg');
  try {
    await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error('server exit '+code)));});
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: {width:1280,height:800} });
    await page.route('https://**/*', route=>route.abort());
    await page.addInitScript(()=>{
      window.auditCanvases = [];
      const create = document.createElement.bind(document);
      document.createElement = function(name,...args) {
        const el = create(name,...args);
        if(String(name).toLowerCase()==='canvas')window.auditCanvases.push(new WeakRef(el));
        return el;
      };
    });
    await page.goto('http://127.0.0.1:8143/index.html');
    const jpg = await page.evaluate(async()=>{
      const img = await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src='/tests/fixtures/edge-source.jpg';});
      const c=document.createElement('canvas');c.width=3000;c.height=2400;
      const x=c.getContext('2d');x.fillStyle='#2a2033';x.fillRect(0,0,3000,2400);x.drawImage(img,1500,200,1200,1500);
      const data=c.toDataURL('image/jpeg',.85);c.width=c.height=0;return data.split(',')[1];
    });
    fs.writeFileSync(fixture,Buffer.from(jpg,'base64'));
    await page.setInputFiles('#fileInput',fixture);
    await page.waitForFunction(()=>window.AuraGram.loadState.status==='ready');
    await page.waitForFunction(()=>window.AuraGram.face.status()==='ready',null,{timeout:60000});
    await page.evaluate(()=>{
      const A=window.AuraGram; A.resetAll();
      for(const key of Object.keys(A.state.beauty))A.state.beauty[key]=60;
      A.state.lashes={density:50,length:30,definition:40};A.renderStudioCanvas();
    });
    await page.waitForFunction(()=>window.AuraGram.retouch.ready());
    const preview = await page.evaluate(()=>{
      const A=window.AuraGram,values=[];A.renderStudioCanvas();
      for(let i=0;i<5;i++){const t=performance.now();A.renderStudioCanvas();values.push(performance.now()-t);}
      values.sort((a,b)=>a-b);return {samples:values,medianMs:values[2]};
    });
    await page.locator('#btnExport').click();
    await page.waitForFunction(()=>!!window.AuraGram.getExportBlob(),null,{timeout:45000});
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.collectGarbage');
    const report = await page.evaluate(preview=>{
      const A=window.AuraGram;
      const canvases=new Set([...document.querySelectorAll('canvas'),...window.auditCanvases.map(ref=>ref.deref()).filter(Boolean)]);
      const canvasRgbaBytes=[...canvases].reduce((n,c)=>n+c.width*c.height*4,0);
      return {date:new Date().toISOString(),browser:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,
        source:{width:3000,height:2400,estimatedDecodedRgbaBytes:3000*2400*4},
        preview,stats:{...A.stats},pngBytes:A.getExportBlob().size,
        memory:{retainedCanvasCount:canvases.size,estimatedCanvasRgbaBytes:canvasRgbaBytes,
          exportCanvasRgbaBytes: A.stats.exportW*A.stats.exportH*4,
          jsHeapBytes:performance.memory?.usedJSHeapSize??null,
          note:'RGBA estimates are dimensions × 4, not measured process RSS. JS heap may be rounded. GPU, codecs and MediaPipe native/WASM memory are not included.'}};
    },preview);
    fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(report,null,2));
    await page.locator('#btnCloseModal').click();
    await page.waitForFunction(()=>document.getElementById('toastMsg').classList.contains('opacity-0'));
    await page.screenshot({path:path.join(out,'desktop.png')});
    await page.setViewportSize({width:375,height:667});
    await page.locator('[data-tab="beauty"]').click();
    await page.locator('#tab-beauty button').last().click();
    await page.screenshot({path:path.join(out,'mobile-lashes.png')});
    console.log(JSON.stringify(report,null,2));
  } finally {
    if(browser)await browser.close();
    server.kill();
    if(fs.existsSync(fixture))fs.unlinkSync(fixture);
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
