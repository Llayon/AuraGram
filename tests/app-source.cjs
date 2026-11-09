const fs = require('node:fs');
const path = require('node:path');
// Supplementary source audits follow the actual module boundaries. Behaviour
// is exercised by unit tests on exports and pixel/browser regression tests.
module.exports = function readAppSource() {
  return ['state/editorState.js', 'rendering/imageRenderer.js', 'loading/photoLoader.js',
    'ui/editorUI.js', 'exporting/exportController.js', 'app.js']
    .map(file => path.join(__dirname, '..', 'src', file))
    .filter(file => fs.existsSync(file))
    .map(file => fs.readFileSync(file, 'utf8')).join('\n');
};
