'use strict';
// Restore byte-identical archived source/JSON into a NEW directory. No browser or network.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const input = path.join(__dirname, 'localization-evidence');
const destination = process.argv[2];
if (!destination || fs.existsSync(destination)) throw new Error('Supply a NEW destination directory');
fs.mkdirSync(destination, {recursive: true});
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const bundle = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(input, 'sources.json.gz'))));
for (const [relative, record] of Object.entries(bundle)) {
  if (relative.split('/').includes('..') || path.isAbsolute(relative)) throw new Error('Invalid source path');
  const bytes = Buffer.from(record.base64, 'base64');
  if (hash(bytes) !== record.sha256) throw new Error('Source hash mismatch: ' + relative);
  const target = path.join(destination, 'candidate-src', relative);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, bytes);
}
for (const file of fs.readdirSync(input).filter(file => file.endsWith('.json.gz') && file !== 'sources.json.gz')) {
  fs.writeFileSync(path.join(destination, file.slice(0, -3)), zlib.gunzipSync(fs.readFileSync(path.join(input, file))));
}
console.log('Restored and verified ' + Object.keys(bundle).length + ' source files; restored JSON preserves original provenance paths.');
