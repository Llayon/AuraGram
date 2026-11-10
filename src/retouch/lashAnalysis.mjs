/** G1c.1 experimental local lash analysis. Native decoded ROI -> oriented
 * dark valleys -> connected proximal tracing -> measured tip tangent.
 * No MediaPipe rerun, inference service, randomized fan or synthetic detail.
 * Pure math is Node-testable; analyzeEye is the bounded browser adapter.
 * Release status and known false negatives: G1C1_REPORT.md (LENGTH HOLD).
 */
import { lashRoiSize } from './eyeGeometry.mjs';

export function lumaOf(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Interpolate a lid polyline (ROI px coords [{x,y}...] sorted by x) at column x. */
export function lidYAt(lidRoi, x) {
  if (!lidRoi.length) return 0;
  if (x <= lidRoi[0].x) return lidRoi[0].y;
  for (let i = 1; i < lidRoi.length; i++) {
    if (x <= lidRoi[i].x) {
      const a = lidRoi[i - 1], b = lidRoi[i];
      const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }
  return lidRoi[lidRoi.length - 1].y;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Combine quality signals into a 0..1 confidence + machine reason.
 * Pure — fully unit-testable.
 */
export function scoreConfidence({ sharp01, coverage, contrast01, usable }) {
  if (!usable) return { confidence: 0, reason: 'eye-unusable' };
  const sharpGate = smoothstep(0.008, 0.030, sharp01);
  if (sharpGate <= 0.01) return { confidence: 0, reason: 'blurry' };
  const coverGate = smoothstep(0.06, 0.30, coverage);
  if (coverGate <= 0.01) return { confidence: 0, reason: 'sparse' };
  const contrastGate = smoothstep(0.025, 0.10, contrast01);
  const confidence = Math.min(1, coverGate) * sharpGate * (0.35 + 0.65 * contrastGate);
  if (contrastGate <= 0.01) return { confidence, reason: 'low-contrast' };
  return { confidence, reason: confidence < 0.25 ? 'weak' : 'ok' };
}

export const LASH_ANALYSIS_VERSION = 'g1c1-trace-1';

/** Closest point on the canonical upper arc, in actual bitmap pixels.
 * Signed distance is positive OUTSIDE the eye. No screen-y assumption.
 */
export function lidFrame(lid, lower, x, y) {
  let best = Infinity, frame = null;
  const low = lower.reduce((a, p) => ({ x: a.x + p.x / lower.length, y: a.y + p.y / lower.length }), {x:0,y:0});
  for (let k = 1; k < lid.length; k++) {
    const a = lid[k-1], b = lid[k], vx = b.x-a.x, vy = b.y-a.y;
    const len2 = vx*vx+vy*vy;
    if (len2 < 1e-8) continue;
    const t = Math.max(0, Math.min(1, ((x-a.x)*vx+(y-a.y)*vy)/len2));
    const px = a.x+t*vx, py = a.y+t*vy;
    const d2 = (x-px)**2+(y-py)**2;
    if (d2 >= best) continue;
    best = d2;
    let nx = -vy/Math.sqrt(len2), ny = vx/Math.sqrt(len2);
    if (nx*(low.x-px)+ny*(low.y-py)>0) { nx=-nx; ny=-ny; }
    frame = { distance:(x-px)*nx+(y-py)*ny, nx, ny, x:px, y:py };
  }
  return frame;
}

function sample(a, w, h, x, y) {
  x=Math.max(0,Math.min(w-1,x)); y=Math.max(0,Math.min(h-1,y));
  const ix=Math.floor(x), iy=Math.floor(y), jx=Math.min(w-1,ix+1), jy=Math.min(h-1,iy+1);
  const fx=x-ix, fy=y-iy;
  return (a[iy*w+ix]*(1-fx)+a[iy*w+jx]*fx)*(1-fy)+(a[jy*w+ix]*(1-fx)+a[jy*w+jx]*fx)*fy;
}

/** Minimal pipeline: directional valley filters + connected local tracing.
 * Retains evidence, including rejected traces, for visual audits. No fan.
 * Eight orientations cover both vertical and oblique hairs. A symmetric
 * dark valley rejects step edges; a normal projection rejects lid-parallel
 * eyeliner. A tip is accepted only if an 8-connected path reaches the lid.
 */
export function analyzeLuma(luma, w, h, lid, lower, bandH, inner, brow = []) {
  const n=w*h, ridge=new Uint8Array(n), dx=new Float32Array(n), dy=new Float32Array(n);
  const distance=new Float32Array(n), normalsX=new Float32Array(n), normalsY=new Float32Array(n);
  const valid=new Uint8Array(n), rootSupport=new Uint8Array(n), sharp=new Float32Array(n);
  const directions=Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/8),y:Math.sin(i*Math.PI/8)}));
  const eyeW=Math.hypot(lid.at(-1).x-lid[0].x,lid.at(-1).y-lid[0].y);
  let count=0, hits=0, lapSum=0, contrastSum=0;
  for(let y=3;y<h-3;y++) for(let x=3;x<w-3;x++) {
    const i=y*w+x, f=lidFrame(lid,lower,x,y);
    if(!f || f.distance<0.5 || f.distance>bandH || Math.hypot(x-inner.x,y-inner.y)<eyeW*.12) continue;
    // No extrapolation beyond either corner; partial-crop pixels are skipped.
    const a=lid[0], b=lid.at(-1), vx=b.x-a.x, vy=b.y-a.y;
    const u=((x-a.x)*vx+(y-a.y)*vy)/(vx*vx+vy*vy);
    if(u<0 || u>1 || brow.some(p=>Math.hypot(x-p.x,y-p.y)<bandH*.6)) continue;
    valid[i]=1; distance[i]=f.distance; normalsX[i]=f.nx; normalsY[i]=f.ny;
    const v=luma[i];
    // Roots merge into a broad dark lash line. Only within the proximal
    // zone may dark observed pixels connect a measured thin hair to lid.
    const skin = Math.max(sample(luma,w,h,x+f.nx*bandH*.7,y+f.ny*bandH*.7),
      sample(luma,w,h,x+f.nx*bandH*.7+f.ny*3,y+f.ny*bandH*.7-f.nx*3));
    if(f.distance<=Math.max(3,bandH*.35) && skin-v>.07)rootSupport[i]=1;
    const lap=Math.abs(4*v-luma[i-1]-luma[i+1]-luma[i-w]-luma[i+w]);
    sharp[i]=lap; lapSum+=lap; count++;
    let best=0, bx=0, by=0;
    for(const d of directions) {
      // Tangent must leave the lid, rather than run along eyeliner.
      // Compare ALL directions first; otherwise an eyeliner ridge can
      // masquerade as the second-best oblique response.
      const px=-d.y, py=d.x;
      const l=sample(luma,w,h,x+px*1.5,y+py*1.5), r=sample(luma,w,h,x-px*1.5,y-py*1.5);
      const l2=sample(luma,w,h,x+px*2.5,y+py*2.5), r2=sample(luma,w,h,x-px*2.5,y-py*2.5);
      const valley=Math.min(l-v,r-v,(l2+r2)*.5-v);
      // Along-axis support suppresses isolated JPEG dots and noise.
      const along=(sample(luma,w,h,x+d.x,y+d.y)+sample(luma,w,h,x-d.x,y-d.y))*.5;
      const response=valley-Math.max(0,along-v)*.5;
      if(response>best) { best=response; bx=d.x; by=d.y; }
    }
    if(best<.018 || Math.abs(bx*f.nx+by*f.ny)<.35) continue;
    if(bx*f.nx+by*f.ny<0) { bx=-bx; by=-by; }
    dx[i]=bx; dy[i]=by;
    ridge[i]=Math.round(255*smoothstep(.018,.09,best));
    if(ridge[i]>40) { hits++; contrastSum+=best; }
  }
  const traces=[], tips=[], used=new Uint8Array(n);
  const seeds=[];
  for(let i=0;i<n;i++) if(ridge[i]>60 && distance[i]>Math.max(3,bandH*.18)) seeds.push(i);
  seeds.sort((a,b)=>distance[b]-distance[a] || ridge[b]-ridge[a] || a-b);
  for(const seed of seeds) {
    if(tips.length>=48) break;
    if(used[seed]) continue;
    const path=[seed], seen=new Set(path); let cur=seed;
    // Trace inwards. Every step is a real adjacent ridge, no gap bridging.
    for(let step=0;step<Math.min(128,bandH*3);step++) {
      if(distance[cur]<=2) break;
      const cx=cur%w, cy=Math.floor(cur/w); let next=-1, best=-Infinity;
      for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++) {
        if(!ox&&!oy) continue;
        const j=(cy+oy)*w+cx+ox;
        if(!valid[j]||(ridge[j]<25&&!rootSupport[j])||seen.has(j)||distance[j]>distance[cur]+.15) continue;
        const len=Math.hypot(ox,oy);
        const cxDir=dx[cur]||normalsX[cur],cyDir=dy[cur]||normalsY[cur];
        const align=-(ox*cxDir+oy*cyDir)/len;
        const coherence=dx[j]||dy[j]?Math.abs(dx[j]*cxDir+dy[j]*cyDir):1;
        if(align<.25||coherence<.7) continue;
        const score=align+coherence+ridge[j]/510+(distance[cur]-distance[j])*.3;
        if(score>best) { best=score; next=j; }
      }
      if(next<0) break;
      path.push(next); seen.add(next); cur=next;
    }
    const points=path.map(i=>({x:i%w,y:Math.floor(i/w)}));
    const tip=points[0], root=points.at(-1);
    const length=points.slice(1).reduce((a,p,k)=>a+Math.hypot(p.x-points[k].x,p.y-points[k].y),0);
    const continuity=length ? Math.hypot(tip.x-root.x,tip.y-root.y)/length : 0;
    const tail=points[Math.min(4,points.length-1)];
    let tx=tip.x-tail.x, ty=tip.y-tail.y, tl=Math.hypot(tx,ty);
    if(tl) {tx/=tl;ty/=tl;}
    const measured=path.filter(i=>ridge[i]>=25);
    const coherence=measured.reduce((a,i)=>a+Math.abs(dx[i]*tx+dy[i]*ty),0)/Math.max(1,measured.length);
    const contrast=path.reduce((a,i)=>a+ridge[i]/255,0)/path.length;
    const sharpness=path.reduce((a,i)=>a+sharp[i],0)/path.length;
    const connected=distance[cur]<=2;
    const outward=tx*normalsX[seed]+ty*normalsY[seed];
    const reason=measured.length<4?'short-measured':!connected?'disconnected':length<4?'short':continuity<.82?'curved-or-branch':coherence<.85?'orientation':outward<.4?'eyeliner':sharpness<.025?'blur':contrast<.22?'contrast':'ok';
    const c=Math.min(continuity,coherence,smoothstep(.02,.1,sharpness),smoothstep(.15,.6,contrast));
    const trace={points,reason,confidence:c,connected,length,continuity,coherence,contrast,sharpness,outward};
    if(traces.length<128) traces.push(trace);
    if(reason!=='ok'||c<.45) { if(reason==='ok')trace.reason='weak-confidence'; continue; }
    const center=luma[seed],px=-ty,py=tx;
    let width=0;
    for(const sign of [-1,1]) {
      let radius=.5;
      while(radius<3 && sample(luma,w,h,tip.x+px*radius*sign,tip.y+py*radius*sign)-center<.05)radius+=.5;
      width+=radius;
    }
    if(width>4){trace.reason='wide';continue;} // thick makeup / clump is not a fine hair
    tips.push({x:(tip.x+.5)/w,y:(tip.y+.5)/h,dx:tx,dy:ty,c,length,width,
      evidence:trace});
    for(const i of path) {
      const x=i%w,y=Math.floor(i/w);
      for(let oy=-2;oy<=2;oy++) for(let ox=-2;ox<=2;ox++) if(x+ox>=0&&x+ox<w&&y+oy>=0&&y+oy<h) used[(y+oy)*w+x+ox]=1;
    }
  }
  const sharp01=count?lapSum/count:0, coverage=count?hits/count:0, contrast01=hits?contrastSum/hits:0;
  // Pixel coverage is not column coverage: gate separately from legacy score.
  const confidence=smoothstep(.005,.035,sharp01)*smoothstep(.002,.05,coverage)*(.35+.65*smoothstep(.02,.12,contrast01));
  return {ridge,tips,traces,sharp01,coverage,contrast01,confidence,reason:confidence<.01?'blurry':confidence<.25?'weak':'ok',
    typedArrayBytes:n*32, retainedTypedArrayBytes:ridge.byteLength};
}

