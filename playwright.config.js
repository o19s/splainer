// Playwright config — smoke flows against the current Angular app.
// These tests are the safety net for the Angular → splainer-search 3.0.0
// migration: they exercise user-visible behavior and should survive any
// framework swap. See MIGRATION_OPTIONS.md (PR 3).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:9000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'grunt serve',
    url: 'http://localhost:9000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
