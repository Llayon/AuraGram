'use strict';
const { spawn } = require('node:child_process');
const { chromium, webkit, devices } = require('@playwright/test');
const { verifyContrast } = require('./check-live.cjs');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const expectedVersion = require('../package.json').version;
async function main() {
  const dist = path.join(root,'dist');
  if(!fs.existsSync(path.join(dist,'index.html')))throw new Error('Build the site with npm run build and npm run package:site first');
  const server=spawn(process.execPath,[path.join(root,'tests/static-server.cjs'),'0',dist],{
    cwd:root,windowsHide:true,stdio:['ignore','pipe','inherit']
  });
  let browser;
  try{
    const url=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Server startup timed out')),15000);
      server.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
      server.once('error',error=>{clearTimeout(timer);reject(error);});
      server.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code));});
    });
    for(const [name,engine,options] of [['chromium',chromium,{}],['webkit-mobile',webkit,devices['iPhone 11']]]) {
    browser=await engine.launch();
    const page=await browser.newPage(options);
    const errors=[];
    const assets=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{const asset=new URL(request.url());if(asset.pathname.includes('/src/')&&/\.(?:js|mjs|css)$/.test(asset.pathname))assets.push(asset);});
    await page.route('https://**/*',route=>route.abort());
    await page.goto(url+'/index.html');
    const contrast=await verifyContrast(page);
    await page.setInputFiles('#fileInput',path.join(root,'tests/fixtures/portrait.jpg'));
    await page.waitForFunction(()=>window.AuraGram?.loadState.status==='ready');
    await page.waitForFunction(()=>window.AuraGram.face.status()==='ready',null,{timeout:60000});
    await page.locator('#btnExport').click();
    await page.waitForFunction(()=>!!window.AuraGram.getExportBlob(),null,{timeout:45000});
    const image=await page.evaluate(async()=>{
      const A=window.AuraGram,blob=A.getExportBlob();
      return {version:A.version,htmlVersion:document.querySelector('meta[name="auragram-version"]')?.content,
        type:blob.type,head:Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0,8)),
        faceCount:A.stats.faceCount,retouch:A.stats.retouchRan};
    });
    if(errors.length||image.version!==expectedVersion||image.htmlVersion!==expectedVersion||image.type!=='image/png'||image.head.join(',')!=='137,80,78,71,13,10,26,10'||image.faceCount!==1||!image.retouch||assets.some(asset=>asset.searchParams.get('v')!==expectedVersion)){
      throw new Error(JSON.stringify({errors,image}));
    }
    console.log('Packaged site '+name+': versioned modules, contrast '+contrast.preview+'/'+contrast.exported+' ('+contrast.backend+'), real face detection, retouch and PNG export passed.');
    await browser.close();browser=null;
    }
  }finally{if(browser)await browser.close();server.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
