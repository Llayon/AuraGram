#!/usr/bin/env node
'use strict';
/**
 * Zero-dependency static server for Playwright E2E (and local manual QA).
 * Serves the repo root over http://127.0.0.1:8137/ so that ESM modules,
 * module Workers and WASM load exactly like on GitHub Pages (file:// would
 * block them via CORS, hiding real integration bugs).
 *
 * Usage: node tests/static-server.cjs [port]
 * (Playwright starts it automatically via webServer; see playwright.config.js.)
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.AURAGRAM_PORT || 8137);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let rel = path.normalize(urlPath).replace(/^([/\\])+/, '');
    if (!rel || rel.endsWith('/') || urlPath.endsWith('/')) rel = path.join(rel, 'index.html');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('server error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`auragram static server: http://127.0.0.1:${PORT}/`);
});
