'use strict';
// Sparse endpoint correspondence, not whole-eye recall or naturalness approval.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const input=process.argv[2],out=process.argv[3];if(!input||!out||fs.existsSync(out))throw Error('Supply manifest and NEW audit filename');
const m=JSON.parse(fs.readFileSync(input)),freeze=JSON.parse(fs.readFileSync(path.join(__dirname,'lash-positive-freeze.json')));
const {lidFrame}=require(path.resolve(path.dirname(input),'candidate-src/retouch/lashAnalysis.mjs'));
for(const[f,d]of Object.entries(freeze.inputs))if(hash(fs.readFileSync(f))!==d)throw Error('Annotation input changed');
const annotations=['primary','independent'].map(who=>({who,data:JSON.parse(fs.readFileSync(path.join(__dirname,'lash-positive-'+who+'-labels.json')))}));
const pointDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),angle=(x,y)=>Math.atan2(y,x)*180/Math.PI;
const difference=(a,b)=>Math.abs(((a-b+540)%360)-180);
const rows=[],geometrySummary=[];
for(const run of m.runs){if(!run.geometry){geometrySummary.push({file:run.file,status:run.status});continue;}
 for(const budget of run.budgets)for(const[side,a]of Object.entries(budget.eyes)){const r=run.geometry[side].roi,rawW=(r.x1-r.x0)*run.W,rawH=(r.y1-r.y0)*run.H;
  geometrySummary.push({file:run.file,budget:budget.maxSide,side,rw:a.rw,rh:a.rh,scale:{x:a.rw/rawW,y:a.rh/rawH},tips:a.tips.length,eligible:a.tips.filter(t=>t.c>=.6&&a.lengthConfidence>=.25).length,lengthConfidence:a.lengthConfidence,densityConfidence:a.densityConfidence,crossingPaths:a.diagnostics?.crossing?.paths.length||0,lengthAbstention:a.diagnostics?.lengthAbstention,rejectionCounts:a.diagnostics?.rejectionCounts,analysisPairTimes:budget.times,typedArrayBytes:a.typedArrayBytes});
 }
 for(const{who,data}of annotations)for(const view of data.views.filter(v=>v.file===run.file))for(const label of view.labels){
  const rect=view.sourceRectNative,p={x:rect[0]+label.tipNative[0],y:rect[1]+label.tipNative[1]},support=label.shaftPointsNative||label.localProximalNativePoints;
  const proximal=support[0],axis=angle(label.tipNative[0]-proximal[0],label.tipNative[1]-proximal[1]);
  const annotationRadius=label.tipUncertaintyNativePx||label.tipUncertaintyPx;
  for(const budget of run.budgets){const candidates=[];
   const spatial=[];
   for(const[side,a]of Object.entries(budget.eyes)){const r=run.geometry[side].roi,rawW=(r.x1-r.x0)*run.W,rawH=(r.y1-r.y0)*run.H;
    const g=run.geometry[side],to=q=>({x:(q.x-r.x0)/(r.x1-r.x0)*a.rw,y:(q.y-r.y0)/(r.y1-r.y0)*a.rh});
    const q=to({x:p.x/run.W,y:p.y/run.H}),lid=g.upperLid.map(to),low=g.lowerLid.map(to),f=lidFrame(lid,low,q.x,q.y),first=lid[0],last=lid.at(-1),vx=last.x-first.x,vy=last.y-first.y;
    const axisParameter=((q.x-first.x)*vx+(q.y-first.y)*vy)/(vx*vx+vy*vy),mid=lid[Math.floor(lid.length/2)],lowerMid=low[Math.floor(low.length/2)],bandH=Math.max(3,Math.min(a.rh*.45,Math.hypot(mid.x-lowerMid.x,mid.y-lowerMid.y)*.65));
    spatial.push({side,nearestLidSourceDistance:Math.hypot((q.x-f.x)*rawW/a.rw,(q.y-f.y)*rawH/a.rh),insideROI:q.x>=0&&q.x<a.rw&&q.y>=0&&q.y<a.rh,axisParameter,signedDistanceAnalysis:f.distance,bandH,searchBandH:a.diagnostics?.boundaryContext?.searchBandH||bandH,browGuard:(g.browPoints||[]).map(to).some(b=>Math.hypot(q.x-b.x,q.y-b.y)<bandH*.6),innerGuard:Math.hypot(q.x-to(g.inner).x,q.y-to(g.inner).y)<Math.hypot(vx,vy)*.12});
    for(const tip of a.tips)if(tip.c>=.6&&a.lengthConfidence>=.25)candidates.push({side,tip,source:{x:r.x0*run.W+tip.x*rawW,y:r.y0*run.H+tip.y*rawH},axisDegrees:angle(tip.dx*rawW/a.rw,tip.dy*rawH/a.rh),analysisFootprintHalfDiagonal:Math.hypot(rawW/a.rw,rawH/a.rh)/2});
   }
   candidates.sort((a,b)=>pointDistance(a.source,p)-pointDistance(b.source,p));const nearest=candidates[0];
   let trace=null;if(budget.maxSide===224){const all=[];for(const[side,a]of Object.entries(run.perEye)){const r=run.geometry[side].roi,size=budget.eyes[side];for(const t of a.traces||[]){const first=t.points?.[0];if(!first)continue;const source={x:r.x0*run.W+(first.x+.5)/size.rw*(r.x1-r.x0)*run.W,y:r.y0*run.H+(first.y+.5)/size.rh*(r.y1-r.y0)*run.H};all.push({side,reason:t.reason,distance:pointDistance(source,p),confidence:t.confidence,source});}}all.sort((a,b)=>a.distance-b.distance);trace=all[0]||null;}
   const dist=nearest?pointDistance(nearest.source,p):null,angleInInterval=nearest&&label.outwardAngleIntervalDegrees?nearest.axisDegrees>=label.outwardAngleIntervalDegrees[0]&&nearest.axisDegrees<=label.outwardAngleIntervalDegrees[1]:null;
   spatial.sort((a,b)=>a.nearestLidSourceDistance-b.nearestLidSourceDistance);
   rows.push({file:run.file,who,view:view.view,id:label.id,budget:budget.maxSide,annotation:{tipSource:p,radius:annotationRadius,localAxis:axis,angleInterval:label.outwardAngleIntervalDegrees||null},spatialAtAnnotation:spatial[0],nearest:nearest?{...nearest,distance:dist,axisDifference:difference(nearest.axisDegrees,axis),withinAnnotationRadius:dist<=annotationRadius,withinRadiusPlusSampling:dist<=annotationRadius+nearest.analysisFootprintHalfDiagonal,withinAnnotatedAngleInterval:angleInInterval}:null,nearestTrace224:trace});
  }
 }
}
const summary={};for(const who of ['primary','independent'])for(const budget of[224,320,384]){const selected=rows.filter(r=>r.who===who&&r.budget===budget);summary[who+'-'+budget]={labels:selected.length,withinAnnotation:selected.filter(r=>r.nearest?.withinAnnotationRadius).length,withinWithSampling:selected.filter(r=>r.nearest?.withinRadiusPlusSampling).length,withinWithSamplingAndAxis:selected.filter(r=>r.nearest?.withinRadiusPlusSampling&&r.nearest?.withinAnnotatedAngleInterval).length};}
const output={meaning:'Provisional sparse coated-structure correspondence only. Nearest eligible tip is not necessarily same physical hair; ties/nearby hairs need visual review. Sampling radius is deterministic quantization footprint, not statistical uncertainty.',engine:m.engine,manifestSHA256:hash(fs.readFileSync(input)),freezeSHA256:hash(fs.readFileSync(path.join(__dirname,'lash-positive-freeze.json'))),summary,geometrySummary,rows};
fs.writeFileSync(out,JSON.stringify(output,null,2),{flag:'wx'});console.log(JSON.stringify(summary,null,2));
