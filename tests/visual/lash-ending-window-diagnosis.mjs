import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectWindowConnectivity,intersectWindowSupport} from './lash-ending-window-connectivity.mjs';

const [joinFile,endingPrefix,output] = process.argv.slice(2);
if (!output || fs.existsSync(output)) throw Error('Supply joined summary, ending prefix and NEW output');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const joinBytes = fs.readFileSync(joinFile), joined = JSON.parse(joinBytes);
const joinedInputs = new Map(Object.entries(joined.inputs).map(([file,digest]) => [file.replaceAll('\\','/'),digest]));
const archived = JSON.parse(fs.readFileSync('tests/visual/spatial-ending-evidence/followup-ending-join-20261119.json'));
const inputs = {[joinFile]:hash(joinBytes)};
const results = {};
for (const engine of ['chromium','webkit']) {
  const file = path.posix.join(`${endingPrefix}-${engine}-02`,engine+'.json');
  const bytes = fs.readFileSync(file), ending = JSON.parse(bytes);
  inputs[file] = hash(bytes);
  assert.equal(inputs[file],joinedInputs.get(file));
  assert.equal(inputs[file],archived.members[path.posix.relative('tests/visual/out',file)]);
  assert.equal(ending.engine,engine);
  results[engine] = {};
  for (const [side,eye] of Object.entries(joined.engines[engine])) {
    const groups = new Map();
    for (const row of eye.rows.filter(r => r.bandStatus === 'no-veto' && r.measuredWindow)) {
      const record = ending.results[side].find(r => r.rank === row.rank);
      assert.equal(record.index,row.index);
      assert.equal(record.status,row.endingStatus);
      assert.equal(record.endpointConfirmed,false);
      const {x,y} = record.lastSourcePoint, tangent = record.measuredTangent;
      const key = JSON.stringify([x,y,tangent.x,tangent.y]);
      const previous = groups.get(key);
      if (previous) {
        assert.deepEqual(record.profiles,previous.record.profiles);
        assert.deepEqual(record.reasons,previous.record.reasons);
        previous.ranks.push(record.rank);
      } else groups.set(key,{record,ranks:[record.rank]});
    }
    results[engine][side] = [...groups.values()].map(({record,ranks}) => {
      const [narrow,wide] = record.profiles;
      const paired = intersectWindowSupport(narrow.rows,wide.rows);
      assert.ok(paired);
      return {point:record.lastSourcePoint,tangent:record.measuredTangent,status:record.status,reasons:record.reasons,ranks,
        individual:record.profiles.map(profile => ({radius:profile.radius,observed:profile.observed,recordedForward:profile.forward,
          ...inspectWindowConnectivity(profile.rows)})),both:inspectWindowConnectivity(paired)};
    });
  }
}
fs.writeFileSync(output,JSON.stringify({source:joined.source,inputs,results,
  meaning:'Exact position and tangent deduplication within each engine. Four-neighbor grid connectivity is diagnostic and does not establish strand identity.'},null,2)+'\n',{flag:'wx'});
