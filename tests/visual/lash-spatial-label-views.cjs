'use strict';
// Render original-only annotations for review; no recognition or lash rendering.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('@playwright/test');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const [labelFile,sourceFile,output]=process.argv.slice(2);
 if(!output||fs.existsSync(output))throw Error('Supply labels, original JPEG and NEW output directory');
 const labels=JSON.parse(fs.readFileSync(labelFile)),source=fs.readFileSync(sourceFile);
 if(hash(source)!==labels.sourceSHA256)throw Error('Source hash mismatch');
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch();
 try{const page=await browser.newPage();const views=await page.evaluate(async({labels,data})=>{
 const i=new Image();i.src=data;await i.decode();const out=[];
 for(const [side,eye]of Object.entries(labels.eyes)){
 const [x,y,w,h]=eye.cropRect,c=document.createElement('canvas');c.width=w;c.height=h;const cx=c.getContext('2d');cx.drawImage(i,x,y,w,h,0,0,w,h);
 const polygon=(points,color,close)=>{cx.strokeStyle=color;cx.lineWidth=2;cx.beginPath();points.forEach((p,k)=>cx[k?'lineTo':'moveTo'](p[0]-x,p[1]-y));if(close)cx.closePath();cx.stroke();};
 for(const a of eye.ambiguities)polygon(a.region,'#ff9900',true);
 for(const t of eye.tips){polygon(t.observedPath,'#00ffff',false);polygon(t.region,'#00ff00',true);}
 out.push({side,png:c.toDataURL()});c.width=c.height=0;
 }return out;
 },{labels,data:'data:image/jpeg;base64,'+source.toString('base64')});
 for(const v of views)fs.writeFileSync(path.join(output,v.side+'.png'),Buffer.from(v.png.split(',')[1],'base64'),{flag:'wx'});
 fs.writeFileSync(path.join(output,'inputs.json'),JSON.stringify({labelSHA256:hash(fs.readFileSync(labelFile)),sourceSHA256:hash(source),meaning:'Green = provisional uncertainty; cyan = visual observed segment; orange = ambiguity. No detector outputs.'},null,2)+'\n');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
