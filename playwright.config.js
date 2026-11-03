import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}/`,
    browserName: 'chromium',
    trace: 'off',
  },
  projects: [
    {
      name: 'phone',
      use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
    },
    {
      name: 'desktop',
      use: { viewport: { width: 1366, height: 768 }, hasTouch: false, isMobile: false, deviceScaleFactor: 1 },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx http-server -p ${PORT} -a 127.0.0.1 -c-1 --silent .`,
        url: `http://127.0.0.1:${PORT}/index.html`,
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
