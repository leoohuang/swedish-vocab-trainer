import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45000,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: 'chrome',
    launchOptions: { args: ['--mute-audio'] },
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  reporter: 'list',
  outputDir: 'test-results',
});
