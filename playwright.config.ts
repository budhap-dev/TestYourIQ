import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the dev server with the in-memory store (no database needed).
 * Desktop runs keyboard-only in light mode; mobile runs at 360px with touch in dark mode.
 */
const PORT = 5180;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  // The dev server compiles each page on first visit, which is slow on a cold CI runner.
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        colorScheme: 'light',
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 780 },
        hasTouch: true,
        isMobile: true,
        colorScheme: 'dark',
      },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    env: { DATABASE_URL: '', SESSION_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-1234' },
  },
});
