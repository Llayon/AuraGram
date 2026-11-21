import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {intakeDevelopmentReviews} from './lash-development-review-intake.mjs';
import {summarizeMaskScope} from './lash-mask-scope-summary.mjs';

const [directory,output] = process.argv.slice(2);
if (!directory || !output || fs.existsSync(output)) throw Error('Supply extracted review directory and NEW output directory');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const selection = JSON.parse(fs.readFileSync('tests/visual/lash-development-review-selection.json'));
const intake = intakeDevelopmentReviews(directory);
const censusBytes = fs.readFileSync(selection.census);
if (hash(censusBytes)!==intake.censusSHA256) throw Error('Census changed during intake');
const census = JSON.parse(censusBytes);
const save = (file, value) => fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const engines = ['chromium','webkit'];
const runner = fileURLToPath(new URL('./lash-mask-scope.cjs',import.meta.url));
fs.mkdirSync(output,{recursive:true});
save(path.join(output,'intake.json'),intake);
const records = [];
for (const record of intake.records) {
  const {file,status} = record;
  const key = path.parse(file).name;
  const relative = `annotations/${key}.json`;
  const labelSHA256 = intake.frozen[relative];
  if (!labelSHA256) { records.push({file,status,mask:'not-run'}); continue; }
  const labelFile = path.resolve(directory,relative), bytes = fs.readFileSync(labelFile);
  if (hash(bytes)!==labelSHA256) throw Error(`Review changed during intake: ${file}`);
  const labels = JSON.parse(bytes);
  if (!labels.evaluatedEyes.some(side=>labels.eyes[side].tips.length)) {
    records.push({file,status,mask:'no-labelled-tip-regions'});
    continue;
  }
  const source = census.sources.find(row=>row.file===file);
  const freezeFile = path.join(output,`${key}-freeze.json`), pairFile = path.join(output,`${key}-screens.json`);
  save(freezeFile,{sourceSHA256:source.sourceSHA256,inputs:{[labelFile]:labelSHA256}});
  save(pairFile,Object.fromEntries(engines.map(engine=>{
    const entry = source.screening.find(item=>item.engine===engine && item.status==='ready');
    return [engine,{file:entry.input,sha256:census.inputs[entry.input]}];
  })));
  const measurementDir = path.join(output,key);
  const child = spawnSync(process.execPath,[runner,labelFile,freezeFile,path.join(directory,'originals',file),pairFile,measurementDir],
    {encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024});
  fs.writeFileSync(path.join(output,`${key}-measurement.log`),(child.stdout ?? '')+(child.stderr ?? ''),{flag:'wx'});
  if (child.status!==0) {
    records.push({file,status,mask:'measurement-failed',reason:child.error?.message ?? `Child exit ${child.status}`});
    continue;
  }
  const readRun = name => {
    const data = fs.readFileSync(path.join(measurementDir,name+'.json'));
    return [name,JSON.parse(data),hash(data)];
  };
  const runs = engines.map(readRun);
  records.push({file,status,mask:'measured',eyes:summarizeMaskScope(labels,Object.fromEntries(runs.map(([name,data])=>[name,data]))),
    inputSHA256:Object.fromEntries(runs.map(([name,,digest])=>[name,digest]))});
}
save(path.join(output,'summary.json'),{records,meaning:'Integer source-pixel mask samples only. This does not qualify a portrait or certify continuous containment.'});
console.log(JSON.stringify(records.map(({file,status,mask})=>({file,status,mask}))));
if (records.some(row=>row.status==='pending'||row.status==='invalid'||row.status==='data-insufficient'||row.mask==='measurement-failed')) process.exitCode=2;
