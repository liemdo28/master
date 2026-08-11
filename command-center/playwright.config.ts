import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT || '4098';
const PIN = process.env.E2E_PIN || '135790';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/command-center/`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node e2e/seed-and-serve.cjs`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 90_000,
    env: { E2E_PORT: PORT, E2E_PIN: PIN },
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
