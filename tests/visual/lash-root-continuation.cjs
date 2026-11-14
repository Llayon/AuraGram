'use strict';
// Offline counterfactual. No product changes or learned/tuned thresholds.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const crypto = require('crypto'), {spawn} = require('child_process');
const {chromium, webkit, devices} = require('@playwright/test');
async function main() {
  const name = process.argv[2], engine = process.argv.includes('--webkit') ? webkit : chromium;
  if (!name || !/^[\w-]+$/.test(name)) throw Error('Supply NEW run name');
  const out = path.join(__dirname, 'out', name);
  fs.mkdirSync(out, {recursive:true});
  fs.writeFileSync(path.join(out, engine.name()+'.started'), 'started', {flag:'wx'});
  const evidence = path.join(__dirname, 'crossing-evidence');
  const hash = b => crypto.createHash('sha256').update(b).digest('hex');
  const packed = file => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
  const sweepPath = path.join(evidence, 'final-sweep-'+engine.name()+'.json.gz');
  const sweep = packed(sweepPath);
  const geometryFiles = {older:path.join(__dirname,'localization-evidence/geometry.json.gz'),
    ...Object.fromEntries(['chromium','webkit'].map(e=>[e,path.join(__dirname,'expanded-evidence/geometry-'+e+'.json.gz')]))};
  for(const [key,file] of Object.entries(geometryFiles))if(hash(fs.readFileSync(file))!==sweep.geometryHashes[key])throw Error('Geometry hash mismatch');
  const older = packed(path.join(__dirname, 'localization-evidence/geometry.json.gz'));
  const expanded = Object.fromEntries(['chromium','webkit'].map(e => [e, packed(path.join(__dirname, 'expanded-evidence/geometry-'+e+'.json.gz'))]));
  const bundle = packed(path.join(evidence, 'candidate-sources.json.gz'));
  for (const [file, entry] of Object.entries(bundle)) {
    const bytes = Buffer.from(entry.base64, 'base64');
    if (hash(bytes) !== entry.sha256) throw Error('Bundle hash mismatch');
    const target = path.join(out, 'frozen-src', file);
    if (fs.existsSync(target)) { if(hash(fs.readFileSync(target))!==entry.sha256) throw Error('Frozen graph differs'); }
    else { fs.mkdirSync(path.dirname(target), {recursive:true}); fs.writeFileSync(target, bytes, {flag:'wx'}); }
  }
  const sourceIndex = JSON.parse(fs.readFileSync(path.join(evidence,'sources.json'))).sources;
  const images = new Map();
  const jobs = sweep.results.map(run => {
    const geometry = run.geometryLabel === 'older-chromium-control' ? older : expanded[run.geometryLabel.replace(/^(closed|actual)-/, '')];
    const record = geometry.runs.find(r => r.file === run.file);
    if (!record?.geometry) throw Error('Missing frozen geometry');
    const entry = sourceIndex.find(r => r.file === run.file), bytes = fs.readFileSync(path.join(evidence,entry.path));
    if (hash(bytes) !== sweep.imageHashes[run.file]) throw Error('JPEG mismatch');
    images.set(run.file, bytes);
    return {run, record};
  });
  const server = spawn(process.execPath, ['tests/static-server.cjs','0'], {windowsHide:true,stdio:['ignore','pipe','inherit']});
  let browser;
  const manifest = {engine:engine.name(), hypothesis:'Last <=5 connected proximal-path pixels, not a validated fiber tangent; unchanged crossing scanner thresholds. Counterfactual would permit any candidate without demonstrated crossing, which is unsafe if unresolved negatives escape.',
    sweepSHA256:hash(fs.readFileSync(sweepPath)), scriptSHA256:hash(fs.readFileSync(__filename)),
    bundleSHA256:hash(fs.readFileSync(path.join(evidence,'candidate-sources.json.gz'))),geometryHashes:sweep.geometryHashes,imageHashes:sweep.imageHashes,results:[]};
  try {
    const url = await new Promise((resolve,reject) => { server.stdout.on('data', b => {const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);}); server.on('error',reject); });
    browser = await engine.launch();
    const page = await browser.newPage(engine===webkit ? devices['iPhone 11'] : {});
    const requests=[]; page.on('request',r=>requests.push(new URL(r.url()).pathname));
    await page.route('https://**/*', r => r.abort());
    await page.route('**/__root_test__', r => r.fulfill({body:'<!doctype html><title>Root continuation counterfactual</title>',contentType:'text/html'}));
    await page.route('**/__root_photo__/*', r => r.fulfill({body:images.get(decodeURIComponent(new URL(r.request().url()).pathname.split('/').at(-1))),contentType:'image/jpeg'}));
    await page.exposeFunction('saveRootPNG', (file,data) => {
      if(path.basename(file)!==file)throw Error('Invalid filename');
      fs.writeFileSync(path.join(out,file),Buffer.from(data.split(',')[1],'base64'),{flag:'wx'});
    });
    await page.goto(url+'/__root_test__');
    for (const job of jobs) {
      console.log(engine.name(), job.run.file, job.run.geometryLabel);
      const result = await page.evaluate(async ({job,name,engineName}) => {
        const {lidFrame,lumaOf} = await import('/tests/visual/out/'+name+'/frozen-src/retouch/lashAnalysis.mjs');
        const image = new Image(); image.src='/__root_photo__/'+job.run.file; await image.decode();
        if(image.width!==job.record.W||image.height!==job.record.H)throw Error('Decoded dimensions differ');
        const eyes=[];
        for (const eye of job.run.eyes) {
          const e=job.record.geometry[eye.side],r=eye.roi,w=eye.width,h=eye.height;
          const rawW=(r.x1-r.x0)*image.width,rawH=(r.y1-r.y0)*image.height;
          const c=document.createElement('canvas');c.width=w;c.height=h;
          try {
            c.getContext('2d').drawImage(image,r.x0*image.width,r.y0*image.height,rawW,rawH,0,0,w,h);
            const rgba=c.getContext('2d').getImageData(0,0,w,h).data;
            const luma=Float32Array.from({length:w*h},(_,i)=>lumaOf(rgba[i*4],rgba[i*4+1],rgba[i*4+2])/255);
            const sample=(x,y)=>{x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));const ix=Math.floor(x),iy=Math.floor(y),jx=Math.min(w-1,ix+1),jy=Math.min(h-1,iy+1),fx=x-ix,fy=y-iy;return(luma[iy*w+ix]*(1-fx)+luma[iy*w+jx]*fx)*(1-fy)+(luma[jy*w+ix]*(1-fx)+luma[jy*w+jx]*fx)*fy;};
            const to=p=>({x:(p.x-r.x0)/(r.x1-r.x0)*w,y:(p.y-r.y0)/(r.y1-r.y0)*h});
            const originalUpper=e.upperLid.map(to),originalLower=e.lowerLid.map(to),rows=[];
            for (const row of eye.samples) {
              const candidates=row.actualLengthVerification?.previousCandidates||[];
              if(!candidates.length)continue;
              const shift=a=>a.map(p=>({x:p.x+row.analysisShift.x,y:p.y+row.analysisShift.y}));
              const upper=row.mode==='both-arcs'?shift(originalUpper):originalUpper,lower=shift(originalLower);
              const tested=[];
              for (const candidate of candidates) {
                const points=candidate.evidence.points,root=points.at(-1),tail=points[Math.max(0,points.length-5)];
                const len=Math.hypot(root.x-tail.x,root.y-tail.y),dx=(root.x-tail.x)/len,dy=(root.y-tail.y)/len;
                const frame=lidFrame(upper,lower,root.x,root.y);
                // Match lower arc by upper segment index/interpolation; same canonical topology.
                let best=Infinity,parameter=0;
                for(let k=1;k<upper.length;k++){const a=upper[k-1],b=upper[k],vx=b.x-a.x,vy=b.y-a.y,den=vx*vx+vy*vy;if(!den)continue;const t=Math.max(0,Math.min(1,((root.x-a.x)*vx+(root.y-a.y)*vy)/den)),dist=Math.hypot(root.x-a.x-t*vx,root.y-a.y-t*vy);if(dist<best){best=dist;parameter=(k-1+t)/(upper.length-1);}}
                const u=parameter*(lower.length-1),k=Math.min(lower.length-2,Math.floor(u)),f=u-k,b={x:lower[k].x*(1-f)+lower[k+1].x*f,y:lower[k].y*(1-f)+lower[k+1].y*f};
                const opening=Math.hypot(b.x-frame.x,b.y-frame.y),nx=(b.x-frame.x)/opening,ny=(b.y-frame.y)/opening;
                let x=root.x,y=root.y,stop='step-limit',crossed=false;const continuation=[];
                if(!len||opening<1||dx*nx+dy*ny<=0)stop=!len?'zero-root-tangent':opening<1?'subpixel-opening':'root-tangent-not-inward';
                else for(let step=0;step<Math.min(64,opening*3+4);step++) {
                  let score=.006,next=null;
                  for(const offset of [-1,0,1]){
                    const qx=x+dx-dy*offset,qy=y+dy+dx*offset;if(qx<3||qx>w-4||qy<3||qy>h-4)continue;
                    const center=sample(qx,qy);let contrast=0;
                    for(const radius of [1.5,3,5])contrast=Math.max(contrast,Math.min(sample(qx-dy*radius,qy+dx*radius),sample(qx+dy*radius,qy-dx*radius))-center);
                    const value=contrast-Math.abs(offset)*.002;
                    if(value>score){score=value;next={x:qx,y:qy,contrast,score};}
                  }
                  if(!next){stop='no-observed-valley';break;}
                  const ax=upper.at(-1).x-upper[0].x,ay=upper.at(-1).y-upper[0].y,position=((next.x-upper[0].x)*ax+(next.y-upper[0].y)*ay)/(ax*ax+ay*ay);
                  if(position<.1||position>.9){stop='corner';break;}
                  continuation.push(next);x=next.x;y=next.y;
                  const clearance=Math.max(4,opening*.35),low=lidFrame(lower,upper,x,y),progress=(x-frame.x)*nx+(y-frame.y)*ny;
                  if(progress>opening+clearance&&low?.distance>clearance){crossed=true;stop='observed-through-lower';break;}
                }
                tested.push({candidate,rootTangent:{dx,dy,length:len,inwardDot:dx*nx+dy*ny,source:'connected-proximal-path-not-validated-thin-fiber'},opening,matchedArcParameter:parameter,continuation,crossed,stop,
                  interpretation:crossed?'observed-crossing':'unresolved',counterfactualWouldPermit:!crossed});
              }
              const suffix=`${engineName}-${job.run.file.replace('.jpg','')}-${job.run.geometryLabel}-${eye.side}-${row.mode}-t${row.tangentNative}-n${row.normalNative}`;
              const rx=Math.floor(r.x0*image.width),ry=Math.floor(r.y0*image.height),cw=Math.ceil(r.x1*image.width)-rx,ch=Math.ceil(r.y1*image.height)-ry;
              const display=document.createElement('canvas');display.width=cw;display.height=ch;const context=display.getContext('2d');context.drawImage(image,rx,ry,cw,ch,0,0,cw,ch);
              const stroke=(points,color)=>{if(!points.length)return;context.strokeStyle=color;context.lineWidth=1;context.beginPath();points.forEach((p,i)=>{const x=r.x0*image.width+(p.x+.5)*rawW/w-rx,y=r.y0*image.height+(p.y+.5)*rawH/h-ry;i?context.lineTo(x,y):context.moveTo(x,y);});context.stroke();};
              row.crossing.paths.forEach(p=>stroke(p.points,'#ff4040'));
              tested.forEach(t=>{stroke(t.candidate.evidence.points,t.crossed?'#ffb000':'#00eaff');stroke(t.continuation,'#bb66ff');});
              await window.saveRootPNG(suffix+'.png',display.toDataURL());display.width=display.height=0;
              rows.push({mode:row.mode,tangentNative:row.tangentNative,normalNative:row.normalNative,oldCrossingPaths:row.crossing.paths.length,tested,png:suffix+'.png'});
            }
            eyes.push({side:eye.side,rows});
          } finally {c.width=c.height=0;}
        }
        return {file:job.run.file,geometryLabel:job.run.geometryLabel,eyes};
      },{job,name,engineName:engine.name()});
      manifest.results.push(result);
      fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify(manifest,null,2));
    }
    if(requests.some(p=>/\.(wasm|task)$/.test(p)))throw Error('Unexpected model call');
    const grouped={};
    for(const r of manifest.results)for(const e of r.eyes)for(const row of e.rows){const key=r.file+'/'+r.geometryLabel+'/'+e.side,g=grouped[key]??={conditions:0,candidates:0,observedCrossing:0,unresolved:0,stops:{}};g.conditions++;for(const t of row.tested){g.candidates++;g[t.crossed?'observedCrossing':'unresolved']++;g.stops[t.stop]=(g.stops[t.stop]||0)+1;}}
    manifest.grouped=grouped;manifest.requests=requests;
    fs.writeFileSync(path.join(out,engine.name()+'.json'),JSON.stringify(manifest,null,2));
    console.log(JSON.stringify(grouped,null,2));
  } finally {if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
