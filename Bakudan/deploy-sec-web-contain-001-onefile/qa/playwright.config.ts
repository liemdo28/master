import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://preview.dashboard.bakudanramen.com';

export default defineConfig({
  testDir: path.join(__dirname, 'playwright'),
  outputDir: path.join(__dirname, 'artifacts', 'test-results'),
  fullyParallel: false, // Sequential: workflow depends on previous steps
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Single worker for sequential workflow
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['html', { outputFolder: path.join(__dirname, 'reports', 'html') }],
    ['json', { outputFile: path.join(__dirname, 'reports', 'results.json') }],
    ['list'],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'en-US',
    timezoneId: 'Asia/Saigon',
    storageState: path.join(__dirname, 'playwright', '.auth', 'session.json'),
  },

  projects: [
    {
      name: 'auth-setup',
      testMatch: '00-auth-setup.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined, // No pre-existing state for login
      },
    },
    {
      name: 'workflow',
      dependencies: ['auth-setup'],
      testMatch: /0[1-9]|1[01]/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
