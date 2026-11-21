'use strict';
// Portable fixture metadata reader. Availability is a property of frozen real
// FaceMesh records, independent of live application's checkout line endings.
// This does NOT replace loadInputs() or its strict live-source replay checks.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),assert=require('assert/strict'),{hash}=require('./lash-domain-inputs.cjs');
function frozenAvailability(){
 const protocol=JSON.parse(fs.readFileSync('tests/visual/lash-break-protocol.json')),mapFile='tests/visual/downward-evidence/files.json',bytes=fs.readFileSync(mapFile);assert.equal(hash(bytes),protocol.inputs[mapFile]);const map=JSON.parse(bytes);
 const read=f=>{const m=map[f];assert.ok(m);const b=fs.readFileSync(path.resolve('tests/visual/downward-evidence',m.asset)),data=m.gzip?zlib.gunzipSync(b):b;assert.equal(hash(data),m.sha256);return JSON.parse(data);};
 const availableFiles=[],manifests={};for(const engine of ['chromium','webkit']){const file=`tests/visual/out/downward-01-observations/manifest-${engine}.json`,m=read(file);assert.equal(m.engine,engine);manifests[engine]=map[file].sha256;for(const r of m.runs){assert.ok(r.geometry.left.upperLid.length&&r.geometry.right.upperLid.length);availableFiles.push(r.file);}}
 const labels=[];for(const file of ['tests/visual/lash-freeend-independent-labels.json','tests/visual/lash-freeend2-independent-labels.json']){const b=fs.readFileSync(file);assert.equal(hash(b),protocol.inputs[file]);for(const v of JSON.parse(b).views)for(const l of v.labels)labels.push({file:v.source,id:l.id});}
 return{labels,availableFiles,manifestSHA256:manifests,mapSHA256:hash(bytes)};
}
module.exports={frozenAvailability};
