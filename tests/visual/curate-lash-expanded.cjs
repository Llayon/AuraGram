'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),cp=require('child_process');
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Supply NEW evidence directory');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),out='tests/visual/out',matrix=out+'/expanded-09-matrix';
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(output+'/sources');fs.mkdirSync(output+'/assets');
const records=JSON.parse(fs.readFileSync(out+'/expanded-06-originals/sources.json')).records;
for(const r of records){const b=fs.readFileSync(out+'/dataset/'+r.file);if(hash(b)!==r.sha256)throw Error('JPEG changed');fs.writeFileSync(output+'/sources/'+r.file,b,{flag:'wx'});}
fs.writeFileSync(output+'/sources.json',JSON.stringify({records},null,2),{flag:'wx'});
const bundle={};for(const folder of ['retouch','rendering','vision'])for(const f of fs.readdirSync(matrix+'/candidate-src/'+folder)){const bytes=fs.readFileSync(matrix+'/candidate-src/'+folder+'/'+f);bundle[folder+'/'+f]={sha256:hash(bytes),base64:bytes.toString('base64')};}
fs.writeFileSync(output+'/candidate-sources.json.gz',zlib.gzipSync(JSON.stringify(bundle),{level:9}),{flag:'wx'});
const baseline={};for(const folder of ['retouch','rendering','vision'])for(const f of fs.readdirSync(out+'/baseline-src/'+folder)){
 const bytes=fs.readFileSync(out+'/baseline-src/'+folder+'/'+f),git=cp.execFileSync('git',['show','b883cf5d8cbcc75723b4701e98444fc349db4856:src/'+folder+'/'+f]);
 const normalized=b=>Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'));
 if(!normalized(bytes).equals(normalized(git)))throw Error('Baseline mismatch '+f);
 baseline[folder+'/'+f]={rawSHA256:hash(bytes),normalizedSHA256:hash(normalized(bytes)),productionSHA256:hash(normalized(git))};
}
fs.writeFileSync(output+'/baseline-validation.json',JSON.stringify({production:'b883cf5d8cbcc75723b4701e98444fc349db4856',files:baseline},null,2),{flag:'wx'});
const matrices={};for(const engine of ['chromium','webkit']){
 for(const [name,file]of [['geometry',out+'/expanded-08-geometry/manifest-'+engine+'.json'],['matrix',matrix+'/'+engine+'.json']])fs.writeFileSync(`${output}/${name}-${engine}.json.gz`,zlib.gzipSync(fs.readFileSync(file),{level:9}),{flag:'wx'});
 matrices[engine]=JSON.parse(fs.readFileSync(matrix+'/'+engine+'.json'));
}
const aliases=[],unique=new Map();
function asset(source,label,category){const b=fs.readFileSync(source),h=hash(b),filename=h+'.png';if(!unique.has(h)){fs.writeFileSync(output+'/assets/'+filename,b,{flag:'wx'});unique.set(h,b.length);}aliases.push({label,category,asset:'assets/'+filename,sha256:h,width:b.readUInt32BE(16),height:b.readUInt32BE(20)});}
for(const f of fs.readdirSync(matrix).filter(f=>f.endsWith('-1x.png')||f.endsWith('-portrait720.png')))asset(matrix+'/'+f,f,'matrix');
for(const f of fs.readdirSync(out+'/expanded-07-screening').filter(f=>f.endsWith('-1x.png')))asset(out+'/expanded-07-screening/'+f,f,'original-only');
for(const [label,file]of [['screening-first-six',out+'/expanded-04-screening/original-crops.json'],['screening-eight',out+'/expanded-07-screening/original-crops.json']])fs.writeFileSync(output+'/'+label+'.json.gz',zlib.gzipSync(fs.readFileSync(file),{level:9}),{flag:'wx'});
const labels=JSON.parse(fs.readFileSync('tests/visual/lash-expanded-independent-labels.json'));
const summary={files:records.map(r=>({file:r.file,width:r.width,height:r.height,sha256:r.sha256})),assets:aliases.length,uniqueAssets:unique.size,uniquePNGMiB:[...unique.values()].reduce((a,b)=>a+b,0)/2**20,
 independentLabelCount:labels.views.reduce((n,v)=>n+v.labels.length,0),engines:Object.fromEntries(Object.entries(matrices).map(([engine,m])=>[engine,{ready:m.runs.length,excluded:m.excluded,runs:m.runs.map(r=>({file:r.file,roundtrip:r.roundtrip,pixels:r.pixels,diagnostics:r.diagnostics,eyes:Object.fromEntries(Object.entries(r.eyes).map(([s,a])=>[s,{tips:a.tips.length,eligibleTips:a.tips.filter(t=>t.c>=.6&&a.lengthConfidence>=.25).length,densityConfidence:a.densityConfidence,lengthConfidence:a.lengthConfidence,diagnostics:a.diagnostics}]))}))}]))};
fs.writeFileSync(output+'/summary.json',JSON.stringify(summary,null,2),{flag:'wx'});fs.writeFileSync(output+'/images.json',JSON.stringify(aliases,null,2),{flag:'wx'});
fs.writeFileSync(output+'/.gitattributes','*.json -text\n*.gz -text\n*.jpg -text\n*.txt -whitespace\n',{flag:'wx'});
fs.writeFileSync(output+'/index.html','<!doctype html><meta charset="utf-8"><title>Expanded real photos — HOLD</title><style>body{background:#222;color:#eee;font:16px sans-serif}figure{overflow:auto}img{max-width:none;image-rendering:pixelated}a{color:#8df}</style><h1>Eight new real photos — LENGTH HOLD</h1><p>Source JPEGs retain native resolution. Matrix effects were rendered natively; portrait viewing previews are720px. Eye PNGs store100% pixels. Zoom2/4 below enlarges these same pixels with nearest-neighbour display; duplicate bitmap assets are unnecessary. Canonical source viewing crops are manual screen rectangles, not FaceMesh geometry. Ridge green=response; density yellow=engineering support; accepted cyan/rejected red=diagnostic paths; difference8x=absoluteRGB amplification. Overlays do not enter product renders. no_face sources remain explicitly excluded.</p><label>Eye display zoom <select onchange="document.querySelectorAll(\'img[data-eye]\').forEach(i=>{i.width=i.dataset.w*this.value;i.height=i.dataset.h*this.value})"><option value="1">100%</option><option value="2">200%</option><option value="4">400%</option></select></label>'+aliases.map(a=>`<figure><figcaption>${a.category}: ${a.label}</figcaption><a href="${a.asset}"><img loading="lazy" ${a.label.includes('portrait720')?'':`data-eye data-w="${a.width}" data-h="${a.height}"`} width="${a.width}" height="${a.height}" src="${a.asset}"></a></figure>`).join(''),{flag:'wx'});
console.log({assets:aliases.length,unique:unique.size,uniquePNGMiB:summary.uniquePNGMiB,baselineFiles:Object.keys(baseline).length});
