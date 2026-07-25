import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4300';

export default defineConfig({
  expect: { timeout: 5_000 },
  forbidOnly: Boolean(process.env['CI']),
  fullyParallel: true,
  globalSetup: './e2e/global-setup.ts',
  outputDir: 'test-results',
  reporter: process.env['CI']
    ? [['github'], ['html', { open: 'never' }]]
    : 'list',
  retries: process.env['CI'] ? 1 : 0,
  testDir: './e2e',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
