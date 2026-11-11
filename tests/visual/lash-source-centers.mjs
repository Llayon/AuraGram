// Offline experiment. Bilinear interpolation estimates an observed center;
// it supplies no new image detail and is never imported by the app.
function sample(a,w,h,x,y){
  if(x<0||y<0||x>w-1||y>h-1)return null;
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const jx=Math.min(w-1,ix+1),jy=Math.min(h-1,iy+1);
  return (a[iy*w+ix]*(1-fx)+a[iy*w+jx]*fx)*(1-fy)+(a[jy*w+ix]*(1-fx)+a[jy*w+jx]*fx)*fy;
}
export function refineCenters(luma,w,h,points,{radius=2.5,maxShift=.75,angleOffset=0}={}){
  return points.map((p,i)=>{
    const a=points[Math.max(0,i-2)],b=points[Math.min(points.length-1,i+2)];
    let tx=a.x-b.x,ty=a.y-b.y,n=Math.hypot(tx,ty);
    if(!n)return {...p,accepted:false,reason:'no-local-direction',profile:[]};
    tx/=n;ty/=n;const angle=angleOffset*Math.PI/180;
    const nx=-ty*Math.cos(angle)-tx*Math.sin(angle),ny=tx*Math.cos(angle)-ty*Math.sin(angle);
    const left=sample(luma,w,h,p.x-nx*radius,p.y-ny*radius),right=sample(luma,w,h,p.x+nx*radius,p.y+ny*radius);
    if(left===null||right===null)return {...p,accepted:false,reason:'crop-boundary',profile:[]};
    const profile=[];
    for(let k=-Math.round(radius*4);k<=Math.round(radius*4);k++){
      const offset=k/4,value=sample(luma,w,h,p.x+nx*offset,p.y+ny*offset);
      if(value===null)return {...p,accepted:false,reason:'crop-boundary',profile:[]};
      const background=left+(right-left)*(offset+radius)/(2*radius);
      profile.push({offset,value,deficit:background-value});
    }
    const candidates=profile.filter(s=>Math.abs(s.offset)<=maxShift);
    const peak=candidates.reduce((a,b)=>b.deficit>a.deficit?b:a);
    let reason='ok',shift=peak.offset;
    if(peak.deficit<.006)reason='weak-valley';
    else if(Math.abs(peak.offset)>=maxShift)reason='shift-boundary';
    else if(Math.min(left-peak.value,right-peak.value)<.006)reason='one-sided-edge';
    else if(profile.some((s,k)=>k>0&&k<profile.length-1&&Math.abs(s.offset-peak.offset)>.75&&s.deficit>=peak.deficit*.9&&s.deficit>=profile[k-1].deficit&&s.deficit>=profile[k+1].deficit))reason='multiple-valleys';
    // Parabolic interpolation is bounded by the observed neighbouring bins.
    const index=profile.indexOf(peak),previous=profile[index-1],next=profile[index+1];
    if(reason==='ok'&&previous&&next){const denominator=previous.deficit-2*peak.deficit+next.deficit;
      if(denominator>=-1e-8)reason='flat-center';
      else shift+=Math.max(-.125,Math.min(.125,.125*(previous.deficit-next.deficit)/denominator));
    }
    const accepted=reason==='ok';
    return {...p,x:accepted&&i>0?p.x+nx*shift:p.x,y:accepted&&i>0?p.y+ny*shift:p.y,accepted,reason,fixedTip:i===0,shift:accepted&&i>0?shift:0,proposedShift:shift,nx,ny,peakDeficit:peak.deficit,profile};
  });
}

export function windowDirections(points,windows=[2,4,6,8]){
  if(points.length<2)return [];
  const nodes=[{...points[0],arc:0}];let arc=0;
  for(let i=1;i<points.length;i++){arc+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);nodes.push({...points[i],arc});}
  return windows.filter(window=>arc>=window).map(window=>{
    let i=1;while(nodes[i].arc<window)i++;
    const a=nodes[i-1],b=nodes[i],f=(window-a.arc)/(b.arc-a.arc||1),x=a.x+(b.x-a.x)*f,y=a.y+(b.y-a.y)*f;
    const dx=points[0].x-x,dy=points[0].y-y;
    const support=nodes.slice(1,i+1),observed=support.filter(p=>p.accepted!==false).length;
    const anchorProfileAccepted=nodes[0].accepted!==false;
    return {window,angle:Math.atan2(dy,dx)*180/Math.PI,observed,total:support.length,anchorProfileAccepted,allProfilesAccepted:anchorProfileAccepted&&observed===support.length};
  });
}
