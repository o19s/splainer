// Smoke flows for splainer (Preact islands + pure ESM services).
// Goal: catch regressions in user-visible behavior. Tests are
// framework-agnostic — they interact via DOM selectors only.
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
    // Selectors target data-role attributes for framework-agnostic access.
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
    // Splainer encodes Solr state as #?solr=<url>&fieldSpec=<spec> in the URL hash
    // (see settingsStore.js buildHashString/parseHash). Any request to the fake
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

    // Poll-wait for the localStorage write — it happens asynchronously
    // after fetch resolves, so there's no DOM signal we can await.
    await expect
      .poll(async () =>
        page.evaluate(() => JSON.stringify(window.localStorage).includes('fake-solr.test')),
      )
      .toBe(true);

    // Reload — settings should come back from localStorage (settingsStore).
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
    // The customHeaders Preact island is used in 3 places (startUrl ES tab,
    // startUrl OS tab, dev sidebar). Vitest only covers the textarea-fallback
    // path under jsdom, so this test opens the ES tab in a real browser (where
    // CodeMirror 6 is active), expands the Advanced Settings section, and
    // exercises the island end-to-end — verifying that (a) the island mounts
    // via main.js, (b) the useCodeMirror useEffect lifecycle works (no
    // pageerror), and (c) picking a header type populates the editor body
    // via the template side effect.
    await page.goto('/');
    await page.locator('a[href="#es_"]').click();
    await page.locator('#es_').getByRole('button', { name: 'Advanced Settings' }).click();
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

    // Read what actually landed in the settings store and editor after the
    // change. Polled because the change-handler → Preact-render → useEffect
    // → CM6 dispatch chain takes a few microtasks to settle and Playwright's
    // selectOption returns before it's done.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          // Read the header type off the DOM select *and* the settings store.
          // Both checks matter: the DOM-only read would pass a regression
          // where the Preact island updates its <select> but fails to
          // propagate the change into the settings store (a "UI shows right,
          // store is wrong" bug class).
          const select = document.querySelector('#es_ [data-role="header-type"]');
          const container = document.querySelector('#es_ [data-role="header-editor"]');
          // CodeMirror 6: useCodeMirror stashes the EditorView on the
          // container as __cmView. Textarea fallback path reads .value.
          const editorVal =
            container && container.__cmView
              ? container.__cmView.state.doc.toString()
              : container && container.value;
          const storeHeaderType = window.SplainerServices
            ? window.SplainerServices.settingsStore.settings.es.headerType
            : null;
          return {
            domHeaderType: select && select.value,
            storeHeaderType: storeHeaderType,
            editorBody: editorVal,
          };
        }),
      )
      .toEqual({
        domHeaderType: 'API Key',
        storeHeaderType: 'API Key',
        editorBody: expect.stringContaining('Authorization'),
      });
  });

  test('configured headers reach the backend HTTP request', async ({ page }) => {
    // The user-meaningful contract of the customHeaders feature: when a
    // user picks "API Key" and enters their key, the resulting Solr/ES/OS
    // request includes the Authorization header. Without this assertion,
    // the entire CustomHeaders island can be working perfectly at the
    // Preact/DOM layer while the headers silently fail to reach
    // the backend (because of a bug in the bootstrap wiring, splainer-search
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
    // template via the settings store → splainer-search.
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
    // chain from Settings island → main.js onPublish → esSettings
    // .fromTweakedSettings → splainer-search 3.0.0 wired services → fetch
    // is wired correctly. Internal-contract tests catch
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
    // backend to fake-es.test. This populates settingsStore.settings.es
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

    // Mutate searchArgsStr via the settings store rather than the Ace editor
    // input. We're testing the *publish* chain (Settings island → bootstrap
    // onPublish → esSettings.fromTweakedSettings → fetch). The
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
      var store = window.SplainerServices.settingsStore;
      store.settings.es.searchArgsStr = value;
      // save() fires subscribe callbacks, which triggers renderAll() in
      // main.js so the Settings island re-renders with the new value.
      store.save();
    }, newArgs);

    // Click the new Settings island's Rerun Query button — uses the
    // post-island data-role selector, NOT a legacy ng-click.
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
    // Proves the user-level click path for the doc-row title link works
    // end-to-end: click the title, the detailedDoc modal opens, and the
    // modal body shows the doc fields splainer-search normalized from the
    // Solr response.
    //
    // Uses canned Solr with a `subs`-shaped doc so the detailedDoc island
    // iterating over doc.subs has something to render — the test would vacuously pass
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
    await page.locator('[data-testid="doc-row"]').first().waitFor();

    // The title link inside the first doc-row. Scoped to doc-row because
    // other <a> elements on the page (tour, footer links) would match a
    // bare locator. The anchor text comes from the highlighted title,
    // so we locate structurally and then assert the modal that results.
    const titleLink = page.locator('[data-testid="doc-row"]').first().locator('h4 a').first();
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

  test('docSelector island: altQuery reaches the backend on the wire', async ({ page }) => {
    // Originally a PR 8 DocSelector merge gate. After PR 10 this test
    // covers the DocExplain island's alt-query path: the form lives
    // inside the <dialog>, and the explainOther closure that dispatches
    // the request lives in directives/searchResults.js.
    //
    // Solr was chosen over ES because the bookmarked-URL path is already
    // proven hermetic for Solr (PR 3), and Solr's explainOther surfaces as
    // a query parameter on the URL — assertable without guessing at
    // engine-specific POST body shapes.
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
    await page.locator('[data-testid="doc-row"]').first().waitFor();

    // 9d: open the explain modal by clicking the chart-detailed link.
    // The alt-query form lives inside the new docExplain Preact dialog;
    // the alt-query path is now backed by the docRow shim's explainOther
    // closure (copy-pasted from docSelector's shim).
    await page
      .locator('[data-testid="doc-row"]')
      .first()
      .locator('[data-testid="stacked-chart-detailed"]')
      .click();

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
    // Originally PR 5's zero-coverage-.catch closer for the DocSelector
    // flow. After PR 9d this exercises the *DocExplain* island's
    // AltQueryForm rejection path: explainOther rejects, the form's
    // .catch sets errorMsg, the [data-role="alt-query-error"] banner
    // appears. Test name preserved for tracking stability.
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
    await page.locator('[data-testid="doc-row"]').first().waitFor();

    await page
      .locator('[data-testid="doc-row"]')
      .first()
      .locator('[data-testid="stacked-chart-detailed"]')
      .click();
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

  test('clicking stacked-chart Detailed link opens the explain modal', async ({ page }) => {
    // PR 8.5 prep test for PR 9bc (DocExplain rewrite). Written against the
    // Angular code so it lands green on main, then must survive the rewrite
    // unchanged. If 9bc breaks this test, the failure points squarely at the
    // rewrite — not at "is the test even right?". Decouples "can we test
    // this?" from "have we rewritten this?".
    //
    // Click target: the [data-testid="stacked-chart-detailed"] anchor in
    // app/views/stackedChart.html — NOT scope.doc.showDetailed() like the
    // PR 8 tests. The whole point is real user interaction.
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
              value: 1.5,
              description: 'weight(title:canned in 0) [SchemaSimilarity]',
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

    // Wait for the row, then click the Detailed link inside its stacked chart.
    await page.locator('[data-testid="doc-row"]').first().waitFor();
    await page
      .locator('[data-testid="doc-row"]')
      .first()
      .locator('[data-testid="stacked-chart-detailed"]')
      .click();

    // Modal opens, header is visible, body contains the explain string from
    // the canned response. The body assertion is what proves the explain tree
    // actually rendered — header alone could be there even if rendering broke.
    await expect(page.locator('[data-testid="detailed-explain-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="detailed-explain-body"]')).toContainText(
      'weight(title:canned',
    );

    // Baseline close behavior — ESC dismisses the modal. PR 9bc swaps
    // ui.bootstrap for native <dialog>; this assertion is the floor that
    // swap has to preserve. Without it, 9bc could ship a modal that opens
    // fine but traps the user and no test would catch it.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="detailed-explain-modal"]')).toBeHidden();
  });

  test('Search Args stays below Search Engine header when switching engines', async ({
    page,
  }) => {
    // Regression test: switching engines in the Tweak panel must not cause
    // the Search Args content to render above the Search Engine header.
    await page.route('http://fake-solr.test/**', async (route) => {
      await fulfillSolr(route, {
        responseHeader: { status: 0, QTime: 1 },
        response: {
          numFound: 1,
          start: 0,
          docs: [{ id: 'doc-1', title: 'Test Result' }],
        },
      });
    });
    const bookmarkedSolr = encodeURIComponent(
      'http://fake-solr.test/solr/coll1/select?q=*:*',
    );
    await page.goto(`/#?solr=${bookmarkedSolr}&fieldSpec=id+title`);
    await page.locator('[data-testid="doc-row"]').first().waitFor();

    // Open the Tweak panel and expand Search Engine.
    await page.locator('a:has-text("Tweak")').click();
    await page.waitForTimeout(300);
    await page.locator('.dev-header:has-text("Search Engine")').click();

    // Helper: assert the search-args-editor textarea is visually below
    // the Search Engine header inside the settings form.
    async function assertArgsBelow(label) {
      await page.waitForTimeout(800);
      const ok = await page.evaluate(() => {
        const east = document.querySelector('.pane_east');
        if (!east) return false;
        const headers = Array.from(east.querySelectorAll('.dev-header'));
        const engineHeader = headers.find(h => h.textContent.includes('Search Engine'));
        const argsEditor = east.querySelector('[data-role="search-args-editor"]');
        if (!engineHeader || !argsEditor) return false;
        return argsEditor.getBoundingClientRect().top > engineHeader.getBoundingClientRect().bottom;
      });
      expect(ok, `${label}: Search Args should be below Search Engine header`).toBe(true);
    }

    await assertArgsBelow('initial Solr');

    await page.locator('input[name="whichEngine"][value="es"]').click();
    await assertArgsBelow('after switch to ES');

    await page.locator('input[name="whichEngine"][value="os"]').click();
    await assertArgsBelow('after switch to OS');

    await page.locator('input[name="whichEngine"][value="solr"]').click();
    await assertArgsBelow('after switch back to Solr');

    await page.locator('input[name="whichEngine"][value="es"]').click();
    await assertArgsBelow('after second switch to ES');
  });

  test('engine switch via Tweak panel + Rerun Query shows results (not error)', async ({
    page,
  }) => {
    // PR 10 coverage: switch engine in the dev sidebar and rerun.
    // The bug: after switching from Solr to ES (or vice versa), clicking
    // Rerun Query showed the IN_ERROR state instead of new results.

    // Intercept both Solr and ES backends.
    await page.route('http://fake-solr.test/**', async (route) => {
      await fulfillSolr(route, {
        responseHeader: { status: 0, QTime: 1 },
        response: {
          numFound: 1,
          start: 0,
          docs: [{ id: 'solr-1', title: 'Solr Result' }],
        },
      });
    });
    await page.route('**/fake-es.test/**', async (route) => {
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
            hits: [{ _id: 'es-1', _score: 1, _source: { title: 'ES Result' } }],
          },
        }),
      });
    });

    // Start with a Solr search.
    const bookmarkedSolr = encodeURIComponent(
      'http://fake-solr.test/solr/coll1/select?q=*:*',
    );
    await page.goto(`/#?solr=${bookmarkedSolr}&fieldSpec=id+title`);
    await page.locator('[data-testid="doc-row"]').first().waitFor();
    await expect(page.getByText('Solr Result')).toBeVisible();

    // Open the Tweak panel.
    await page.locator('a:has-text("Tweak")').click();
    await page.waitForTimeout(300);

    // Expand the Search Engine section and switch to ES.
    await page.locator('.dev-header:has-text("Search Engine")').click();
    await page.locator('input[name="whichEngine"][value="es"]').click();

    // Configure ES URL in the sidebar input so the search can succeed.
    // First, wait for the settings island to remount after engine change.
    await page.waitForTimeout(200);
    const urlInput = page.locator('[data-role="search-url"]');
    await urlInput.fill('http://fake-es.test/_search');

    // Click Rerun Query.
    await page.locator('[data-role="rerun-query"]').click();

    // Should show ES results, not an error.
    await expect(page.locator('.alert-error')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText('ES Result')).toBeVisible({ timeout: 5000 });
  });
});
