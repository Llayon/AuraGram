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

export const LASH_ANALYSIS_VERSION = 'g1c1-recovery-5-boundary-context';

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

/** Negative evidence: thin lines continuing THROUGH the expected eyeball
 * and beyond the lower lid are occluders, not upper lashes. Every tracked
 * sample must be an observed transverse dark valley; no gap is filled.
 */
export function crossingHairEvidence(luma,w,h,lid,lower) {
  const at=(arc,t)=>{const u=t*(arc.length-1),i=Math.min(arc.length-2,Math.floor(u)),f=u-i;
    return {x:arc[i].x*(1-f)+arc[i+1].x*f,y:arc[i].y*(1-f)+arc[i+1].y*f};};
  const eyeW=Math.hypot(lid.at(-1).x-lid[0].x,lid.at(-1).y-lid[0].y),paths=[],testedOpenings=[];
  // Sample at approximately two actual ROI pixels, rather than a fixed
  // eleven positions that can miss a strand after a subpixel landmark shift.
  const seedCount=Math.min(96,Math.max(12,Math.ceil(eyeW/2)));
  for(let k=1;k<seedCount;k++) {
    const t=.1+.8*k/seedCount,a=at(lid,t),b=at(lower,t),opening=Math.hypot(b.x-a.x,b.y-a.y);
    testedOpenings.push(opening);
    if(opening<1)continue;
    const nx=(b.x-a.x)/opening,ny=(b.y-a.y)/opening;
    for(const angle of [-Math.PI/4,-Math.PI/8,0,Math.PI/8,Math.PI/4]) {
      const dx=nx*Math.cos(angle)-ny*Math.sin(angle),dy=nx*Math.sin(angle)+ny*Math.cos(angle);
      let x=a.x,y=a.y;const points=[];
      for(let step=0;step<Math.min(64,opening*3+4);step++) {
        let best=.006,next=null;
        for(const offset of [-1,0,1]) {
          const qx=x+dx-dy*offset,qy=y+dy+dx*offset;
          if(qx<3||qx>w-4||qy<3||qy>h-4)continue;
          const value=sample(luma,w,h,qx,qy);
          let contrast=0;
          // Occluding hair bundles can be wider than actual lash ridges.
          // These scales are used only as negative crossing-line evidence.
          for(const radius of [1.5,3,5])contrast=Math.max(contrast,
            Math.min(sample(luma,w,h,qx-dy*radius,qy+dx*radius),sample(luma,w,h,qx+dy*radius,qy-dx*radius))-value);
          const score=contrast-Math.abs(offset)*.002;
          if(score>best){best=score;next={x:qx,y:qy};}
        }
        if(!next)break;
        const axisX=lid.at(-1).x-lid[0].x,axisY=lid.at(-1).y-lid[0].y;
        const axisPosition=((next.x-lid[0].x)*axisX+(next.y-lid[0].y)*axisY)/(eyeW*eyeW);
        // Leaving through a corner is not evidence of crossing an eyeball.
        if(axisPosition<.1||axisPosition>.9)break;
        points.push(next);x=next.x;y=next.y;
        const lowerFrame=lidFrame(lower,lid,x,y);
        const clearance=Math.max(4,opening*.35),progress=(x-a.x)*nx+(y-a.y)*ny;
        if(progress>opening+clearance&&lowerFrame?.distance>clearance) {
          const root=points[0];
          if(!paths.some(p=>Math.hypot(p.root.x-root.x,p.root.y-root.y)<2.5))paths.push({root,dx,dy,points});
          break;
        }
      }
    }
  }
  const span=paths.length?Math.max(...paths.map(p=>p.root.x*(lid.at(-1).x-lid[0].x)+p.root.y*(lid.at(-1).y-lid[0].y)))-Math.min(...paths.map(p=>p.root.x*(lid.at(-1).x-lid[0].x)+p.root.y*(lid.at(-1).y-lid[0].y))):0;
  return {paths,testedOpenings,coveredAxisFraction:eyeW?span/(eyeW*eyeW):0,occluded:paths.length>=2&&span>eyeW*eyeW*.25};
}

