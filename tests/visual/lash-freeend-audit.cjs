'use strict';
// Posthoc only. Annotation coordinates never reach a browser or image analyzer.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{pathToFileURL}=require('url');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const target=process.argv[2];if(!target||fs.existsSync(target))throw Error('Supply NEW audit JSON');
 const {lidFrame}=await import(pathToFileURL(path.resolve('src/retouch/lashAnalysis.mjs')));
 const inside=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
 const result={harnessSHA256:hash(fs.readFileSync(__filename)),geometryHelperSHA256:hash(fs.readFileSync('src/retouch/lashAnalysis.mjs')),meaning:'Sparse provisional source labels, not exhaustive precision/recall or biological ownership groundtruth. Negative signed distance is below current outward upper-lid policy, not proof a real lash does not exist. Polygon membership is predicted geometry, not segmentation.',inputs:{},sources:[],labels:[]};
 for(const [prefix,run]of [['lash-freeend','freeend-05-analysis'],['lash-freeend2','freeend2-05-analysis']]){
  const f=`tests/visual/${prefix}-independent-labels.json`,bytes=fs.readFileSync(f),labels=JSON.parse(bytes);result.inputs[f]=hash(bytes);
  for(const engine of ['chromium','webkit']){
   const file=`tests/visual/out/${run}/manifest-${engine}.json`,raw=fs.readFileSync(file),record=JSON.parse(raw);result.inputs[file]=hash(raw);
   for(const r of record.runs){result.sources.push({file:r.file,engine,status:r.status,budgets:(r.budgets||[]).map(b=>({maxSide:b.maxSide,analysisMs:b.analysisMs,eyes:Object.fromEntries(Object.entries(b.eyes).map(([s,a])=>[s,{rw:a.rw,rh:a.rh,reason:a.reason,confidence:a.confidence,lengthConfidence:a.lengthConfidence,tips:a.tips.length,typedArrayBytes:a.typedArrayBytes,potential:a.diagnostics?.potentialRidgePixels,densityPixels:a.diagnostics?.densityPixels,seeds:a.diagnostics?.tracingSeeds,traces:a.diagnostics?.tracedStructures,rejections:a.diagnostics?.rejectionCounts,crossingPaths:a.diagnostics?.crossing?.paths?.length}]))}))});
    for(const v of labels.views.filter(v=>v.source===r.file))for(const l of v.labels){const rect=(v.labelCoordinateFrame||v.crop).sourceRectXYWH,p={x:rect[0]+l.tipNative[0],y:rect[1]+l.tipNative[1]},row={id:l.id,file:r.file,engine,sourcePoint:p,uncertainty:l.tipUncertaintyNativePx,status:r.status};
     if(r.status==='ready'){
      const frames=Object.entries(r.geometry).map(([side,e])=>{const convert=a=>a.map(q=>({x:q.x*r.W,y:q.y*r.H})),upper=convert(e.upperLid),lower=convert(e.lowerLid),frame=lidFrame(upper,lower,p.x,p.y);return{side,frame,insidePredictedOpening:inside(p,upper.concat(lower.slice().reverse())),insideROI:p.x>=e.roi.x0*r.W&&p.x<=e.roi.x1*r.W&&p.y>=e.roi.y0*r.H&&p.y<=e.roi.y1*r.H};}).sort((a,b)=>Math.hypot(p.x-a.frame.x,p.y-a.frame.y)-Math.hypot(p.x-b.frame.x,p.y-b.frame.y));
      Object.assign(row,frames[0]);row.currentOutwardSide=frames[0].frame.distance>0;
      row.nearestByBudget=r.budgets.map(b=>{const tips=Object.entries(b.eyes).flatMap(([s,a])=>a.tips.map((t,i)=>{const e=r.geometry[s],x=(e.roi.x0+t.x*(e.roi.x1-e.roi.x0))*r.W,y=(e.roi.y0+t.y*(e.roi.y1-e.roi.y0))*r.H;return{side:s,index:i,x,y,distance:Math.hypot(x-p.x,y-p.y),confidence:t.c};})).sort((a,b)=>a.distance-b.distance);return{maxSide:b.maxSide,nearest:tips[0]||null,withinProvisionalRadius:!!tips[0]&&tips[0].distance<=l.tipUncertaintyNativePx};});
     }result.labels.push(row);
    }
   }
  }
 }
 fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(result.labels.map(l=>({id:l.id,engine:l.engine,status:l.status,signed:l.frame?.distance,insideOpening:l.insidePredictedOpening,insideROI:l.insideROI})));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
