'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('@playwright/test');
async function main(){
 const input=process.argv[2],output=process.argv[3];if(!input||!output||fs.existsSync(output))throw Error('Supply source records and NEW output directory');
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),records=JSON.parse(fs.readFileSync(input)).records,cropsBytes=fs.readFileSync(path.join(__dirname,'lash-expanded-screen-crops.json')),crops=JSON.parse(cropsBytes);
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch(),results=[];
 try{const page=await browser.newPage();for(const source of records){const bytes=fs.readFileSync(path.join(__dirname,'out/dataset',source.file));if(hash(bytes)!==source.sha256)throw Error('Source changed');
  const images=await page.evaluate(async({data,crops})=>{const image=new Image();image.src=data;await image.decode();const result=[];for(const crop of crops){const [x,y,w,h]=crop.rect;if(x<0||y<0||x+w>image.width||y+h>image.height)throw Error('Invalid original crop');for(const scale of [1,2,4]){const c=document.createElement('canvas');c.width=w*scale;c.height=h*scale;const cx=c.getContext('2d');cx.imageSmoothingEnabled=false;cx.drawImage(image,x,y,w,h,0,0,c.width,c.height);result.push({view:crop.view,rect:crop.rect,scale,png:c.toDataURL()});c.width=c.height=0;}}return result;},{data:'data:image/jpeg;base64,'+bytes.toString('base64'),crops:crops.crops.filter(c=>c.file===source.file)});
  for(const im of images){const filename=source.file.replace('.jpg','')+'-'+im.view+'-'+im.scale+'x.png',png=Buffer.from(im.png.split(',')[1],'base64');fs.writeFileSync(path.join(output,filename),png,{flag:'wx'});results.push({file:source.file,sourceSHA256:source.sha256,view:im.view,rect:im.rect,scale:im.scale,filename,sha256:hash(png)});}
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(output,'original-crops.json'),JSON.stringify({records,cropSelectionSHA256:hash(cropsBytes),method:'Original-only manual source viewing crops. Nearest-neighbour display enlargement only. No analysis, invented geometry or sharpening.',results},null,2),{flag:'wx'});
 fs.writeFileSync(path.join(output,'index.html'),'<!doctype html><meta charset="utf-8"><title>Original-only source screening</title><style>body{background:#222;color:#eee;font:16px sans-serif}figure{overflow:auto}img{max-width:none}</style><h1>Original-only screening</h1><p>Manual source viewing rectangles, not landmarks. Native1x,2x,4x; nearest-neighbour display only. No detector results.</p>'+results.map(r=>`<figure><figcaption>${r.filename}</figcaption><img loading="lazy" src="${r.filename}"></figure>`).join(''),{flag:'wx'});
 console.log('Saved '+results.length+' original crops');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