/** Minimal pipeline: directional valley filters + connected local tracing.
 * Retains evidence, including rejected traces, for visual audits. No fan.
 * Eight orientations cover both vertical and oblique hairs. A symmetric
 * dark valley rejects step edges; a normal projection rejects lid-parallel
 * eyeliner. A tip is accepted only if an 8-connected path reaches the lid.
 */
export function analyzeLuma(luma, w, h, lid, lower, bandH, inner, brow = [], options={}) {
  const n=w*h, ridge=new Uint8Array(n), dx=new Float32Array(n), dy=new Float32Array(n);
  const distance=new Float32Array(n), normalsX=new Float32Array(n), normalsY=new Float32Array(n);
  const valid=new Uint8Array(n), rootSupport=new Uint8Array(n), sharp=new Float32Array(n);
  const responseMap=new Float32Array(n), anisotropy=new Float32Array(n);
  const densityConfidenceMap=new Uint8Array(n), densityRidge=new Uint8Array(n),ridgeResponseMap=new Uint8Array(n),contextOrientation=new Uint8Array(n);
  const directions=Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/8),y:Math.sin(i*Math.PI/8)}));
  const eyeW=Math.hypot(lid.at(-1).x-lid[0].x,lid.at(-1).y-lid[0].y);
  const crossing=crossingHairEvidence(luma,w,h,lid,lower);
  const crossesHair=(x,y)=>crossing.paths.some(p=>{
    const along=(x-p.root.x)*p.dx+(y-p.root.y)*p.dy;
    return along<=2&&Math.abs((x-p.root.x)*p.dy-(y-p.root.y)*p.dx)<2.5;
  });
  if(crossing.occluded)return {ridge,ridgeResponseMap,densityRidge,densityConfidenceMap,rootConnectionMap:new Uint8Array(n),
    densityConfidence:0,lengthConfidence:0,confidence:0,reason:'crossing-structures',tips:[],traces:[],sharp01:0,coverage:0,contrast01:0,
    diagnostics:{potentialRidgePixels:0,densityPixels:0,tracingSeeds:0,tracedStructures:0,rejectionCounts:{},crossing},
    typedArrayBytes:n*49,retainedTypedArrayBytes:n*5};
  let count=0, hits=0, lapSum=0, contrastSum=0;
  let measuredContextPixels=0;
  function measureRidges(maxDistance, minDistance = 0) {
  for(let y=3;y<h-3;y++) for(let x=3;x<w-3;x++) {
    if(minDistance>0 && valid[y*w+x])continue;
    const i=y*w+x, f=lidFrame(lid,lower,x,y);
    if(!f || f.distance<0.5 || f.distance<=minDistance || f.distance>maxDistance || Math.hypot(x-inner.x,y-inner.y)<eyeW*.12||crossesHair(x,y)) continue;
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
    sharp[i]=lap;
    if(f.distance<=bandH){lapSum+=lap;count++;}
    else measuredContextPixels++;
    let best=0, bx=0, by=0, bestIndex=0;
    const responses=[];
    for(let directionIndex=0;directionIndex<directions.length;directionIndex++) {
      const d=directions[directionIndex];
      // Tangent must leave the lid, rather than run along eyeliner.
      // Compare ALL directions first; otherwise an eyeliner ridge can
      // masquerade as the second-best oblique response.
      const px=-d.y, py=d.x;
      // Along-axis support suppresses isolated JPEG dots and noise.
      const along=(sample(luma,w,h,x+d.x,y+d.y)+sample(luma,w,h,x-d.x,y-d.y))*.5;
      let response=0;
      // A decoded900px portrait can contain subpixel-width hairs next to
      // darker makeup. A1.5px transverse probe can cross that background
      // boundary; the0.75px probe tests the actual finer local valley.
      for(const radius of [.75,1.5]) {
        const l=sample(luma,w,h,x+px*radius,y+py*radius),r=sample(luma,w,h,x-px*radius,y-py*radius);
        const l2=sample(luma,w,h,x+px*radius*5/3,y+py*radius*5/3),r2=sample(luma,w,h,x-px*radius*5/3,y-py*radius*5/3);
        const valley=Math.min(l-v,r-v,(l2+r2)*.5-v);
        response=Math.max(response,valley-Math.max(0,along-v)*.5);
      }
      responses.push(response);
      if(response>best) { best=response; bx=d.x; by=d.y; bestIndex=directionIndex; }
    }
    if(best<.006 || Math.abs(bx*f.nx+by*f.ny)<.35) continue;
    if(bx*f.nx+by*f.ny<0) { bx=-bx; by=-by; }
    dx[i]=bx; dy[i]=by;
    responseMap[i]=best;
    ridgeResponseMap[i]=Math.round(Math.min(1,best/.15)*255);
    anisotropy[i]=Math.max(0,(best-Math.max(0,responses[(bestIndex+4)%8]))/best);
    ridge[i]=Math.round(255*smoothstep(.018,.09,best));
    if(ridge[i]>40 && f.distance<=bandH) { hits++; contrastSum+=best; }
  }
  }
  measureRidges(bandH);
  // A contrast transition can tie several filter directions at one observed
  // pixel. Resolve only a single ambiguous sample bracketed by two directly
  // observed, aligned valleys. Context-resolved pixels cannot propagate this
  // rule, and the transverse dark valley must still exist in the image.
  let contextualSamples=0, baselineDirectionUpdates=0;
  function resolveContextDirections() {
  for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++) {
    const i=y*w+x;
    if(!responseMap[i]||anisotropy[i]>=.5)continue;
    for(let oy=-1;oy<=1&&!contextOrientation[i];oy++)for(let ox=-1;ox<=1&&!contextOrientation[i];ox++) {
      if(!ox&&!oy)continue;
      const j=(y+oy)*w+x+ox,k=(y-oy)*w+x-ox;
      if(anisotropy[j]<.5||anisotropy[k]<.5||contextOrientation[j]||contextOrientation[k])continue;
      const agreement=Math.abs(dx[j]*dx[k]+dy[j]*dy[k]);
      if(agreement<.85||Math.abs((ox*dx[j]+oy*dy[j])/Math.hypot(ox,oy))<.7)continue;
      const px=-dy[j],py=dx[j];
      const valley=Math.min(sample(luma,w,h,x+px*1.5,y+py*1.5),sample(luma,w,h,x-px*1.5,y-py*1.5))-luma[i];
      if(valley<.006)continue;
      dx[i]=dx[j];dy[i]=dy[j];anisotropy[i]=Math.min(anisotropy[j],anisotropy[k]);
      if(measuredContextPixels && distance[i]<=bandH)baselineDirectionUpdates++;
      contextOrientation[i]=1;contextualSamples++;break;
    }
  }
  }
  resolveContextDirections();
  // Density needs local thin-detail evidence, not an entire root-to-tip trace.
  // Compare aligned neighbours and transverse/longitudinal contrast to reject
  // isolated noise and lid-parallel makeup. Do not multiply by global coverage:
  // a sparse eye can contain a few excellent, individually useful hairs.
  // Farther from the lid, a crease can have the same local ridge response.
  // Admit distal density evidence only when observed oriented pixels connect
  // to the proximal zone. This has no tip/length/width/confidence gate and
  // cannot supply a Length candidate; proximal density stays purely local.
  const rootConnectionMap=new Uint8Array(n),queue=new Uint32Array(n);
  let head=0,tail=0;
  for(let i=0;i<n;i++)if(valid[i]&&distance[i]<=2&&(rootSupport[i]||responseMap[i]>=.006)) {
    rootConnectionMap[i]=1;queue[tail++]=i;
  }
  while(head<tail) {
    const i=queue[head++],x=i%w,y=Math.floor(i/w);
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++) {
      if(!ox&&!oy)continue;
      const j=(y+oy)*w+x+ox;
      if(!valid[j]||rootConnectionMap[j]||distance[j]<distance[i]-.15)continue;
      const observed=responseMap[j]>=.006&&anisotropy[j]>=.5;
      if(!observed&&!rootSupport[j])continue;
      const jx=observed?dx[j]:normalsX[j],jy=observed?dy[j]:normalsY[j];
      if((ox*jx+oy*jy)/Math.hypot(ox,oy)<.35)continue;
      if(observed&&responseMap[i]>=.006&&anisotropy[i]>=.5&&Math.abs(dx[i]*jx+dy[i]*jy)<.85)continue;
      rootConnectionMap[j]=1;queue[tail++]=j;
    }
  }
  let densityPixels=0, densityWeight=0;
  for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++) {
    const i=y*w+x;
    if(!responseMap[i])continue;
    let support=0, coherence=0;
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++) {
      if(!ox&&!oy)continue;
      const j=(y+oy)*w+x+ox, alignment=Math.abs((ox*dx[i]+oy*dy[i])/Math.hypot(ox,oy));
      if(alignment<.7||responseMap[j]<.006)continue;
      const sameAxis=Math.abs(dx[i]*dx[j]+dy[i]*dy[j]);
      if(sameAxis<.85)continue;
      support++;coherence+=sameAxis;
    }
    if(!support)continue;
    // Use local Weber contrast: a0.02 valley on a dark lash background is
    // not equivalent to0.02 sensor/JPEG variation on bright skin. The dark
    // denominator floor and absolute observed-response floor remain guards.
    const relativeContrast=responseMap[i]/Math.max(.08,luma[i]+responseMap[i]);
    const contrast=smoothstep(.025,.18,relativeContrast);
    const shape=smoothstep(.2,.75,anisotropy[i]);
    const continuity=Math.min(1,support/2)*coherence/support;
    // Density strengthens the proximal hair band. The larger analysis zone
    // is needed to find tips, but its distal boundary often contains eyelid
    // creases/makeup. Keep those outside the density evidence by distance,
    // without requiring a complete connected Length trace.
    const proximal=smoothstep(.5,2,distance[i])*Math.max(1-smoothstep(bandH*.4,bandH*.55,distance[i]),rootConnectionMap[i]);
    // These correlated measurements are not independent probabilities.
    // The weakest supported local feature bounds strength; multiplying all
    // three would repeatedly attenuate the same faint observed structure.
    const q=Math.min(contrast,shape,continuity)*proximal;
    densityConfidenceMap[i]=Math.round(q*255);
    if(q<=0)continue;
    // fillDensityRGBA's existing .25 noise floor stays unchanged. Encode the
    // supported local score into that signal domain once, avoiding a second
    // accidental hard rejection of weak but coherent observed valleys.
    densityRidge[i]=Math.round(255*(.25+.75*q));
    densityPixels++;densityWeight+=q;
  }
  const traces=[], tips=[], used=new Uint8Array(n), rejectionCounts={};
  const clippedSeeds=[];
  let tracingPhase='baseline';
  let tracedStructures=0;
  const recordTrace=trace=>{
    if(tracingPhase==='boundary-context')trace.boundaryRecovery=true;
    tracedStructures++;
    rejectionCounts[trace.reason]=(rejectionCounts[trace.reason]||0)+1;
    if(traces.length<128)traces.push(trace);
  };
  const seeds=[];
  for(let i=0;i<n;i++) if(ridge[i]>60 && distance[i]>Math.max(3,bandH*.18)) seeds.push(i);
  seeds.sort((a,b)=>distance[b]-distance[a] || ridge[b]-ridge[a] || a-b);
  function traceSeeds(seedList, searchBandH) {
  for(const strongSeed of seedList) {
    if(tips.length>=48) break;
    if(used[strongSeed]) continue;
    // Strong seeds are not automatically visible tips. Follow actual faint
    // valleys outwards first, so extension starts AFTER observed structure.
    let seed=strongSeed;
    const outwardPath=[seed],outwardSeen=new Set(outwardPath);
    for(let step=0;step<Math.min(128,bandH*3);step++) {
      const cx=seed%w,cy=Math.floor(seed/w);let next=-1,best=-Infinity;
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++) {
        if(!ox&&!oy)continue;
        const j=(cy+oy)*w+cx+ox;
        if(!valid[j]||responseMap[j]<.006||anisotropy[j]<.5||outwardSeen.has(j)||distance[j]<distance[seed]-.15)continue;
        const align=(ox*dx[seed]+oy*dy[seed])/Math.hypot(ox,oy);
        const coherent=Math.abs(dx[seed]*dx[j]+dy[seed]*dy[j]);
        if(align<.6||coherent<.85)continue;
        const score=align+coherent+responseMap[j];
        if(score>best){best=score;next=j;}
      }
      if(next<0)break;
      seed=next;outwardSeen.add(seed);outwardPath.push(seed);
    }
    if(distance[seed]>=searchBandH-1.5||seed%w<=3||seed%w>=w-4||Math.floor(seed/w)<=3||Math.floor(seed/w)>=h-4) {
      if(tracingPhase==='baseline')clippedSeeds.push(strongSeed);
      recordTrace({points:outwardPath.map(i=>({x:i%w,y:Math.floor(i/w)})),reason:'clipped-tip',confidence:0});
      continue;
    }
    const path=[seed], seen=new Set(path); let cur=seed;
    // Trace inwards. Every step is a real adjacent ridge, no gap bridging.
    for(let step=0;step<Math.min(128,bandH*3);step++) {
      if(distance[cur]<=2) break;
      const cx=cur%w, cy=Math.floor(cur/w); let next=-1, best=-Infinity;
      for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++) {
        if(!ox&&!oy) continue;
        const j=(cy+oy)*w+cx+ox;
        // A faint valley can remain observed after its byte ridge score falls
        // below the strong-seed threshold. It must still be anisotropic and
        // aligned; no missing pixel or arbitrary geometric gap is bridged.
        const faintValley=responseMap[j]>=.006&&anisotropy[j]>=.5;
        if(!valid[j]||(ridge[j]<25&&!rootSupport[j]&&!faintValley)||seen.has(j)||distance[j]>distance[cur]+.15) continue;
        const len=Math.hypot(ox,oy);
        const hasDirection=dx[cur]!==0||dy[cur]!==0;
        const cxDir=hasDirection?dx[cur]:normalsX[cur],cyDir=hasDirection?dy[cur]:normalsY[cur];
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
    const measured=path.filter(i=>responseMap[i]>=.006&&anisotropy[i]>=.5);
    // Fit the local distal hair, not the broad dark root's route to the lid.
    const distal=[];
    const observed=[];
    for(let k=0;k<path.length;k++) {
      if(responseMap[path[k]]<.006||anisotropy[path[k]]<.5)break;
      observed.push(points[k]);
    }
    for(let k=0;k<path.length&&distal.length<5;k++) {
      if(responseMap[path[k]]<.006||anisotropy[path[k]]<.5)break;
      distal.push(points[k]);
    }
    const tail=distal.at(-1)||tip;
    let tx=tip.x-tail.x, ty=tip.y-tail.y, tl=Math.hypot(tx,ty);
    if(tl) {tx/=tl;ty/=tl;}
    const distalLength=distal.slice(1).reduce((a,p,k)=>a+Math.hypot(p.x-distal[k].x,p.y-distal[k].y),0);
    const continuity=distalLength?tl/distalLength:0;
    const coherence=distal.reduce((a,p)=>a+Math.abs(dx[p.y*w+p.x]*tx+dy[p.y*w+p.x]*ty),0)/Math.max(1,distal.length);
    const contrast=measured.reduce((a,i)=>a+smoothstep(.006,.09,responseMap[i]),0)/Math.max(1,measured.length);
    const sharpness=measured.reduce((a,i)=>a+sharp[i],0)/Math.max(1,measured.length);
    const connected=distance[cur]<=2;
    const outward=tx*normalsX[seed]+ty*normalsY[seed];
    const reason=measured.length<4||distal.length<3?'short-measured':!connected?'disconnected':length<4?'short':continuity<.82?'curved-or-branch':coherence<.85?'orientation':outward<.4?'eyeliner':sharpness<.025?'blur':contrast<.22?'contrast':'ok';
    const c=Math.min(continuity,coherence,smoothstep(.02,.1,sharpness),smoothstep(.15,.6,contrast));
    const observedLength=observed.slice(1).reduce((a,p,k)=>a+Math.hypot(p.x-observed[k].x,p.y-observed[k].y),0);
    const trace={points,reason,confidence:c,connected,length,observedLength,continuity,coherence,contrast,sharpness,outward,
      measuredCount:measured.length,distalCount:distal.length,rootDistance:distance[cur],tipDistance:distance[seed],
      meanResponse:path.reduce((a,i)=>a+responseMap[i],0)/path.length,
      endpointProfile:[.5,1,2,3].map(t=>({distance:t,lumaRise:sample(luma,w,h,tip.x+tx*t,tip.y+ty*t)-luma[seed]}))};
    if(reason!=='ok'||c<.45) { if(reason==='ok')trace.reason='weak-confidence';recordTrace(trace);continue; }
    const center=luma[seed],px=-ty,py=tx;
    let width=0;
    for(const sign of [-1,1]) {
      let radius=.5;
      const halfContrast=Math.min(.05,responseMap[seed]*.5);
      while(radius<3 && sample(luma,w,h,tip.x+px*radius*sign,tip.y+py*radius*sign)-center<halfContrast)radius+=.5;
      width+=radius;
    }
    if(width>4){trace.reason='wide';recordTrace(trace);continue;} // thick makeup / clump is not a fine hair
    if(tracingPhase==='boundary-context') {
      // Only revisit the former endpoint guard. The same measured path must
      // still reach the lid and pass the existing renderer confidence gates.
      const sharpGate=smoothstep(.005,.035,count?lapSum/count:0);
      if(distance[seed]<bandH-1.5 || c<.6 || c*sharpGate<.25)continue;
      const prefix=points.slice(0,distal.length);
      const overlapsDistalPath=tips.some(existing=>{
        if(Math.abs(existing.dx*tx+existing.dy*ty)<.85)return false;
        const other=existing.evidence.points.slice(0,existing.evidence.distalCount);
        const close=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<=1;
        // Use both observed distal prefixes, never the merged root route.
        return prefix.filter(p=>other.some(q=>close(p,q))).length>=3 &&
          other.filter(p=>prefix.some(q=>close(p,q))).length>=3;
      });
      if(overlapsDistalPath){trace.reason='duplicate-distal-path';recordTrace(trace);continue;}
      trace.referenceBandH=bandH;trace.searchBandH=searchBandH;trace.clippedSeed=strongSeed;
      trace.endpointRidgeProfile=[-2,-1,0,.5,1,1.5,2,3].map(offset=>{
        const x=tip.x+tx*offset,y=tip.y+ty*offset,center=sample(luma,w,h,x,y);
        const along=(sample(luma,w,h,x+tx,y+ty)+sample(luma,w,h,x-tx,y-ty))*.5;
        let response=0,transverseContrast=-Infinity;
        for(const radius of [.75,1.5]){
          const left=sample(luma,w,h,x-ty*radius,y+tx*radius),right=sample(luma,w,h,x+ty*radius,y-tx*radius);
          const farLeft=sample(luma,w,h,x-ty*radius*5/3,y+tx*radius*5/3),farRight=sample(luma,w,h,x+ty*radius*5/3,y-tx*radius*5/3);
          const valley=Math.min(left-center,right-center,(farLeft+farRight)*.5-center);
          transverseContrast=Math.max(transverseContrast,valley);
          response=Math.max(response,valley-Math.max(0,along-center)*.5);
        }
        return {offset,center,transverseContrast,response};
      });
      if(trace.endpointRidgeProfile.find(p=>p.offset===0).response<.006){
        trace.reason='weak-fitted-tip-direction';recordTrace(trace);continue;
      }
      // An orientation failure alone is not a visible endpoint. Confirm that
      // the measured transverse valley falls below the existing observation
      // floor over consecutive samples beyond the tip, even on a darkening
      // background. Do not mistake background luma slope for a hair ending.
      if(trace.endpointRidgeProfile.some(p=>p.offset>=1&&p.offset<=2&&p.response>=.006)){
        trace.reason='continuing-transverse-ridge';recordTrace(trace);continue;
      }
    }
    recordTrace(trace);
    tips.push({x:(tip.x+.5)/w,y:(tip.y+.5)/h,dx:tx,dy:ty,c,length:observedLength,width,
      evidence:trace});
    for(const i of path) {
      const x=i%w,y=Math.floor(i/w);
      for(let oy=-2;oy<=2;oy++) for(let ox=-2;ox<=2;ox++) if(x+ox>=0&&x+ox<w&&y+oy>=0&&y+oy<h) used[(y+oy)*w+x+ox]=1;
    }
  }
  }
  traceSeeds(seeds,bandH);
  const baselineTipCount=tips.length;
  const referenceSharpGate=smoothstep(.005,.035,count?lapSum/count:0);
  const baselineLengthConfidence=tips.reduce((maximum,tip)=>Math.max(maximum,tip.c),0)*referenceSharpGate;
  let lengthSearchBandH=bandH;
  if(options.recoverBoundaryTips && clippedSeeds.length && tips.length<48 && referenceSharpGate>=.25) {
    // Context is for Length only. Freeze the already-computed Density maps
    // before measuring an extra filter-support radius (2.5px) plus the
    // existing endpoint guard (1.5px). Root/skin/brow/seed scales stay bandH.
    lengthSearchBandH=Math.min(h*.45,bandH+4);
    if(lengthSearchBandH>bandH) {
      measureRidges(lengthSearchBandH,bandH);
      resolveContextDirections();
      tracingPhase='boundary-context';
      traceSeeds(clippedSeeds,lengthSearchBandH);
    }
  }
  const sharp01=count?lapSum/count:0, coverage=count?hits/count:0, contrast01=hits?contrastSum/hits:0;
  // Pixel coverage is not column coverage: gate separately from legacy score.
  const sharpGate=smoothstep(.005,.035,sharp01);
  const densityConfidence=densityPixels?sharpGate:0;
  const lengthConfidence=tips.reduce((a,t)=>Math.max(a,t.c),0)*sharpGate;
  const boundaryLengthConfidence=tips.slice(baselineTipCount).reduce((maximum,tip)=>Math.max(maximum,tip.c),0)*sharpGate;
  const confidence=Math.max(densityConfidence,lengthConfidence);
  return {ridge,ridgeResponseMap,densityRidge,densityConfidenceMap,rootConnectionMap,densityConfidence,lengthConfidence,baselineLengthConfidence,boundaryLengthConfidence,
    tips,traces,sharp01,coverage,contrast01,confidence,reason:confidence<.01?'blurry':confidence<.25?'weak':'ok',
    diagnostics:{potentialRidgePixels:hits,densityPixels,densityWeight,contextualSamples,tracingSeeds:seeds.length,tracedStructures,rejectionCounts,crossing,
      boundaryContext:{baselineTipCount,recoveredTips:tips.length-baselineTipCount,clippedSeeds:clippedSeeds.length,measuredContextPixels,baselineDirectionUpdates,referenceBandH:bandH,searchBandH:lengthSearchBandH}},
    typedArrayBytes:n*49, retainedTypedArrayBytes:ridge.byteLength+ridgeResponseMap.byteLength+densityRidge.byteLength+densityConfidenceMap.byteLength+rootConnectionMap.byteLength,
    ...(options.debug?{debug:{responseMap,anisotropy,dx,dy,distance,valid}}:{})};
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
    const result=analyzeLuma(luma,rw,rh,lid,lower,bandH,toRoi(eyeDesc.inner),(eyeDesc.browPoints||[]).map(toRoi),{recoverBoundaryTips:true});
    // Sample the actual observed hair colour; no universal black ink.
    for(const tip of result.tips) {
      const p=tip.evidence.points[Math.min(2,tip.evidence.points.length-1)], i=(p.y*rw+p.x)*4;
      tip.color=[data[i],data[i+1],data[i+2]];
    }
    return {...result,side,size,rw,rh,lidRoi:lid.map(p=>({x:p.x/rw,y:p.y/rh})),bandH:bandH/rh,
      lengthBandH:(result.diagnostics?.boundaryContext?.recoveredTips?result.diagnostics.boundaryContext.searchBandH:bandH)/rh,ms:performance.now()-t0};
  } catch(e) { return empty('eye-unusable'); }
  finally { c.width=0;c.height=0; }
}
