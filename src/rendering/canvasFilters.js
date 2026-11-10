(function (root, factory) {
  const api = root.AuraGramCanvasFilters || factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AuraGramCanvasFilters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = value => Math.max(0, Math.min(255, value));
  const cache = new Map();
  let native;
  function nativeSupported() {
    if (native !== undefined) return native;
    if (typeof document === 'undefined') return false;
    const source = document.createElement('canvas'), output = document.createElement('canvas');
    source.width = output.width = 1; source.height = output.height = 1;
    try {
      const a = source.getContext('2d'), b = output.getContext('2d');
      a.fillStyle = 'rgb(96,96,96)'; a.fillRect(0,0,1,1);
      b.filter = 'contrast(200%)'; b.drawImage(source,0,0);
      native = Math.abs(b.getImageData(0,0,1,1).data[0] - 64) <= 1;
    } catch (error) { native = false; }
    finally { source.width = source.height = output.width = output.height = 0; }
    return native;
  }
  function compileFilter(filter) {
    if (cache.has(filter)) return cache.get(filter);
    const stages = []; let variance = 0;
    for (const match of String(filter).matchAll(/([a-z-]+)\(([-+.\d]+)(%|deg|px)?\)/g)) {
      const [,type,raw,unit] = match; let value = Number(raw);
      if (!Number.isFinite(value)) throw new Error('Invalid filter');
      if (unit === '%') value /= 100;
      if (type === 'blur') { variance += Math.max(0,value) ** 2; continue; }
      if (type === 'brightness' || type === 'contrast') {
        value = Math.max(0,value);
        if (value !== 1) stages.push({diagonal:value, offset:type === 'contrast' ? (1-value)*127.5 : 0});
      } else if (type === 'saturate') {
        const s = Math.max(0,value);
        if (s !== 1) stages.push({matrix:[.213+.787*s,.715-.715*s,.072-.072*s,.213-.213*s,.715+.285*s,.072-.072*s,.213-.213*s,.715-.715*s,.072+.928*s]});
      } else if (type === 'sepia') {
        const s = Math.min(1,Math.max(0,value));
        if (s) stages.push({matrix:[1-.607*s,.769*s,.189*s,.349*s,1-.314*s,.168*s,.272*s,.534*s,1-.869*s]});
      } else if (type === 'hue-rotate') {
        const angle = value * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
        if (value % 360) stages.push({matrix:[.213+.787*c-.213*s,.715-.715*c-.715*s,.072-.072*c+.928*s,
          .213-.213*c+.143*s,.715+.285*c+.140*s,.072-.072*c-.283*s,
          .213-.213*c-.787*s,.715-.715*c+.715*s,.072+.928*c+.072*s]});
      } else throw new Error('Unsupported filter: '+type);
    }
    const compiled = {stages, sigma:Math.sqrt(variance)};
    if (cache.size >= 64) cache.delete(cache.keys().next().value);
    cache.set(filter,compiled); return compiled;
  }
  function transformPixels(data, stages) {
    for (let i=0;i<data.length;i+=4) {
      let r=data[i],g=data[i+1],b=data[i+2];
      for (const stage of stages) {
        if (stage.matrix) {
          const m=stage.matrix, nr=clamp(m[0]*r+m[1]*g+m[2]*b), ng=clamp(m[3]*r+m[4]*g+m[5]*b);
          b=clamp(m[6]*r+m[7]*g+m[8]*b); r=nr; g=ng;
        } else { r=clamp(r*stage.diagonal+stage.offset);g=clamp(g*stage.diagonal+stage.offset);b=clamp(b*stage.diagonal+stage.offset); }
      }
      data[i]=r;data[i+1]=g;data[i+2]=b;
    }
    return data;
  }
  // Premultiplied RGBA, transparent image boundaries, separable convolution.
  // One scanline scratch buffer avoids a second full-size RGBA allocation.
  function blurPixels(data,W,H,sigma) {
    if (sigma < .01) return;
    for(let i=0;i<data.length;i+=4) {const a=data[i+3]/255;data[i]*=a;data[i+1]*=a;data[i+2]*=a;}
    const line = new Uint8ClampedArray(Math.max(W,H)*4);
    let kernel = null;
    if (sigma <= 2) {
      const radius=Math.ceil(3*sigma);kernel=[];let sum=0;
      for(let k=-radius;k<=radius;k++){const weight=Math.exp(-k*k/(2*sigma*sigma));kernel.push(weight);sum+=weight;}
      kernel=kernel.map(weight=>weight/sum);
    }
    function pass(horizontal, radius) {
      const length=horizontal?W:H,count=horizontal?H:W,step=horizontal?4:W*4;
      for(let n=0;n<count;n++) {
        const start=horizontal?n*W*4:n*4;
        for(let p=0;p<length;p++){const from=start+p*step,to=p*4;line[to]=data[from];line[to+1]=data[from+1];line[to+2]=data[from+2];line[to+3]=data[from+3];}
        if(kernel) {
          for(let p=0;p<length;p++) {
            let r=0,g=0,b=0,a=0;
            for(let k=-radius;k<=radius;k++){const q=p+k;if(q<0||q>=length)continue;const j=q*4,w=kernel[k+radius];r+=line[j]*w;g+=line[j+1]*w;b+=line[j+2]*w;a+=line[j+3]*w;}
            const j=start+p*step;data[j]=r;data[j+1]=g;data[j+2]=b;data[j+3]=a;
          }
        } else {
          let r=0,g=0,b=0,a=0;
          for(let p=0;p<=Math.min(radius,length-1);p++){const j=p*4;r+=line[j];g+=line[j+1];b+=line[j+2];a+=line[j+3];}
          const divisor=2*radius+1;
          for(let p=0;p<length;p++) {
            const j=start+p*step;data[j]=r/divisor;data[j+1]=g/divisor;data[j+2]=b/divisor;data[j+3]=a/divisor;
            const enter=p+radius+1,leave=p-radius;
            if(enter<length){const q=enter*4;r+=line[q];g+=line[q+1];b+=line[q+2];a+=line[q+3];}
            if(leave>=0){const q=leave*4;r-=line[q];g-=line[q+1];b-=line[q+2];a-=line[q+3];}
          }
        }
      }
    }
    if(kernel) {const radius=(kernel.length-1)/2;pass(true,radius);pass(false,radius);}
    else {
      const lo=Math.floor((Math.sqrt(1+4*sigma*sigma)-1)/2), hi=lo+1;
      const lowVariance=lo*(lo+1)/3, highVariance=hi*(hi+1)/3;
      const highCount=Math.max(0,Math.min(3,Math.round((sigma*sigma-3*lowVariance)/(highVariance-lowVariance))));
      for(let k=0;k<3;k++){const radius=k<highCount?hi:lo;if(radius){pass(true,radius);pass(false,radius);}}
    }
    for(let i=0;i<data.length;i+=4){const a=data[i+3];if(a){data[i]=data[i]*255/a;data[i+1]=data[i+1]*255/a;data[i+2]=data[i+2]*255/a;}else data[i]=data[i+1]=data[i+2]=0;}
  }
  function applyPixelsFilter(ctx,filter) {
    const {stages,sigma}=compileFilter(filter), W=ctx.canvas.width,H=ctx.canvas.height;
    if(!W||!H||(!stages.length&&sigma<.01))return;
    if(sigma>=.01) {
      const image=ctx.getImageData(0,0,W,H);transformPixels(image.data,stages);blurPixels(image.data,W,H,sigma);ctx.putImageData(image,0,0);
    } else {
      // Bound temporary CPU pixel storage to at most 128 rows, including export.
      for(let y=0;y<H;y+=128){const image=ctx.getImageData(0,y,W,Math.min(128,H-y));transformPixels(image.data,stages);ctx.putImageData(image,0,y);}
    }
  }
  // Caller supplies a cleared, source-over layer. Native output is unchanged.
  function drawFiltered(ctx,src,filter,...rect) {
    if(nativeSupported()){const previous=ctx.filter;ctx.filter=filter;try{ctx.drawImage(src,...rect);}finally{ctx.filter=previous || 'none';}}
    else {ctx.drawImage(src,...rect);applyPixelsFilter(ctx,filter);}
  }
  function drawFilteredOverlay(ctx,src,filter,x,y,W,H) {
    if(nativeSupported()){const previous=ctx.filter;ctx.filter=filter;try{ctx.drawImage(src,x,y,W,H);}finally{ctx.filter=previous || 'none';}return;}
    const scratch=document.createElement('canvas');scratch.width=W;scratch.height=H;
    try {drawFiltered(scratch.getContext('2d'),src,filter,0,0,W,H);ctx.drawImage(scratch,x,y);}
    finally {scratch.width=scratch.height=0;}
  }
  return {nativeSupported,compileFilter,transformPixels,blurPixels,applyPixelsFilter,drawFiltered,drawFilteredOverlay};
});
