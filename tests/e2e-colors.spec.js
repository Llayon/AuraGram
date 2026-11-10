const {test,expect}=require('./app-fixtures.cjs');

test.beforeEach(async({page})=>{await page.goto('/index.html');await page.waitForFunction(()=>!!window.AuraGram);});

test('contrast slider changes real preview and exported PNG pixels',async({page})=>{
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=128;
    const x=c.getContext('2d');x.fillStyle='rgb(96,96,96)';x.fillRect(0,0,128,128);return c.toDataURL().split(',')[1];});
  await page.setInputFiles('#fileInput',{name:'contrast.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(()=>window.AuraGram.loadState.status==='ready');
  await page.locator('#btnReset').click();
  await page.locator('[data-tab="adjust"]').click();
  await page.locator('#tab-adjust button').filter({hasText:'Контраст'}).click();
  const read=()=>page.locator('#mainCanvas').evaluate(c=>Array.from(c.getContext('2d').getImageData(64,64,1,1).data));
  expect(await read()).toEqual([96,96,96,255]);
  await page.locator('#mainSlider').evaluate(el=>{el.value=50;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
  await expect.poll(async()=> (await read())[0]).toBeLessThanOrEqual(81);
  const changed=await read();expect(changed[0]).toBeGreaterThanOrEqual(79);
  await page.locator('#btnExport').click();await page.waitForFunction(()=>!!window.AuraGram.getExportBlob());
  const exported=await page.evaluate(async()=>{
    const url=URL.createObjectURL(window.AuraGram.getExportBlob());
    try{const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});
      const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.drawImage(image,0,0);return Array.from(x.getImageData(64,64,1,1).data);
    }finally{URL.revokeObjectURL(url);}
  });
  expect(exported).toEqual(changed);
});

test('every preset and intensity produces processed pixels in this browser',async({page})=>{
  const results=await page.evaluate(()=>{
    const A=window.AuraGram,source=document.createElement('canvas');source.width=source.height=96;
    const x=source.getContext('2d'),data=x.createImageData(96,96);
    for(let i=0;i<data.data.length;i+=4){const n=i/4;data.data[i]=(n*17)%210+15;data.data[i+1]=(n*31)%210+15;data.data[i+2]=(n*13)%210+15;data.data[i+3]=255;}x.putImageData(data,0,0);
    const output=document.createElement('canvas');output.width=output.height=96;const y=output.getContext('2d');
    function render(st){A.renderImage(y,96,96,source,st,null);return y.getImageData(0,0,96,96).data.slice();}
    const baseline=render(A.createNeutralState());
    return A.PRESETS.map(p=>{
      const samples=[0,50,100].map(intensity=>{const st=A.createNeutralState();st.activePreset=p.id;st.presetIntensity=intensity;return render(st);});
      const distance=(a,b)=>a.reduce((sum,v,i)=>sum+(i%4===3?0:Math.abs(v-b[i])),0)/(96*96*3);
      return {id:p.id,zero:distance(samples[0],baseline),half:distance(samples[1],baseline),full:distance(samples[2],baseline),halfToFull:distance(samples[1],samples[2])};
    });
  });
  for(const result of results){expect(result.zero,result.id).toBe(0);
    if(result.id==='normal'){expect(result.full).toBe(0);continue;}
    expect(result.half,result.id).toBeGreaterThan(.1);expect(result.full,result.id).toBeGreaterThan(.1);expect(result.halfToFull,result.id).toBeGreaterThan(.1);
  }
});

test('all adjustment sliders and artistic effects alter pixels',async({page})=>{
  const results=await page.evaluate(()=>{
    const A=window.AuraGram,source=document.createElement('canvas');source.width=source.height=128;
    const x=source.getContext('2d');for(let y=0;y<128;y++)for(let n=0;n<128;n++){
      x.fillStyle=`rgb(${(n%2)*130+12},${(y%2)*95+18},${(n+y)%2*80+24})`;x.fillRect(n,y,1,1);
    }
    const output=document.createElement('canvas');output.width=output.height=128;const ctx=output.getContext('2d');
    function draw(st){A.renderImage(ctx,128,128,source,st,null);return ctx.getImageData(0,0,128,128).data.slice();}
    const base=draw(A.createNeutralState());
    function distance(st){return draw(st).reduce((sum,value,i)=>sum+(i%4===3?0:Math.abs(value-base[i])),0)/(128*128*3);}
    return {adjustments:A.ADJUSTMENTS.map(tool=>{const st=A.createNeutralState();st.adjustments[tool.key]=tool.max;
      return {id:tool.key,distance:distance(st)};}),effects:A.FX_LIST.filter(f=>f.id!=='none').map(f=>{const st=A.createNeutralState();st.activeFX=f.id;return{id:f.id,distance:distance(st)};})};
  });
  for(const result of [...results.adjustments,...results.effects])expect(result.distance,result.id).toBeGreaterThan(.05);
});

