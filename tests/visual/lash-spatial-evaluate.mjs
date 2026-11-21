import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';
import qualifier from './lash-spatial-qualify.cjs';
import {scoreSpatialEyes} from './lash-spatial-eye-score.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const requireEvidence = (condition,message) => { if (!condition) throw Error(message); };
const readJSON = file => {
  const bytes = fs.readFileSync(file);
  return {sha256:hash(bytes),content:JSON.parse(bytes)};
};

/** Offline scoring after qualification. This tool opens files, never images or a detector. */
export function evaluateSpatialFiles(configFile) {
  const config = readJSON(configFile).content;
  const resolve = name => path.resolve(path.dirname(configFile),name);
  const sourceFile = resolve(config.sources), annotationFile = resolve(config.annotations);
  const qualification = qualifier.qualifyFiles(sourceFile,annotationFile,resolve(config.sourceDirectory));
  if (!qualification.eligible) return {status:'cohort-unqualified',qualification};

  const sources = readJSON(sourceFile), annotations = readJSON(annotationFile);
  const freeze = readJSON(resolve(config.freeze));
  requireEvidence(sources.sha256===qualification.sourceManifestSHA256 && annotations.sha256===qualification.annotationManifestSHA256,
    'Qualification inputs changed');
  requireEvidence(freeze.content.sourcesSHA256===sources.sha256 && freeze.content.annotationsSHA256===annotations.sha256,
    'Freeze does not bind the qualified cohort');
  const frozenArtifacts = ['candidate','baseline'];
  for (const name of frozenArtifacts) {
    const record = freeze.content[name];
    requireEvidence(typeof record?.file==='string' && record.file.trim() &&
      record.sha256===hash(fs.readFileSync(resolve(record.file))),`Changed frozen ${name} artifact`);
  }

  const byFile = new Map(annotations.content.annotations.map(annotation=>[annotation.file,annotation]));
  const eyes = sources.content.sources.filter(source=>source.split==='validation').flatMap(({file})=>{
    const annotation = byFile.get(file), positive = annotation.role==='positive';
    const selected = annotation.evaluatedEyes ?? ['left','right'];
    requireEvidence(Array.isArray(selected) && selected.length>0,`No evaluated eyes for ${file}`);
    return selected.map(side=>{
      requireEvidence(side==='left'||side==='right',`Invalid eye for ${file}`);
      return {id:`${file}/${side}`,positive,labels:annotation.eyes?.[side]};
    });
  });
  const runs = {}, inputs = {freezeSHA256:freeze.sha256};
  for (const engine of ['chromium','webkit']) {
    const files = config.runs[engine];
    requireEvidence(files.primary!==files.repeat && resolve(files.primary)!==resolve(files.repeat),`Missing distinct ${engine} repeat file`);
    const first = readJSON(resolve(files.primary)), second = readJSON(resolve(files.repeat));
    const review = readJSON(resolve(files.review));
    requireEvidence(first.content.engine===engine && second.content.engine===engine && first.content.freezeSHA256===freeze.sha256 &&
      second.content.freezeSHA256===freeze.sha256,`Wrong ${engine} provenance`);
    requireEvidence(isDeepStrictEqual(first.content.eyes,second.content.eyes),`Nondeterministic ${engine} eye records`);
    requireEvidence(review.content.engine===engine && review.content.runSHA256===first.sha256,`Unbound ${engine} review`);
    const reviewerEyes = new Map(review.content.eyes.map(eye=>[eye.id,eye.reviews]));
    requireEvidence(reviewerEyes.size===review.content.eyes.length && reviewerEyes.size===first.content.eyes.length &&
      first.content.eyes.every(eye=>reviewerEyes.has(eye.id)),`Wrong ${engine} review coverage`);
    runs[engine] = first.content.eyes.map(eye=>({...eye,reviews:reviewerEyes.get(eye.id)}));
    inputs[engine] = {primarySHA256:first.sha256,repeatSHA256:second.sha256,reviewSHA256:review.sha256};
  }
  const scores = scoreSpatialEyes(eyes,runs);
  return {status:scores.passesScoredEyes?'eye-criteria-passed':'eye-criteria-failed',qualification,inputs,scores,
    limitations:'The scorer verifies supplied records. Independent human review, freeze chronology and remaining integration gates need separate evidence.'};
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
  const [config,output] = process.argv.slice(2);
  if (!config || !output || fs.existsSync(output)) {
    console.error('Usage: node lash-spatial-evaluate.mjs config.json NEW-output.json');
    process.exitCode = 1;
  } else {
    let result;
    try { result = evaluateSpatialFiles(config); }
    catch (error) { result = {status:'invalid-evidence',reason:error.message}; }
    fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    console.log(result.status);
    process.exitCode = result.status==='eye-criteria-passed'?0:result.status==='invalid-evidence'?1:2;
  }
}
