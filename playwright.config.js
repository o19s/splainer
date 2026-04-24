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
      use: {
        ...devices['Desktop Chrome'],
        baseURL: localURL,
        viewport: { width: 1400, height: 900 },
      },
    },
    // Desktop audit: 1400×900 pinned explicitly so the viewport doesn't
    // drift if devices['Desktop Chrome'] changes defaults. Matches the
    // shape a typical splainer user has in their browser.
    {
      name: 'audit-prod',
      testMatch: /audit\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: prodURL,
        viewport: { width: 1400, height: 900 },
      },
    },
    {
      name: 'audit-local',
      testMatch: /audit\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: localURL,
        viewport: { width: 1400, height: 900 },
      },
    },
    // Mobile audit — Pixel 5 preset (Chromium-based, ~393×851 viewport,
    // isMobile, hasTouch). Local-only, deliberately not paired with a
    // prod variant:
    //   - The goal is to catch responsive-layout regressions the desktop
    //     audit can't see (e.g. flex layouts breaking at narrow widths).
    //   - Prod is a frozen 2024 build with no ongoing development, so its
    //     mobile layout is whatever it is; there's no regression risk on
    //     that side of the comparison.
    //   - The diff script's DIR_RE regex (/^audit-audit-(.+)-audit-(prod|local)$/)
    //     won't match `-audit-local-mobile`, so mobile runs are silently
    //     excluded from the cross-version diff. Review mobile screenshots
    //     via `npx playwright show-report` instead.
    //   - Using Pixel 5 (Chromium) rather than iPhone 12 (WebKit) so we
    //     don't pull in a second browser engine for the audit and so
    //     layout differences isolate to viewport/isMobile, not engine.
    {
      name: 'audit-local-mobile',
      testMatch: /audit\.spec\.js/,
      use: {
        ...devices['Pixel 5'],
        baseURL: localURL,
      },
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
