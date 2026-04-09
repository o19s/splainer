// Playwright config — smoke flows against the current Angular app.
// These tests are the safety net for the Angular → splainer-search 3.0.0
// migration: they exercise user-visible behavior and should survive any
// framework swap. See MIGRATION_OPTIONS.md (PR 3).
import { defineConfig, devices } from '@playwright/test';

// Default: grunt serve on :9000. Override with SPLAINER_DEV=vite to run
// the suite against the Vite dev server on :5173 — used during PR 4a
// to prove Angular boots under Vite without making Vite the default yet.
const useVite = process.env.SPLAINER_DEV === 'vite';
const baseURL = useVite ? 'http://localhost:5173' : 'http://localhost:9000';
const serverCommand = useVite ? 'yarn dev:vite' : 'grunt serve';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: serverCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
