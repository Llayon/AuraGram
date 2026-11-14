'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const labelsPath = process.argv[2] || 'tests/visual/lash-localization-labels.json';
const manifestPath = process.argv[3] || 'tests/visual/recovery-evidence/manifest-chromium.json';
const outputDirectory = process.argv[4];
if (!outputDirectory || fs.existsSync(outputDirectory)) {
  throw new Error('Supply a new audit output directory as the third argument');
}

const labelsBytes = fs.readFileSync(labelsPath);
const manifestBytes = fs.readFileSync(manifestPath);
const labels = JSON.parse(labelsBytes);
const manifest = JSON.parse(manifestBytes);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function angleDegrees(first, second) {
  const denominator = Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y);
  if (!denominator) return null;
  const cosine = (first.x * second.x + first.y * second.y) / denominator;
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

function distanceToSegment(point, first, second) {
  const dx = second.x - first.x, dy = second.y - first.y;
  const squareLength = dx * dx + dy * dy;
  const projection = squareLength ? ((point.x - first.x) * dx + (point.y - first.y) * dy) / squareLength : 0;
  const fraction = Math.max(0, Math.min(1, projection));
  return distance(point, {x: first.x + dx * fraction, y: first.y + dy * fraction});
}

function distanceToPolyline(point, points) {
  if (points.length === 1) return distance(point, points[0]);
  let closest = Infinity;
  for (let index = 1; index < points.length; index++) {
    closest = Math.min(closest, distanceToSegment(point, points[index - 1], points[index]));
  }
  return closest;
}

function svgPolyline(points, color, width = 2) {
  return `<polyline points="${points.map(p => `${p.x * 4},${p.y * 4}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
}

fs.mkdirSync(outputDirectory, {recursive: true});
const audit = {
  labelsPath, labelsSHA256: hash(labelsBytes), manifestPath, manifestSHA256: hash(manifestBytes),
  sourceHashes: manifest.sourceHashes,
  tracePointOrderNormalization: 'Legacy clipped-tip arrays run seed-to-tip and are reversed before endpoint comparison. Fitted traces already run tip-to-root.',
  matching: 'Per-label nearest eligible tip. Positional agreement uses declared label uncertainty only. Tangent angles remain raw. Duplicate nearest-candidate assignments are explicitly reported. This sampled annotation does not estimate whole-eye precision or recall.',
  eyes: []
};
const sections = [];

