// Smoke flows against the current Angular splainer app.
// Goal: catch regressions in user-visible behavior during the
// Angular → splainer-search 3.0.0 migration. These tests must
// survive whatever framework replaces Angular.
import { test, expect } from '@playwright/test';

test.describe('splainer smoke', () => {
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
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          responseHeader: { status: 0, QTime: 1 },
          response: {
            numFound: 1,
            start: 0,
            docs: [{ id: 'doc-1', title: 'canned title' }],
          },
        }),
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
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          responseHeader: { status: 0 },
          response: { numFound: 0, start: 0, docs: [] },
        }),
      }),
    );

    await page.goto('/');
    const url = 'http://fake-solr.test/solr/persist/select?q=*:*';
    await page.locator('input[ng-model="start.solrSettings.startUrl"]').fill(url);
    await page.locator('[ng-click="start.submitSolr()"]').first().click();

    // Reload — settings should come back from localStorage (settingsStoreSvc).
    // Note: this test starts on '/' (no hash), so the only way the URL can
    // round-trip post-reload is via localStorage — the $location.search() and
    // localStorageService.set() calls live in the same submit code path.
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
});
