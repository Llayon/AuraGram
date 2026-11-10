'use strict';
// Reproducible real-face audit. Freeze 0.5.1 sources in out/baseline-src first.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium,webkit}=require('@playwright/test');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'out',process.env.LASH_RUN||'g1c1-final');
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const server=spawn(process.execPath,[path.join(root,'tests/static-server.cjs'),'0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});
 let browser;
 try{
 const url=await new Promise(resolve=>server.stdout.on('data',d=>{const m=String(d).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);}));
 const manifest={baseline:'b02fac3c684f2a7e3178933cb66ded925ab8bce8',version:'0.5.1',runs:[]};
 for(const engine of process.argv.includes('--webkit')?[webkit]:[chromium]){
 browser=await engine.launch();const page=await browser.newPage();
 await page.route('https://**/*',r=>r.abort());
 const fixtures=fs.readdirSync(path.join(__dirname,'out/dataset')).filter(f=>/\.jpg$/.test(f)&&(!process.env.LASH_FIXTURE||f===process.env.LASH_FIXTURE));
 for(const file of fixtures){
 console.log(engine.name(),file);
 await page.goto(url+'/index.html');await page.waitForFunction(()=>!!window.AuraGram);
 await page.setInputFiles('#fileInput',path.join(__dirname,'out/dataset',file));
 await page.waitForFunction(()=>['ready','no_face','failed','unsupported'].includes(window.AuraGram.face.status()),null,{timeout:100000});
 const status=await page.evaluate(()=>window.AuraGram.face.status());
 if(status!=='ready'){manifest.runs.push({file,engine:engine.name(),status,excludedReason:'No usable real FaceMesh; no invented geometry'});fs.writeFileSync(path.join(out,'manifest-'+engine.name()+'.json'),JSON.stringify(manifest,null,2));continue;}
 const result=await page.evaluate(async({file,engine})=>{
 const source=new Image();source.src='/tests/visual/out/dataset/'+file;await source.decode();
 const W=source.naturalWidth,H=source.naturalHeight,regs=window.AuraGram.face.store().faces[0].regions;
 const faceW=Math.max(...regs.faceOval.map(p=>p.x))-Math.min(...regs.faceOval.map(p=>p.x));
 const oldGeo=await import('/tests/visual/out/baseline-src/retouch/eyeGeometry.mjs');
 const oldAn=await import('/tests/visual/out/baseline-src/retouch/lashAnalysis.mjs');
 const oldPass=await import('/tests/visual/out/baseline-src/retouch/lashEnhancement.mjs');
 const geo=await import('/src/retouch/eyeGeometry.mjs'),an=await import('/src/retouch/lashAnalysis.mjs'),pass=await import('/src/retouch/lashEnhancement.mjs');
 const eyes=geo.describeEyes(regs,faceW),oldEyes=oldGeo.describeEyes(regs,faceW);
 const old={left:oldAn.analyzeEye(source,oldEyes.left,'left'),right:oldAn.analyzeEye(source,oldEyes.right,'right')};
 const analysis={},budgets=[];
 for(const maxSide of [224,320,384]){
 let times=[],value;
 for(let i=0;i<5;i++) {const t=performance.now();value={left:an.analyzeEye(source,eyes.left,'left',{maxSide}),right:an.analyzeEye(source,eyes.right,'right',{maxSide})};times.push(performance.now()-t);}
 budgets.push({maxSide,times,eyes:Object.fromEntries(Object.entries(value).map(([s,v])=>[s,{rw:v.rw,rh:v.rh,confidence:v.confidence,tips:v.tips.map(t=>({x:t.x,y:t.y,dx:t.dx,dy:t.dy,c:t.c,width:t.width,length:t.length})),traces:v.traces.length,typedArrayBytes:v.typedArrayBytes,retainedTypedArrayBytes:v.retainedTypedArrayBytes,rejections:v.traces.reduce((a,t)=>(a[t.reason]=(a[t.reason]||0)+1,a),{})}]))});
 if(maxSide===224)Object.assign(analysis,value);
 }
 const canvas=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(source,0,0);return c;};
 const images=[],variants=[['original',null],['old-density50',{density:50}],['new-density50',{density:50}],['old-length50',{length:50}],['new-length50',{length:50}],['definition50',{definition:50}],['natural',{density:25,length:25,definition:20}],...([25,49,50,51,75,100].map(v=>['length'+v,{length:v}]))];
 for(const [name,setting] of variants){
 const c=canvas();if(setting)(name.startsWith('old')?oldPass:pass).applyLashPass(c.getContext('2d'),W,H,name.startsWith('old')?oldEyes:eyes,name.startsWith('old')?old:analysis,{density:0,length:0,definition:0,...setting},{});
 images.push({name,url:c.toDataURL()});
 }
 for(const name of ['ridge','traces','difference']){
 const c=canvas(),ctx=c.getContext('2d');
 if(name==='difference'){
 const im=new Image();im.src=images.find(i=>i.name==='natural').url;await im.decode();const temp=canvas();temp.getContext('2d').drawImage(im,0,0);
 const a=ctx.getImageData(0,0,W,H),b=temp.getContext('2d').getImageData(0,0,W,H);for(let i=0;i<a.data.length;i+=4)for(let k=0;k<3;k++)a.data[i+k]=Math.abs(a.data[i+k]-b.data[i+k])*8;ctx.putImageData(a,0,0);
 }else for(const side of ['left','right']){
 const v=analysis[side],r=eyes[side].roi,rw=(r.x1-r.x0)*W,rh=(r.y1-r.y0)*H;
 if(name==='ridge'&&v.ridge){const rc=document.createElement('canvas');rc.width=v.rw;rc.height=v.rh;const x=rc.getContext('2d'),d=x.createImageData(v.rw,v.rh);for(let i=0;i<v.ridge.length;i++){d.data[i*4]=0;d.data[i*4+1]=255;d.data[i*4+2]=100;d.data[i*4+3]=v.ridge[i];}x.putImageData(d,0,0);ctx.drawImage(rc,r.x0*W,r.y0*H,rw,rh);}
 if(name==='traces')for(const t of v.traces){ctx.strokeStyle=t.reason==='ok'?'#00ff80':'#ff3040';ctx.lineWidth=1;ctx.beginPath();t.points.forEach((p,i)=>{const x=r.x0*W+(p.x+.5)/v.rw*rw,y=r.y0*H+(p.y+.5)/v.rh*rh;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
 }
 images.push({name,url:c.toDataURL()});
 }
 // Native crops, then exact nearest-neighbour 200/400%, preserving artifacts.
 for(const im of images){const pic=new Image();pic.src=im.url;await pic.decode();im.crops=[];for(const side of ['left','right'])for(const zoom of [1,2,4]){
 const r=eyes[side].roi,c=document.createElement('canvas');const w=Math.ceil((r.x1-r.x0)*W),h=Math.ceil((r.y1-r.y0)*H);c.width=w*zoom;c.height=h*zoom;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(pic,Math.floor(r.x0*W),Math.floor(r.y0*H),w,h,0,0,c.width,c.height);im.crops.push({side,zoom,url:c.toDataURL()});}}
 const perf=[];for(const width of [900,W]){const c=document.createElement('canvas');c.width=width;c.height=Math.round(H*width/W);const x=c.getContext('2d'),scratch={};let ms=[],ran=[];for(let i=0;i<9;i++){x.drawImage(source,0,0,c.width,c.height);const t=performance.now();const res=pass.applyLashPass(x,c.width,c.height,eyes,analysis,{density:35,length:30,definition:25},scratch);ms.push(performance.now()-t);ran=res.ran;}perf.push({width,height:c.height,ms,ran});}
 return {file,engine,W,H,old:Object.fromEntries(Object.entries(old).map(([s,v])=>[s,{rw:v.rw,rh:v.rh,tips:v.tips.length,confidence:v.confidence}])),budgets,perf,images};
 },{file,engine:engine.name()});
 for(const im of result.images){const prefix=engine.name()+'-'+file.replace('.jpg','')+'-'+im.name;fs.writeFileSync(path.join(out,prefix+'.png'),Buffer.from(im.url.split(',')[1],'base64'));delete im.url;for(const crop of im.crops){fs.writeFileSync(path.join(out,prefix+'-'+crop.side+'-'+crop.zoom+'x.png'),Buffer.from(crop.url.split(',')[1],'base64'));delete crop.url;}}
 manifest.runs.push(result);fs.writeFileSync(path.join(out,'manifest-'+engine.name()+'.json'),JSON.stringify(manifest,null,2));
 }
 await browser.close();browser=null;
 }
 const files=fs.readdirSync(out).filter(f=>f.endsWith('.png'));
 fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><meta charset="utf-8"><title>G1c.1 visual evidence</title><style>body{background:#222;color:#eee;font:14px sans-serif}article{display:inline-block;vertical-align:top;margin:8px}img{max-width:700px}</style><h1>0.5.1 / G1c.1 — native PNG evidence</h1>'+files.map(f=>`<article><p>${f}</p><a href="${f}"><img loading="lazy" src="${f}"></a></article>`).join(''));
 }finally{if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
