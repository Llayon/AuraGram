'use strict';
// Original pixels + actual FaceMesh only. Never imports lashAnalysis or renderer.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process');
const {chromium,webkit}=require('@playwright/test');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const input=process.argv[2],output=process.argv[3],engine=process.argv.includes('--webkit')?webkit:chromium;
 if(!input||!output||fs.existsSync(output))throw Error('Supply downloads.json and NEW output directory');
 const records=JSON.parse(fs.readFileSync(input)).records;
 fs.mkdirSync(output,{recursive:true});
 const server=spawn(process.execPath,['tests/static-server.cjs','0'],{windowsHide:true,stdio:['ignore','pipe','inherit']});let browser;
 const results=[];
 try{
 const url=await new Promise((resolve,reject)=>{server.once('error',reject);server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);});});
 browser=await engine.launch();const page=await browser.newPage();
 await page.route('https://**/*',r=>r.abort());
 await page.route('**/__spatial_screen__',r=>r.fulfill({body:'<!doctype html><title>Original source screening</title>',contentType:'text/html'}));
 await page.goto(url+'/__spatial_screen__');
 for(const record of records){
 if(record.status!=='downloaded'){results.push(record);continue;}
 const bytes=fs.readFileSync(path.join(path.dirname(input),record.file));if(hash(bytes)!==record.sha256)throw Error('Source hash changed');
 const result=await page.evaluate(async({data,split})=>{
 const {createFaceEngine}=await import('/src/vision/faceDetector.mjs');
 const image=new Image();image.src=data;await image.decode();
 const face=createFaceEngine();
 try{
 face.schedule(1,image);
 const start=performance.now();while(!['ready','no_face','failed','unsupported'].includes(face.status())){
 if(performance.now()-start>100000)throw Error('FaceMesh screening timeout');await new Promise(r=>setTimeout(r,50));}
 const regions=face.store.faces[0]?.regions;
 let eyes=null;
 if(regions){const {describeEyes}=await import('/src/retouch/eyeGeometry.mjs');const xs=regions.faceOval.map(p=>p.x);eyes=describeEyes(regions,Math.max(...xs)-Math.min(...xs));}
 const views=[];
 // Keep validation source views sealed; only qualification metadata is emitted.
 if(split==='development'){
 const c=document.createElement('canvas'),ctx=c.getContext('2d');c.width=600;c.height=Math.round(image.height/image.width*600);ctx.drawImage(image,0,0,c.width,c.height);views.push({name:'portrait',png:c.toDataURL()});
 if(eyes)for(const side of ['left','right']){const e=eyes[side],r=e.roi;
 const x=Math.floor(r.x0*image.width),y=Math.floor(r.y0*image.height),w=Math.ceil(r.x1*image.width)-x,h=Math.ceil(r.y1*image.height)-y;
 c.width=w;c.height=h;ctx.drawImage(image,x,y,w,h,0,0,w,h);views.push({name:side,rect:[x,y,w,h],png:c.toDataURL()});}c.width=c.height=0;
 }
 return{status:face.status(),width:image.width,height:image.height,metrics:{...face.metrics},regions,eyes,views};
 }finally{face.destroy();}
 },{data:'data:image/jpeg;base64,'+bytes.toString('base64'),split:record.split});
 for(const view of result.views){const file=record.file.replace('.jpg','-'+view.name+'.png');fs.writeFileSync(path.join(output,file),Buffer.from(view.png.split(',')[1],'base64'),{flag:'wx'});delete view.png;view.file=file;}
 results.push({...record,...result});fs.writeFileSync(path.join(output,'screening.json'),JSON.stringify({engine:engine.name(),detectorExecuted:false,inputSHA256:hash(fs.readFileSync(input)),results},null,2)+'\n');
 console.log(record.file,result.status);
 }
 }finally{if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
