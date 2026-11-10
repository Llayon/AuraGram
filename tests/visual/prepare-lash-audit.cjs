'use strict';
// Pin baseline sources and download ONLY public audit fixtures. No user photos.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),https=require('node:https');
const root=path.resolve(__dirname,'../..'),base='b02fac3c684f2a7e3178933cb66ded925ab8bce8';
const photos={beauty:['photo-1534528741775-53994a69daeb',3000],natural:['photo-1524504388940-b1c1722653e1',2400],mascara:['photo-1517841905240-472988babdf9',2400],glasses:['photo-1524250502761-1ac6f2e30d43',2400],light:['photo-1508214751196-bcfd4ca60f91',2400]};
function download(url,target){return new Promise((resolve,reject)=>{https.get(url,res=>{if(res.statusCode!==200){res.resume();return reject(new Error(url+': '+res.statusCode));}const out=fs.createWriteStream(target);res.pipe(out);out.on('finish',()=>out.close(resolve));out.on('error',reject);}).on('error',reject);});}
async function main(){
 const files=cp.execFileSync('git',['ls-tree','-r','--name-only',base,'src/retouch','src/vision','src/rendering'],{cwd:root,encoding:'utf8'}).trim().split('\n');
 for(const file of files){const target=path.join(__dirname,'out/baseline-src',file.slice(4));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,cp.execFileSync('git',['show',base+':'+file],{cwd:root}));}
 const folder=path.join(__dirname,'out/dataset');fs.mkdirSync(folder,{recursive:true});
 for(const [key,[id,w]] of Object.entries(photos)){const target=path.join(folder,key+'.jpg');if(!fs.existsSync(target))await download(`https://images.unsplash.com/${id}?w=${w}&q=95`,target);}
 fs.writeFileSync(path.join(folder,'sources.json'),JSON.stringify({license:'https://unsplash.com/license',baseline:base,photos,note:'Names are historical audit identifiers, NOT verified categories. Do not count glasses as eyeglasses or light as pale eyelashes.'},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
