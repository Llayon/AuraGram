#!/usr/bin/env node
'use strict';
/**
 * Vendor MediaPipe tasks-vision runtime into vendor/mediapipe/ for local hosting.
 *
 * Copies (from the pinned npm dependency — see package.json, exact version):
 *   vision_bundle.mjs        ESM runtime imported by the app / face worker
 *   wasm/*.js + wasm/*.wasm  WASM backends loaded by FilesetResolver
 *   LICENSE-APACHE-2.0      from the npm package (Apache-2.0)
 *
 * The model file vendor/mediapipe/face_landmarker.task is downloaded once from
 * the official MediaPipe model storage (see vendor/mediapipe/ATTRIBUTION.md)
 * and committed — it is NOT fetched at build time so Pages works offline-first.
 *
 * Usage: node scripts/vendor-mediapipe.mjs [--check]
 *   --check verifies the vendored files match node_modules (CI gate).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision');
const DST = path.join(ROOT, 'vendor', 'mediapipe');

const FILES = [
  'vision_bundle.mjs',
  'vision_bundle.cjs',
  path.join('wasm', 'vision_wasm_internal.js'),
  path.join('wasm', 'vision_wasm_internal.wasm'),
  path.join('wasm', 'vision_wasm_nosimd_internal.js'),
  path.join('wasm', 'vision_wasm_nosimd_internal.wasm')
];

function sha256(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function main() {
  const checkOnly = process.argv.includes('--check');
  if (!fs.existsSync(path.join(SRC, 'package.json'))) {
    console.error(`missing ${SRC}: run 'npm install' first`);
    process.exit(1);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(SRC, 'package.json'), 'utf8'));
  console.log(`tasks-vision ${pkg.version} (${pkg.license})`);

  let mismatch = 0;
  for (const rel of FILES) {
    const s = path.join(SRC, rel);
    const d = path.join(DST, rel);
    if (!fs.existsSync(s)) { console.error(`MISSING source: ${rel}`); process.exit(1); }
    if (checkOnly) {
      if (!fs.existsSync(d) || sha256(s) !== sha256(d)) {
        console.error(`MISMATCH: ${rel} — run node scripts/vendor-mediapipe.mjs`);
        mismatch += 1;
      } else {
        console.log(`ok: ${rel}`);
      }
    } else {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
      console.log(`vendored: ${rel} (${fs.statSync(d).size} bytes)`);
    }
  }
  // License attribution (Apache-2.0, required redistribution notice).
  const licCandidates = ['LICENSE', 'LICENSE.txt', 'LICENSE-APACHE-2.0'];
  if (!checkOnly) {
    let copied = false;
    for (const name of licCandidates) {
      const s = path.join(SRC, name);
      if (fs.existsSync(s)) {
        fs.copyFileSync(s, path.join(DST, 'LICENSE.tasks-vision'));
        console.log(`vendored license: ${name}`);
        copied = true;
        break;
      }
    }
    if (!copied) console.log('note: no LICENSE file inside the npm package; see ATTRIBUTION.md');
  }
  if (checkOnly && mismatch > 0) process.exit(1);
  // Model presence (content is committed; only presence is gated here).
  const model = path.join(DST, 'face_landmarker.task');
  if (!fs.existsSync(model)) {
    console.error('MISSING vendor/mediapipe/face_landmarker.task — see ATTRIBUTION.md for the official source');
    process.exit(1);
  }
  console.log(`model: face_landmarker.task (${fs.statSync(model).size} bytes)`);
}

main();
