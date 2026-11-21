import {insideRegion} from './lash-spatial-match.mjs';
// Post-hoc geometry only. A window overlap is not a detection or path link.
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const on=(a,b,c)=>Math.abs(cross(a,b,c))<1e-8&&c.x>=Math.min(a.x,b.x)-1e-8&&c.x<=Math.max(a.x,b.x)+1e-8&&c.y>=Math.min(a.y,b.y)-1e-8&&c.y<=Math.max(a.y,b.y)+1e-8;
function intersects(a,b,c,d){
 const x=cross(a,b,c),y=cross(a,b,d),u=cross(c,d,a),v=cross(c,d,b);
 return ((x>0&&y<0||x<0&&y>0)&&(u>0&&v<0||u<0&&v>0))||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
export function polygonsOverlap(first,second){
 if(first.length<3||second.length<3)return false;
 const a=first.map(([x,y])=>({x,y})),b=second.map(([x,y])=>({x,y}));
 if([...a,...b].some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return false;
 if(a.some(p=>insideRegion(p,second))||b.some(p=>insideRegion(p,first)))return true;
 return a.some((p,i)=>b.some((q,j)=>intersects(p,a[(i+1)%a.length],q,b[(j+1)%b.length])));
}
export function endingWindow(point,tangent){
 if(!point||!tangent||![point.x,point.y,tangent.x,tangent.y].every(Number.isFinite)||Math.abs(Math.hypot(tangent.x,tangent.y)-1)>1e-6)return null;
 return[[-2,-3],[4,-3],[4,3],[-2,3]].map(([a,b])=>[point.x+tangent.x*a-tangent.y*b,point.y+tangent.y*a+tangent.x*b]);
}
