// Smoke flows against the current Angular splainer app.
// Goal: catch regressions in user-visible behavior during the
// Angular → splainer-search 3.0.0 migration. These tests must
// survive whatever framework replaces Angular.
import { test, expect } from '@playwright/test';

// All canned-backend responses need this so the browser doesn't block the
// cross-origin response. Extracted because it's used in 4 fulfill blocks
// and the literal `{ 'Access-Control-Allow-Origin': '*' }` is opaque at
// the call site — the named constant says what role it plays.
const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

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
      headers: corsHeaders,
      body: `${callback}(${json});`,
    });
  } else {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
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
    // Selectors target data-role attributes rather than ng-model so the
    // tests survive PRs 8-10, which rewrite StartUrl off Angular.
    const solrInput = page.locator('[data-role="solr-start-url"]');
    await expect(solrInput).toBeVisible();
  });

  test('Solr URL input accepts a value and submit button is enabled', async ({ page }) => {
    await page.goto('/');
    const solrInput = page.locator('[data-role="solr-start-url"]');
    await solrInput.fill('http://localhost:8983/solr/techproducts/select?q=*:*');
    const submit = page.locator('[data-role="solr-submit"]').first();
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
    await page.locator('[data-role="solr-start-url"]').fill(url);
    await page.locator('[data-role="solr-submit"]').first().click();

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

  test('customHeaders island renders and updates the editor body in a real browser', async ({
    page,
  }) => {
    // PR 6 coverage: the customHeaders Preact island is used in 3 places
    // (startUrl ES tab, startUrl OS tab, dev sidebar) and Vitest only
    // covers the textarea-fallback path under jsdom. This test opens the
    // ES tab in a real browser (where window.ace is loaded), expands the
    // Advanced Settings section, and exercises the island end-to-end —
    // verifying that (a) the island mounts via the directive shim,
    // (b) the Ace `useEffect` lifecycle works (no pageerror), and
    // (c) picking a header type populates the editor body via the
    // template side effect.
    await page.goto('/');
    await page.locator('a[href="#es_"]').click();
    await page.locator('#es_').getByRole('button', { name: 'Advanced Settings' }).click();
    // Framework-agnostic: data-role on the ES URL input survives deangularize.

    // The select rendered by the Preact island. There are multiple
    // [data-role="header-type"] elements on the page (one per call site),
    // so we scope to the ES tab pane.
    const select = page.locator('#es_ [data-role="header-type"]');
    await expect(select).toBeVisible();

    // ES initial state is 'Custom' per settingsStoreSvc.js — different
    // from Solr/OS which default to 'None'. The point of this assertion
    // is to confirm the island is honoring the initial settings, not to
    // pin a specific default.
    await expect(select).toHaveValue('Custom');

    // Pick API Key. The island's setHeaderType handler should populate
    // the editor body with the API Key template via the side effect.
    await select.selectOption('API Key');

    // Read what actually landed in the Angular scope and Ace editor after
    // the change. Polled because the change-handler → $apply → digest →
    // $watch → Preact-render → useEffect → ace.setValue chain takes a few
    // microtasks to settle and Playwright's selectOption returns before
    // it's done.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          // Read the header type off the DOM select *and* the settings store.
          // Both checks matter: the DOM-only read would pass a regression
          // where the Preact island updates its <select> but fails to
          // propagate the change into settingsStoreSvc (a "UI shows right,
          // store is wrong" bug class). The store read uses Angular's
          // injector, which will disappear with the directive shim in PR 11 —
          // at that point this block should read whatever public API
          // replaces settingsStoreSvc.
          const select = document.querySelector('#es_ [data-role="header-type"]');
          const container = document.querySelector('#es_ [data-role="header-editor"]');
          const aceVal =
            window.ace && container && container.tagName !== 'TEXTAREA'
              ? window.ace.edit(container).getValue()
              : container && container.value;
          const storeHeaderType = window.angular
            ? window.angular
                .element(document.querySelector('settings-island'))
                .injector()
                .get('settingsStoreSvc').settings.es.headerType
            : null;
          return {
            domHeaderType: select && select.value,
            storeHeaderType: storeHeaderType,
            aceBody: aceVal,
          };
        }),
      )
      .toEqual({
        domHeaderType: 'API Key',
        storeHeaderType: 'API Key',
        aceBody: expect.stringContaining('Authorization'),
      });
  });

  test('configured headers reach the backend HTTP request', async ({ page }) => {
    // The user-meaningful contract of the customHeaders feature: when a
    // user picks "API Key" and enters their key, the resulting Solr/ES/OS
    // request includes the Authorization header. Without this assertion,
    // the entire CustomHeaders island can be working perfectly at the
    // Angular/Preact/DOM layer while the headers silently fail to reach
    // the backend (because of a bug in the directive shim, splainer-search
    // 3.0.0's wired services, or anywhere else in the chain). This is the
    // *only* test that exercises the integration end-to-end.
    //
    // We capture *all* intercepted requests, not just the last one — splainer
    // makes one request today, but a future preflight/retry/batch could
    // make several and we'd want to assert that *any* of them carried the
    // header rather than racing on which call wins the closure assignment.
    const captured = [];
    await page.route('**/fake-es.test/**', async (route) => {
      captured.push(route.request().headers());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          took: 1,
          timed_out: false,
          _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
          hits: {
            total: { value: 1, relation: 'eq' },
            max_score: 1,
            hits: [{ _id: '1', _score: 1, _source: { title: 'canned' } }],
          },
        }),
      });
    });

    await page.goto('/');
    await page.locator('a[href="#es_"]').click();
    // Set the ES URL to our intercepted host.
    await page
      .locator('#es_ [data-role="es-start-url"]')
      .fill('http://fake-es.test/_search');
    // Open the Advanced Settings panel and pick API Key — the island's
    // setHeaderType handler populates the body with the Authorization
    // template via the directive shim → scope mutation → splainer-search.
    await page.locator('#es_').getByRole('button', { name: 'Advanced Settings' }).click();
    await page.locator('#es_ [data-role="header-type"]').selectOption('API Key');

    // Submit the search.
    await page.locator('#es_').getByRole('button', { name: 'Splain This!' }).click();

    // Poll until at least one captured request had the Authorization header.
    // Polled because the click → digest → splainer-search → fetch chain
    // takes a few microtasks. Header names are lowercased in Playwright's
    // headers() output.
    await expect
      .poll(() =>
        captured.some(
          (h) => typeof h.authorization === 'string' && h.authorization.includes('ApiKey'),
        ),
      )
      .toBe(true);
  });

  test('settings island: configured search args reach the backend on the wire', async ({
    page,
  }) => {
    // PR 7 merge gate. Intercepts the outbound ES request and asserts that a
    // unique marker the user typed into the dev-sidebar Search Args editor
    // landed in the request body. This is the only test that proves the full
    // chain from Settings island → directive shim → onPublish callback →
    // esSettingsSvc.fromTweakedSettings → splainer-search 3.0.0 wired
    // services → fetch is wired correctly. Internal-contract tests catch
    // refactor regressions; this one catches silent integration breaks.
    //
    // Includes Security's two negative assertions: the marker must NOT be
    // logged to the console and must NOT leak into a new localStorage entry
    // beyond the expected settings keys.
    const captured = [];
    await page.route('**/fake-es.test/**', async (route) => {
      captured.push({
        url: route.request().url(),
        body: route.request().postData(),
        headers: route.request().headers(),
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          took: 1,
          timed_out: false,
          _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
          hits: {
            total: { value: 1, relation: 'eq' },
            max_score: 1,
            hits: [{ _id: '1', _score: 1, _source: { title: 'canned' } }],
          },
        }),
      });
    });

    await page.goto('/');

    // Use the StartUrl ES tab to seed an initial ES search and route the
    // backend to fake-es.test. This populates settingsStoreSvc.settings.es
    // and triggers the first search, which puts the dev sidebar into the
    // 'es' engine — the state we want to test the dev sidebar against.
    await page.locator('a[href="#es_"]').click();
    await page
      .locator('#es_ [data-role="es-start-url"]')
      .fill('http://fake-es.test/_search');
    await page.locator('#es_').getByRole('button', { name: 'Splain This!' }).click();

    // Wait until the first search lands so the dev sidebar's Settings island
    // is mounted in 'es' mode.
    await expect.poll(() => captured.length).toBeGreaterThan(0);
    captured.length = 0; // clear; we want to assert against the *post-edit* request

    // Mutate searchArgsStr via the Angular store rather than the Ace editor
    // input. We're testing the *publish* chain (Settings island → directive
    // shim → onPublish → esSettingsSvc.fromTweakedSettings → fetch). The
    // editor → store mutation path has its own coverage in
    // app/scripts/islands/settings.spec.js (Vitest, textarea fallback) and
    // is structurally identical to PR 6's customHeaders editor wiring,
    // which has its own browser-level Playwright test. Going through the
    // store keeps this test focused on the integration boundary it owns,
    // and avoids Ace's programmatic-setValue idiosyncrasies (the change
    // event doesn't fire reliably for API writes vs. user keystrokes).
    const marker = 'PR7_MARKER_' + Math.random().toString(36).slice(2, 10);
    const newArgs = JSON.stringify({ query: { match: { title: marker } } });
    await page.evaluate((value) => {
      const svc = window.angular
        .element(document.querySelector('settings-island'))
        .injector()
        .get('settingsStoreSvc');
      // Wrap in $apply so the directive's deep $watch fires and the island
      // re-renders with the new searchArgsStr before we click submit.
      const $rootScope = window.angular
        .element(document.querySelector('settings-island'))
        .injector()
        .get('$rootScope');
      $rootScope.$apply(function () {
        svc.settings.es.searchArgsStr = value;
      });
    }, newArgs);

    // Click the new Settings island's Rerun Query button — uses the
    // post-island data-role selector, NOT the legacy Angular ng-click.
    // This selector existing at all is the test's red→green signal.
    await page.locator('[data-role="rerun-query"]').click();

    // Poll until at least one captured request body contains the marker.
    await expect
      .poll(() => captured.some((c) => typeof c.body === 'string' && c.body.includes(marker)))
      .toBe(true);

    // --- Security: negative assertions ---

    // (a) The marker must not have been logged to the console at any point.
    // The beforeEach captures all console.error / pageerror events; assert
    // none of them mention the marker. (Console.log and console.info aren't
    // captured here, but pageerror is the channel that catches accidental
    // serialization-of-settings-into-error-stacks regressions.)
    const leakedToConsole = consoleErrors.some((e) => e.includes(marker));
    expect(leakedToConsole, 'marker leaked into console errors').toBe(false);

    // (b) The marker must only appear in the expected localStorage key
    // (es_searchArgsStr or its splainer:v3:* successor). Any other key
    // containing the marker is an unexpected leak.
    const leakedKeys = await page.evaluate((m) => {
      const out = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        const v = window.localStorage.getItem(k);
        if (v && v.includes(m) && !/searchArgsStr$/.test(k)) {
          out.push(k);
        }
      }
      return out;
    }, marker);
    expect(leakedKeys, `marker leaked into unexpected localStorage keys: ${leakedKeys.join(', ')}`).toEqual([]);
  });

  test('clicking a doc-row title opens the detailed doc view with field data', async ({
    page,
  }) => {
    // Precondition for PR 9 (docRow migration). The Test Specialist flagged
    // results-subtree coverage as the safety net that has to land before any
    // docRow work starts. This test proves the user-level click path for the
    // title link — `<a ng-click="doc.showDoc()">` in docRow.html — works
    // end-to-end: click the title, the $uibModal opens detailedDoc.html,
    // and the modal body shows the doc fields splainer-search normalized
    // from the Solr response.
    //
    // Uses canned Solr with a `subs`-shaped doc so the detailedDoc ng-repeat
    // over doc.subs has something to render — the test would vacuously pass
    // against an empty subs map otherwise.
    await page.route('http://fake-solr.test/**', async (route) => {
      await fulfillSolr(route, {
        responseHeader: { status: 0, QTime: 1 },
        response: {
          numFound: 1,
          start: 0,
          docs: [
            {
              id: 'doc-42',
              title: 'ROW_CLICK_TITLE_MARKER',
              director: 'Someone',
              release_year: 1999,
            },
          ],
        },
      });
    });

    const bookmarkedSolr = encodeURIComponent(
      'http://fake-solr.test/solr/coll1/select?q=*:*',
    );
    await page.goto(`/#?solr=${bookmarkedSolr}&fieldSpec=id+title+director+release_year`);

    // Wait for the initial search to render at least one doc-row.
    await page.locator('doc-row').first().waitFor();

    // The title link inside the first doc-row. Scoped to doc-row because
    // other <a> elements on the page (tour, footer links) would match a
    // bare locator. ng-bind-html populates the anchor text from
    // docRow.title, so we can't locate by text — locate structurally
    // and then assert the modal that results.
    const titleLink = page.locator('doc-row').first().locator('h4 a').first();
    await titleLink.click();

    // The detailedDoc modal's only stable string is the template heading
    // "Detailed Document View of doc: {{doc.id}}". Assert the heading is
    // visible AND that the doc id is interpolated — this proves both
    // (a) the $uibModal opened and (b) splainer-search normalized the
    // canned doc into the shape detailedDoc.html expects (doc.id,
    // doc.subs populated).
    await expect(page.getByText(/Detailed Document View of doc:\s*doc-42/)).toBeVisible();

    // And at least one of the canned sub fields made it into the modal
    // body. Scoped to the dialog role because the field also appears in
    // the underlying doc-row snippet — matching both would fail strict
    // mode, and matching the modal is the assertion that actually proves
    // the detailed view rendered.
    await expect(page.getByRole('dialog').getByText('Someone')).toBeVisible();
  });

  test('detailed explain modal renders the explain tree content', async ({ page }) => {
    // Precondition for PR 9 (docRow migration): the explain panel — one of
    // the load-bearing user-visible features of splainer — has no direct
    // coverage. Existing docSelector tests open the explain modal and
    // interact with its altQuery form, but nothing asserts the explain tree
    // itself rendered. A regression that broke the <pre>{{doc.explain().toStr()}}</pre>
    // block (e.g. a breaking change in splainer-search's explain formatter)
    // would slip through every current test.
    //
    // Asserts the Summarized tab's <pre> content contains the canned
    // explain description. Doesn't pin on exact format — splainer-search's
    // toStr() output may evolve — but requires the weight(title:canned)
    // marker to appear somewhere in the explain view.
    await page.route('http://fake-solr.test/**', async (route) => {
      await fulfillSolr(route, {
        responseHeader: { status: 0, QTime: 1 },
        response: {
          numFound: 1,
          start: 0,
          docs: [{ id: 'doc-1', title: 'canned title' }],
        },
        debug: {
          explain: {
            'doc-1': {
              match: true,
              value: 1.2345,
              description: 'EXPLAIN_TREE_MARKER weight(title:canned)',
              details: [],
            },
          },
        },
      });
    });

    const bookmarkedSolr = encodeURIComponent(
      'http://fake-solr.test/solr/coll1/select?q=*:*',
    );
    await page.goto(`/#?solr=${bookmarkedSolr}&fieldSpec=id+title`);

    await page.locator('doc-row').first().waitFor();

    // Open the detailed explain modal via doc.showDetailed() — same entry
    // path the existing docSelector tests use. Clicking the stacked-chart
    // SVG is unreliable (coordinate-dependent), and showDetailed() is the
    // app's own code path.
    await page.evaluate(() => {
      const docRow = document.querySelector('doc-row');
      const scope = window.angular.element(docRow).scope();
      scope.doc.showDetailed();
      scope.$apply();
    });

    // Wait for the modal body — the detailedExplain.html template anchors
    // on the "Explain for:" header.
    await expect(page.getByText(/Explain for:/)).toBeVisible();

    // The Summarized tab is the default-active uib-tab. Its <pre> should
    // contain the canned marker from the explain description. Polled
    // because splainer-search's explain parser may finish asynchronously
    // after the modal opens.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const pres = Array.from(document.querySelectorAll('.explain-view pre'));
          return pres.some((pre) => (pre.textContent || '').includes('EXPLAIN_TREE_MARKER'));
        }),
      )
      .toBe(true);
  });

  test('docSelector island: altQuery reaches the backend on the wire', async ({ page }) => {
    // PR 8 merge gate. Intercepts the outbound Solr request triggered by
    // the DocSelector's "Find Others" button and asserts that the altQuery
    // the user typed made it onto the wire. Validates the full chain:
    //   Preact island (docSelector.jsx)
    //     → directive shim (directives/docSelector.js) onExplainOther
    //     → searchSvc.createSearcher + searcher.explainOther
    //     → splainer-search 3.0.0 wired services → JSONP
    //
    // Solr was chosen over ES because the bookmarked-URL path is already
    // proven hermetic for Solr (PR 3), and Solr's explainOther surfaces as
    // a query parameter on the URL — assertable without guessing at
    // engine-specific POST body shapes.
    //
    // The detailed-explain modal is opened programmatically via the first
    // doc's showDetailed() rather than clicking through the stacked-chart's
    // "Detailed" link: the click path couples to splainer-search's explain-
    // tree parsing producing at least one hot match, and the DocSelector
    // we're testing doesn't care *how* the modal opened.
    const captured = [];
    await page.route('http://fake-solr.test/**', async (route) => {
      captured.push(route.request().url());
      await fulfillSolr(route, {
        responseHeader: { status: 0, QTime: 1 },
        response: {
          numFound: 1,
          start: 0,
          docs: [{ id: 'doc-1', title: 'canned title' }],
        },
        debug: {
          explain: {
            'doc-1': {
              match: true,
              value: 1,
              description: 'weight(title:canned)',
              details: [],
            },
          },
        },
      });
    });

    const bookmarkedSolr = encodeURIComponent(
      'http://fake-solr.test/solr/coll1/select?q=*:*',
    );
    await page.goto(`/#?solr=${bookmarkedSolr}&fieldSpec=id+title`);

    // Wait for the initial search to land and render the first doc-row.
    await expect.poll(() => captured.length).toBeGreaterThan(0);
    await page.locator('doc-row').first().waitFor();

    // Open the detailed-explain modal via the first doc's showDetailed().
    // This uses the app's own code path — $uibModal.open with
    // views/detailedExplain.html — the same thing clicking "Detailed"
    // would trigger.
    await page.evaluate(() => {
      const docRow = document.querySelector('doc-row');
      const scope = window.angular.element(docRow).scope();
      scope.doc.showDetailed();
      scope.$apply();
    });

    // Wait for the DocSelector island inside the modal.
    await page.locator('[data-role="alt-query"]').waitFor();

    // Clear captures so we assert against the *post-explainOther* request.
    captured.length = 0;

    const marker = 'PR8altmarker' + Math.random().toString(36).slice(2, 10);
    await page.locator('[data-role="alt-query"]').fill(marker);
    await page.locator('[data-role="find-others"]').click();

    // Solr's explainOther surfaces as query parameters on the URL.
    // splainer-search 3.0.0 either sets explainOther=<q> or re-runs the
    // query with q=<q> + explainOther=true. Either way, the marker appears
    // somewhere in the URL of the second request.
    await expect
      .poll(() => captured.some((u) => u.includes(marker)))
      .toBe(true);
  });

  test('docSelector island: backend error surfaces the error banner', async ({ page }) => {
    // Closes PR 5's zero-coverage .catch: splainer-search 3.0.0 rejects on
    // HTTP/parse errors, and PR 5 added a .catch on explainOther() to
    // surface the rejection. Until this test, no suite exercised the
    // rejection path end-to-end for the DocSelector flow.
    let searchCount = 0;
    await page.route('http://fake-solr.test/**', async (route) => {
      searchCount++;
      if (searchCount === 1) {
        // Initial search succeeds — populates results so the modal can open.
        await fulfillSolr(route, {
          responseHeader: { status: 0, QTime: 1 },
          response: {
            numFound: 1,
            start: 0,
            docs: [{ id: 'doc-1', title: 'canned title' }],
          },
          debug: {
            explain: {
              'doc-1': {
                match: true,
                value: 1,
                description: 'weight(title:canned)',
                details: [],
              },
            },
          },
        });
      } else {
        // explainOther fails with 500 — the rejection we care about.
        await route.fulfill({
          status: 500,
          contentType: 'text/plain',
          headers: corsHeaders,
          body: 'simulated solr failure',
        });
      }
    });

    const bookmarkedSolr = encodeURIComponent(
      'http://fake-solr.test/solr/coll1/select?q=*:*',
    );
    await page.goto(`/#?solr=${bookmarkedSolr}&fieldSpec=id+title`);

    await expect.poll(() => searchCount).toBeGreaterThan(0);
    await page.locator('doc-row').first().waitFor();

    await page.evaluate(() => {
      const docRow = document.querySelector('doc-row');
      const scope = window.angular.element(docRow).scope();
      scope.doc.showDetailed();
      scope.$apply();
    });
    await page.locator('[data-role="alt-query"]').waitFor();

    await page.locator('[data-role="alt-query"]').fill('anything');
    await page.locator('[data-role="find-others"]').click();

    // The island renders the rejection's .message in the error banner.
    // Durable assertion: banner visible, no pinning on the exact text —
    // splainer-search's error format may evolve.
    await expect(page.locator('[data-role="alt-query-error"]')).toBeVisible();
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
        headers: corsHeaders,
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
