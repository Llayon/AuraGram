'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {versionAssets} = require('./asset-versions.cjs');
const version = require('../package.json').version;
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
if (!out.startsWith(root + path.sep) || path.basename(out) !== 'dist') throw new Error('Unsafe build target');
if (fs.existsSync(out) && fs.lstatSync(out).isSymbolicLink()) throw new Error('Build target must not be a symlink');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const entry of ['index.html', 'src', 'vendor']) {
  fs.cpSync(path.join(root, entry), path.join(out, entry), { recursive: true });
}
const html = path.join(out, 'index.html');
fs.writeFileSync(html, versionAssets(fs.readFileSync(html, 'utf8'), version, true));
function versionModules(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) versionModules(file);
    else if (/\.(?:js|mjs)$/.test(entry.name)) fs.writeFileSync(file, versionAssets(fs.readFileSync(file,'utf8'), version));
  }
}
versionModules(path.join(out,'src'));
console.log('Static site prepared in dist/.');
