'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('@playwright/test');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){const geometry=process.argv[2],name=process.argv[3];if(!geometry||!name||!/^[\w-]+$/.test(name))throw Error('Supply manifest and NEW run name');
 const out=path.join(__dirname,'out',name);if(fs.existsSync(out))throw Error('Run exists');fs.mkdirSync(out,{recursive:true});
 const m=JSON.parse(fs.readFileSync(geometry)),labels=['primary','independent'].map(who=>({who,data:JSON.parse(fs.readFileSync(path.join(__dirname,'lash-positive-'+who+'-labels.json')))})),crops=JSON.parse(fs.readFileSync(path.join(__dirname,'lash-positive-crops.json'))).crops;
 const b=await chromium.launch(),images=[];try{const p=await b.newPage();for(const crop of crops){const run=m.runs.find(r=>r.file===crop.file);if(!run?.geometry)continue;
  const bytes=fs.readFileSync(path.join(__dirname,'out/dataset',crop.file));const results=await p.evaluate(async({url,crop,run,labels})=>{const source=new Image();source.src=url;await source.decode();const[x0,y0,w,h]=crop.rect,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),output=[];
   const point=(px,py,color,r=3)=>{x.strokeStyle=color;x.lineWidth=1;x.beginPath();x.arc(px-x0,py-y0,r,0,Math.PI*2);x.stroke();};
   const line=(pts,color)=>{x.strokeStyle=color;x.lineWidth=1;x.beginPath();pts.forEach((q,i)=>i?x.lineTo(q.x-x0,q.y-y0):x.moveTo(q.x-x0,q.y-y0));x.stroke();};
   for(const cap of[0,224,320,384]){x.drawImage(source,x0,y0,w,h,0,0,w,h);
    if(cap){const budget=run.budgets.find(b=>b.maxSide===cap);for(const[side,a]of Object.entries(budget.eyes)){const g=run.geometry[side],r=g.roi,rawW=(r.x1-r.x0)*run.W,rawH=(r.y1-r.y0)*run.H;line(g.upperLid.map(q=>({x:q.x*run.W,y:q.y*run.H})),'#44ff88');line(g.lowerLid.map(q=>({x:q.x*run.W,y:q.y*run.H})),'#44ff88');for(const t of a.tips)if(t.c>=.6&&a.lengthConfidence>=.25){const px=r.x0*run.W+t.x*rawW,py=r.y0*run.H+t.y*rawH;point(px,py,'#00eaff',Math.max(2,Math.hypot(rawW/a.rw,rawH/a.rh)/2));line([{x:px,y:py},{x:px+t.dx*rawW/a.rw*4,y:py+t.dy*rawH/a.rh*4}],'#00eaff');}}}
    for(const {who,data}of labels)for(const view of data.views.filter(v=>v.file===crop.file&&v.view===crop.view))for(const label of view.labels){const rect=view.sourceRectNative,[tx,ty]=label.tipNative,color=who==='primary'?'#ffe600':'#ff8800',support=label.shaftPointsNative||label.localProximalNativePoints;point(tx+rect[0],ty+rect[1],color,label.tipUncertaintyNativePx||label.tipUncertaintyPx);line([{x:tx+rect[0],y:ty+rect[1]},...support.map(q=>({x:q[0]+rect[0],y:q[1]+rect[1]}))],color);x.font='11px sans-serif';x.fillStyle=color;x.fillText(label.id,tx+rect[0]-x0+6,ty+rect[1]-y0-5);}
    output.push({cap,png:c.toDataURL()});
   }c.width=c.height=0;return output;
  },{url:'data:image/jpeg;base64,'+bytes.toString('base64'),crop,run,labels});
  for(const r of results){const file=m.engine+'-'+crop.file.replace('.jpg','')+'-'+crop.view+'-'+(r.cap?'cap'+r.cap:'labels-only')+'.png',bytes=Buffer.from(r.png.split(',')[1],'base64');fs.writeFileSync(path.join(out,file),bytes,{flag:'wx'});images.push({file,source:crop.file,view:crop.view,cap:r.cap,sha256:hash(bytes),width:crop.rect[2],height:crop.rect[3]});}
 }fs.writeFileSync(path.join(out,'images.json'),JSON.stringify({engine:m.engine,geometrySHA256:hash(fs.readFileSync(geometry)),images},null,2),{flag:'wx'});
 }finally{await b.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
