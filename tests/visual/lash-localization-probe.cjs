'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const {chromium} = require('@playwright/test');

async function main() {
  const geometryPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!geometryPath || !outputPath || fs.existsSync(outputPath)) {
    throw new Error('Supply a frozen geometry manifest and a new output JSON');
  }
  const geometryBytes = fs.readFileSync(geometryPath);
  const geometry = JSON.parse(geometryBytes);
  const analysisSource = process.env.LASH_ANALYSIS_SOURCE || 'src/retouch/lashAnalysis.mjs';
  const analysisModuleURL = '/' + path.relative(process.cwd(), path.resolve(analysisSource)).replaceAll(path.sep, '/');
  const annotationInputs = ['tests/visual/lash-localization-labels.json', 'tests/visual/lash-localization-independent-labels.json'];
  const annotations = annotationInputs.map(file => ({file, data: JSON.parse(fs.readFileSync(file))}));
  const images = new Map();
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const imageHashes = {};
  for (const run of geometry.runs) {
    if (path.basename(run.file) !== run.file || !run.geometry) throw new Error('Missing frozen canonical geometry');
    const bytes = fs.readFileSync(path.join('tests/visual/out/dataset', run.file));
    images.set(run.file, bytes);
    imageHashes[run.file] = hash(bytes);
  }
  const server = spawn(process.execPath, ['tests/static-server.cjs', '0'], {windowsHide: true, stdio: ['ignore', 'pipe', 'inherit']});
  let browser;
  try {
    const url = await new Promise((resolve, reject) => {
      server.stdout.on('data', data => {
        const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) resolve(match[0]);
      });
      server.once('error', reject);
    });
    browser = await chromium.launch();
    const page = await browser.newPage();
    const requests = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await page.route('https://**/*', route => route.abort());
    await page.route('**/__lash_probe__', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Offline lash geometry probe</title>'}));
    await page.route('**/tests/visual/out/dataset/*', route => {
      const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1));
      return images.has(name) ? route.fulfill({contentType: 'image/jpeg', body: images.get(name)}) : route.abort();
    });
    await page.goto(url + '/__lash_probe__');
    const results = await page.evaluate(async ({runs, annotations, analysisModuleURL}) => {
      const {analyzeLuma, lidFrame, lumaOf} = await import(analysisModuleURL);
      const results = [];
      function sample(values, width, height, x, y) {
        x = Math.max(0, Math.min(width - 1, x));
        y = Math.max(0, Math.min(height - 1, y));
        const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
        const jx = Math.min(width - 1, ix + 1), jy = Math.min(height - 1, iy + 1);
        return (values[iy * width + ix] * (1 - fx) + values[iy * width + jx] * fx) * (1 - fy) +
          (values[jy * width + ix] * (1 - fx) + values[jy * width + jx] * fx) * fy;
      }
      const fields = tip => [tip.x, tip.y, tip.dx, tip.dy, tip.c, tip.length, tip.width];
      for (const run of runs) {
        const image = new Image();
        image.src = '/tests/visual/out/dataset/' + run.file;
        await image.decode();
        if (image.width !== run.W || image.height !== run.H) throw new Error('Source dimensions changed');
        for (const side of ['left', 'right']) {
          const eye = run.geometry[side];
          const size = run.budgets.find(budget => budget.maxSide === 224).eyes[side];
          const width = size.rw, height = size.rh, roi = eye.roi;
          const rawWidth = (roi.x1 - roi.x0) * run.W, rawHeight = (roi.y1 - roi.y0) * run.H;
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          try {
            const context = canvas.getContext('2d', {willReadFrequently: true});
            context.drawImage(image, roi.x0 * run.W, roi.y0 * run.H, rawWidth, rawHeight, 0, 0, width, height);
            const rgba = context.getImageData(0, 0, width, height).data;
            const luma = new Float32Array(width * height);
            for (let index = 0; index < luma.length; index++) luma[index] = lumaOf(rgba[index * 4], rgba[index * 4 + 1], rgba[index * 4 + 2]) / 255;
            const toAnalysis = point => ({x: (point.x - roi.x0) / (roi.x1 - roi.x0) * width, y: (point.y - roi.y0) / (roi.y1 - roi.y0) * height});
            const lid = eye.upperLid.map(toAnalysis), lower = eye.lowerLid.map(toAnalysis);
            const mid = lid[Math.floor(lid.length / 2)], low = lower[Math.floor(lower.length / 2)];
            const opening = Math.hypot(mid.x - low.x, mid.y - low.y);
            const baselineBand = Math.max(3, Math.min(height * .45, opening * .65));
            const inner = toAnalysis(eye.inner), brow = (eye.browPoints || []).map(toAnalysis);
            const base = analyzeLuma(luma, width, height, lid, lower, baselineBand, inner, brow, {debug: true});
            if (JSON.stringify(base.tips.map(fields)) !== JSON.stringify(run.perEye[side].tips.map(fields))) throw new Error('Offline baseline differs from browser adapter');
            const eyeLabels = annotations.map(input => ({file: input.file, eye: input.data.eyes.find(e => e.file === run.file && e.side === side)}));
            const labelled = eyeLabels.flatMap(input => input.eye.strands.map(strand => {
              const points = strand.points4x.map(([x, y]) => ({
                x: (Math.floor(roi.x0 * run.W) + x / 4 - roi.x0 * run.W) / rawWidth * width - .5,
                y: (Math.floor(roi.y0 * run.H) + y / 4 - roi.y0 * run.H) / rawHeight * height - .5
              }));
              const tip = points.at(-1), shaft = points.at(-2);
              const tangentLength = Math.hypot(tip.x - shaft.x, tip.y - shaft.y);
              const px = -(tip.y - shaft.y) / tangentLength, py = (tip.x - shaft.x) / tangentLength;
              const center = sample(luma, width, height, tip.x, tip.y);
              const valley = Math.min(sample(luma, width, height, tip.x + px * 1.5, tip.y + py * 1.5), sample(luma, width, height, tip.x - px * 1.5, tip.y - py * 1.5)) - center;
              const frame = lidFrame(lid, lower, tip.x, tip.y);
              const index = Math.round(tip.y) * width + Math.round(tip.x);
              return {
                annotator: input.file, id: strand.id, tip, signedDistance: frame.distance,
                baselineBand, marginToOuterBand: baselineBand - frame.distance,
                rawTransverseValley: valley, valid: !!base.debug.valid[index],
                response: base.debug.responseMap[index], anisotropy: base.debug.anisotropy[index]
              };
            }));
            const recovered = analyzeLuma(luma, width, height, lid, lower, baselineBand, inner, brow, {recoverBoundaryTips: true});
            for (const map of ['densityRidge', 'densityConfidenceMap', 'rootConnectionMap']) {
              if (!base[map].every((value, index) => value === recovered[map][index])) throw new Error('Density evidence changed: ' + map);
            }
            if (base.densityConfidence !== recovered.densityConfidence) throw new Error('Density confidence changed');
            if (JSON.stringify(base.tips.map(fields)) !== JSON.stringify(recovered.tips.slice(0, base.tips.length).map(fields))) throw new Error('Baseline tips changed');
            const bands = [];
            for (const multiplier of [.65, .85, 1, 'support4']) {
              const requestedBand = multiplier === 'support4' ? baselineBand + 4 : opening * multiplier;
              const band = Math.max(3, Math.min(height * .45, requestedBand));
              const start = performance.now();
              const result = multiplier === .65 ? base : analyzeLuma(luma, width, height, lid, lower, band, inner, brow);
              bands.push({multiplier, band, diagnosticMs: performance.now() - start,
                tips: result.tips, lengthConfidence: result.lengthConfidence, diagnostics: result.diagnostics});
            }
            results.push({file: run.file, side, width, height, roi, rawWidth, rawHeight, opening, baselineBand, labelled, bands,
              contextRecovery: {tips: recovered.tips, traces:recovered.traces, lengthConfidence: recovered.lengthConfidence, diagnostics: recovered.diagnostics, densityIdentical: true, baselineTipsUnchanged: true}});
          } finally { canvas.width = 0; canvas.height = 0; }
        }
      }
      return results;
    }, {runs: geometry.runs, annotations, analysisModuleURL});
    if (requests.some(request => /\.(?:wasm|task)$/.test(request))) throw new Error('Unexpected inference asset request');
    fs.writeFileSync(outputPath, JSON.stringify({geometryPath, geometrySHA256: hash(geometryBytes), imageHashes,analysisSource,analysisSHA256:hash(fs.readFileSync(analysisSource)),
      annotations: annotationInputs.map(file => ({file, sha256: hash(fs.readFileSync(file))})),
      requests, decoderEngine: 'chromium', note: 'Band sweep is a diagnostic experiment. Baseline tips exactly match the real-image adapter. No slider, renderer, Density or product gate changed.', results}, null, 2), {flag: 'wx'});
    for (const eye of results) {
      console.log(eye.file, eye.side, 'band', eye.baselineBand.toFixed(2), 'tip counts', eye.bands.map(band => band.tips.filter(tip => tip.c >= .6 && band.lengthConfidence >= .25).length));
      console.log('outside', eye.labelled.filter(label => label.marginToOuterBand < 0).map(label => [label.id, label.marginToOuterBand.toFixed(2), label.rawTransverseValley.toFixed(4)]));
      console.log('recovery', eye.contextRecovery.diagnostics.boundaryContext);
    }
  } finally { if (browser) await browser.close(); server.kill(); }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
