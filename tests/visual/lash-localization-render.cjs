'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const {chromium, webkit, devices} = require('@playwright/test');

async function main() {
  const geometryPath = process.argv[2];
  const runName = process.argv[3];
  if (!geometryPath || !runName || !/^[\w-]+$/.test(runName)) throw new Error('Supply geometry manifest and NEW run name');
  const root = path.resolve(__dirname, '../..');
  const output = path.join(__dirname, 'out', runName);
  const geometry = JSON.parse(fs.readFileSync(geometryPath));
  const selection = process.env.LASH_FIXTURE?.split(',');
  const selectedRuns = geometry.runs.filter(run => run.geometry && (!selection || selection.includes(run.file)));
  const gradeProbeOnly = process.argv.includes('--grade-probe-only');
  const referenceFolder = process.env.LASH_REFERENCE_SOURCE ? path.resolve(process.env.LASH_REFERENCE_SOURCE) : path.join(path.dirname(path.resolve(geometryPath)), 'candidate-src');
  const engine = process.argv.includes('--webkit') ? webkit : chromium;
  fs.mkdirSync(output, {recursive: true});
  fs.writeFileSync(path.join(output, engine.name() + '.started'), new Date().toISOString(), {flag: 'wx'});
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const sourceHashes = {}, referenceHashes = {};
  for (const folder of ['retouch', 'rendering', 'vision']) {
    const snapshot = path.join(output, 'candidate-src', folder);
    if (!fs.existsSync(snapshot)) fs.cpSync(path.join(root, 'src', folder), snapshot, {recursive: true});
    for (const name of fs.readdirSync(snapshot)) sourceHashes[folder + '/' + name] = hash(fs.readFileSync(path.join(snapshot, name)));
    for (const name of fs.readdirSync(path.join(referenceFolder, folder))) referenceHashes[folder + '/' + name] = hash(fs.readFileSync(path.join(referenceFolder, folder, name)));
  }
  const imageBytes = new Map();
  const imageHashes = {};
  for (const run of selectedRuns) {
    if (path.basename(run.file) !== run.file) throw new Error('Invalid source name');
    const bytes = fs.readFileSync(path.join(__dirname, 'out/dataset', run.file));
    if(run.sourceImageSHA256 && hash(bytes)!==run.sourceImageSHA256)throw new Error('Frozen geometry belongs to different source bytes: '+run.file);
    imageBytes.set(run.file, bytes); imageHashes[run.file] = hash(bytes);
  }
  const server = spawn(process.execPath, ['tests/static-server.cjs', '0'], {windowsHide: true, stdio: ['ignore', 'pipe', 'inherit']});
  let browser;
  const manifest = {engine: engine.name(), sourceHashes, referenceHashes, imageHashes, geometryPath, selection, gradeProbeOnly,
    geometrySHA256: hash(fs.readFileSync(geometryPath)), runs: [],
    excluded: geometry.runs.filter(run => !run.geometry).map(run => ({file: run.file, status: run.status, reason: run.excludedReason})),
    legend: 'Original native JPEG decoded once. b46 Length vs boundary-context Length. Recovery-only isolates added measured structures. Difference maps amplify RGB8x. Baseline-only removes recovered candidates to verify exact compositor preservation.'};
  try {
    const url = await new Promise((resolve, reject) => {
      server.stdout.on('data', data => {const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) resolve(match[0]);});
      server.once('error', reject);
    });
    browser = await engine.launch();
    const page = await browser.newPage(engine === webkit ? devices['iPhone 11'] : {});
    const requests = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await page.route('https://**/*', route => route.abort());
    await page.route('**/__localization_render__', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Offline measured lash render</title>'}));
    await page.route('**/tests/visual/out/dataset/*', route => {
      const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1));
      return imageBytes.has(name) ? route.fulfill({contentType: 'image/jpeg', body: imageBytes.get(name)}) : route.abort();
    });
    await page.exposeFunction('saveAuditPNG', (name, data) => {
      if (path.basename(name) !== name) throw new Error('Invalid PNG filename');
      fs.writeFileSync(path.join(output, name), Buffer.from(data.split(',')[1], 'base64'), {flag: 'wx'});
    });
    await page.goto(url + '/__localization_render__');
    const referenceURL = '/' + path.relative(root, referenceFolder).replaceAll(path.sep, '/') + '/retouch/';
    for (const run of selectedRuns) {
      console.log(engine.name(), run.file);
      const result = await page.evaluate(async ({run, runName, referenceURL, engineName, gradeProbeOnly}) => {
        const referenceAnalysis = await import(referenceURL + 'lashAnalysis.mjs');
        if(referenceAnalysis.LASH_ANALYSIS_VERSION !== 'g1c1-recovery-4')throw new Error('Select the frozen b46 reference source graph');
        const referencePass = await import(referenceURL + 'lashEnhancement.mjs');
        const candidateURL = '/tests/visual/out/' + runName + '/candidate-src/retouch/';
        const candidateAnalysis = await import(candidateURL + 'lashAnalysis.mjs');
        const candidatePass = await import(candidateURL + 'lashEnhancement.mjs');
        const image = new Image(); image.src = '/tests/visual/out/dataset/' + run.file; await image.decode();
        const width = image.width, height = image.height, eyes = run.geometry;
        if (width !== run.W || height !== run.H) throw new Error('Source dimensions changed');
        const analyze = module => Object.fromEntries(['left', 'right'].map(side => [side, module.analyzeEye(image, eyes[side], side)]));
        const before = performance.now(), reference = analyze(referenceAnalysis), referenceMs = performance.now() - before;
        const start = performance.now(), candidate = analyze(candidateAnalysis), candidateMs = performance.now() - start;
        const baselineOnly = {}, recoveryOnly = {};
        const fields = tip => [tip.x, tip.y, tip.dx, tip.dy, tip.c, tip.length, tip.width, tip.color];
        for (const side of ['left', 'right']) {
          for (const key of ['densityRidge', 'densityConfidenceMap', 'rootConnectionMap']) {
            const referenceMap=reference[side][key],candidateMap=candidate[side][key];
            if (!!referenceMap !== !!candidateMap || referenceMap && (referenceMap.length!==candidateMap.length || !referenceMap.every((value,index)=>value===candidateMap[index]))) throw new Error('Density evidence changed: ' + side + key);
          }
          const baselineTips = candidate[side].tips.filter(tip => !tip.evidence?.boundaryRecovery);
          if (JSON.stringify(baselineTips.map(fields)) !== JSON.stringify(reference[side].tips.map(fields))) throw new Error('Baseline candidate changed');
          baselineOnly[side] = {...candidate[side], tips: baselineTips};
          recoveryOnly[side] = {...candidate[side], tips: candidate[side].tips.filter(tip => tip.evidence?.boundaryRecovery)};
        }
        const makeCanvas = () => {
          const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(image, 0, 0); return canvas;
        };
        const originalCanvas = makeCanvas(), original = originalCanvas.getContext('2d').getImageData(0, 0, width, height).data;
        originalCanvas.width = originalCanvas.height = 0;
        const pixels = {}, diagnostics = {}, geometryChecks = [];
        function checkRecoveredGeometry(name, applied, outputWidth, outputHeight) {
          for (const side of ['left', 'right']) {
            const expected = candidate[side].tips.filter(tip => tip.evidence?.boundaryRecovery && tip.c >= .6 && candidate[side].boundaryLengthConfidence >= .25);
            const extensions = (applied.perEye.find(eye => eye.side === side)?.extensions || []).filter(extension => extension.boundaryRecovery);
            if (expected.length !== extensions.length) throw new Error('Recovered geometry count mismatch');
            const roi = eyes[side].roi;
            expected.forEach((tip, index) => {
              const sourceX = roi.x0 + tip.x * (roi.x1 - roi.x0), sourceY = roi.y0 + tip.y * (roi.y1 - roi.y0);
              const extension = extensions[index];
              const errorX = extension.x - sourceX * outputWidth, errorY = extension.y - sourceY * outputHeight;
              if (Math.abs(errorX) > 1e-8 || Math.abs(errorY) > 1e-8 || extension.analysisLength > 3 + 1e-10) throw new Error('Source coordinate or extension bound mismatch');
              geometryChecks.push({name, side, outputWidth, outputHeight, errorX, errorY, analysisLength: extension.analysisLength});
            });
          }
        }
        function difference(first, second) {
          let absolute = 0, changed = 0;
          for (let index = 0; index < first.length; index += 4) {
            let pixel = 0; for (let channel = 0; channel < 3; channel++) pixel += Math.abs(first[index + channel] - second[index + channel]);
            absolute += pixel; if (pixel) changed++;
          }
          return {absoluteRGB: absolute, changedPixels: changed};
        }
        async function save(name, canvas, full = false) {
          const prefix = engineName + '-' + run.file.replace('.jpg', '') + '-' + name;
          if (full) await window.saveAuditPNG(prefix + '.png', canvas.toDataURL());
          const outputWidth=canvas.width,outputHeight=canvas.height;
          for (const side of ['left', 'right']) for (const zoom of [1, 2, 4]) {
            const roi = eyes[side].roi, crop = document.createElement('canvas');
            const cropWidth = Math.ceil((roi.x1 - roi.x0) * outputWidth), cropHeight = Math.ceil((roi.y1 - roi.y0) * outputHeight);
            crop.width = cropWidth * zoom; crop.height = cropHeight * zoom;
            const context = crop.getContext('2d'); context.imageSmoothingEnabled = false;
            context.drawImage(canvas, Math.floor(roi.x0 * outputWidth), Math.floor(roi.y0 * outputHeight), cropWidth, cropHeight, 0, 0, crop.width, crop.height);
            await window.saveAuditPNG(prefix + '-' + side + '-' + zoom + 'x.png', crop.toDataURL()); crop.width = crop.height = 0;
          }
        }
        const invariants = [];
        if (gradeProbeOnly) {
          const canvas = makeCanvas(), context = canvas.getContext('2d');
          try {
            globalThis.AuraGramCanvasFilters.applyPixelsFilter(context, 'saturate(0%)');
            const before = context.getImageData(0, 0, width, height).data;
            await save('desaturated-original', canvas);
            const applied = candidatePass.applyLashPass(context, width, height, eyes, recoveryOnly, {density: 0, length: 100, definition: 0}, {diagnostics: true});
            const after = context.getImageData(0, 0, width, height).data;
            let maxAddedSpread = 0, coloredPixels = 0, brightenedChannels = 0;
            for (let index = 0; index < after.length; index += 4) {
              const beforeSpread = Math.max(before[index], before[index + 1], before[index + 2]) - Math.min(before[index], before[index + 1], before[index + 2]);
              const afterSpread = Math.max(after[index], after[index + 1], after[index + 2]) - Math.min(after[index], after[index + 1], after[index + 2]);
              maxAddedSpread = Math.max(maxAddedSpread, afterSpread - beforeSpread);
              if (afterSpread > beforeSpread) coloredPixels++;
              for (let channel = 0; channel < 3; channel++) if (after[index + channel] > before[index + channel]) brightenedChannels++;
            }
            await save('desaturated-recovery100', canvas);
            return {file: run.file, gradeProbe: {maxAddedSpread, coloredPixels, brightenedChannels, difference: difference(before, after), applied}};
          } finally {canvas.width = canvas.height = 0;}
        }
        for (const control of ['density', 'definition', 'length']) {
          for (const strength of [0, 1, 25, 50, 75, 100]) {
            const setting = {density: 0, length: 0, definition: 0, [control]: strength};
            const referenceCanvas = makeCanvas(), candidateCanvas = makeCanvas();
            try {
              referencePass.applyLashPass(referenceCanvas.getContext('2d'), width, height, eyes, reference, setting, {});
              candidatePass.applyLashPass(candidateCanvas.getContext('2d'), width, height, eyes, control === 'length' ? baselineOnly : candidate, setting, {});
              const compared = difference(referenceCanvas.getContext('2d').getImageData(0, 0, width, height).data, candidateCanvas.getContext('2d').getImageData(0, 0, width, height).data);
              invariants.push({control, strength, ...compared});
              if (compared.absoluteRGB) throw new Error('Existing control pixels changed: ' + control + strength);
            } finally { referenceCanvas.width = referenceCanvas.height = candidateCanvas.width = candidateCanvas.height = 0; }
          }
        }
        const variants = [
          ['original', null], ['reference-length50', {length: 50}], ['reference-length100', {length: 100}],
          ['context-length25', {length: 25}], ['context-length49', {length: 49}], ['context-length50', {length: 50}],
          ['context-length51', {length: 51}], ['context-length75', {length: 75}], ['context-length100', {length: 100}],
          ['recovery-only50', {length: 50}], ['recovery-only100', {length: 100}], ['combined', {density: 25, length: 25, definition: 20}]
        ];
        for (const [name, setting] of variants) {
          const canvas = makeCanvas();
          try {
            if (setting) {
              const isReference = name.startsWith('reference');
              diagnostics[name] = (isReference ? referencePass : candidatePass).applyLashPass(canvas.getContext('2d'), width, height, eyes,
                isReference ? reference : name.startsWith('recovery') ? recoveryOnly : candidate,
                {density: 0, length: 0, definition: 0, ...setting}, {diagnostics: true});
              if(!isReference && setting.length)checkRecoveredGeometry(name,diagnostics[name],width,height);
            }
            const after = canvas.getContext('2d').getImageData(0, 0, width, height).data;
            pixels[name] = difference(original, after);
            await save(name, canvas, ['original', 'reference-length100', 'context-length100', 'combined'].includes(name));
            if (name === 'recovery-only100') {
              const delta = canvas.getContext('2d').createImageData(width, height);
              for (let index = 0; index < after.length; index += 4) {
                for (let channel = 0; channel < 3; channel++) delta.data[index + channel] = Math.min(255, Math.abs(after[index + channel] - original[index + channel]) * 8);
                delta.data[index + 3] = 255;
              }
              canvas.getContext('2d').putImageData(delta, 0, 0); await save('recovery-difference8x', canvas);
            }
          } finally { canvas.width = canvas.height = 0; }
        }
        const previews=[];
        for(const previewWidth of [450,720]){
          const canvas=document.createElement('canvas');canvas.width=previewWidth;canvas.height=Math.round(height*previewWidth/width);
          try{
            const context=canvas.getContext('2d');context.drawImage(image,0,0,canvas.width,canvas.height);
            const before=context.getImageData(0,0,canvas.width,canvas.height).data;
            const applied=candidatePass.applyLashPass(context,canvas.width,canvas.height,eyes,recoveryOnly,{density:0,length:100,definition:0},{diagnostics:true});
            checkRecoveredGeometry('preview'+previewWidth,applied,canvas.width,canvas.height);
            previews.push({width:canvas.width,height:canvas.height,recoveryPixels:difference(before,context.getImageData(0,0,canvas.width,canvas.height).data),applied});
            await save('preview-recovery'+previewWidth,canvas,true);
          }finally{canvas.width=canvas.height=0;}
        }
        for (const name of ['ridge-map', 'accepted-traces', 'rejected-traces']) {
          const canvas = makeCanvas(), context = canvas.getContext('2d');
          try {
            for (const side of ['left', 'right']) {
              const analysis = candidate[side], roi = eyes[side].roi;
              const rawWidth = (roi.x1 - roi.x0) * width, rawHeight = (roi.y1 - roi.y0) * height;
              if (name === 'ridge-map' && analysis.ridgeResponseMap) {
                const map = document.createElement('canvas'); map.width = analysis.rw; map.height = analysis.rh;
                const mapContext = map.getContext('2d'), rgba = mapContext.createImageData(map.width, map.height);
                for (let index = 0; index < analysis.ridgeResponseMap.length; index++) {
                  rgba.data[index * 4 + 1] = 255; rgba.data[index * 4 + 3] = analysis.ridgeResponseMap[index];
                }
                mapContext.putImageData(rgba, 0, 0); context.drawImage(map, roi.x0 * width, roi.y0 * height, rawWidth, rawHeight);
                map.width = map.height = 0;
              }
              const traces = name === 'accepted-traces' ? analysis.tips.filter(tip => tip.c >= .6 && analysis.lengthConfidence >= .25).map(tip => tip.evidence) :
                name === 'rejected-traces' ? analysis.traces.filter(trace => trace.reason !== 'ok') : [];
              for (const trace of traces) {
                context.strokeStyle = name === 'rejected-traces' ? '#ff4040' : trace.boundaryRecovery ? '#ffe000' : '#00eaff';
                context.lineWidth = 1; context.beginPath();
                trace.points.forEach((point, index) => {
                  const x = roi.x0 * width + (point.x + .5) / analysis.rw * rawWidth;
                  const y = roi.y0 * height + (point.y + .5) / analysis.rh * rawHeight;
                  if (index) context.lineTo(x, y); else context.moveTo(x, y);
                });
                context.stroke();
              }
            }
            await save(name, canvas);
          } finally { canvas.width = canvas.height = 0; }
        }
        return {file: run.file, width, height, geometry: eyes, referenceMs, candidateMs, invariants, pixels, diagnostics,geometryChecks,previews,
          eyes: Object.fromEntries(['left', 'right'].map(side => [side, {
            baselineTips: reference[side].tips, contextTips: candidate[side].tips,
            densityConfidence: candidate[side].densityConfidence, lengthConfidence: candidate[side].lengthConfidence,
            diagnostics: candidate[side].diagnostics
          }]))};
      }, {run, runName, referenceURL, engineName: engine.name(), gradeProbeOnly});
      manifest.runs.push(result);
      fs.writeFileSync(path.join(output, engine.name() + '.json'), JSON.stringify(manifest, null, 2));
    }
    if (requests.some(request => /\.(?:wasm|task)$/.test(request))) throw new Error('Unexpected model request');
    manifest.requests = requests;
    fs.writeFileSync(path.join(output, engine.name() + '.json'), JSON.stringify(manifest, null, 2));
    const files = fs.readdirSync(output).filter(file => file.endsWith('.png') && file.endsWith('-4x.png'));
    fs.writeFileSync(path.join(output, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Boundary context Length</title><style>body{font:16px sans-serif;background:#222;color:#eee}article{overflow:auto;margin:24px 0}img{max-width:none}</style><h1>Boundary context Length</h1><p>' + manifest.legend + '</p><p>Green ridge opacity is directional response, not probability. Accepted traces cyan=baseline, yellow=boundary recovery. Rejected traces red. Diagnostic lines are excluded from product renders.</p>' + files.map(file => '<article><p>' + file + '</p><img loading="lazy" src="' + file + '"></article>').join(''));
  } finally { if (browser) await browser.close(); server.kill(); }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
