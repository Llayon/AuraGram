'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const input=process.argv[2],output=process.argv[3];
if(!input||!output||fs.existsSync(output))throw Error('Supply existing run and NEW evidence directory');
fs.mkdirSync(output,{recursive:true});
const manifests=['chromium','webkit'].map(e=>JSON.parse(fs.readFileSync(path.join(input,e+'.json'))));
const svgProfile=p=>{
 if(!p.profile.length)return '<p>No profile: '+p.reason+'</p>';
 const rows=p.profile,min=Math.min(...rows.map(s=>s.value))-.01,max=Math.max(...rows.map(s=>s.value+s.deficit))+.01,r=rows.at(-1).offset;
 const xy=(s,key)=>`${25+(s.offset+r)/(r*2)*250},${100-(s[key]-min)/(max-min)*80}`;
 const values=rows.map(s=>({...s,background:s.value+s.deficit}));
 return `<svg width="310" height="135" viewBox="0 0 310 135"><rect width="310" height="135" fill="#333"/><path d="M25 20V100H275" stroke="#888" fill="none"/><polyline points="${values.map(s=>xy(s,'value')).join(' ')}" stroke="#eee" fill="none"/><polyline points="${values.map(s=>xy(s,'background')).join(' ')}" stroke="#ffdb55" fill="none"/><text x="25" y="120" fill="white">−${r}px</text><text x="145" y="120" fill="white">0</text><text x="250" y="120" fill="white">+${r}px</text><text x="0" y="20" fill="white" font-size="9">${max.toFixed(3)}</text><text x="0" y="98" fill="white" font-size="9">${min.toFixed(3)}</text></svg>`;
};
const sections=[],summary=[];
for(const m of manifests){fs.writeFileSync(path.join(output,m.engine+'.json.gz'),zlib.gzipSync(fs.readFileSync(path.join(input,m.engine+'.json')),{level:9}),{flag:'wx'});
 for(const eye of m.eyes){for(const c of eye.candidates){
  const variants=c.variants.map(v=>({radius:v.radius,angleOffset:v.angleOffset,anchorReason:v.refined[0].reason,proposedAnchorShift:v.refined[0].proposedShift,acceptedProfiles:v.refined.filter(p=>p.accepted).length,totalProfiles:v.refined.length,directions:v.directions,freeAnchorDirections:v.freeAnchorDiagnostic.directions}));
  summary.push({engine:m.engine,file:eye.file,side:eye.side,index:c.index,recovered:c.recovered,sourceSupport:c.sourceSupport,rawDirections:c.rawDirections,variants});
  if(c.recovered){sections.push(`<section><h2>${m.engine} ${eye.file} ${eye.side} candidate${c.index}</h2><p>Contiguous source support ${c.sourceSupport.toFixed(2)}px. Conditional angles below are not validated physical tangents.</p>`);
   for(const v of c.variants){const table=v.directions.map(d=>{const f=v.freeAnchorDiagnostic.directions.find(f=>f.window===d.window);return `<tr><td>${d.window}</td><td>${d.angle.toFixed(1)}°</td><td>${f?f.angle.toFixed(1)+'°':'unavailable'}</td><td>${d.allProfilesAccepted?'all profile checks':'rejected support/anchor'}</td></tr>`;}).join('');
    sections.push(`<article><h3>Radius${v.radius}px, normal offset${v.angleOffset}°</h3><p>Fixed anchor profile: ${v.refined[0].reason}; proposed displacement ${v.refined[0].proposedShift?.toFixed(3)}px. This proposal is NOT applied to the product tip.</p><table><tr><th>Window px</th><th>Fixed anchor</th><th>Free-anchor diagnostic</th><th>Evidence</th></tr>${table}</table><div class="profiles">${v.refined.slice(0,4).map((p,i)=>`<div><p>Sample${i}: ${p.reason}, shift${p.shift?.toFixed(3)}</p>${svgProfile(p)}</div>`).join('')}</div></article>`);
   }sections.push('</section>');
  }
 }}
}
const pairs=manifests[0].eyes.map(a=>{const b=manifests[1].eyes.find(b=>a.file===b.file&&a.side===b.side);return {file:a.file,side:a.side,nativeRGBAEqual:a.rgbaSHA256===b.rgbaSHA256};});
fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({nativeRGBAPairs:pairs,candidates:summary},null,2),{flag:'wx'});
const pictures=fs.readdirSync(input).filter(f=>f.endsWith('.png'));
for(const f of pictures)fs.copyFileSync(path.join(input,f),path.join(output,f),fs.constants.COPYFILE_EXCL);
fs.writeFileSync(path.join(output,'source-centers.mjs'),fs.readFileSync(path.join(input,'source-centers.mjs')),{flag:'wx'});
fs.writeFileSync(path.join(output,'.gitattributes'),'*.json -text\n*.gz -text\n*.mjs -text\n*.txt -whitespace\n',{flag:'wx'});
fs.writeFileSync(path.join(output,'index.html'),'<!doctype html><meta charset="utf-8"><title>Native source profiles — HOLD</title><style>body{background:#222;color:#eee;font:16px sans-serif}section{border-top:2px solid #888;padding:20px 0}article{margin:20px 0}img{max-width:none}figure{overflow:auto}.profiles{display:flex;flex-wrap:wrap}td,th{padding:6px;border:1px solid #666}a{color:#8df}</style><h1>Native source center profiles — diagnostic only</h1><p>No product render or tip change. Cyan=old path, yellow=refined path/profile-check accepted points, red circles=rejected unchanged samples, white circle=fixed tip. Rejected samples cannot establish orientation. All-profile-checks does not certify a physical endpoint. Bilinear0.25px grid adds no detail. Profile plots: white=raw normalized luminance, yellow=linear endpoint background estimate. Y axes auto-range and are labelled per plot; this display does not prove naturalness. Free-anchor angles illustrate anchoring bias only. Full product/portrait comparisons remain in earlier localization evidence.</p>'+pictures.map(f=>`<figure><figcaption>${f}</figcaption><img loading="lazy" src="${f}"></figure>`).join('')+sections.join(''),{flag:'wx'});
console.log(JSON.stringify({nativeRGBAPairs:pairs,candidates:summary.length,recovered:summary.filter(c=>c.recovered).map(c=>({engine:c.engine,file:c.file,side:c.side,index:c.index,primary:c.variants.find(v=>v.radius===1.5&&v.angleOffset===0)}))},null,2));
