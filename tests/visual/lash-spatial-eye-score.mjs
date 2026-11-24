import {insideRegion, matchRegions} from './lash-spatial-match.mjs';

const statuses = new Set(['terminal','continuing','ambiguous','censored']);
const finitePoint = p => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const validPolygon = p => Array.isArray(p) && p.length>=3 && p.every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)) &&
  Math.abs(p.reduce((area,[x,y],i)=>area+x*p[(i+1)%p.length][1]-y*p[(i+1)%p.length][0],0))>1e-8;

function assertUniqueIds(records,kind) {
  const ids = new Set();
  for (const record of records) {
    if (typeof record.id!=='string' || !record.id.trim() || ids.has(record.id)) throw Error(`Invalid or duplicate ${kind} id`);
    ids.add(record.id);
  }
}

/** Score one frozen eye after tracing. The caller verifies the cohort and reviewer provenance. */
export function scoreSpatialEye({positive, labels, baseline, candidates, reviews}) {
  if (typeof positive!=='boolean' || !Array.isArray(labels?.tips) || !Array.isArray(labels.ambiguities) ||
      !Array.isArray(labels.protectedRegions)) throw Error('Expected an explicit eye role and frozen regions');
  const {tips,ambiguities,protectedRegions} = labels;
  if ((positive && tips.length<5) || tips.some(t=>!validPolygon(t.region) || !Array.isArray(t.directionRange) ||
      t.directionRange.length!==2 || !t.directionRange.every(Number.isFinite)) ||
      [...ambiguities,...protectedRegions].some(r=>!validPolygon(r.region))) throw Error('Invalid frozen eye annotations');
  for (const [kind,rows] of Object.entries({tip:tips,baseline,candidate:candidates,review:reviews})) assertUniqueIds(rows,kind);
  if (baseline.some(r=>!finitePoint(r.point)||!finitePoint(r.tangent)||Math.hypot(r.tangent.x,r.tangent.y)<1e-8))
    throw Error('Invalid baseline point or tangent');

  const blockers = [], terminals = [], seenPoints = new Set(), reviewById = new Map(reviews.map(r=>[r.id,r]));
  const fail = (reason,id) => blockers.push({reason,...(id===undefined?{}:{id})});
  for (const candidate of candidates) {
    const {id,status,point,tangent,path,endpointConfirmed,proximalConnection} = candidate;
    if (!statuses.has(status) || typeof endpointConfirmed!=='boolean' || endpointConfirmed!==(status==='terminal')) {
      fail('inconsistent-ending-status',id);
      continue;
    }
    if (!endpointConfirmed) continue;
    const review = reviewById.get(id);
    if (!review || typeof review.reviewer!=='string' || !review.reviewer.trim() ||
        ['continuingShaft','switchedStrand','protectedArea'].some(key=>typeof review[key]!=='boolean')) {
      fail('incomplete-independent-review',id);
    } else {
      for (const defect of ['continuingShaft','switchedStrand','protectedArea']) if (review[defect]) fail(`critic-${defect}`,id);
    }
    if (!finitePoint(point) || !finitePoint(tangent) || Math.hypot(tangent.x,tangent.y)<1e-8 ||
        proximalConnection!==true || !Array.isArray(path) || path.length<2 || !path.every(finitePoint)) {
      fail('invalid-terminal-evidence',id);
      continue;
    }
    if (protectedRegions.some(r=>insideRegion(point,r.region))) fail('terminal-in-protected-region',id);
    if (ambiguities.some(r=>insideRegion(point,r.region))) fail('terminal-in-ambiguous-region',id);
    const key = JSON.stringify([point.x,point.y]);
    if (seenPoints.has(key)) { fail('duplicate-terminal-point',id); continue; }
    seenPoints.add(key);
    terminals.push(candidate);
  }
  const matching = matchRegions(terminals,tips), baselineMatching = matchRegions(baseline,tips);
  for (const id of matching.unmatchedCandidates) fail('unmatched-terminal',id);
  const matched = new Set(matching.matches.map(m=>m.label));
  const baselineLosses = baselineMatching.matches.filter(m=>!matched.has(m.label));
  const recall = positive ? matching.matches.length/tips.length : null;
  if (positive && matching.matches.length*2<tips.length) fail('eye-recall-below-half');
  return {passesEyeCriteria:blockers.length===0,expectedTips:tips.length,recall,matching,baselineMatching,baselineLosses,blockers};
}

/** Join per-engine results to the same declared eyes without averaging their recall. */
export function scoreSpatialEyes(eyes, runs) {
  assertUniqueIds(eyes,'eye');
  if (!eyes.some(eye=>eye.positive===true)) throw Error('Missing positive eye');
  const expected = new Set(eyes.map(eye=>eye.id));
  const engines = {};
  for (const engine of ['chromium','webkit']) {
    const records = runs[engine];
    if (!Array.isArray(records)) throw Error(`Missing ${engine} results`);
    assertUniqueIds(records,`${engine} eye`);
    if (records.length!==eyes.length || records.some(record=>!expected.has(record.id))) throw Error(`Unexpected ${engine} eye coverage`);
    const byId = new Map(records.map(record=>[record.id,record]));
    engines[engine] = eyes.map(({id,positive,labels})=>{
      const {baseline,candidates,reviews} = byId.get(id);
      return {id,...scoreSpatialEye({positive,labels,baseline,candidates,reviews})};
    });
  }
  return {passesScoredEyes:Object.values(engines).every(results=>results.every(eye=>eye.passesEyeCriteria)),engines};
}
