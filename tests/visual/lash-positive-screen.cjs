'use strict';
// Original-only viewing artifacts; no detector, sharpening or inferred landmark.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('@playwright/test');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const name=process.argv[2];if(!name||!/^[\w-]+$/.test(name))throw Error('Supply NEW run name');
 const out=path.join(__dirname,'out',name);if(fs.existsSync(out))throw Error('Run already exists');fs.mkdirSync(out,{recursive:true});
 const sources=JSON.parse(fs.readFileSync(path.join(__dirname,'lash-positive-sources.json'))).sources;
 const crops=JSON.parse(fs.readFileSync(path.join(__dirname,'lash-positive-crops.json'))).crops;
 const b=await chromium.launch(),manifest={method:'Original-only integer native crops, no detector;720px full portraits are viewing previews.',sources:[],crops:[]};
 try{const p=await b.newPage();for(const s of sources){const committed=path.join(__dirname,'positive-evidence/sources',s.file),file=fs.existsSync(committed)?committed:path.join(__dirname,'out/dataset',s.file),bytes=fs.readFileSync(file);
  const views=await p.evaluate(async({url,crops})=>{const i=new Image();i.src=url;await i.decode();const c=document.createElement('canvas'),output=[];
   c.width=720;c.height=Math.round(i.height/i.width*720);c.getContext('2d').drawImage(i,0,0,c.width,c.height);output.push({view:'portrait720',png:c.toDataURL()});
   for(const r of crops){const[x,y,w,h]=r.rect;if(x<0||y<0||x+w>i.width||y+h>i.height)throw Error('Crop boundary');c.width=w;c.height=h;c.getContext('2d').drawImage(i,x,y,w,h,0,0,w,h);output.push({view:r.view,rect:r.rect,png:c.toDataURL()});}c.width=c.height=0;return{width:i.width,height:i.height,output};
  },{url:'data:image/jpeg;base64,'+bytes.toString('base64'),crops:crops.filter(r=>r.file===s.file)});
  manifest.sources.push({...s,width:views.width,height:views.height,sha256:hash(bytes)});
  for(const v of views.output){const png=Buffer.from(v.png.split(',')[1],'base64'),file=s.file.replace('.jpg','-'+v.view+(v.rect?'-1x':'')+'.png');fs.writeFileSync(path.join(out,file),png,{flag:'wx'});manifest.crops.push({source:s.file,view:v.view,rect:v.rect||null,file,sha256:hash(png),width:png.readUInt32BE(16),height:png.readUInt32BE(20)});}
 }fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
 }finally{await b.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
