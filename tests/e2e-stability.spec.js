const { test, expect } = require('./app-fixtures.cjs');

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.AuraGram);
});

test('negative Noir saturation retains the same grade as zero saturation', async ({ page }) => {
  const samples = await page.evaluate(() => {
    const A = window.AuraGram;
    const source = document.createElement('canvas'); source.width = source.height = 64;
    const sx = source.getContext('2d'); sx.fillStyle = '#dd6444'; sx.fillRect(0, 0, 64, 64);
    return [0, -1, -50, -100].map(value => {
      const st = A.createNeutralState(); st.activePreset = 'noir'; st.adjustments.saturate = value;
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'); A.renderImage(x, 64, 64, source, st, null);
      return Array.from(x.getImageData(32, 32, 1, 1).data);
    });
  });
  for (const sample of samples.slice(1)) expect(sample).toEqual(samples[0]);
});

test('all preset and saturation combinations produce accepted canvas grades',async({page})=>{
  const rejected=await page.evaluate(()=>{
    const A=window.AuraGram,failures=[];
    const c=document.createElement('canvas');c.width=c.height=32;
    const x=c.getContext('2d');x.fillStyle='#dd6444';x.fillRect(0,0,32,32);
    const source=document.createElement('canvas');source.width=source.height=32;source.getContext('2d').drawImage(c,0,0);
    const descriptor=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,'filter');
    let current;
    Object.defineProperty(x,'filter',{get(){return descriptor.get.call(this);},set(value){
      descriptor.set.call(this,value);
      if(value.includes('hue-rotate')&&value.includes('blur')&&descriptor.get.call(this)==='none')failures.push(current);
    }});
    for(const preset of A.PRESETS)for(const intensity of [0,50,100])for(const saturation of [-100,-50,-1,0,50,100]){
      current={preset:preset.id,intensity,saturation};
      const st=A.createNeutralState();st.activePreset=preset.id;st.presetIntensity=intensity;st.adjustments.saturate=saturation;
      A.renderImage(x,32,32,source,st,null);
    }
    return failures;
  });
  expect(rejected).toEqual([]);
});

test('lash definition leaves skin above the lash band untouched', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { applyLashPass } = await import('/src/retouch/lashEnhancement.mjs');
    const c = document.createElement('canvas'); c.width = c.height = 100;
    const x = c.getContext('2d'); x.fillStyle = '#668899'; x.fillRect(0, 0, 100, 100);
    const read = y => Array.from(x.getImageData(50, y, 1, 1).data);
    const before = read(30), bandBefore = read(52);
    const desc = { usable: true, roi: { x0: 0, y0: 0, x1: 1, y1: 1 }, w: .6, h: .2,
      upperLid: [{x:.2,y:.6},{x:.5,y:.55},{x:.8,y:.6}], brow: {x:.5,y:.1} };
    applyLashPass(x, 100, 100, {left:desc,right:null}, {left:{confidence:1,rw:100,rh:100}},
      {density:0,length:0,definition:100}, {});
    return {before, after:read(30), bandBefore, bandAfter:read(52)};
  });
  expect(result.after).toEqual(result.before);
  expect(result.bandAfter).not.toEqual(result.bandBefore);
});

test('inner corners are protected on both tilted eyes', async ({page})=>{
  const sides=await page.evaluate(async()=>{
    const {applyLashPass}=await import('/src/retouch/lashEnhancement.mjs');
    return ['left','right'].map(side=>{
      const c=document.createElement('canvas');c.width=c.height=720;
      const x=c.getContext('2d');x.fillStyle='#668899';x.fillRect(0,0,720,720);
      const read=(nx,ny)=>Array.from(x.getImageData(Math.round(nx*720),Math.round(ny*720),1,1).data);
      const desc={usable:true,roi:{x0:0,y0:0,x1:1,y1:1},w:.6,h:.2,
        upperLid:[{x:.2,y:.56},{x:.5,y:.55},{x:.8,y:.64}],brow:{x:.5,y:.1}};
      const leftBefore=read(.23,.54),rightBefore=read(.77,.60);
      applyLashPass(x,720,720,{[side]:desc},{[side]:{confidence:1,rw:100,rh:100}},
        {density:0,length:0,definition:100},{});
      return {side,leftBefore,rightBefore,left:read(.23,.54),right:read(.77,.60)};
    });
  });
  for(const eye of sides){
    if(eye.side==='left'){expect(eye.left).toEqual(eye.leftBefore);expect(eye.right).not.toEqual(eye.rightBefore);}
    else{expect(eye.right).toEqual(eye.rightBefore);expect(eye.left).not.toEqual(eye.leftBefore);}
  }
});

test('lash length and stroke width scale with export resolution',async({page})=>{
  const bounds=await page.evaluate(async()=>{
    const {applyLashPass}=await import('/src/retouch/lashEnhancement.mjs');
    return [720,1440].map(size=>{
      const c=document.createElement('canvas');c.width=c.height=size;
      const x=c.getContext('2d');x.fillStyle='#668899';x.fillRect(0,0,size,size);
      const desc={usable:true,roi:{x0:0,y0:0,x1:1,y1:1},w:.6,h:.2,
        upperLid:[{x:.2,y:.6},{x:.5,y:.55},{x:.8,y:.6}],brow:{x:.5,y:.1}};
      applyLashPass(x,size,size,{left:desc},{left:{confidence:1,rw:100,rh:100,
        tips:[{x:.5,y:.52,dx:0,dy:-1,c:1}]}},{density:0,length:100,definition:0},{});
      const d=x.getImageData(0,0,size,size).data;
      let x0=size,y0=size,x1=0,y1=0,count=0;
      for(let iy=0;iy<size;iy++)for(let ix=0;ix<size;ix++){
        const i=(iy*size+ix)*4;if(d[i]===102&&d[i+1]===136&&d[i+2]===153)continue;
        count++;x0=Math.min(x0,ix);x1=Math.max(x1,ix);y0=Math.min(y0,iy);y1=Math.max(y1,iy);
      }
      return {count,bounds:[x0/size,y0/size,x1/size,y1/size]};
    });
  });
  for(const b of bounds)expect(b.count).toBeGreaterThan(0);
  bounds[0].bounds.forEach((v,i)=>expect(Math.abs(v-bounds[1].bounds[i])).toBeLessThan(.003));
});