for (const annotatedEye of labels.eyes) {
  const run = manifest.runs.find(run => run.file === annotatedEye.file);
  if (!run?.perEye?.[annotatedEye.side]) throw new Error('Missing frozen eye');
  const eye = run.perEye[annotatedEye.side];
  const size = run.budgets.find(budget => budget.maxSide === 224).eyes[annotatedEye.side];
  const roi = eye.roi;
  const rawWidth = (roi.x1 - roi.x0) * run.W;
  const rawHeight = (roi.y1 - roi.y0) * run.H;
  const offsetX = roi.x0 * run.W - Math.floor(roi.x0 * run.W);
  const offsetY = roi.y0 * run.H - Math.floor(roi.y0 * run.H);
  const fromAnalysis = point => ({
    x: offsetX + (point.x + .5) * rawWidth / size.rw,
    y: offsetY + (point.y + .5) * rawHeight / size.rh
  });
  const candidates = eye.tips.filter(tip => tip.c >= .6 && eye.lengthConfidence >= .25).map((tip, index) => ({
    index, point: {x: offsetX + tip.x * rawWidth, y: offsetY + tip.y * rawHeight},
    tangent: {x: tip.dx * rawWidth / size.rw, y: tip.dy * rawHeight / size.rh},
    confidence: tip.c, observedLengthSourcePx: tip.length * rawWidth / size.rw,
    trace: tip.evidence.points.map(fromAnalysis)
  }));
  const traces = eye.traces.map((trace, index) => ({
    index, reason: trace.reason, confidence: trace.confidence,
    // Legacy clipped traces store seed-to-tip, all fitted traces tip-to-root.
    points: (trace.reason === 'clipped-tip' ? trace.points.slice().reverse() : trace.points).map(fromAnalysis), measuredCount: trace.measuredCount,
    distalCount: trace.distalCount, connected: trace.connected
  }));
  const rows = annotatedEye.strands.map(strand => {
    const points = strand.points4x.map(([x, y]) => ({x: x / 4, y: y / 4}));
    const endpoint = points.at(-1), shaft = points.at(-2);
    const tangent = {x: endpoint.x - shaft.x, y: endpoint.y - shaft.y};
    const nearestAccepted = candidates.map(candidate => ({
      index: candidate.index, endpointErrorSourcePx: distance(endpoint, candidate.point),
      tangentErrorDegrees: angleDegrees(tangent, candidate.tangent),
      confidence: candidate.confidence, observedLengthSourcePx: candidate.observedLengthSourcePx
    })).sort((a, b) => a.endpointErrorSourcePx - b.endpointErrorSourcePx)[0] || null;
    const nearbyTraces = traces.map(trace => ({
      index: trace.index, reason: trace.reason, confidence: trace.confidence,
      endpointErrorSourcePx: distance(endpoint, trace.points[0]),
      distalPathDistanceSourcePx: (distanceToPolyline(endpoint, trace.points) + distanceToPolyline(shaft, trace.points)) / 2,
      measuredCount: trace.measuredCount, distalCount: trace.distalCount, connected: trace.connected
    })).sort((a, b) => a.distalPathDistanceSourcePx - b.distalPathDistanceSourcePx).slice(0, 3);
    return {
      id: strand.id, points, nearestAccepted,
      tipUncertaintySourcePx: strand.tipUncertaintySourcePx ?? annotatedEye.tipUncertaintySourcePx,
      positionAgreesWithinAnnotation: !!nearestAccepted && nearestAccepted.endpointErrorSourcePx <= (strand.tipUncertaintySourcePx ?? annotatedEye.tipUncertaintySourcePx),
      nearbyTraces
    };
  });
  const nearestAssignments = rows.filter(row => row.positionAgreesWithinAnnotation).map(row => row.nearestAccepted.index);
  const duplicateAssignments = nearestAssignments.filter((index, position) => nearestAssignments.indexOf(index) !== position);
  const pictureName = `chromium-${annotatedEye.file.replace('.jpg', '')}-original-${annotatedEye.side}-4x.png`;
  const picturePaths = [
    path.join('tests/visual/recovery-evidence', pictureName),
    path.join('tests/visual/localization-evidence/originals', pictureName)
  ];
  const picturePath = picturePaths.find(file => fs.existsSync(file));
  if (!picturePath) throw new Error('Missing original crop: ' + pictureName);
  const picture = fs.readFileSync(picturePath);
  const width = picture.readUInt32BE(16), height = picture.readUInt32BE(20);
  const result = {
    file: annotatedEye.file, side: annotatedEye.side, status: annotatedEye.status,
    imageSHA256: hash(picture), imageWidth: width, imageHeight: height,
    eligibleCandidates: candidates.length, annotatedStrands: rows.length,
    positionalAgreements: rows.filter(row => row.positionAgreesWithinAnnotation).length,
    duplicateAssignments, rows,
    diagnostics: eye.diagnostics,
    caveat: 'Nearest rejected paths may belong to a neighbouring hair. Their reasons are diagnostic leads, not automatically attributed causes. Stored traces are bounded and may omit later rejections.'
  };
  audit.eyes.push(result);
  let overlay = '';
  for (const row of rows) {
    overlay += svgPolyline(row.points, '#ffe04b');
    const tip = row.points.at(-1);
    overlay += `<circle cx="${tip.x * 4}" cy="${tip.y * 4}" r="${row.tipUncertaintySourcePx * 4}" fill="none" stroke="#ffe04b"/><text x="${tip.x * 4 + 6}" y="${tip.y * 4 - 5}" fill="#fff" font-size="11">${row.id}</text>`;
  }
  for (const candidate of candidates) {
    overlay += svgPolyline(candidate.trace, '#00eaff');
    overlay += `<circle cx="${candidate.point.x * 4}" cy="${candidate.point.y * 4}" r="3" fill="#00eaff"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="data:image/png;base64,${picture.toString('base64')}" width="${width}" height="${height}"/>${overlay}</svg>`;
  const prefix = annotatedEye.file.replace('.jpg', '') + '-' + annotatedEye.side;
  fs.writeFileSync(path.join(outputDirectory, prefix + '.svg'), svg, {flag: 'wx'});
  sections.push(`<section><h2>${prefix}</h2><p>${annotatedEye.status}. Marked ${rows.length}, eligible ${candidates.length}, endpoint agreements ${result.positionalAgreements}. Yellow = provisional visual paths and uncertainty circles. Cyan = eligible detector traces.</p><img src="${prefix}.svg" width="${width}" height="${height}"></section>`);
  console.log(prefix, JSON.stringify(rows.map(row => ({id: row.id, error: row.nearestAccepted?.endpointErrorSourcePx.toFixed(2), angle: row.nearestAccepted?.tangentErrorDegrees?.toFixed(1), agrees: row.positionAgreesWithinAnnotation, nearby: row.nearbyTraces[0]?.reason}))));
}
fs.writeFileSync(path.join(outputDirectory, 'audit.json'), JSON.stringify(audit, null, 2), {flag: 'wx'});
fs.writeFileSync(path.join(outputDirectory, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Lash localization audit</title><style>body{background:#222;color:#eee;font:16px sans-serif}section{margin:24px 0;overflow:auto}img{max-width:none}</style><h1>Original-only annotations vs frozen detector</h1><p>Coordinates and uncertainty are provisional visual measurements. Unlabelled candidates are unreviewed, not automatically false positives. Native crop enlarged400%, no extra sharpening.</p>' + sections.join(''), {flag: 'wx'});
