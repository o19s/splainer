// Audit suite — compares the deployed splainer.io (frozen Angular build)
// against the local deangularize branch (Preact islands). Runs as two
// Playwright projects (audit-prod, audit-local) that share these test
// definitions but point at different baseURLs. Review results in
// playwright-report/index.html — attachments group by project, so you get
// side-by-side screenshots + structural state + console logs for every
// scenario.
//
// Design notes:
//   - These tests do NOT use mocks. The point is to observe real behavior
//     against real (Quepid TMDB) backends from both environments.
//   - Assertions are user-visible-text-based, not selector-based. Prod is
//     Angular with custom directives; local is Preact islands with
//     [data-role] hooks. Both eventually render the same human-visible text,
//     so that's the lowest-common-denominator assertion surface.
//   - We capture pageerrors in attachments but do NOT hard-fail on them.
//     The frozen prod build almost certainly has some baseline noise, and
//     the audit's first job is to document current state, not prosecute it.
//   - Data-dependent assertions (e.g., "page contains Batman") use stable
//     anchors in the TMDB dataset. If TMDB ever mutates out from under us,
//     these will flake — acceptable trade for real signal today.
//
// Adding a scenario: append to SCENARIOS. The shape is declarative — the
// test loop at the bottom reads the `expect*` fields and enforces them.
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1400, height: 900 } });

// Give each audit case generous headroom. Live splainer.io pulls remote
// images / analytics that can stall, and cold page loads against prod
// routinely take 15+ seconds on first hit.
test.setTimeout(90_000);

// --- Scenario definitions -------------------------------------------------
//
// Each scenario is one test. Fields:
//   name:             filesystem-safe id, used for attachment filenames
//   description:      human-readable one-liner (surfaced as an annotation)
//   hash:             URL hash fragment driving the scenario ('' = clean boot)
//   expectBodyText:   array of substrings that MUST appear in body.innerText.
//                     Checked case-sensitively. These are the cross-version
//                     invariants — they must hold on both Angular prod and
//                     Preact local. If you can't find text that holds on
//                     both, the scenario is a design regression candidate.
//   expectAbsentText: array of substrings that MUST NOT appear. Used to
//                     assert state transitions (e.g., after a search, the
//                     "Splain This!" button goes away).
//   expectMinDocRows: lower bound on visible doc rows (0 = no constraint)
//   expectMaxDocRows: upper bound on visible doc rows (null = no constraint)
//
const TMDB_SELECT = 'http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select';
const solrHash = (query, fieldSpec = 'id+title') =>
  `#?solr=${encodeURIComponent(`${TMDB_SELECT}?q=${query}`)}&fieldSpec=${fieldSpec}`;

const SCENARIOS = [
  {
    name: 'boot',
    description: 'Fresh page load — StartUrl view, no search active.',
    hash: '',
    expectBodyText: [
      // The brand/title appears in the navbar on both versions.
      'Splainer',
      // The footer is static HTML in index.html on both versions.
      'OpenSource Connections',
      // The engine radio labels: prod uses a radio group in the Search Controls
      // panel, local uses tabbed start-URL forms. Both render the word
      // "Elasticsearch" somewhere visible on the boot page.
      'Elasticsearch',
    ],
    // On boot, the "Rerun Query" button lives in the Search Controls pane on
    // prod but local's equivalent is inside the Settings island. Skipping
    // absence checks here because boot state is what we expect by default.
    expectAbsentText: [],
    expectMinDocRows: 0,
    expectMaxDocRows: 0, // Boot has no search, so zero doc rows is invariant.
  },
  {
    name: 'solr-tmdb-default',
    description: 'Quepid TMDB Solr demo, q=*:* — default field spec.',
    hash: solrHash('*:*'),
    expectBodyText: [
      'Splainer',
      // After a search the Tweak button is exposed in the navbar on both
      // versions (prod uses ng-show, local unhides via JS). Presence of
      // "Tweak" is a reliable "a search ran successfully" signal.
      'Tweak',
    ],
    expectAbsentText: [
      // After a successful search, the Splain This! button should no longer
      // be the focus of the page — on prod it's gone entirely (ng-show),
      // on local the start-url form is unmounted. Absence proves the app
      // actually left the boot state.
      'Splain This!',
    ],
    expectMinDocRows: 1,
    expectMaxDocRows: null,
  },
  {
    name: 'solr-tmdb-query',
    description: 'TMDB search for "batman" — results must contain Batman titles.',
    hash: solrHash('batman'),
    expectBodyText: [
      'Splainer',
      'Tweak',
      // TMDB contains many Batman movies. This is the most stable data-based
      // anchor I can think of — "Batman" has been in TMDB since launch and
      // will stay there. If this fails, something's genuinely broken:
      // either the query didn't propagate, or the result rendering did.
      'Batman',
    ],
    expectAbsentText: ['Splain This!'],
    expectMinDocRows: 1,
    expectMaxDocRows: null,
  },
  {
    name: 'solr-rich-fieldspec',
    description: 'TMDB q=*:* with multi-field display (id + title + overview).',
    // overview is a longer text field; this exercises the multi-line display
    // path that differs between the Angular docRow directive and the Preact
    // docRow island.
    hash: solrHash('*:*', 'id+title+overview'),
    expectBodyText: ['Splainer', 'Tweak'],
    expectAbsentText: ['Splain This!'],
    expectMinDocRows: 1,
    expectMaxDocRows: null,
  },
  {
    name: 'solr-empty-results',
    description: 'TMDB query with no matches — should render no-results state, not crash.',
    // This literal is vanishingly unlikely to ever match. If TMDB adds a
    // movie titled "zzzzzxxnothingthisisnotarealquery" we'll find out.
    hash: solrHash('title:zzzzzxxnothingthisisnotarealquery'),
    expectBodyText: [
      'Splainer',
      // Tweak button should still be accessible — we're in a "search ran"
      // state, just with zero hits.
      'Tweak',
    ],
    expectAbsentText: [
      'Splain This!',
      // TMDB titles should not leak into an empty-results page. This is a
      // cheap sanity check that we're actually seeing the empty state and
      // not accidentally rendering the previous scenario's cached results.
      'Batman',
    ],
    expectMinDocRows: 0,
    expectMaxDocRows: 0,
  },
];

