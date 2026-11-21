'use strict';
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('@playwright/test');
async function main(){
 const folder=path.join(__dirname,'out/dataset');
 const small=path.join(folder,'low256.jpg');if(!fs.existsSync(small))fs.copyFileSync(path.join(__dirname,'../fixtures/portrait.jpg'),small);
 const target=path.join(folder,'light-rotated25.jpg');
 if(!fs.existsSync(target)){
  const browser=await chromium.launch();
  try{const page=await browser.newPage();
   const url=await page.evaluate(async data=>{
    const im=new Image();im.src=data;await im.decode();const angle=25*Math.PI/180;
    const c=document.createElement('canvas');c.width=Math.ceil(im.width*Math.cos(angle)+im.height*Math.sin(angle));c.height=Math.ceil(im.height*Math.cos(angle)+im.width*Math.sin(angle));
    const x=c.getContext('2d');x.fillStyle='#808080';x.fillRect(0,0,c.width,c.height);x.translate(c.width/2,c.height/2);x.rotate(angle);x.drawImage(im,-im.width/2,-im.height/2);return c.toDataURL('image/jpeg',.95);
   },'data:image/jpeg;base64,'+fs.readFileSync(path.join(folder,'light.jpg')).toString('base64'));
   fs.writeFileSync(target,Buffer.from(url.split(',')[1],'base64'));
  }finally{await browser.close();}
 }
 fs.writeFileSync(path.join(folder,'recovery-derived.json'),JSON.stringify({
  'low256.jpg':{source:'portrait.jpg / photo-1534528741775-53994a69daeb',operation:'existing256px downscale; low-resolution guard, not a new independent photo'},
  'edge900.jpg':{source:'edge-source.jpg / photo-1534528741775-53994a69daeb',operation:'existing900px downscale'},
  'light-rotated25.jpg':{source:'light.jpg / photo-1508214751196-bcfd4ca60f91',operation:'25degree in-plane canvas rotation; JPEGq95; derived real photograph, not an independent source'}
 },null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
