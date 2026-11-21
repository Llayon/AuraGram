import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {auditProximalBands} from './lash-proximal-band-audit.mjs';

const [inputFile, outputFile, browserInputFile] = process.argv.slice(2);
if (!browserInputFile || [outputFile,browserInputFile].some(file => fs.existsSync(file)))
  throw Error('Supply archived serialized inputs, NEW comparison and NEW browser input files');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = fs.readFileSync(inputFile);
const baseline = JSON.parse(fs.readFileSync('tests/visual/lash-proximal-band-browser-summary.json'));
assert.equal(hash(bytes),baseline.protocol.inputSHA256);
const {width,height,cases} = JSON.parse(bytes);
const score = 'transverseContrast';
const rows = cases.map(({kind,luma,points,expected},index) => {
  const pixels = Float32Array.from(luma);
  assert.deepEqual(auditProximalBands(pixels,width,height,points),expected,`Baseline case ${index}`);
  const contrast = auditProximalBands(pixels,width,height,points,score);
  return {index,kind,baseline:expected,contrast};
});
const counts = {};
for (const row of rows) {
  const group = counts[row.kind] ??= {cases:0,baselineRefusals:0,contrastRefusals:0,newRefusals:0,lostRefusals:0};
  group.cases++;
  const oldVeto = row.baseline.status !== 'no-veto', newVeto = row.contrast.status !== 'no-veto';
  group.baselineRefusals += Number(oldVeto);
  group.contrastRefusals += Number(newVeto);
  group.newRefusals += Number(!oldVeto && newVeto);
  group.lostRefusals += Number(oldVeto && !newVeto);
}
const files = ['tests/visual/lash-proximal-band-audit.mjs','tests/visual/lash-endpoint-profile.mjs'];
const inputs = Object.fromEntries(files.map(file => [file,hash(fs.readFileSync(file))]));
assert.equal(inputs[files[1]],baseline.protocol.inputs[files[1]]);
const protocol = {baselineInputSHA256:hash(bytes),score,inputs,
  hypothesis:'Replace penalized response with transverse contrast for the veto only. Keep the grid, tangent, radii, floor and status rules fixed.',
  decisionRule:'The variant must flag the previously missed fork and preserve all isolated paths and previous refusals to warrant further study.'};
fs.writeFileSync(outputFile,JSON.stringify({protocol,counts,rows},null,2)+'\n',{flag:'wx'});
fs.writeFileSync(browserInputFile,JSON.stringify({width,height,inputs,score,
  cases:cases.map((c,index) => ({...c,expected:rows[index].contrast}))})+'\n',{flag:'wx'});
console.log(JSON.stringify(counts));
