'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
if (!out.startsWith(root + path.sep) || path.basename(out) !== 'dist') throw new Error('Unsafe build target');
if (fs.existsSync(out) && fs.lstatSync(out).isSymbolicLink()) throw new Error('Build target must not be a symlink');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const entry of ['index.html', 'src', 'vendor']) {
  fs.cpSync(path.join(root, entry), path.join(out, entry), { recursive: true });
}
console.log('Static site prepared in dist/.');
