'use strict';
// Download only public research fixtures. Never runs a lash detector.
const fs=require('fs'),path=require('path'),https=require('https'),crypto=require('crypto');
const manifest=JSON.parse(fs.readFileSync(process.argv[3]||path.join(__dirname,'lash-spatial-cohort.json'),'utf8'));
const output=process.argv[2];
if(!output||fs.existsSync(output))throw Error('Supply NEW output directory');
fs.mkdirSync(output,{recursive:true});
function get(url){return new Promise((resolve,reject)=>{
 const req=https.get(url,res=>{
  if(res.statusCode!==200){res.resume();return reject(Error('HTTP '+res.statusCode));}
  const chunks=[];let length=0;
  res.on('data',b=>{length+=b.length;if(length>40*1024*1024)res.destroy(Error('40 MiB limit'));else chunks.push(b);});
  res.on('error',reject);res.on('end',()=>resolve(Buffer.concat(chunks)));
 });req.setTimeout(30000,()=>req.destroy(Error('download-timeout')));req.on('error',reject);
});}
(async()=>{const records=[];for(const source of manifest.sources){
 try{const bytes=await get(source.url);if(bytes[0]!==255||bytes[1]!==216)throw Error('Not JPEG');
 fs.writeFileSync(path.join(output,source.file),bytes,{flag:'wx'});
 records.push({...source,status:'downloaded',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 }catch(e){records.push({...source,status:'download-failed',error:e.message||e.code||e.name,causes:e.errors?.map(c=>({code:c.code,message:c.message}))});}
 fs.writeFileSync(path.join(output,'downloads.json'),JSON.stringify({license:manifest.license,records},null,2)+'\n');
 console.log(source.file,records.at(-1).status);
}if(records.some(r=>r.status!=='downloaded'))process.exitCode=1;})();
