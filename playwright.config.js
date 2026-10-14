import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: [/e2e\.spec\.js/, /e2e-face\.spec\.js/],
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8137',
    headless: true
  },
  webServer: {
    command: 'node tests/static-server.cjs 8137',
    url: 'http://127.0.0.1:8137/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
