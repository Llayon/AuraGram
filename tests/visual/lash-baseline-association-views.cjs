'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('@playwright/test');
async function main(){
 const [summaryFile,runDir,labelFile,sourceFile,out]=process.argv.slice(2);
 if(!out||fs.existsSync(out))throw Error('Supply baseline census, native run, labels, original JPEG and NEW output');
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),summary=JSON.parse(fs.readFileSync(summaryFile)),labels=JSON.parse(fs.readFileSync(labelFile)),bytes=fs.readFileSync(sourceFile);
 if(hash(bytes)!==labels.sourceSHA256||hash(fs.readFileSync(labelFile))!==summary.labelSHA256)throw Error('Source/labels changed');
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch();
 try{const page=await browser.newPage();for(const record of summary.results){
 const file=path.join(runDir,record.engine+'.json');if(hash(fs.readFileSync(file))!==record.sourceArtifact.sha256)throw Error('Saved paths changed');
 const native=JSON.parse(fs.readFileSync(file)).run[record.side];
 const png=await page.evaluate(async({record,native,eye,data})=>{
 const i=new Image();i.src=data;await i.decode();const [x,y,w,h]=eye.cropRect,c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(i,x,y,w,h,0,0,w,h);
 const line=(pts,color,dashed=false)=>{ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.setLineDash(dashed?[4,3]:[]);ctx.beginPath();pts.forEach((p,k)=>ctx[k?'lineTo':'moveTo'](p.x-x,p.y-y));ctx.stroke();};
 for(const t of record.traces){
 let arc=0;const prefix=[t.pointsSource[0]];for(let k=1;k<t.pointsSource.length;k++){
 const a=t.pointsSource[k-1],b=t.pointsSource[k],len=Math.hypot(b.x-a.x,b.y-a.y),left=t.distalValleyPrefixNativeArc-arc;
 if(left<=0)break;if(left<len){prefix.push({x:a.x+(b.x-a.x)*left/len,y:a.y+(b.y-a.y)*left/len});break;}prefix.push(b);arc+=len;
 }
 line(t.pointsSource,'#ff9900',true);line(prefix,'#00ffff');
 }
 for(const r of native.results)if(r.proximal?.points.length)line(r.proximal.points,'#ff00ff');
 for(const t of eye.tips)line([...t.region,t.region[0]].map(p=>({x:p[0],y:p[1]})),'#ffffff');
 return c.toDataURL();
 },{record,native,eye:labels.eyes[record.side],data:'data:image/jpeg;base64,'+bytes.toString('base64')});
 fs.writeFileSync(path.join(out,record.engine+'-'+record.side+'.png'),Buffer.from(png.split(',')[1],'base64'),{flag:'wx'});
 }fs.writeFileSync(path.join(out,'legend.txt'),'Cyan: measured distal valley prefix in coarse baseline. Dashed orange: entire coarse baseline route including proximal support, not native ownership. Magenta: native observed proximal attempts. White: frozen provisional tip uncertainty. No lash enhancement or gap filling.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
