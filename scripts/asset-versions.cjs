'use strict';
// Only first-party HTML references and JS import/URL literals are rewritten.
// Source files stay usable directly; packaged releases use fresh asset URLs.
function versionAssets(source, version, html = false) {
  const suffix = '?v=' + encodeURIComponent(version);
  if (html) return source.replace(/((?:src|href)=["'])(\.\/src\/[^"'?]+\.(?:js|css))(["'])/g,
    (_, before, path, after) => before + path + suffix + after);
  return source
    .replace(/(\b(?:from|import)\s*(?:\(\s*)?["'])(\.{1,2}\/[^"'?]+\.(?:js|mjs))(["'])/g,
      (_, before, path, after) => before + path + suffix + after)
    .replace(/(\bnew URL\(\s*["'])((?:(?:\.{1,2}\/|src\/|vendor\/))?[^"'?\s]+\.(?:js|mjs))(["'])/g,
      (_, before, path, after) => /^https?:/.test(path) ? before + path + after : before + path + suffix + after);
}
module.exports = {versionAssets};
