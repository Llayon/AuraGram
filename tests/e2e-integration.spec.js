const {test,expect}=require('./app-fixtures.cjs');
const path=require('node:path');

test('a delayed Telegram SDK does not block editing and initializes when ready',async({page})=>{
  let release;
  const gate=new Promise(resolve=>release=resolve);
  await page.route('https://telegram.org/js/telegram-web-app.js',async route=>{
    await gate;
    await route.fulfill({contentType:'text/javascript',body:`
      window.sdkCalls=[];
      window.Telegram={WebApp:{
        ready:()=>sdkCalls.push('ready'),expand:()=>sdkCalls.push('expand'),
        setHeaderColor:()=>sdkCalls.push('header'),setBackgroundColor:()=>sdkCalls.push('background'),
        HapticFeedback:{impactOccurred:type=>sdkCalls.push('haptic:'+type)}
      }};
    `});
  });
  try{
    await page.goto('/index.html',{waitUntil:'domcontentloaded'});
    await page.setInputFiles('#fileInput',path.join(__dirname,'fixtures/portrait.jpg'));
    await page.waitForFunction(()=>window.AuraGram.loadState.status==='ready');
    await page.locator('#btnCompare').dispatchEvent('pointerdown');
    expect(await page.evaluate(()=>window.AuraGram.state.isComparing)).toBe(true);
    await page.locator('#btnCompare').dispatchEvent('pointercancel');
    expect(await page.evaluate(()=>window.AuraGram.state.isComparing)).toBe(false);
    release();
    await page.waitForFunction(()=>window.sdkCalls?.includes('ready'));
    await page.locator('#btnReset').click();
    expect(await page.evaluate(()=>window.sdkCalls)).toEqual(['ready','expand','header','background','haptic:medium']);
  }finally{release();}
});
