/** Post-hoc baseline trace census. Does not generate seeds or approve tips. */
export function summarizeBaselineTrace(tip,mapping,roiWidth,automaticSeeds,nativeRecords) {
 const points=tip.evidence?.points||[];
 const source=p=>({x:mapping.x+(p.x+.5)*mapping.scaleX-.5,y:mapping.y+(p.y+.5)*mapping.scaleY-.5});
 const native=points.map(source);let roiArc=0,nativeArc=0,prefixNativeArc=0;
 const cutoff=tip.evidence?.observedLength??0;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],step=Math.hypot(b.x-a.x,b.y-a.y),length=Math.hypot(native[i].x-native[i-1].x,native[i].y-native[i-1].y);
  const fraction=step?Math.max(0,Math.min(1,(cutoff-roiArc)/step)):0;
  prefixNativeArc+=length*fraction;roiArc+=step;nativeArc+=length;
 }
 const indices=new Set(points.map(p=>p.y*roiWidth+p.x));
 const sharedSeeds=automaticSeeds.filter(s=>indices.has(s.index)).map(s=>{
  const r=nativeRecords.find(r=>r.rank===s.rank);
  return{rank:s.rank,index:s.index,processed:s.rank<128,status:r?.status??'not-recorded',proximalConnection:r?.proximalConnection??false,proximalStop:r?.proximal?.reason??null};
 });
 return{pointsROI:points,pointsSource:native,connectedAtROIScale:tip.evidence?.connected===true,
  rootDistanceROI:tip.evidence?.rootDistance??null,roiArc,nativeArc,distalValleyPrefixNativeArc:prefixNativeArc,
  afterDistalValleyPrefixNativeArc:Math.max(0,nativeArc-prefixNativeArc),
  tipToRootDistanceNative:native.length?Math.hypot(native[0].x-native.at(-1).x,native[0].y-native.at(-1).y):null,
  fullPathExceeds36:nativeArc>36,distalPrefixExceeds36:prefixNativeArc>36,
  referenceRootGateROI:2,sourceEquivalentRootGateRange:[2*Math.min(mapping.scaleX,mapping.scaleY),2*Math.max(mapping.scaleX,mapping.scaleY)],
  nativeExperimentalRootGate:1.5,sharedAutomaticSeeds:sharedSeeds,
  endpointConfirmed:false,meaning:'Coarse observed route and distal valley prefix; broader proximal support is not native same-fiber ownership. Shared raster indices are not biological identity.'};
}
