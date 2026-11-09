const base = require('@playwright/test');
// All photos and ML assets in browser tests come from the local server.
// External demo/SDK availability must never change the tested initial state.
exports.test = base.test.extend({
  page: async ({ page, context }, use) => {
    await context.route('https://**/*', route => route.abort());
    await use(page);
  }
});
exports.expect = base.expect;
