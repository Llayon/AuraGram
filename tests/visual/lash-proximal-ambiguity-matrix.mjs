import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {followCurve} from './lash-subpixel-probe.mjs';
import {NATIVE_PATH_PROTOCOL} from './lash-native-path.mjs';
import {auditSharedArcProximal} from './lash-shared-arc-proximal.mjs';
import {auditProximalBands} from './lash-proximal-band-audit.mjs';

// Fixed analytic luminance fixtures. Integrate before quantizing to native pixels.
const patch = {x:0, y:0, w:72, h:64};
const geometry = {lid:[{x:12,y:46},{x:60,y:46}], lower:[{x:36,y:52}]};
const stress = process.argv.includes('--stress-contrast');
const phases = stress ? [-.4,-.125,.125,.4] : [-.25,0,.25];
const originalCases = [
  {kind:'single'}, {kind:'gap'},
  ...[.35,.65,1].flatMap(slope => [.5,1].flatMap(strength => [
    {kind:'crossing',slope,strength}, {kind:'fork',slope,strength}
  ])),
  ...[1.5,2.5,3.5].flatMap(separation => [.5,1].map(strength => ({kind:'parallel',separation,strength})))
];
const stressCases = [
  {kind:'single'}, {kind:'gap'},
  ...[.25,.45,.8].flatMap(slope => [.25,.65,.85].flatMap(strength => [
    {kind:'crossing',slope,strength}, {kind:'fork',slope,strength}
  ])),
  ...[1.75,2.75,4.25].flatMap(separation => [.25,.65,.85].map(strength => ({kind:'parallel',separation,strength})))
];
const cases = stress ? stressCases : originalCases;
const axis = {x:0,y:-1};
const auditBands = stress || process.argv.includes('--audit-bands');
const browserInputIndex = process.argv.indexOf('--browser-inputs');
const browserInputFile = browserInputIndex < 0 ? null : process.argv[browserInputIndex + 1];
if (browserInputIndex >= 0 && (!auditBands || !browserInputFile || fs.existsSync(browserInputFile)))
  throw Error('Supply --audit-bands and a NEW browser input JSON');
const browserInputs = [];
const gaussian = dx => Math.exp(-(dx * dx) / .45);
function signal(dx, y, fixture) {
  const main = gaussian(dx);
  const offset = y - 32;
  switch (fixture.kind) {
    case 'single': return main;
    case 'gap': return y >= 30 && y <= 34 ? 0 : main;
    case 'crossing': return Math.max(main, fixture.strength * gaussian(dx - offset * fixture.slope));
    case 'fork': return offset < 0 ? main : Math.max(gaussian(dx + offset * fixture.slope), fixture.strength * gaussian(dx - offset * fixture.slope));
    case 'parallel': return Math.max(main, fixture.strength * gaussian(dx - fixture.separation));
    default: throw Error('Unknown fixture');
  }
}
function run(fixture, phase) {
  const center = 36 + phase;
  const luma = Float32Array.from({length:patch.w * patch.h}, (_, i) => {
    const x = i % patch.w, y = Math.floor(i / patch.w);
    let sum = 0;
    for (let row=0; row<4; row++) for (let col=0; col<4; col++)
      sum += .8 - .45 * signal(x + (col + .5) / 4 - .5 - center, y + (row + .5) / 4 - .5, fixture);
    return Math.round(sum / 16 * 255) / 255;
  });
  const start = {x:center,y:18};
  const distal = followCurve(luma, patch.w, patch.h, start, {available:true,tx:axis.x,ty:axis.y},
    {body:true,association:true}, {margin:1.5,protocol:{...NATIVE_PATH_PROTOCOL,maximumSteps:12,maximumArcNative:6}});
  const reverse = auditSharedArcProximal(luma, patch, start, axis, distal, geometry);
  assert.ok((reverse.distalArc ?? 0) + (reverse.proximalArc ?? 0) <= 36 + 1e-8);
  assert.equal(reverse.endpointConfirmed, undefined);
  const row = {...fixture,phase,distalReason:distal.reason,distalPoints:distal.points,reverse};
  if (auditBands && reverse.status === 'gate-observed') {
    row.bandAudit = auditProximalBands(luma,patch.w,patch.h,reverse.points);
    if (stress) row.contrastAudit = auditProximalBands(luma,patch.w,patch.h,reverse.points,'transverseContrast');
    if (browserInputFile) browserInputs.push({kind: fixture.kind, luma: Array.from(luma), points: reverse.points,
      expected: stress ? row.contrastAudit : row.bandAudit});
  }
  return row;
}

const output = process.argv[2];
if (!output || fs.existsSync(output)) throw Error('Supply NEW output JSON');
const rows = cases.flatMap(fixture => phases.map(phase => run(fixture,phase)));
const summary = {};
for (const {kind,reverse} of rows) {
  summary[kind] ??= {cases:0, gateArrivals:0, reasons:{}};
  summary[kind].cases++;
  if (reverse.status === 'gate-observed') summary[kind].gateArrivals++;
  summary[kind].reasons[reverse.reason] = (summary[kind].reasons[reverse.reason] ?? 0) + 1;
}
if (auditBands) for (const {kind,bandAudit} of rows.filter(row => row.bandAudit)) {
  const counts = summary[kind].bandAudit ??= {};
  counts[bandAudit.reason] = (counts[bandAudit.reason] ?? 0) + 1;
}
if (stress) for (const {kind,bandAudit,contrastAudit} of rows.filter(row => row.contrastAudit)) {
  const group = summary[kind];
  const counts = group.contrastAudit ??= {refusals:0,newRefusals:0,lostRefusals:0};
  const oldVeto = bandAudit.status !== 'no-veto', newVeto = contrastAudit.status !== 'no-veto';
  counts.refusals += Number(newVeto);
  counts.newRefusals += Number(!oldVeto && newVeto);
  counts.lostRefusals += Number(oldVeto && !newVeto);
}
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources = ['lash-proximal-ambiguity-matrix.mjs','lash-shared-arc-proximal.mjs','lash-proximal-budget-bound.mjs',
  'lash-native-path.mjs','lash-subpixel-probe.mjs','lash-subpixel-center.mjs','lash-endpoint-profile.mjs','lash-native-shaft.mjs']
  .map(file => 'tests/visual/' + file);
sources.push('src/retouch/lashAnalysis.mjs');
if (auditBands) sources.push('tests/visual/lash-proximal-band-audit.mjs');
const inputs = Object.fromEntries(sources.map(file => [file,hash(file)]));
const protocol = stress ? {phases,cases,policy:'Compare saved response and transverse contrast with all other parameters fixed. Count lost refusals, no-veto crossings and forks, and isolated cases separately.'} : undefined;
fs.writeFileSync(output, JSON.stringify({patch,geometry,inputs,summary,rows,...(protocol ? {protocol} : {})},null,2) + '\n', {flag:'wx'});
if (browserInputFile) fs.writeFileSync(browserInputFile, JSON.stringify({width: patch.w, height: patch.h, inputs,
  ...(stress ? {score:'transverseContrast'} : {}),cases: browserInputs}) + '\n', {flag:'wx'});
console.log(JSON.stringify(summary));