// --- Structural capture helper -------------------------------------------
//
// Evaluated in-page. Returns a serializable snapshot used for both the
// attachment (for human review) and the assertions below. Keep this in
// sync with the checks at the bottom of each test.
async function captureStructuralState(page) {
  return page.evaluate(() => {
    const $$ = (sel) => Array.from(document.querySelectorAll(sel));

    // Union selector for doc rows: local uses [data-testid="doc-row"]
    // (testing-library convention in docRow.jsx), prod uses an Angular
    // element directive that Angular leaves in the DOM as literal <doc-row>
    // tags (default restrict:'E' behavior). Note that docRow.jsx uses
    // data-testid while startUrl.jsx uses data-role — the codebase is not
    // internally consistent on which hook to use, so audit selectors have
    // to accept either.
    const docRowEls = $$('[data-testid="doc-row"], doc-row');

    // Engine tab / radio presence. Local uses <a href="#solr_">, prod uses
    // <input type="radio" value="solr" ng-model="workingWhichEngine">. We
    // check both shapes and return whichever matched.
    const engineTabsLocal = $$('a[href="#solr_"], a[href="#es_"], a[href="#os_"]').map(
      (a) => a.getAttribute('href'),
    );
    const engineRadiosProd = $$('input[type="radio"][value="solr"], input[type="radio"][value="es"], input[type="radio"][value="os"]').map(
      (r) => r.getAttribute('value'),
    );

    const body = document.body;
    const bodyText = body ? body.innerText : '';

    return {
      title: document.title,
      url: location.href,
      hash: location.hash,
      docRowCount: docRowEls.length,
      // Whichever engine selector shape is active tells us which framework
      // is rendering. Both-empty on a boot page is itself a regression signal.
      engineTabsLocal,
      engineRadiosProd,
      // Presence of data-role hooks — only meaningful for local, but we
      // capture on both for diffing.
      dataRoles: {
        solrStartUrl: !!document.querySelector('[data-role="solr-start-url"]'),
        solrSubmit: !!document.querySelector('[data-role="solr-submit"]'),
        esStartUrl: !!document.querySelector('[data-role="es-start-url"]'),
        osStartUrl: !!document.querySelector('[data-role="os-start-url"]'),
      },
      // Body text samples at two sizes: short for quick eyeballing in the
      // attachment panel, long for substring assertions.
      bodyTextLen: bodyText.length,
      bodyTextSample: bodyText.slice(0, 2000),
      bodyTextFull: bodyText,
      // Deangularize branch exposes this global for tests; prod does not.
      // Useful as an "am I looking at the refactored code" indicator.
      servicesWired: typeof window.SplainerServices === 'object',
      // Angular footprint — presence of `ng-app` or an `angular` global.
      // Used as an "am I looking at Angular prod" indicator.
      angularFootprint: !!(
        document.querySelector('[ng-app]') || window.angular
      ),
    };
  });
}

// --- Wait helpers --------------------------------------------------------
//
// Waiting strategies differ by scenario shape:
//   - Zero-row scenarios can't wait for doc rows; wait for any content.
//   - Results scenarios should wait until at least one doc row exists.
// Both use expect.poll so failures are diagnostic rather than opaque timeouts.

