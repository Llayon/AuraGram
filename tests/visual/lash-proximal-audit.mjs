import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {diagnoseProximal} from './lash-proximal-diagnosis.mjs';
const [runDir,labelFile,output]=process.argv.slice(2);
if(!output||fs.existsSync(output))throw Error('Supply run directory, frozen labels and NEW output JSON');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const protocol=JSON.parse(fs.readFileSync(path.join(runDir,'protocol.json')));
if(hash(fs.readFileSync(labelFile))!==protocol.labelInputs[labelFile])throw Error('Frozen annotations differ');
const labels=JSON.parse(fs.readFileSync(labelFile));
if(labels.sourceSHA256!==protocol.sourceSHA256)throw Error('Source identity mismatch');
if(hash(fs.readFileSync('src/retouch/lashAnalysis.mjs'))!==protocol.moduleSHA256['src/retouch/lashAnalysis.mjs'])throw Error('Lid-frame implementation differs');
const results=[];
for(const engine of ['chromium','webkit']){
 const file=path.join(runDir,engine+'.json'),run=JSON.parse(fs.readFileSync(file));
 if(hash(fs.readFileSync(run.geometryPath))!==run.geometrySHA256)throw Error('Geometry changed');
 const geometry=JSON.parse(fs.readFileSync(run.geometryPath)).results.find(r=>r.file===labels.file);
 if(geometry.status!=='ready'||geometry.sha256!==protocol.sourceSHA256)throw Error('No actual source FaceMesh');
 for(const side of ['left','right']){
 const eye=geometry.eyes[side];
 const toNative=p=>({x:p.x*geometry.width-.5,y:p.y*geometry.height-.5});
 const diagnostic=diagnoseProximal(run.run[side].results,eye.upperLid.map(toNative),eye.lowerLid.map(toNative),labels.eyes[side].ambiguities);
 results.push({engine,side,...diagnostic});console.log(engine,side,JSON.stringify(diagnostic.summary));
 }
}
fs.writeFileSync(output,JSON.stringify({kind:'posthoc-proximal-stop-diagnostic-not-recognition',date:'2026-11-14',annotationsUsedForClassificationOnly:true,associationPolicyChanged:false,inputs:{protocolSHA256:hash(fs.readFileSync(path.join(runDir,'protocol.json'))),annotationSHA256:hash(fs.readFileSync(labelFile)),diagnosticSHA256:hash(fs.readFileSync('tests/visual/lash-proximal-diagnosis.mjs'))},results},null,2)+'\n',{flag:'wx'});
