import { defineConfig, devices } from '@playwright/test';

const performanceChecks = /I14 performance:|L20 performance:/;

export default defineConfig({
  testDir: './tests',
  testMatch: /e2e(?:-[\w]+)?\.spec\.js$/,
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL: process.env.AURAGRAM_TEST_BASE_URL || 'http://127.0.0.1:8137',
    actionTimeout: 15000,
    headless: true
  },
  webServer: process.env.AURAGRAM_TEST_BASE_URL ? undefined : {
    command: 'node tests/static-server.cjs 8137',
    url: 'http://127.0.0.1:8137/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  },
  projects: [
    { name: 'chromium', grepInvert: performanceChecks, use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-mobile', testMatch: /e2e-(?:mobile|session)\.spec\.js$/, use: { ...devices['iPhone 11'], browserName: 'webkit' } },
    {
      name: 'chromium-performance',
      testMatch: /e2e-(?:g1b1|lashes)\.spec\.js$/,
      grep: performanceChecks,
      dependencies: ['chromium', 'webkit-mobile'],
      workers: 1,
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
