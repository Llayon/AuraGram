import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium, webkit} from '@playwright/test';

const [jpeg, expectedWidth, expectedHeight] = process.argv.slice(2);
if (!jpeg || !expectedWidth || !expectedHeight) throw Error('Supply a development JPEG and its verified width and height');
const viewer = pathToFileURL(path.resolve('tests/visual/lash-development-review-picker.html')).href;
for (const engine of [chromium,webkit]) {
  const browser = await engine.launch({timeout:15000});
  try {
    const page = await browser.newPage({viewport:{width:1100,height:850}});
    await page.route(/^https?:/, route=>route.abort());
    await page.goto(viewer);
    await page.locator('#source').setInputFiles(jpeg);
    await page.locator('#stage').waitFor({state:'visible'});
    const photo = page.locator('#photo');
    const size = await photo.evaluate(img=>[img.naturalWidth,img.naturalHeight]);
    assert.deepEqual(size,[Number(expectedWidth),Number(expectedHeight)]);
    const target=[Math.floor(size[0]/2),Math.floor(size[1]/2)];
    const clickNative = async (x,y) => {
      const box=await photo.boundingBox();
      await page.mouse.click(box.x+(x+.5)*box.width/size[0],box.y+(y+.5)*box.height/size[1]);
    };
    const points = async () => JSON.parse(await page.locator('#points').inputValue());
    await clickNative(...target);
    const [mapped]=await points();
    const fitBox=await photo.boundingBox();
    assert.ok(mapped.every((value,i)=>Math.abs(value-target[i])<=Math.ceil(size[0]/fitBox.width)));
    await page.locator('#clear').click();
    await page.locator('#actual').click();
    const zoomCenter = await page.locator('#viewport').evaluate(vp=>[vp.scrollLeft+vp.clientWidth/2,vp.scrollTop+vp.clientHeight/2]);
    assert.ok(zoomCenter.every((value,i)=>Math.abs(value-target[i])<=25));
    await page.locator('#viewport').evaluate((vp,[x,y])=>{vp.scrollLeft=x-100;vp.scrollTop=y-100;},target);
    await clickNative(...target);
    await clickNative(target[0]+10,target[1]+10);
    await clickNative(target[0]+20,target[1]);
    assert.deepEqual(await points(),[target,[target[0]+10,target[1]+10],[target[0]+20,target[1]]]);
    await page.locator('#close-polygon').check();
    assert.equal(await page.locator('#overlay polygon').count(),1);
    assert.equal((await points()).length,3);
    await page.locator('#undo').click();
    assert.deepEqual(await points(),[target,[target[0]+10,target[1]+10]]);
    await page.locator('#select').click();
    assert.equal(await page.locator('#points').evaluate(element=>element.selectionEnd-element.selectionStart),
      (await page.locator('#points').inputValue()).length);
    console.log(`${engine.name()}: offline source, fit/native coordinates, polygon and undo PASS`);
  } finally { await browser.close(); }
}
