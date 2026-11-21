import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {requireConnectedContinuation} from './lash-ending-window-connectivity.mjs';

const [source,output,webkitControl] = process.argv.slice(2);
if (!/^\d+$/.test(source ?? '') || !output || fs.existsSync(output)) throw Error('Supply development source ID and NEW output');
const manifest = JSON.parse(fs.readFileSync('tests/visual/spatial-ending-evidence/followup-ending-join-20261119.json'));
const inputs = {};
const read = relative => {
  const bytes = fs.readFileSync('tests/visual/out/' + relative);
  inputs[relative] = createHash('sha256').update(bytes).digest('hex');
  return JSON.parse(bytes);
};
const engines = {};
for (const engine of ['chromium','webkit']) {
  const originalPath = `bounded-ending-${source}-${engine}-02/${engine}.json`;
  const archived = read(originalPath);
  assert.equal(inputs[originalPath], manifest.members[originalPath]);
  const directory = `connected-ending-${source}-${engine}-01`;
  const current = read(`${directory}/${engine}.json`);
  const protocol = read(`${directory}/protocol.json`);
  let original = archived;
  if (engine==='webkit' && webkitControl) {
    const controlProtocol = read(`${webkitControl}/protocol.json`);
    assert.deepEqual(controlProtocol,{...protocol,connectedContinuation:false,
      moduleSHA256:Object.fromEntries(Object.entries(protocol.moduleSHA256)
        .filter(([file]) => file!=='tests/visual/lash-ending-window-connectivity.mjs'))});
    original = read(`${webkitControl}/webkit.json`);
    assert.equal(original.inputSHA256,archived.inputSHA256);
  }
  assert.equal(protocol.connectedContinuation,true);
  assert.equal(original.engine,engine);
  assert.equal(current.engine,engine);
  assert.equal(current.inputSHA256,original.inputSHA256);
  engines[engine] = {};
  for (const [side,records] of Object.entries(original.results)) {
    const expected = records.map(requireConnectedContinuation);
    assert.equal(current.results[side].length,expected.length);
    for (let i=0;i<expected.length;i++) assert.ok(JSON.stringify(current.results[side][i])===JSON.stringify(expected[i]),
      `${engine} ${side} replay differs at rank ${expected[i].rank}`);
    assert.ok(expected.every(record => !record.endpointConfirmed && record.status !== 'terminal'));
    const changes = records.flatMap((record,index) => record === expected[index] ? [] : [
      {rank:record.rank,index:record.index,before:record.status,after:expected[index].status,reason:expected[index].reasons[0]}
    ]);
    const changedSinceArchive = records.flatMap((record,i) => {
      const old = archived.results[side][i];
      assert.equal(record.rank,old.rank);
      assert.equal(record.index,old.index);
      return JSON.stringify(old)===JSON.stringify(record) ? [] : [{rank:record.rank,before:old.status,after:record.status}];
    });
    engines[engine][side] = {records:records.length,priorContinuing:records.filter(r=>r.status==='continuing').length,
      connectedContinuing:expected.filter(r=>r.status==='continuing').length,changes,changedSinceArchive};
    console.log(engine,side,JSON.stringify({...engines[engine][side],changes:changes.length}));
  }
}
fs.writeFileSync(output,JSON.stringify({source,inputs,engines,
  meaning:'Observed grid connectivity restricts continuation claims. Existing refusals survive and no terminal is evaluated.'},null,2)+'\n',{flag:'wx'});
