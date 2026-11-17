import {sampleBilinear} from './lash-endpoint-profile.mjs';

// Analytic signal mechanism fixture, not a generated portrait or hair asset.
export function sampledProfileGrid({kind,width,amplitude,blurSigma,noiseAmplitude,phaseX}){
 if(!['taper','fade','continuing'].includes(kind))throw Error('Unknown mechanism');
 const w=21,h=25,cx=10,cy=12;
 const pixels=new Float64Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let sum=0;
  for(let j=0;j<4;j++)for(let i=0;i<4;i++){
   const px=x-cx-phaseX+(i+.5)/4-.5,py=y-cy+(j+.5)/4-.5,t=Math.max(0,Math.min(1,(py+2)/6));
   const sigma=width*(kind==='taper'?1-.75*t:1),a=amplitude*(kind==='fade'?1-.85*t:1);
   sum+=.8-a*Math.exp(-((px/sigma)**2));
  }
  pixels[y*w+x]=sum/16;
 }
 let measured=pixels;
 if(blurSigma>0){
  const radius=Math.ceil(3*blurSigma),kernel=Array.from({length:2*radius+1},(_,i)=>Math.exp(-.5*((i-radius)/blurSigma)**2)),total=kernel.reduce((a,b)=>a+b,0);
  for(let i=0;i<kernel.length;i++)kernel[i]/=total;
  const convolve=(source,vertical)=>Float64Array.from({length:w*h},(_,i)=>{
   const x=i%w,y=Math.floor(i/w);let value=0;
   for(let k=-radius;k<=radius;k++){const xx=Math.max(0,Math.min(w-1,x+(vertical?0:k))),yy=Math.max(0,Math.min(h-1,y+(vertical?k:0)));value+=source[yy*w+xx]*kernel[k+radius];}return value;
  });
  measured=convolve(convolve(measured,false),true);
 }
 // Use the same deterministic noise field for paired latent causes.
 const quantized=Float32Array.from(measured,(v,i)=>{
  let z=Math.imul(i+1,0x45d9f3b);z=Math.imul(z^(z>>>16),0x45d9f3b);const noise=((z>>>0)/0xffffffff*2-1)*noiseAmplitude;
  return Math.round(Math.max(0,Math.min(1,v+noise))*255)/255;
 });
 const rows=Array.from({length:25},(_,j)=>{const ahead=-2+j*.25;return{ahead,samples:Array.from({length:25},(_,i)=>{const offset=-3+i*.25;return{offset,value:sampleBilinear(quantized,w,h,cx+offset,cy+ahead)};})};});
 return{w,h,rows,pixelValues:Array.from(quantized)};
}
