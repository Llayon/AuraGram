'use strict';
const fs = require('node:fs'), {createHash} = require('node:crypto');
const hash = b => createHash('sha256').update(b).digest('hex');
async function main() {
  const [configFile, output] = process.argv.slice(2);
  if (!output || fs.existsSync(output)) throw Error('Supply config and NEW output JSON');
  const inputs = {}, configBytes = fs.readFileSync(configFile), config = JSON.parse(configBytes);
  const read = path => {const bytes = fs.readFileSync(path); inputs[path] = hash(bytes); return {...JSON.parse(bytes), path, sha256: hash(bytes)};};
  const acquisitions = config.acquisitions.map(read), screenings = config.screenings.map(read);
  const {screeningCensus} = await import('./lash-screening-census.mjs');
  const result = screeningCensus(acquisitions, screenings);
  fs.writeFileSync(output, JSON.stringify({...result, configSHA256: hash(configBytes), inputs,
    moduleSHA256: hash(fs.readFileSync('tests/visual/lash-screening-census.mjs')),
    runnerSHA256: hash(fs.readFileSync(__filename))}, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({consistent: result.consistent, errors: result.errors, planned: result.planned,
    downloaded: result.downloaded, validationViewsEmitted: result.validationViewsEmitted, splits: result.splits}));
  if (!result.consistent) process.exitCode = 2;
}
main().catch(e => {console.error(e); process.exitCode = 1;});