/** Browser adapter: original decoded image only, one bounded temporary canvas. */
export function analyzeEye(src, eyeDesc, side, budget) {
  const t0=performance.now();
  const empty=reason=>({side,confidence:0,reason,sharp01:0,coverage:0,contrast01:0,tips:[],traces:[],lidRoi:[],bandH:0,rw:0,rh:0,ms:performance.now()-t0});
  if(!eyeDesc?.usable) return empty('eye-unusable');
  const natW=src.naturalWidth||src.width, natH=src.naturalHeight||src.height;
  const size=lashRoiSize(eyeDesc.roi,natW,natH,budget);
  if(size.status!=='ok') return {...empty('low-resolution'),size};
  const {w:rw,h:rh}=size, roi=eyeDesc.roi;
  const c=document.createElement('canvas'); c.width=rw;c.height=rh;
  try {
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(src,roi.x0*natW,roi.y0*natH,size.rawW,size.rawH,0,0,rw,rh);
    const data=ctx.getImageData(0,0,rw,rh).data, luma=new Float32Array(rw*rh);
    for(let i=0;i<luma.length;i++) luma[i]=lumaOf(data[4*i],data[4*i+1],data[4*i+2])/255;
    const toRoi=p=>({x:(p.x-roi.x0)/(roi.x1-roi.x0)*rw,y:(p.y-roi.y0)/(roi.y1-roi.y0)*rh});
    const lid=eyeDesc.upperLid.map(toRoi), lower=eyeDesc.lowerLid.map(toRoi);
    const mid=lid[Math.floor(lid.length/2)], low=lower[Math.floor(lower.length/2)];
    const bandH=Math.max(3,Math.min(rh*.45,Math.hypot(mid.x-low.x,mid.y-low.y)*.65));
    const result=analyzeLuma(luma,rw,rh,lid,lower,bandH,toRoi(eyeDesc.inner),(eyeDesc.browPoints||[]).map(toRoi));
    // Sample the actual observed hair colour; no universal black ink.
    for(const tip of result.tips) {
      const p=tip.evidence.points[Math.min(2,tip.evidence.points.length-1)], i=(p.y*rw+p.x)*4;
      tip.color=[data[i],data[i+1],data[i+2]];
    }
    return {...result,side,size,rw,rh,lidRoi:lid.map(p=>({x:p.x/rw,y:p.y/rh})),bandH:bandH/rh,ms:performance.now()-t0};
  } catch(e) { return empty('eye-unusable'); }
  finally { c.width=0;c.height=0; }
}
