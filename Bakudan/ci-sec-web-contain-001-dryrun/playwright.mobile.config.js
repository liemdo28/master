const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'mobile-regression.spec.js',
  outputDir: './test-results/mobile-regression',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: './test-results/mobile-regression/results.json' }],
  ],
  use: {
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
});
