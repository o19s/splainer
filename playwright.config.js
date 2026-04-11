// Playwright config — two kinds of tests live here:
//   1. smoke.spec.js — hermetic, fully mocked, runs against the local dev
//      server. This is the framework-swap safety net.
//   2. audit.spec.js — live, un-mocked, runs against *both* the deployed
//      splainer.io and the local dev branch to compare UI/behavior.
// See MIGRATION_CHANGES.md.
import { defineConfig, devices } from '@playwright/test';

const localURL = 'http://localhost:5173';
// splainer.io is served from S3 over plain HTTP — https:// returns a
// connection reset. That's useful to remember: since prod is HTTP, it can
// freely fetch the default http:// quepid demo backends without tripping
// mixed-content blocking.
const prodURL = 'http://splainer.io';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The HTML reporter is what makes the audit usable — attachments (screenshots,
  // DOM state, console logs) render side-by-side per project at
  // playwright-report/index.html. `open: 'never'` keeps it from auto-launching
  // the browser in CI / watch mode.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'smoke-local',
      testMatch: /smoke\.spec\.js/,
      use: { ...devices['Desktop Chrome'], baseURL: localURL },
    },
    {
      name: 'audit-prod',
      testMatch: /audit\.spec\.js/,
      use: { ...devices['Desktop Chrome'], baseURL: prodURL },
    },
    {
      name: 'audit-local',
      testMatch: /audit\.spec\.js/,
      use: { ...devices['Desktop Chrome'], baseURL: localURL },
    },
  ],
  // Global webServer — starts `yarn dev:vite` for local projects. Running
  // only `--project=audit-prod` will still start it, but `reuseExistingServer`
  // makes that cheap if one's already up. Harmless in CI because audit-prod
  // alone doesn't hit it.
  webServer: {
    command: 'yarn dev:vite',
    url: localURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
