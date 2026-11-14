import {measureShaftCenter} from './lash-native-shaft.mjs';
import {measureAt} from './lash-endpoint-profile.mjs';

export function inspectLoss(luma,w,h,anchor,axis,loss,{sx,sy,margin,protocol,centerProtocol}) {
 if(!axis.available || loss===null || loss===undefined)return{available:false,outcome:'UNKNOWN',reason:'no-axis-or-recorded-loss',rows:[],endpointConfirmed:false};
 const normal={x:-axis.ty,y:axis.tx},along={x:axis.tx*protocol.alongStepNative,y:axis.ty*protocol.alongStepNative};
 const safeMeasure=point=>{try{return measureAt(luma,w,h,point,along,normal,protocol.radiiNative);}catch(e){if(e.message!=='Profile outside measured bitmap')throw e;return{unavailable:true};}};
 const rows=protocol.lossOffsetsNative.map(offset=>{
  const distanceNative=loss+offset,point={x:anchor.x+axis.tx*distanceNative,y:anchor.y+axis.ty*distanceNative,tx:axis.tx,ty:axis.ty};
  const center=measureShaftCenter(luma,w,h,point,{sx,sy,margin,protocol:centerProtocol}),onAxis=safeMeasure(point),atCenter=center.accepted?safeMeasure(center.center):null;
  const displacedSupport=!!(center.accepted&&!onAxis.unavailable&&atCenter&&!atCenter.unavailable&&Math.abs(center.proposedShift)>centerProtocol.profileStepNative&&onAxis.response<protocol.observationFloor&&atCenter.response>=protocol.observationFloor);
  return{offset,distanceNative,...center,onAxis,atCenter,displacedSupport};
 });
 return{available:true,lossNative:loss,rows,displacedSupportRows:rows.filter(r=>r.displacedSupport).length,outcome:'UNKNOWN',endpointConfirmed:false,meaning:'Transverse image evidence only. Displaced support does not establish ownership or an ending; no rendering.'};
}
