// Smoke flows against the current Angular splainer app.
// Goal: catch regressions in user-visible behavior during the
// Angular → splainer-search 3.0.0 migration. These tests must
// survive whatever framework replaces Angular.
import { test, expect } from '@playwright/test';

// Fulfill a Solr request — JSONP-aware. splainer-search 3.0.0 prefers JSONP
// for Solr (dynamic <script> injection), so the response body must be a
// callback invocation, not raw JSON. Falls back to JSON for non-JSONP probes.
async function fulfillSolr(route, body) {
  const url = new URL(route.request().url());
  const callback = url.searchParams.get('json.wrf');
  const json = JSON.stringify(body);
  if (callback) {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: `${callback}(${json});`,
    });
  } else {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: json,
    });
  }
}

// Per-test console/page-error capture. Lifted to a beforeEach so every test
// gets it for free — without this, the JSONP/Unexpected-token-':' bug in PR 5
// would have shown up as "test failed, no idea why" instead of pointing
// directly at the parse error.
test.describe('splainer smoke', () => {
  let consoleErrors;
  test.beforeEach(({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));
  });
  test.afterEach(() => {
    // Page errors (uncaught exceptions, parse errors) are *always* a regression.
    // Console errors are noisier — splainer-search 3.0.0 emits some warnings
    // we don't control — so only the pageerror channel hard-fails.
    const fatal = consoleErrors.filter((e) => e.startsWith('pageerror: '));
    expect(fatal, `unexpected page errors: ${fatal.join('\n')}`).toEqual([]);
  });

  test('app boots and shows the Solr URL form', async ({ page }) => {
    await page.goto('/');
    // The StartUrl view renders three engine forms (Solr, ES, OpenSearch).
    // The Solr URL input is bound to start.solrSettings.startUrl.
    const solrInput = page.locator('input[ng-model="start.solrSettings.startUrl"]');
    await expect(solrInput).toBeVisible();
  });

  test('Solr URL input accepts a value and submit button is enabled', async ({ page }) => {
    await page.goto('/');
    const solrInput = page.locator('input[ng-model="start.solrSettings.startUrl"]');
    await solrInput.fill('http://localhost:8983/solr/techproducts/select?q=*:*');
    // The submit button lives in the same form; ng-click="start.submitSolr()".
    const submit = page.locator('[ng-click="start.submitSolr()"]').first();
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();
  });

  test('bookmarked URL with hash fragment restores search state', async ({ page }) => {
    // Splainer encodes Solr state as ?solr=<url>&fieldSpec=<spec> behind the hash
    // (Angular hashPrefix(''), see settingsStoreSvc.js). Any request to the fake
    // Solr host is intercepted and answered with a minimal canned response so the
    // test stays hermetic — no live Solr needed.
    let solrHits = 0;
    await page.route('http://fake-solr.test/**', async (route) => {
      solrHits++;
      await fulfillSolr(route, {
        responseHeader: { status: 0, QTime: 1 },
        response: {
          numFound: 1,
          start: 0,
          docs: [{ id: 'doc-1', title: 'canned title' }],
        },
      });
    });

    const bookmarkedSolr = encodeURIComponent(
      'http://fake-solr.test/solr/coll1/select?q=*:*',
    );
    await page.goto(`/#?solr=${bookmarkedSolr}&fieldSpec=id+title`);

    // Two-part assertion: the URL is reflected somewhere durable (DOM input
    // value or localStorage) AND splainer actually fired a request to Solr.
    // Without the request-count check, a regression where the hash is read
    // but no search runs would slip through.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const fromDom = inputs.some((i) => (i.value || '').includes('fake-solr.test'));
          const fromStorage = JSON.stringify(window.localStorage).includes('fake-solr.test');
          return fromDom || fromStorage;
        }),
      )
      .toBe(true);
    expect(solrHits, 'splainer should fire at least one Solr request').toBeGreaterThan(0);
  });

  test('settings persist across reload via localStorage', async ({ page }) => {
    await page.route('http://fake-solr.test/**', (route) =>
      fulfillSolr(route, {
        responseHeader: { status: 0 },
        response: { numFound: 0, start: 0, docs: [] },
      }),
    );

    await page.goto('/');
    const url = 'http://fake-solr.test/solr/persist/select?q=*:*';
    await page.locator('input[ng-model="start.solrSettings.startUrl"]').fill(url);
    await page.locator('[ng-click="start.submitSolr()"]').first().click();

    // Poll-wait for the localStorage write — it happens inside Angular's
    // $digest after fetch resolves, so there's no DOM signal we can await.
    // Polling is the right primitive; waitForTimeout is forbidden.
    await expect
      .poll(async () =>
        page.evaluate(() => JSON.stringify(window.localStorage).includes('fake-solr.test')),
      )
      .toBe(true);

    // Reload — settings should come back from localStorage (settingsStoreSvc).
    await page.reload();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const fromDom = inputs.some((i) => (i.value || '').includes('fake-solr.test'));
          const fromStorage = JSON.stringify(window.localStorage).includes('fake-solr.test');
          return fromDom || fromStorage;
        }),
      )
      .toBe(true);
  });

  test('search error path surfaces an error message', async ({ page }) => {
    // Coverage gap left by the 6 xdescribe'd Karma specs in
    // test/spec/controllers/searchResults.js — those tests covered the
    // WAITING_FOR_SEARCH → IN_ERROR transition and errorMsg population on
    // failed searches. Under splainer-search 3.0.0 this is the highest-risk
    // path because the new contract REJECTS the search promise instead of
    // resolving with { error }, so any controller that doesn't .catch will
    // silently swallow the failure. This test asserts the user sees *some*
    // error feedback when Solr returns 500 — the exact UI text isn't pinned
    // because views will be rewritten in PRs 6–10.
    await page.route('http://fake-solr.test/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'text/plain',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: 'simulated solr failure',
      }),
    );

    const failingSolr = encodeURIComponent(
      'http://fake-solr.test/solr/coll1/select?q=*:*',
    );
    await page.goto(`/#?solr=${failingSolr}&fieldSpec=id+title`);

    // The app should reach the IN_ERROR state and surface SOMETHING to the
    // user. We probe for either: (a) a visible error class commonly used in
    // splainer's templates, or (b) the literal text "error" appearing in the
    // body. The OR is intentional — both are durable signals that survive a
    // template rewrite.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const hasErrorClass = !!document.querySelector('.error, .alert-danger, [class*="error"]');
          const bodyText = (document.body.textContent || '').toLowerCase();
          const hasErrorText = bodyText.includes('error') || bodyText.includes('failed');
          return hasErrorClass || hasErrorText;
        }),
      )
      .toBe(true);
  });
});
