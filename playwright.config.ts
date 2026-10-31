import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the production build (`vite preview` plus the bundled API) with the
 * in-memory store, so no database is needed and the shipped client bundle is what's tested.
 * Desktop runs keyboard-only in light mode; mobile runs at 360px with touch in dark mode.
 */
const PORT = 5180;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
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
    command: `npm run build && node scripts/build-preview-api.mjs && npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: '',
      ALLOW_MEMORY_STORE: '1',
      SESSION_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-1234',
    },
  },
});
