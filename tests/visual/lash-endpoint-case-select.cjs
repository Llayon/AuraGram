'use strict';
// Stable IDs from the previously frozen old set; no new tracing or model call.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),{chromium}=require('@playwright/test');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){const name=process.argv[2];if(!name||!/^[\w-]+$/.test(name))throw Error('Supply NEW run name');const out=path.join(__dirname,'out',name);if(fs.existsSync(out))throw Error('Run exists');fs.mkdirSync(out,{recursive:true});
 const root=path.join(__dirname,'positive-evidence'),packed=n=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,n+'.json.gz'))));
 const before=packed('v6-render-chromium'),fixed=packed('fixed-render-chromium'),audit=packed('audit-chromium'),index=JSON.parse(fs.readFileSync(path.join(root,'images.json')));
 const key=t=>JSON.stringify([t.x,t.y,t.dx,t.dy,t.c,t.length,t.width]),rows=[],b=await chromium.launch();
 try{const p=await b.newPage();for(const side of['left','right']){const run=before.runs.find(r=>r.file==='pexels-10460940.jpg'),after=fixed.runs.find(r=>r.file===run.file),eye=run.eyes[side],roi=eye.roi,rx=Math.floor(roi.x0*run.W),ry=Math.floor(roi.y0*run.H),retained=new Set(after.eyes[side].tips.map(key));
  const selected=eye.tips.flatMap((t,i)=>t.c>=.6&&eye.lengthConfidence>=.25&&retained.has(key(t))?[{id:'C104-'+side+'-old'+i,tip:t,oldIndex:i,source:{x:roi.x0*run.W+t.x*(roi.x1-roi.x0)*run.W,y:roi.y0*run.H+t.y*(roi.y1-roi.y0)*run.H}}]:[]);
  const image=index.find(i=>i.label==='positive-17-fixed-render/chromium-pexels-10460940-current-length100-'+side+'-1x.png'),bytes=fs.readFileSync(path.join(root,image.file));if(hash(bytes)!==image.sha256)throw Error('PNG hash');
  const png=await p.evaluate(async({url,selected,rx,ry})=>{const i=new Image();i.src=url;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);for(const s of selected){const px=s.source.x-rx,py=s.source.y-ry;x.strokeStyle='#00eaff';x.lineWidth=1;x.beginPath();x.arc(px,py,4,0,Math.PI*2);x.stroke();x.fillStyle='#00eaff';x.font='13px sans-serif';x.fillText(s.id,px+6,py-6);}return c.toDataURL();},{url:'data:image/png;base64,'+bytes.toString('base64'),selected,rx,ry});
  fs.writeFileSync(path.join(out,side+'-fixed-old-ids.png'),Buffer.from(png.split(',')[1],'base64'),{flag:'wx'});rows.push({file:run.file,side,roi,rw:eye.rw,rh:eye.rh,W:run.W,H:run.H,selected});
 }
 const controls=['PI729R1','PI729R2'].map(id=>{const r=audit.rows.find(r=>r.id===id&&r.budget===224);if(!r?.nearest)throw Error('Missing frozen control');return{id,file:r.file,side:r.nearest.side,tip:r.nearest.tip,source:r.nearest.source,annotation:r.annotation,oldDistance:r.nearest.distance};});
 fs.writeFileSync(path.join(out,'old-identities.json'),JSON.stringify({baseline:'5c262d62781a775c216b8fa9d89a5c968cec07f3',meaning:'IDs of old v6 eligible candidates retained by previous fixed-subset experiment. Overlays are NOT product images. Controls are the exact old nearest candidates, not replacements.',inputHashes:Object.fromEntries(['v6-render-chromium','fixed-render-chromium','audit-chromium'].map(n=>[n,hash(fs.readFileSync(path.join(root,n+'.json.gz')))])),rows,controls},null,2),{flag:'wx'});
 }finally{await b.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
