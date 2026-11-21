import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const sides = ['left','right'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const nonempty = value => typeof value==='string' && value.trim().length>0;

export function inspectReview(annotation, source) {
  if (annotation.file!==source.file || annotation.sourceSHA256!==source.sha256 || annotation.originalOnly!==true ||
      annotation.coordinateSpace!=='original-source-pixels') return {status:'invalid',issues:['source-or-coordinate-mismatch']};
  if (annotation.role===null && !nonempty(annotation.reviewer)) return {status:'pending',issues:['blank-template']};
  const issues = [];
  const role = annotation.role;
  if (!['positive','hard','unqualified'].includes(role) || !nonempty(annotation.reviewer)) issues.push('missing-role-or-reviewer');
  const evaluated = annotation.evaluatedEyes;
  if (!Array.isArray(evaluated) || new Set(evaluated).size!==evaluated.length || evaluated.some(side=>!sides.includes(side)))
    issues.push('invalid-evaluated-eyes');
  else if (role==='positive' || role==='hard') {
    if (!evaluated.length) issues.push('missing-evaluated-eyes');
    for (const side of sides) if (!evaluated.includes(side) && !nonempty(annotation.excludedEyes?.[side])) issues.push(`missing-exclusion:${side}`);
  }
  if (role==='unqualified' && !nonempty(annotation.notes)) issues.push('missing-unqualified-reason');

  const point = p => Array.isArray(p) && p.length===2 && p.every(Number.isFinite) &&
    p[0]>=0 && p[0]<source.width && p[1]>=0 && p[1]<source.height;
  const polygon = p => Array.isArray(p) && p.length>=3 && p.every(point) &&
    Math.abs(p.reduce((area,[x,y],i)=>area+x*p[(i+1)%p.length][1]-y*p[(i+1)%p.length][0],0))>1e-8;
  const tipCounts = {};
  for (const side of sides) {
    const {tips, ambiguities, protectedRegions} = annotation.eyes?.[side] ?? {};
    if (![tips,ambiguities,protectedRegions].every(Array.isArray)) { issues.push(`missing-eye-lists:${side}`); continue; }
    tipCounts[side] = tips.length;
    const ids = new Set();
    for (const tip of tips) {
      if (!nonempty(tip?.id) || ids.has(tip.id)) issues.push(`invalid-tip-id:${side}`);
      ids.add(tip?.id);
      if (!polygon(tip?.region)) issues.push(`invalid-tip-region:${side}`);
      const track = tip?.observedPath;
      if (!Array.isArray(track) || track.length<2 || !track.every(point) ||
          !track.some(p=>p[0]!==track[0][0] || p[1]!==track[0][1])) issues.push(`invalid-observed-path:${side}`);
      const angles = tip?.directionRange;
      if (!Array.isArray(angles) || angles.length!==2 || !angles.every(a=>Number.isFinite(a) && a>=-180 && a<=180))
        issues.push(`invalid-direction-range:${side}`);
    }
    if (ambiguities.some(r=>!polygon(r?.region) || !nonempty(r.reason))) issues.push(`invalid-ambiguity:${side}`);
    if (protectedRegions.some(r=>!polygon(r?.region))) issues.push(`invalid-protected-region:${side}`);
  }
  if (issues.length) return {status:'invalid',role,issues,tipCounts};
  const deficits = role==='positive' ? evaluated.filter(side=>tipCounts[side]<5).map(side=>`fewer-than-five:${side}`) : [];
  return {status:deficits.length?'data-insufficient':'review-recorded',role,issues:deficits,tipCounts};
}

export function intakeDevelopmentReviews(directory) {
  const selection = JSON.parse(fs.readFileSync('tests/visual/lash-development-review-selection.json'));
  const summary = JSON.parse(fs.readFileSync(selection.censusSummary));
  const censusBytes = fs.readFileSync(selection.census);
  if (hash(censusBytes)!==summary.censusSHA256) throw Error('Census digest mismatch');
  const census = JSON.parse(censusBytes);
  const indexBytes = fs.readFileSync(path.join(directory,'index.json'));
  const index = JSON.parse(indexBytes);
  if (index.split!=='development' || JSON.stringify(index.sources.map(s=>s.file))!==JSON.stringify(selection.sources))
    throw Error('Packet inventory does not match the development selection');
  const records = [], frozen = {};
  for (const source of index.sources) {
    const recorded = census.sources.find(s=>s.file===source.file);
    if (recorded?.split!=='development' || !recorded.bothEnginesReady || source.sha256!==recorded.sourceSHA256 ||
        hash(fs.readFileSync(path.join(directory,'originals',source.file)))!==source.sha256) throw Error(`Source integrity failed for ${source.file}`);
    const geometry = ['chromium','webkit'].map(engine=>{
      const entry=recorded.screening.find(item=>item.engine===engine && item.status==='ready');
      const bytes=fs.readFileSync(entry.input);
      if (hash(bytes)!==census.inputs[entry.input]) throw Error(`Screening bytes changed for ${source.file}`);
      const row=JSON.parse(bytes).results.find(item=>item.file===source.file && item.sha256===source.sha256 && item.status==='ready');
      if (!row || !Number.isInteger(row.width) || !Number.isInteger(row.height) || row.width<1 || row.height<1)
        throw Error(`No verified source dimensions for ${source.file}`);
      return {width:row.width,height:row.height};
    });
    if (geometry[0].width!==geometry[1].width || geometry[0].height!==geometry[1].height) throw Error(`Disagreeing source dimensions: ${source.file}`);
    const relative = `annotations/${path.parse(source.file).name}.json`;
    let bytes;
    try { bytes=fs.readFileSync(path.join(directory,relative)); }
    catch(error) {
      if(error.code!=='ENOENT')throw error;
      records.push({file:source.file,status:'pending',issues:['missing-review']});
      continue;
    }
    let result;
    try { result=inspectReview(JSON.parse(bytes),{...source,...geometry[0]}); }
    catch { result={status:'invalid',issues:['invalid-review-json']}; }
    if (['review-recorded','data-insufficient'].includes(result.status)) frozen[relative]=hash(bytes);
    records.push({file:source.file,...result});
  }
  return {split:'development',indexSHA256:hash(indexBytes),censusSHA256:hash(censusBytes),records,frozen,
    limitations:'Validates the recorded geometry and file bytes. Review independence, actual visibility, mask scope and identity-group separation require separate checks.'};
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
  const [directory,output] = process.argv.slice(2);
  if (!directory || !output || fs.existsSync(output)) throw Error('Supply extracted review directory and NEW report JSON');
  const result=intakeDevelopmentReviews(directory);
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  const counts={};
  for (const {status} of result.records) counts[status]=(counts[status] ?? 0)+1;
  console.log(JSON.stringify(counts));
  if (counts.pending || counts.invalid || counts['data-insufficient']) process.exitCode=2;
}
