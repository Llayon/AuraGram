import {measureCentroid} from './lash-subpixel-center.mjs';

/** One measured centre inside the original coarse pixel cell. No retry,
 * phase selection, angular search or annotation-dependent displacement.
 */
export function initializeNativeCell(luma,w,h,point,axis,cell,protocol) {
 const norm=Math.hypot(axis.x,axis.y);
 if(!cell||![cell.w,cell.h,norm].every(Number.isFinite)||cell.w<1||cell.h<1||norm<1e-8)
  return{accepted:false,reason:'invalid-native-cell'};
 const u={x:axis.x/norm,y:axis.y/norm},normal={x:-u.y,y:u.x};
 const half=Math.min(Math.abs(normal.x)>1e-10?cell.w/(2*Math.abs(normal.x)):Infinity,Math.abs(normal.y)>1e-10?cell.h/(2*Math.abs(normal.y)):Infinity);
 const searchHalfNative=Math.floor((half+1e-10)/.25)*.25;
 if(searchHalfNative<.25)return{accepted:false,reason:'insufficient-native-cell'};
 const m=measureCentroid(luma,w,h,point,u,1.5,{...protocol,searchHalfNative});
 const base={...m,cell:{...cell},searchHalfNative};
 if(!m.accepted)return base;
 // Refuse every separately supported lobe inside the cell, including weaker
 // neighbors below the V2 dominant-peak ratio. Do not choose a convenient one.
 const supported=m.profile.filter(p=>Math.abs(p.offset)<=searchHalfNative+1e-9);
 let bands=0,previous=false;
 for(const p of supported){const on=p.deficit>=.006;if(on&&!previous)bands++;previous=on;}
 if(bands!==1)return{...base,accepted:false,reason:'multiple-supported-cell-lobes',center:null};
 if(Math.abs(m.center.x-point.x)>=cell.w/2||Math.abs(m.center.y-point.y)>=cell.h/2)
  return{...base,accepted:false,reason:'native-cell-boundary',center:null};
 return{...base,accepted:true,reason:'single-supported-native-cell-centre',supportedBands:bands};
}