async function waitForScenario(page, scenario) {
  // Every scenario: wait for *some* text to render. This catches "page
  // didn't mount at all" which is the fastest-to-diagnose failure.
  await expect
    .poll(
      async () => {
        const len = await page.evaluate(() =>
          document.body ? document.body.innerText.length : 0,
        );
        return len;
      },
      { timeout: 20_000, message: 'body never rendered text — page failed to mount' },
    )
    .toBeGreaterThan(50);

  if (scenario.expectMinDocRows > 0) {
    // Results scenario: wait for doc rows to actually appear. Search
    // latency varies — Quepid's demo Solr can be slow — so the timeout
    // needs to accommodate ~15s cold starts.
    await expect
      .poll(
        async () => {
          return page.evaluate(() => {
            const els = document.querySelectorAll('[data-testid="doc-row"], doc-row');
            return els.length;
          });
        },
        { timeout: 30_000, message: 'doc rows never rendered after search' },
      )
      .toBeGreaterThanOrEqual(scenario.expectMinDocRows);
  } else if (scenario.hash && scenario.hash.includes('solr=')) {
    // Empty-results scenario: we can't wait for rows, but we can wait
    // for the body text to exceed the boot-length threshold, which
    // signals that the search ran and the results view rendered (even
    // if it's the empty state).
    await expect
      .poll(
        async () => {
          return page.evaluate(() => document.body.innerText.length);
        },
        { timeout: 30_000, message: 'results view never rendered for empty search' },
      )
      .toBeGreaterThan(200);
  }
  // Boot scenario: no extra wait needed, the initial text-length poll
  // above is sufficient.
}

// --- The test loop --------------------------------------------------------

for (const scenario of SCENARIOS) {
  test(`audit: ${scenario.name}`, async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'scenario', description: scenario.description });

    const consoleLog = [];
    const pageErrors = [];
    const requests = [];
    page.on('console', (msg) => {
      consoleLog.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      const entry = `[pageerror] ${err.message}`;
      consoleLog.push(entry);
      pageErrors.push(err.message);
    });
    page.on('request', (req) => {
      requests.push(`${req.method()} ${req.url()}`);
    });

    // The structural snapshot is what assertions read. It's captured
    // either after successful waiting (happy path) or in the finally
    // block (failure path) — the attachments must land either way so
    // that failure diagnostics are available in the HTML report.
    let structural = null;

    try {
      // waitUntil: 'domcontentloaded' stops blocking on long-tail subresources
      // (prod pulls images from github.com/s3 that can stall). The app-mount
      // wait below is what actually tells us when the scenario is ready.
      await page.goto('/' + scenario.hash, { waitUntil: 'domcontentloaded' });

      // Application-specific settling: wait for the scenario to reach its
      // expected rendered state (see helper for per-shape logic).
      await waitForScenario(page, scenario);
    } finally {
      // Capture state EVEN IF the wait above threw — that's precisely when
      // we need to see the DOM, console, and network state. The screenshot
      // and structural eval are wrapped in their own catches so a double
      // failure (e.g., page crashed) still lets the attachments flush.
      try {
        await page.screenshot({
          path: testInfo.outputPath(`${scenario.name}.png`),
          fullPage: true,
        });
      } catch {
        // Screenshot may fail if the page crashed. Not fatal for the audit.
      }
      try {
        structural = await captureStructuralState(page);
      } catch {
        structural = { captureError: 'captureStructuralState threw' };
      }

      await testInfo.attach(`${scenario.name}.state.json`, {
        body: JSON.stringify(
          { ...structural, pageErrorCount: pageErrors.length, pageErrors },
          null,
          2,
        ),
        contentType: 'application/json',
      });
      await testInfo.attach(`${scenario.name}.console.txt`, {
        body: consoleLog.join('\n') || '(no console output)',
        contentType: 'text/plain',
      });
      await testInfo.attach(`${scenario.name}.requests.txt`, {
        body: requests.join('\n') || '(no requests captured)',
        contentType: 'text/plain',
      });
    }

    // --- Assertions -------------------------------------------------------
    //
    // User-visible-text-based. These enforce cross-version invariants: if
    // prod satisfies them, local should too, and vice versa. Any failure is
    // a real regression — either the page didn't load, the search didn't
    // run, or the rendering model diverged in a user-visible way.

    // The page must have rendered meaningful content. This catches catastrophic
    // failures (white screen, mount never ran) on either environment.
    expect(
      structural.bodyTextLen,
      'page should have rendered a meaningful amount of text',
    ).toBeGreaterThan(50);

    // All expected strings must be present in body text. Per-scenario
    // content invariants.
    for (const needle of scenario.expectBodyText) {
      expect(
        structural.bodyTextFull,
        `body text should contain "${needle}" (scenario: ${scenario.name})`,
      ).toContain(needle);
    }

    // All forbidden strings must NOT be present. Used to enforce state
    // transitions (e.g., the boot form is gone after a search).
    for (const forbidden of scenario.expectAbsentText) {
      expect(
        structural.bodyTextFull,
        `body text should NOT contain "${forbidden}" (scenario: ${scenario.name})`,
      ).not.toContain(forbidden);
    }

    // Doc row count bounds.
    expect(
      structural.docRowCount,
      `doc row count should be >= ${scenario.expectMinDocRows}`,
    ).toBeGreaterThanOrEqual(scenario.expectMinDocRows);
    if (scenario.expectMaxDocRows !== null) {
      expect(
        structural.docRowCount,
        `doc row count should be <= ${scenario.expectMaxDocRows}`,
      ).toBeLessThanOrEqual(scenario.expectMaxDocRows);
    }

    // We intentionally do NOT fail on pageErrorCount > 0. Prod's frozen
    // Angular build likely has pre-existing noise that isn't a regression.
    // The count lives in the structural attachment so you can see if it
    // *diverges* between prod and local at review time — that's where the
    // signal is.
  });
}
