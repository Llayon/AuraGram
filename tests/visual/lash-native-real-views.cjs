'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('@playwright/test');
async function main(){
 const [runDir,labelsFile,sourceFile,out]=process.argv.slice(2);if(!out||fs.existsSync(out))throw Error('Supply run, labels, original and NEW output');
 const labels=JSON.parse(fs.readFileSync(labelsFile)),bytes=fs.readFileSync(sourceFile);
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==labels.sourceSHA256)throw Error('Source mismatch');
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch();
 try{const p=await browser.newPage();for(const engine of ['chromium','webkit']){
 const run=JSON.parse(fs.readFileSync(path.join(runDir,engine+'.json')));
 const images=await p.evaluate(async({data,labels,run})=>{
 const i=new Image();i.src=data;await i.decode();const images=[];
 for(const side of ['left','right']){
 const [x,y,w,h]=labels.eyes[side].cropRect,c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(i,x,y,w,h,0,0,w,h);
 const line=(points,color,close=false)=>{ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();points.forEach((p,k)=>ctx[k?'lineTo':'moveTo'](p.x-x,p.y-y));if(close)ctx.closePath();ctx.stroke();};
 for(const label of labels.eyes[side].tips)line(label.region.map(p=>({x:p[0],y:p[1]})),'#ff00ff',true);
 for(const r of run.run[side].results){if(r.proximal)line(r.proximal.points,'#00ffff');line(r.path,'#ff9900');}
 images.push({side,png:c.toDataURL()});c.width=c.height=0;
 }return images;
 },{data:'data:image/jpeg;base64,'+bytes.toString('base64'),labels,run});
 for(const im of images)fs.writeFileSync(path.join(out,engine+'-'+im.side+'.png'),Buffer.from(im.png.split(',')[1],'base64'),{flag:'wx'});
 }fs.writeFileSync(path.join(out,'legend.txt'),'Magenta: frozen provisional tip uncertainty. Cyan: observed proximal attempt. Orange: observed distal attempt. All paths unconfirmed; zero accepted endings. Source pixels at native 1x.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
