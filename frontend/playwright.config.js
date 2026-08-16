import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suite.
 *
 * Nothing here is mocked: the browser talks to the real Vite build, which talks
 * to the real Spring Boot API, which talks to the real database. The point of
 * this layer is to catch the integration failures the unit suites cannot see.
 *
 * The servers are expected to be running (see `npm run e2e` / `qa/run-qa.ps1`).
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4173';
const API = process.env.E2E_API_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts',
  // Booking races mean two specs must never fight over the same slot pool.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: './e2e/global-setup.js',
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    extraHTTPHeaders: { 'x-e2e': '1' },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  metadata: { api: API, web: WEB },
});
