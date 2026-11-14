// Offline diagnostic only: no product module imports this file.
// Parameterize the connected observed path by arc length; never invent gaps.
export function distalFits(points, maxWindow = 8) {
  const nodes=[];let s=0;
  for(let i=0;i<points.length;i++) {
    if(i){const step=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);if(!step)continue;s+=step;}
    if(s>maxWindow)break;
    nodes.push({...points[i],s});
  }
  if(nodes.length<2)return {chords:[],quadratic:null};
  const angle=(x,y)=>Math.atan2(y,x)*180/Math.PI;
  const chords=[2,4,6,8].filter(w=>w<=maxWindow&&nodes.at(-1).s>=w).map(w=>{
    let i=1;while(nodes[i].s<w)i++;
    const a=nodes[i-1],b=nodes[i],f=(w-a.s)/(b.s-a.s),x=a.x+(b.x-a.x)*f,y=a.y+(b.y-a.y)*f;
    return {window:w,dx:points[0].x-x,dy:points[0].y-y,angle:angle(points[0].x-x,points[0].y-y)};
  });
  if(nodes.length<5)return {chords,quadratic:null};
  const scale=nodes.at(-1).s;
  const matrix=Array.from({length:3},()=>[0,0,0,0,0]);
  for(const p of nodes){const t=p.s/scale,b=[1,t,t*t],weight=Math.exp(-p.s/6);
    for(let i=0;i<3;i++){for(let j=0;j<3;j++)matrix[i][j]+=weight*b[i]*b[j];matrix[i][3]+=weight*b[i]*p.x;matrix[i][4]+=weight*b[i]*p.y;}}
  for(let i=0;i<3;i++){
    const pivot=matrix[i][i];if(Math.abs(pivot)<1e-10)return {chords,quadratic:null};
    for(let j=i;j<5;j++)matrix[i][j]/=pivot;
    for(let k=0;k<3;k++)if(k!==i){const f=matrix[k][i];for(let j=i;j<5;j++)matrix[k][j]-=f*matrix[i][j];}
  }
  const x=matrix.map(row=>row[3]),y=matrix.map(row=>row[4]);
  const residuals=nodes.map(p=>{const t=p.s/scale;return Math.hypot(p.x-(x[0]+x[1]*t+x[2]*t*t),p.y-(y[0]+y[1]*t+y[2]*t*t));});
  const norm=Math.hypot(x[1],y[1]);
  if(!Number.isFinite(norm)||norm<1e-8)return {chords,quadratic:null};
  return {chords,quadratic:{x,y,scale,points:nodes.length,endpointShift:Math.hypot(x[0]-points[0].x,y[0]-points[0].y),maxResidual:Math.max(...residuals),dx:-x[1]/norm,dy:-y[1]/norm,angle:angle(-x[1],-y[1]),note:'Fit to quantized observed tracing points only; not independent image evidence or a validated tip direction.'}};
}
