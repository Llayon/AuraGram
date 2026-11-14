'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium,webkit}=require('@playwright/test');
async function main(){
 const [runDir,sourceFile,out]=process.argv.slice(2);if(!out||fs.existsSync(out))throw Error('Supply ending run, original JPEG and NEW output');
 const source=fs.readFileSync(sourceFile),p=JSON.parse(fs.readFileSync(path.join(runDir,'protocol.json')));
 if(crypto.createHash('sha256').update(source).digest('hex')!==p.sourceSHA256)throw Error('Source changed');
 fs.mkdirSync(out,{recursive:true});const views=[];
 for(const engine of [chromium,webkit]){
 const saved=JSON.parse(fs.readFileSync(path.join(runDir,engine.name()+'.json'))),selected=Object.entries(saved.results).flatMap(([side,records])=>records.filter(r=>r.coarseConnected&&r.correspondence==='consistent-local-evidence').map(r=>({side,...r})));
 const browser=await engine.launch();try{const page=await browser.newPage();
 for(const r of selected){
 const images=await page.evaluate(async({data,r})=>{
 const image=new Image();image.src=data;await image.decode();const x=Math.floor(r.lastSourcePoint.x)-18,y=Math.floor(r.lastSourcePoint.y)-18,w=36,h=36;
 const c=document.createElement('canvas');c.width=w;c.height=h;let ctx=c.getContext('2d');ctx.drawImage(image,x,y,w,h,0,0,w,h);const one=c.toDataURL();
 c.width=w*4;c.height=h*4;ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,x,y,w,h,0,0,w*4,h*4);const four=c.toDataURL();
 ctx.scale(4,4);const end={x:r.lastSourcePoint.x-x,y:r.lastSourcePoint.y-y},u=r.measuredTangent,n={x:-u.y,y:u.x};
 const point=(a,o)=>({x:end.x+u.x*a+n.x*o,y:end.y+u.y*a+n.y*o});
 ctx.strokeStyle='#00ffff';ctx.lineWidth=.25;ctx.beginPath();const a=point(-2,-3);ctx.moveTo(a.x,a.y);for(const [along,across]of [[4,-3],[4,3],[-2,3],[-2,-3]]){const q=point(along,across);ctx.lineTo(q.x,q.y);}ctx.stroke();
 ctx.strokeStyle='#ffff00';ctx.beginPath();ctx.moveTo(end.x,end.y);const ahead=point(4,0);ctx.lineTo(ahead.x,ahead.y);ctx.stroke();
 ctx.fillStyle='rgba(255,0,0,.45)';for(const row of r.profiles?.[0]?.rows||[])for(const s of row.samples)if(s.supported)ctx.fillRect(s.point.x+r.patch.x-x-.1,s.point.y+r.patch.y-y-.1,.2,.2);
 return{one,four,overlay:c.toDataURL(),crop:[x,y,w,h]};
 },{data:'data:image/jpeg;base64,'+source.toString('base64'),r});
 const stem=engine.name()+'-'+r.side+'-'+r.rank;
 for(const type of ['one','four','overlay'])fs.writeFileSync(path.join(out,stem+'-'+type+'.png'),Buffer.from(images[type].split(',')[1],'base64'),{flag:'wx'});
 views.push({engine:engine.name(),side:r.side,rank:r.rank,status:r.status,reasons:r.reasons,stem,crop:images.crop,measuredTangent:r.measuredTangent,meaning:'Unapproved endpoint probe. Cyan box=measured window; yellow=measured tangent; red=radius.75 supported response samples. Raw originals shown separately.'});
 }
 }finally{await browser.close();}
 }
 fs.writeFileSync(path.join(out,'views.json'),JSON.stringify(views,null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><meta charset="utf-8"><title>Unapproved ending probes</title><style>body{font:16px sans-serif;background:#222;color:#eee}img{margin:8px;image-rendering:pixelated}</style><h1>Unapproved ending probes</h1><p>All records with coarse root reach plus local correspondence, without biological ownership approval. Each original is decoded by its recorded engine. Raw1x / raw4x / measured overlay4x. No rendered lash or inferred missing segment.</p>'+views.map(v=>`<section><h2>${v.stem}: ${v.status}</h2><p>${v.reasons.join(', ')}</p>${['one','four','overlay'].map(type=>`<img src="${v.stem}-${type}.png">`).join('')}</section>`).join(''),{flag:'wx'});
}
main().catch(e=>{console.error(e);process.exitCode=1;});
