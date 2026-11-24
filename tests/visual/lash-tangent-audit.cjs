'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
async function main(){
  const output=process.argv[2];
  if(!output||fs.existsSync(output))throw new Error('Supply NEW output directory');
  const {distalFits}=await import('./lash-tangent-fit.mjs');
  const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
  const root='tests/visual/localization-evidence';
  const manifestBytes=zlib.gunzipSync(fs.readFileSync(root+'/chromium.json.gz'));
  const geometry=JSON.parse(zlib.gunzipSync(fs.readFileSync(root+'/geometry.json.gz')));
  const manifest=JSON.parse(manifestBytes);
  const inputs=['tests/visual/lash-tangent-primary-labels.json','tests/visual/lash-tangent-independent-labels.json'];
  const result={baseline:'47e8e9e571f025585e5909a006de02cf4fb86b9b',manifestSHA256:hash(manifestBytes),sourceHashes:manifest.sourceHashes,
    diagnosticSourceHashes:Object.fromEntries(['lash-tangent-audit.cjs','lash-tangent-fit.mjs'].map(f=>[f,hash(fs.readFileSync(path.join(__dirname,f)))])),
    annotations:[],eyes:[],method:'Offline fit of existing observed quantized paths only. Diagnostic quadratic fit never enters product. Label intervals are engineering uncertainty, not calibrated confidence or exact tip derivatives.'};
  fs.mkdirSync(output,{recursive:true});const sections=[];
  const angle=(x,y)=>Math.atan2(y,x)*180/Math.PI;
  const vector=(p,degrees,color,length=6,dash='')=>{const a=degrees*Math.PI/180;return `<path d="M${p.x*4},${p.y*4} l${Math.cos(a)*length*4},${Math.sin(a)*length*4}" stroke="${color}" stroke-width="2" ${dash?'stroke-dasharray="4 3"':''}/>`;};
  const line=(points,color)=>`<polyline points="${points.map(p=>`${p.x*4},${p.y*4}`).join(' ')}" stroke="${color}" fill="none" stroke-width="2"/>`;
  for(const file of inputs){const bytes=fs.readFileSync(file),labels=JSON.parse(bytes),name=file.includes('independent')?'independent':'primary';result.annotations.push({file,sha256:hash(bytes)});
    const eyes=Array.isArray(labels.eyes)?labels.eyes:Object.entries(labels.eyes).map(([side,e])=>({file:'natural.jpg',side,strands:e.labels}));
    for(const eye of eyes){const run=manifest.runs.find(r=>r.file===eye.file),g=geometry.runs.find(r=>r.file===eye.file),roi=g.perEye[eye.side].roi;
      const size=g.budgets.find(b=>b.maxSide===224).eyes[eye.side],rawW=(roi.x1-roi.x0)*g.W,rawH=(roi.y1-roi.y0)*g.H;
      const offX=roi.x0*g.W-Math.floor(roi.x0*g.W),offY=roi.y0*g.H-Math.floor(roi.y0*g.H);
      const from=p=>({x:offX+(p.x+.5)*rawW/size.rw,y:offY+(p.y+.5)*rawH/size.rh});
      const candidates=run.eyes[eye.side].contextTips.filter(t=>t.c>=.6&&run.eyes[eye.side].lengthConfidence>=.25).map((t,index)=>{
        const point={x:offX+t.x*rawW,y:offY+t.y*rawH};
        // measuredCount counts ALL observed pixels along the path, not a
        // contiguous distal prefix. Respect the saved observedLength instead.
        const sourcePoints=[];let observedArc=0;
        for(let i=0;i<t.evidence.points.length;i++){
          if(i)observedArc+=Math.hypot(t.evidence.points[i].x-t.evidence.points[i-1].x,t.evidence.points[i].y-t.evidence.points[i-1].y);
          if(observedArc>t.evidence.observedLength+1e-8)break;
          sourcePoints.push(from(t.evidence.points[i]));
        }
        return {index,point,productAngle:angle(t.dx*rawW/size.rw,t.dy*rawH/size.rh),recovered:!!t.evidence.boundaryRecovery,points:sourcePoints,fits:distalFits(sourcePoints)};
      });
      const picturePath=`${root}/images/chromium-natural-original-${eye.side}-4x.png`,picture=fs.readFileSync(picturePath);
      if(labels.provenance?.images?.[eye.side]?.sha256&&hash(picture)!==labels.provenance.images[eye.side].sha256)throw new Error('Annotation original changed');
      const rows=[];let overlay='';
      for(const label of eye.strands){const point={x:label.tip4x[0]/4,y:label.tip4x[1]/4};
        const interval=label.angleIntervalDegrees||label.outwardAngleIntervalDegrees;
        const points=(label.localPoints4x||[...label.proximalCenterSamples4x.map(p=>p.point4x).reverse(),label.tip4x]).map(([x,y])=>({x:x/4,y:y/4}));
        const nearest=candidates.map(c=>({...c,distance:Math.hypot(c.point.x-point.x,c.point.y-point.y)})).sort((a,b)=>a.distance-b.distance)[0];
        const matched=!!nearest&&nearest.distance<=label.tipUncertaintySourcePx;
        const row={id:label.id,status:label.status,interval,tipUncertaintySourcePx:label.tipUncertaintySourcePx,endpointDistance:nearest?.distance,nearestIndex:nearest?.index,positionMatched:matched,productAngle:nearest?.productAngle,
          angleInsideVisualBounds:matched&&nearest.productAngle>=interval[0]&&nearest.productAngle<=interval[1],directionClaim:'Interval membership only, never validation of an exact terminal tangent. Ambiguous and position-unmatched labels cannot establish direction accuracy.',diagnosticFits:nearest?.fits,notes:label.notes};rows.push(row);
        overlay+=line(points,'#ffe04b')+`<circle cx="${point.x*4}" cy="${point.y*4}" r="${label.tipUncertaintySourcePx*4}" fill="none" stroke="#ffe04b"/><text x="${point.x*4+5}" y="${point.y*4-6}" font-size="11" fill="white">${label.id}</text>`;
      }
      for(const c of candidates){overlay+=line(c.points.slice(0,9),'#00eaff')+vector(c.point,c.productAngle,'#00eaff');const q=c.fits.quadratic;if(q)overlay+=vector({x:q.x[0],y:q.y[0]},q.angle,'#ef77ff',6,true);}
      const width=picture.readUInt32BE(16),height=picture.readUInt32BE(20),prefix=name+'-'+eye.side;
      fs.writeFileSync(path.join(output,prefix+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="data:image/png;base64,${picture.toString('base64')}" width="${width}" height="${height}"/>${overlay}</svg>`,{flag:'wx'});
      result.eyes.push({annotator:name,file:eye.file,side:eye.side,imageSHA256:hash(picture),rows,candidates});
      sections.push(`<section><h2>${prefix}</h2><img src="${prefix}.svg" width="${width}" height="${height}"><pre>${JSON.stringify(rows,null,2)}</pre></section>`);
    }
  }
  fs.writeFileSync(path.join(output,'audit.json'),JSON.stringify(result,null,2),{flag:'wx'});
  fs.writeFileSync(path.join(output,'index.html'),'<!doctype html><meta charset="utf-8"><title>Distal tangent — diagnostic HOLD</title><style>body{background:#222;color:#eee;font:16px sans-serif}section{overflow:auto}img{max-width:none}</style><h1>Local distal tangent — no product change</h1><p>Yellow: provisional original-only local paths and uncertainty. Cyan: existing product trace/direction. Dashed magenta: rejected experimental quadratic with up-to8sourcepx support; actual scale is recorded per fit. Diagnostic only. Vectors6nativepx for visibility, not actual product extension. Wide angle intervals are not exact terminal tangents; position-unmatched candidates cannot validate direction. Sparse labels do not yield precision/recall.</p>'+sections.join(''),{flag:'wx'});
  for(const eye of result.eyes)console.log(eye.annotator,eye.side,eye.rows.map(r=>({id:r.id,matched:r.positionMatched,error:r.endpointDistance?.toFixed(2),product:r.productAngle?.toFixed(1),interval:r.interval,quadratic:r.diagnosticFits.quadratic?.angle.toFixed(1),shift:r.diagnosticFits.quadratic?.endpointShift.toFixed(2)})));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
