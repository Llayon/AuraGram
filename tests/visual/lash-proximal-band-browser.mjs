import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium, webkit} from '@playwright/test';
import {auditProximalBands} from './lash-proximal-band-audit.mjs';

const [inputFile, output] = process.argv.slice(2);
if (!output || fs.existsSync(output)) throw Error('Supply serialized inputs and a NEW output directory');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inputBytes = fs.readFileSync(inputFile);
const {width,height,inputs,cases,score = 'response'} = JSON.parse(inputBytes);
assert.ok(cases.length > 0);
const modules = new Map(['lash-proximal-band-audit.mjs','lash-endpoint-profile.mjs'].map(name => {
  const file = `tests/visual/${name}`;
  const bytes = fs.readFileSync(file);
  assert.equal(hash(bytes), inputs[file]);
  return [`/${name}`,bytes];
}));
const measurements = cases.map(({luma,points}) => ({luma,points}));
const expected = cases.map(c => c.expected);
assert.deepEqual(measurements.map(c => auditProximalBands(Float32Array.from(c.luma),width,height,c.points,score)), expected);
const tolerance = 1e-12;
function compareNumeric(actual, reference, field = 'result') {
  if (typeof reference === 'number' && !Number.isInteger(reference)) {
    assert.ok(Number.isFinite(actual), `${field}: expected finite measurement`);
    const difference = Math.abs(actual-reference);
    assert.ok(difference <= tolerance, `${field}: numeric difference ${difference}`);
    return difference;
  }
  if (reference && typeof reference === 'object') {
    assert.ok(actual && typeof actual === 'object', `${field}: missing record`);
    assert.deepEqual(Object.keys(actual),Object.keys(reference),`${field}: fields`);
    return Math.max(0,...Object.keys(reference).map(key => compareNumeric(actual[key],reference[key],`${field}.${key}`)));
  }
  assert.equal(actual,reference,field);
  return 0;
}
fs.mkdirSync(output,{recursive:true});
const save = (file,value) => fs.writeFileSync(path.join(output,file),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const protocol = {kind:'serialized-input-runtime-parity', inputSHA256:hash(inputBytes), cases:cases.length,
  repeatsPerEngine:2, tolerance, inputs, score, engines:{}};
const server = http.createServer((request,response) => {
  if (request.url === '/') return response.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><title>Band audit</title>');
  const module = modules.get(request.url);
  if (module) return response.writeHead(200,{'Content-Type':'text/javascript'}).end(module);
  response.writeHead(404).end();
});
await new Promise((resolve,reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
try {
  for (const engine of [chromium,webkit]) {
    const browser = await engine.launch({timeout:15000});
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/`,{timeout:15000});
      const runs = [];
      for (let i=0;i<2;i++) runs.push(await page.evaluate(async ({width,height,cases,score}) => {
        const {auditProximalBands} = await import('/lash-proximal-band-audit.mjs');
        return cases.map(c => auditProximalBands(Float32Array.from(c.luma),width,height,c.points,score));
      },{width,height,cases:measurements,score}));
      save(engine.name()+'.json', runs);
      assert.deepEqual(runs[0],runs[1],`${engine.name()}: repeated output`);
      const maxNumericDifference = compareNumeric(runs[0],expected);
      protocol.engines[engine.name()] = {version:browser.version(), exactRepeat:true, exactDecisions:true,
        exactNodeParity:maxNumericDifference === 0,maxNumericDifference};
      console.log(`${engine.name()}: ${cases.length} matching decisions, maximum numeric difference ${maxNumericDifference}`);
    } finally { await browser.close(); }
  }
} catch (error) {
  save('failure.json',{message:error.message,completed:protocol.engines});
  throw error;
} finally { server.close(); }
save('protocol.json',protocol);
