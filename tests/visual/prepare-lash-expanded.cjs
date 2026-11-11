'use strict';
const fs=require('fs'),path=require('path'),https=require('https'),crypto=require('crypto');
const sources=JSON.parse(fs.readFileSync(path.join(__dirname,'lash-expanded-sources.json')));
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Supply NEW download directory');
fs.mkdirSync(output,{recursive:true});
async function download(url,file,redirects=0){
 if(redirects>4)throw Error('Redirect limit');
 return new Promise((resolve,reject)=>https.get(url,res=>{
  if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();download(new URL(res.headers.location,url).href,file,redirects+1).then(resolve,reject);return;}
  if(res.statusCode!==200){res.resume();reject(Error('HTTP '+res.statusCode));return;}
  const hash=crypto.createHash('sha256'),writer=fs.createWriteStream(file,{flags:'wx'});let bytes=0;
  res.on('data',chunk=>{bytes+=chunk.length;if(bytes>40*1024*1024){res.destroy(Error('40MiB per source bound'));return;}hash.update(chunk);});
  res.on('error',reject);writer.on('error',reject);res.pipe(writer);writer.on('finish',()=>resolve({bytes,sha256:hash.digest('hex')}));
 }).on('error',reject));
}
(async()=>{const records=[],selection=process.argv[3]?.split(',');for(const source of sources.sources.filter(s=>!selection||selection.includes(s.file))){try{const info=await download(source.url,path.join(output,source.file));records.push({...source,...info,status:'downloaded'});}catch(e){records.push({...source,status:'download-failed',error:e.message});}fs.writeFileSync(path.join(output,'downloads.json'),JSON.stringify({selection:sources.selection,records},null,2));console.log(records.at(-1));}})().catch(e=>{console.error(e);process.exitCode=1;});
