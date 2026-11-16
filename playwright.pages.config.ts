import { defineConfig } from '@playwright/test';

const port = process.env.CITY_TEST_PORT || '4411';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/statoz-next-website';
const baseURL = (process.env.CITY_TEST_URL || `http://127.0.0.1:${port}${basePath}/`).replace(/\/?$/, '/');
export default defineConfig({
  testDir: './tests', testMatch: 'pages.spec.ts', timeout: 120000, workers: 1,
  use: { baseURL, browserName: 'chromium', headless: true, launchOptions: { channel: 'chromium' } },
  reporter: [['list']],
  webServer: process.env.CITY_TEST_URL ? undefined : {
    command: 'node scripts/serve-pages.mjs', url: baseURL, reuseExistingServer: false, timeout: 30000,
  },
});
