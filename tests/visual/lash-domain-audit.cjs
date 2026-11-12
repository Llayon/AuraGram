'use strict';
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),{loadInputs,hash,archived}=require('./lash-domain-inputs.cjs');
async function main(){
 const name=process.argv[2];if(!name||!/^[\w-]+$/.test(name))throw Error('Supply NEW LASH_RUN');const target='tests/visual/out/'+name;if(fs.existsSync(target))throw Error('Run exists');
 const protocolFile='tests/visual/lash-domain-protocol.json',protocol=JSON.parse(fs.readFileSync(protocolFile)),data=loadInputs();
 for(const[f,d]of Object.entries(protocol.inputs)){const bytes=f.startsWith('tests/visual/out/')?archived(f):fs.readFileSync(f);if(hash(bytes)!==d)throw Error('Protocol input drift');}
 for(const[f,d]of Object.entries({...protocol.images,...protocol.modules}))if(hash(fs.readFileSync(f))!==d)throw Error('Image/module drift '+f);
 if(JSON.stringify(data.runs.map(r=>({engine:r.engine,file:r.file,sourceKind:r.sourceKind})))!==JSON.stringify(protocol.cases))throw Error('Case drift');
 const {eyeFrame,measureDomainPoint}=await import(pathToFileURL(path.resolve('tests/visual/lash-domain.mjs'))),{lashRoiSize}=await import(pathToFileURL(path.resolve('src/retouch/eyeGeometry.mjs')));
 const result={protocolSHA256:hash(fs.readFileSync(protocolFile)),harnessSHA256:hash(fs.readFileSync(__filename)),helperSHA256:hash(fs.readFileSync('tests/visual/lash-domain.mjs')),inputHelperSHA256:hash(fs.readFileSync('tests/visual/lash-domain-inputs.cjs')),meaning:'Offline geometry only; no source pixels changed. Outside predicted opening is not semantic skin. Crossing observations can be real lashes, folds or foreign hair. No precision/recall or accepted endpoint claim.',runs:[],excludedLabels:data.labels.filter(l=>!data.runs.some(r=>r.file===l.file)).map(l=>({id:l.id,file:l.file,reason:'No frozen usable FaceMesh; no invented geometry'}))};
 for(const r of data.runs){
  const record={engine:r.engine,file:r.file,W:r.W,H:r.H,imagePath:r.imagePath,imageSHA256:r.imageSHA256,sourceKind:r.sourceKind,eyes:{},labels:[]};
  for(const side of ['left','right']){
   const e=r.geometry[side],convert=a=>a.map(p=>({x:p.x*r.W,y:p.y*r.H})),upper=convert(e.upperLid),lower=convert(e.lowerLid),frame=eyeFrame(upper,lower),size=lashRoiSize(e.roi,r.W,r.H,{maxSide:224}),cross=r.crossing[side];
   const point=p=>({x:(e.roi.x0+p.x/size.w*(e.roi.x1-e.roi.x0))*r.W,y:(e.roi.y0+p.y/size.h*(e.roi.y1-e.roi.y0))*r.H});
   const paths=cross.paths.map((p,i)=>{const points=p.points.map(point),measurements=points.map(p=>measureDomainPoint(p,upper,lower,protocol.geometryOptions));return{index:i,points,pointCount:points.length,insideOpeningPoints:measurements.filter(m=>m.polygon.inside).length,clearOutsidePoints:measurements.filter(m=>m.clearlyOutside).length,belowByDepth:protocol.geometryOptions.depthRatios.map((depth,k)=>({depth,points:measurements.filter(m=>m.belowProbe[k].contains).length}))};});
   record.eyes[side]={upper,lower,roi:e.roi,frame,workingSize:size,crossing:{pathCount:paths.length,occluded:cross.occluded,lengthAbstain:cross.lengthAbstain,coveredAxisFraction:cross.coveredAxisFraction},paths,apertureSweep:protocol.apertureCutoffs.map(cutoff=>({cutoff,geometryBelowCutoff:frame.apertureMedian<=cutoff,geometricBelowPathCounts:protocol.geometryOptions.depthRatios.map((depth,k)=>({depth,paths:frame.apertureMedian<=cutoff?paths.filter(p=>p.belowByDepth[k].points>0).length:0}))}))};
  }
  for(const l of data.labels.filter(l=>l.file===r.file)){
   const candidates=Object.entries(record.eyes).map(([side,e])=>({side,measurement:measureDomainPoint(l.tip,e.upper,e.lower,{...protocol.geometryOptions,uncertainty:l.uncertainty})})).sort((a,b)=>a.measurement.nearest.distance-b.measurement.nearest.distance);
   const selected=candidates[0],eye=record.eyes[selected.side];record.labels.push({...l,...selected,apertureMedian:eye.frame.apertureMedian,shaft:l.shaft.map(p=>({point:p,measurement:measureDomainPoint(p,eye.upper,eye.lower,{...protocol.geometryOptions,uncertainty:l.uncertainty})})),apertureSweep:protocol.apertureCutoffs.map(cutoff=>({cutoff,geometryBelowCutoff:eye.frame.apertureMedian<=cutoff}))});
  }
  result.runs.push(record);
 }
 fs.mkdirSync(target,{recursive:true});fs.writeFileSync(target+'/audit.json',JSON.stringify(result,null,2)+'\n');fs.writeFileSync(target+'/protocol.json',fs.readFileSync(protocolFile));
 const rows=['engine,file,side,aperture_median,geometry_usable,crossing_paths,whole_eye_veto,length_veto,below025_paths,below050_paths'];
 for(const r of result.runs)for(const[s,e]of Object.entries(r.eyes))rows.push([r.engine,r.file,s,e.frame.apertureMedian,e.frame.validity.usable,e.paths.length,e.crossing.occluded,e.crossing.lengthAbstain,...[0,1].map(k=>e.paths.filter(p=>p.belowByDepth[k].points>0).length)].join(','));fs.writeFileSync(target+'/eyes.csv',rows.join('\n')+'\n');
 console.log('Measured',result.runs.length,'cases;',result.runs.flatMap(r=>r.labels).length,'engine/label observations; no inference/render.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