test('every adjustment control routes its minimum and maximum to visible preview changes',async({page})=>{
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
    for(let y=0;y<128;y++)for(let n=0;n<128;n++){x.fillStyle=`rgb(${12+n%2*130},${18+y%2*95},${24+(n+y)%2*80})`;x.fillRect(n,y,1,1);}return c.toDataURL().split(',')[1];});
  await page.setInputFiles('#fileInput',{name:'controls.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(()=>window.AuraGram.loadState.status==='ready');
  await page.locator('[data-tab="adjust"]').click();
  const tools=await page.evaluate(()=>window.AuraGram.ADJUSTMENTS.map(({key,min,max})=>({key,min,max})));
  const pixels=()=>page.locator('#mainCanvas').evaluate(c=>{
    const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let hash=2166136261;
    for(const value of data)hash=Math.imul(hash^value,16777619);return hash>>>0;
  });
  for(const tool of tools)for(const value of (tool.min<0?[tool.min,tool.max]:[tool.max])) {
    await page.locator('#btnReset').click();const before=await pixels();
    await page.locator(`[data-adjustment="${tool.key}"]`).click();
    await page.locator('#mainSlider').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);
    expect(await page.evaluate(key=>window.AuraGram.state.adjustments[key],tool.key)).toBe(value);
    await expect.poll(pixels,{message:tool.key+' '+value}).not.toBe(before);
  }
});

test('software color transforms agree with native Canvas filters where supported',async({page})=>{
  const result=await page.evaluate(()=>{
    const F=window.AuraGramCanvasFilters;
    if(!F.nativeSupported())return null;
    const colors=[[25,70,140],[96,96,96],[180,100,55],[220,240,190],[240,30,160]];
    const filters=['brightness(125%)','contrast(150%)','saturate(0%)','sepia(70%)','hue-rotate(190deg)',
      'brightness(104%) contrast(125.2%) saturate(108%) sepia(6%) hue-rotate(-12deg)',
      'brightness(72%) contrast(280%) saturate(85%)'];
    let maxDifference=0;
    for(const filter of filters){const c=document.createElement('canvas');c.width=colors.length;c.height=1;const x=c.getContext('2d');
      for(let i=0;i<colors.length;i++){x.fillStyle=`rgb(${colors[i].join(',')})`;x.fillRect(i,0,1,1);}
      const raw=x.getImageData(0,0,c.width,1).data.slice();
      const out=document.createElement('canvas');out.width=c.width;out.height=1;const y=out.getContext('2d');y.filter=filter;y.drawImage(c,0,0);
      const native=y.getImageData(0,0,out.width,1).data;
      F.transformPixels(raw,F.compileFilter(filter).stages);
      for(let i=0;i<raw.length;i++)maxDifference=Math.max(maxDifference,Math.abs(raw[i]-native[i]));
    }
    return maxDifference;
  });
  if(result!==null)expect(result).toBeLessThanOrEqual(2);
});

test('each Beauty tool and lash control changes portrait pixels with valid face geometry',async({page})=>{
  const path=require('node:path');await page.setInputFiles('#fileInput',path.join(__dirname,'fixtures/edge-source.jpg'));
  await page.waitForFunction(()=>window.AuraGram.face.status()==='ready');
  await page.waitForFunction(()=>window.AuraGram.retouch.ready());
  const results=await page.evaluate(async()=>{
    const A=window.AuraGram,img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src='tests/fixtures/edge-source.jpg';});
    const c=document.createElement('canvas');c.width=450;c.height=563;const x=c.getContext('2d'),face=A.retouch.snapshot();
    function draw(st){A.renderImage(x,450,563,img,st,face);return x.getImageData(0,0,450,563).data.slice();}
    const base=draw(A.createNeutralState()),results=[];
    for(const tool of A.BEAUTY_TOOLS){const st=A.createNeutralState();st.beauty[tool.key]=100;
      results.push({id:tool.key,difference:draw(st).reduce((sum,v,i)=>sum+Math.abs(v-base[i]),0)});}
    for(const key of ['density','length','definition']){const st=A.createNeutralState();st.lashes[key]=100;
      results.push({id:key,difference:draw(st).reduce((sum,v,i)=>sum+Math.abs(v-base[i]),0)});}
    return results;
  });
  for(const result of results)expect(result.difference,result.id).toBeGreaterThan(10);
});

test('maximum lash density darkens real lashes without opaque black blocks',async({page})=>{
  const path=require('node:path');await page.setInputFiles('#fileInput',path.join(__dirname,'fixtures/edge-source.jpg'));
  await page.waitForFunction(()=>window.AuraGram.face.status()==='ready');await page.waitForFunction(()=>window.AuraGram.retouch.ready());
  const result=await page.evaluate(async()=>{
    const A=window.AuraGram,img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src='tests/fixtures/edge-source.jpg';});
    const c=document.createElement('canvas');c.width=450;c.height=563;const x=c.getContext('2d'),face=A.retouch.snapshot(),st=A.createNeutralState();
    A.renderImage(x,450,563,img,st,face);const before=x.getImageData(0,0,450,563).data.slice();
    st.lashes.density=100;A.renderImage(x,450,563,img,st,face);const after=x.getImageData(0,0,450,563).data;
    let changed=0,tooDark=0;
    for(let i=0;i<before.length;i++){if(i%4===3)continue;if(after[i]!==before[i])changed++;
      if(before[i]>20&&after[i]<Math.floor(before[i]*.65)-2)tooDark++;}
    return {changed,tooDark};
  });
  expect(result.changed).toBeGreaterThan(10);expect(result.tooDark).toBe(0);
});
