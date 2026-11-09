const {test,expect}=require('./app-fixtures.cjs');
const path=require('node:path');
const portrait=path.join(__dirname,'fixtures/portrait.jpg');

async function upload(page,file=portrait) {
  await page.setInputFiles('#fileInput',file);
  await page.waitForFunction(()=>window.AuraGram.loadState.status==='ready');
}

test('export waits for retouch and retains the settings captured at click',async({page})=>{
  let release;
  const gate=new Promise(r=>release=r);
  await page.route('**/src/retouch/retouch.mjs',async route=>{await gate;await route.continue();});
  try {
    await page.goto('/index.html');
    await upload(page);
    await page.waitForFunction(()=>window.AuraGram.face.status()==='ready');
    await page.evaluate(()=>{
      const A=window.AuraGram; A.resetAll(); A.state.beauty.blush=100;
      window.expectedExportState=structuredClone(A.state); A.renderStudioCanvas();
    });
    await page.locator('#btnExport').click();
    await expect(page.locator('#btnExport')).toHaveAttribute('aria-busy','true');
    expect(await page.evaluate(()=>window.AuraGram.getExportBlob())).toBeNull();
    await page.evaluate(()=>window.AuraGram.state.adjustments.brightness=50);
    release();
    await page.waitForFunction(()=>!!window.AuraGram.getExportBlob());
    const diff=await page.evaluate(async()=>{
      const A=window.AuraGram;
      const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src='/tests/fixtures/portrait.jpg';});
      const actual=await createImageBitmap(A.getExportBlob());
      const c=document.createElement('canvas');c.width=actual.width;c.height=actual.height;
      const x=c.getContext('2d');x.drawImage(actual,0,0);actual.close();
      const before=x.getImageData(0,0,c.width,c.height).data;
      A.renderImage(x,c.width,c.height,img,window.expectedExportState,A.retouch.snapshot());
      const after=x.getImageData(0,0,c.width,c.height).data;
      let max=0;for(let i=0;i<before.length;i++)max=Math.max(max,Math.abs(before[i]-after[i]));
      return max;
    });
    expect(diff).toBe(0);
  } finally {release();}
});

test('photo change during PNG encoding cancels export and invalidates old geometry before paint',async({page})=>{
  await page.goto('/index.html');await upload(page);
  await page.waitForFunction(()=>window.AuraGram.face.status()==='ready');
  await page.evaluate(()=>{
    const A=window.AuraGram;A.resetAll();
    const original=HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob=function(...args){
      window.releaseEncoding=()=>{HTMLCanvasElement.prototype.toBlob=original;original.apply(this,args);};
    };
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    let previousSource;
    CanvasRenderingContext2D.prototype.drawImage=function(source,...args){
      if(this.canvas.id==='mainCanvas'&&source instanceof HTMLImageElement){
        if(previousSource&&source!==previousSource&&window.firstNewPhotoSnapshot===undefined){
          window.firstNewPhotoSnapshot=A.retouch.snapshot();
        }
        previousSource=source;
      }
      return draw.call(this,source,...args);
    };
    A.renderStudioCanvas();
  });
  await page.locator('#btnExport').click();
  await page.waitForFunction(()=>!!window.releaseEncoding);
  await page.locator('#btnExport').dispatchEvent('click');
  await upload(page,path.join(__dirname,'fixtures/edge-source.jpg'));
  expect(await page.evaluate(()=>window.firstNewPhotoSnapshot)).toBeNull();
  await page.evaluate(()=>window.releaseEncoding());
  await expect(page.locator('#btnExport')).not.toHaveAttribute('aria-busy','true');
  expect(await page.evaluate(()=>window.AuraGram.getExportBlob())).toBeNull();
  await expect(page.locator('#exportModal')).toBeHidden();
});

test('PNG encoding failure restores controls and allows retry',async({page})=>{
  await page.goto('/index.html');await upload(page);
  await page.evaluate(()=>{
    window.AuraGram.resetAll();const original=HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob=function(callback){HTMLCanvasElement.prototype.toBlob=original;callback(null);};
  });
  await page.locator('#btnExport').click();
  await expect(page.locator('#btnExport')).toBeEnabled();
  expect(await page.evaluate(()=>window.AuraGram.getExportBlob())).toBeNull();
  await page.locator('#btnExport').click();
  await page.waitForFunction(()=>!!window.AuraGram.getExportBlob());
});

test('delayed face analysis follows rapid photo changes and export waits for the final photo',async({page})=>{
  let release,seen=false;
  const gate=new Promise(resolve=>release=resolve);
  await page.route('**/face_landmarker.task',async route=>{seen=true;await gate;await route.continue();});
  try {
    await page.goto('/index.html');await upload(page);
    await expect.poll(()=>seen).toBe(true);
    await upload(page,path.join(__dirname,'fixtures/edge-source.jpg'));
    await upload(page);
    await page.locator('#btnExport').click();
    await expect(page.locator('#btnExport')).toHaveAttribute('aria-busy','true');
    expect(await page.evaluate(()=>window.AuraGram.getExportBlob())).toBeNull();
    release();
    await page.waitForFunction(()=>!!window.AuraGram.getExportBlob());
    const final=await page.evaluate(async()=>{
      const A=window.AuraGram,bitmap=await createImageBitmap(A.getExportBlob());
      const result={status:A.face.status(),currentId:A.face.imageId(),geometryId:A.face.store().imageId,
        width:bitmap.width,height:bitmap.height,sourceW:A.face.store().width,sourceH:A.face.store().height};
      bitmap.close();return result;
    });
    expect(final.status).toBe('ready');expect(final.geometryId).toBe(final.currentId);
    expect(final.width).toBe(final.sourceW);expect(final.height).toBe(final.sourceH);
    await expect(page.locator('#exportMeta')).not.toContainText('локальная ретушь недоступна');
  } finally {release();}
});
