'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const vendor = path.join(root, 'vendor', 'ui');
fs.mkdirSync(vendor, { recursive: true });
for (const style of ['regular', 'bold', 'fill']) {
  const metadata = path.join(vendor, 'icons', style, 'selection.json');
  if (fs.existsSync(metadata)) fs.unlinkSync(metadata);
  fs.cpSync(path.join(root, 'node_modules/@phosphor-icons/web/src', style),
    path.join(vendor, 'icons', style), {
      recursive: true,
      filter: entry => path.basename(entry) !== 'selection.json'
    });
}
fs.copyFileSync(path.join(root, 'node_modules/@phosphor-icons/web/LICENSE'), path.join(vendor, 'icons/LICENSE'));
for (const [family, weights] of [['inter', [400, 500, 600, 700]], ['space-mono', [700]]]) {
  const source = path.join(root, 'node_modules/@fontsource', family);
  const dest = path.join(vendor, family);
  fs.mkdirSync(path.join(dest, 'files'), { recursive: true });
  for (const weight of weights) {
    const css = fs.readFileSync(path.join(source, `${weight}.css`), 'utf8');
    fs.writeFileSync(path.join(dest, `${weight}.css`), css);
    for (const match of css.matchAll(/url\(\.\/files\/([^)]+)\)/g)) {
      fs.copyFileSync(path.join(source, 'files', match[1]), path.join(dest, 'files', match[1]));
    }
  }
  fs.copyFileSync(path.join(source, 'LICENSE'), path.join(dest, 'LICENSE'));
}
console.log('Local UI resources prepared.');
