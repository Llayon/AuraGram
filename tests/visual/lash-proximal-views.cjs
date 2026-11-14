'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('@playwright/test');
async function main(){
 const [summaryFile,runDir,labelFile,sourceFile,out]=process.argv.slice(2);
 if(!out||fs.existsSync(out))throw Error('Supply diagnostic, run, labels, original JPEG and NEW output');
 const summary=JSON.parse(fs.readFileSync(summaryFile)),labels=JSON.parse(fs.readFileSync(labelFile)),source=fs.readFileSync(sourceFile);
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 if(hash(source)!==labels.sourceSHA256||hash(fs.readFileSync(labelFile))!==summary.inputs.annotationSHA256)throw Error('Input mismatch');
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch();
 try{const page=await browser.newPage();
 for(const result of summary.results){
 const run=JSON.parse(fs.readFileSync(path.join(runDir,result.engine+'.json'))),screen=JSON.parse(fs.readFileSync(run.geometryPath)).results.find(r=>r.file===labels.file);
 if(hash(fs.readFileSync(run.geometryPath))!==run.geometrySHA256)throw Error('Geometry changed');
 const side=result.side,lid=screen.eyes[side].upperLid.map(p=>({x:p.x*screen.width-.5,y:p.y*screen.height-.5}));
 const png=await page.evaluate(async({data,result,lid,eye})=>{
 const i=new Image();i.src=data;await i.decode();const [x,y,w,h]=eye.cropRect,c=document.createElement('canvas');c.width=w;c.height=h;
 const ctx=c.getContext('2d');ctx.drawImage(i,x,y,w,h,0,0,w,h);
 const line=(points,color)=>{ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();points.forEach((p,k)=>ctx[k?'lineTo':'moveTo'](p.x-x,p.y-y));ctx.stroke();};
 for(const a of eye.ambiguities)line([...a.region,a.region[0]].map(p=>({x:p[0],y:p[1]})),'#ff9900');
 line(lid,'#00ff00');
 for(const r of result.rows){if(!r.end)continue;const p=r.end.point;ctx.fillStyle='#ff00ff';ctx.beginPath();ctx.arc(p.x-x,p.y-y,2,0,2*Math.PI);ctx.fill();}
 // Closest three observed stops only for readable labels; all records kept.
 const nearest=result.rows.filter(r=>r.end).sort((a,b)=>a.end.signedLidDistance-b.end.signedLidDistance).slice(0,3);
 ctx.font='14px monospace';
 for(const r of nearest){const p=r.end.point;ctx.fillStyle='#000';ctx.fillRect(p.x-x+4,p.y-y-17,135,17);ctx.fillStyle='#fff';ctx.fillText('seed '+r.rank+' d='+r.end.signedLidDistance.toFixed(1),p.x-x+5,p.y-y-4);}
 return c.toDataURL();
 },{data:'data:image/jpeg;base64,'+source.toString('base64'),result,lid,eye:labels.eyes[side]});
 fs.writeFileSync(path.join(out,result.engine+'-'+side+'.png'),Buffer.from(png.split(',')[1],'base64'),{flag:'wx'});
 }
 fs.writeFileSync(path.join(out,'legend.txt'),'Green: actual FaceMesh upper-lid polyline, not manually annotated roots. Orange: frozen provisional ambiguous region. Magenta: last observed proximal points. Labels: nearest three signed distances, diagnostic only. No bridge or extension drawn.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
