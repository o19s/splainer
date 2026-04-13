# Splainer — Angular to Preact + Vite Migration Log

This is the phase-by-phase log of removing AngularJS from Splainer and landing it on Preact islands, Vite, native ESM, and `splainer-search` 3.0.0.

The companion document on the library side is [`splainer-search/MIGRATION_CHANGES.md`](../splainer-search/MIGRATION_CHANGES.md), which records the framework-agnostic rewrite of the 3.0.0 library this branch consumes. User-facing 3.0.0 breakage lives in that repo's release notes.

## Baseline and target

- **Before.** AngularJS 1.8.3 SPA, ~1,336 LOC across 24 files (8 controllers, 5 directives, 5 services, 12 templates). Built with Grunt (325-line `Gruntfile.js`), tested with Karma + Jasmine, consumed `splainer-search` 2.20.1 via the `o19s.splainer-search` Angular module.
- **After.** Preact islands mounted from a single `main.js` ESM entry point, built with Vite, tested with Vitest + Playwright, CodeMirror 6 in place of Ace, consuming `splainer-search` 3.0.0 (framework-agnostic, ESM + IIFE) via its wired bag.
- **Method.** Strangler fig: upgrade the library behind an Angular shim first, replace views one at a time, extract services edge-in, delete Angular last, swap bundlers, then swap the editor.

## Cross-cutting patterns

Several patterns recur across phases and are worth naming once.

**Island + directive-shim + mount (Phases 6–12; retired in 13b).** During the Angular coexistence window, each Preact island lived at `app/scripts/islands/*.jsx`, built to an IIFE that attached itself to `window.SplainerIslands.<name>`, and was integrated into Angular via a thin directive shim whose `link` function deep-`$watch`ed the bound data, called the island's idempotent `mount()` on every tick, and cleaned up on `$on('$destroy')`. Vitest specs imported the `.jsx` source directly; Karma loaded the built IIFE alongside the rest of `app/scripts/`. Per-island cost after the first one: write the JSX, add an entry to `vite.islands.config.js`, copy-paste a 50-line shim. Phase 12 deleted every shim and Angular dependency; Phase 13b converted islands to direct ESM imports from `main.js`, removing all `globalThis` assignments and the separate island build step.

**Two-file service extraction (Phase 11; wrappers retired in 12–13b).** Each Phase 11 service landed as a pure ESM module (the real logic, Vitest-testable, no Angular) plus a thin Angular wrapper that read the module off `globalThis.SplainerServices.*` and preserved the old DI signature. Dependencies the pure module needs (the `Search` constructor, `solrUrlSvc`, `fieldSpecSvc`) are passed as leading parameters so the module never touches the injector. Phase 12 deleted the Angular wrappers; Phase 13b converted the pure modules to direct ESM imports, removing the `globalThis` registration.

**Three refs per imperative editor wrapper.** Any island that wraps an imperative third-party editor needs three `useRef`s: one for the editor instance, one for the latest `onChange` prop (updated via an effect so the handler is never stale), and one echo-suppression flag wrapped in `try/finally` around every programmatic value mutation. Skip any of the three and you get stale closures, infinite loops, or silently dropped input. Originally codified in `useAceEditor` (Phase 7); now lives in `useCodeMirror` (Phase 14a) after the Ace→CodeMirror 6 swap.

**Deps bag.** Services that need many splainer-search dependencies (`Search`, `main.js`'s `explainOther`) receive a single `deps` object rather than an N-long positional list, keeping the pure-module signature stable as upstream adds dependencies.

**Wire-level Playwright as merge gate.** Every user-config feature landed with a Playwright test that intercepts the outbound request with `page.route` and asserts the config reached the network — not that scope mutated. Internal contract tests catch refactor regressions; outbound-request tests catch silent integration breaks. This primitive caught the Phase 5 JSONP bug, the Phase 6 header wiring, and every island settings flow after it.

**Console-error spy in `beforeEach`.** `e2e/smoke.spec.js` installs a page-level console-error / `pageerror` listener in `beforeEach` so any uncaught exception fails the test loudly. Every new test gets this for free. This is the primitive that caught the Phase 5 JSONP parse error.

---

## Phase 1 — Foundations

**Behavioral changes:** None.

Prettier and ESLint landed and ran a formatting pass over the Angular codebase. The Dockerfile bumped from `node:14` to `node:20`, and `libappindicator1` was dropped (gone from Debian Bookworm).

## Phase 2 — Vitest alongside Karma

**Behavioral changes:** None.

Vitest 4.x landed scoped to `app/scripts/{islands,services}/**/*.spec.{js,jsx}` with a proof-of-life spec. Existing Karma specs stayed intact and kept guarding Angular code until each controller was removed. `yarn test` still ran Karma.

## Phase 3 — Playwright smoke flows

**Behavioral changes:** None.

`@playwright/test` installed; `playwright.config.js` auto-boots the dev server (originally `grunt serve` on :9000; switched to `yarn dev:vite` on :5173 in Phase 13a). The initial four smoke tests in `e2e/smoke.spec.js` exercise app-boot, URL-input, bookmarked-URL hash round-trip, and settings-persist via localStorage (later phases added wire-level tests for each island, bringing the total to 14). Solr responses are mocked with `page.route('http://fake-solr.test/**')` returning canned JSON with CORS headers.

## Phase 4 — Vite dev server alongside Grunt

**Behavioral changes:** None.

Vite 8 landed with `root: 'app'`, `appType: 'mpa'` (removed in Phase 13b's ESM conversion), and a `configureServer` middleware shim that mirrors the relevant parts of `Gruntfile.js`. `yarn dev:vite` serves on :5173; `SPLAINER_DEV=vite yarn test:e2e` runs the smoke suite against Vite. Grunt remained the default for `npm test` and production builds until Phase 13.

## Phase 5 — splainer-search 2.20.1 → 3.0.0 behind an Angular shim

**Behavioral changes:** None in-app. One Playwright test fix (see below).

Added `urijs`, dropped `o19s.splainer-search` from the module dependencies, and introduced `splainerSearchShim.js` — an Angular factory that wraps `globalThis.SplainerSearchWired.getDefaultWiredServices()` and re-exposes each service under the same DI name. The shim uses Angular's array-injection form so `grunt-ngmin` is no longer load-bearing.

**JSONP wire-test fix.** The existing `page.route('http://fake-solr.test/**')` mock returned raw JSON, but splainer-search 3.0.0 calls Solr via JSONP (dynamic `<script>` injection), so the browser tried to parse JSON as JavaScript and threw `Unexpected token ':'`. Fixed by reading `json.wrf` from the request URL and wrapping the body as `callback({...});` with `Content-Type: application/javascript`.

This behavior is correct for both library versions: 2.20.1 and 3.0.0 both default Solr to `apiMethod: 'JSONP'` in `defaultSolrConfig.js`, both use `json.wrf` as the callback param, and both inject a `<script>` tag. The only difference is the substrate — Angular `$http.jsonp` vs 3.0.0's vanilla `httpClient.jsonp` — the wire contract a Playwright mock has to honor is identical. Karma never needed the fix because it mocked one level above the transport, at the `$httpBackend` layer.

A new Playwright test (`search error path surfaces an error message`) closes the highest-priority gap left by the six `xdescribe`'d Karma specs: the `WAITING_FOR_SEARCH → IN_ERROR` transition under 3.0.0's promise-rejection contract.

## Phase 6 — `CustomHeaders` island (the pattern-setter)

**Behavioral changes:** None. Rendering moves from Angular to Preact; the outbound request is unchanged.

The first Preact island, and the one that establishes the island + shim + mount pattern used by everything after it. `vite.islands.config.js` builds `customHeaders.jsx` in Vite library mode with `preact`/`preact/hooks` externalized, emitting an IIFE to `app/scripts/islands/dist/`. Karma loads the built IIFE alongside Angular; Vitest imports the JSX source directly against a textarea fallback (jsdom has no Ace).

The `AceEditor` wrapper required two fixes worth recording:

- **Stale `onChange` closure.** The change handler captured `onChange` from the first render and always called that one. Fixed with `onChangeRef` updated via `useEffect` — not during render (a React anti-pattern).
- **Echo loop.** The value-sync effect called `editor.setValue()`, Ace fired `change` synchronously, the handler re-entered `$apply` mid-digest, and the editor body silently cleared. Fixed with a `suppressRef` flag wrapped in `try/finally` so a thrown `setValue` cannot strand the flag.

Those two refs plus the editor-instance ref became the "three refs" pattern later codified in `useAceEditor` (Phase 7) and inherited by `useCodeMirror` (Phase 14a).

A Playwright test configures a custom API-key header in the UI, submits the search, captures the outbound ES request via `page.route`, and asserts `Authorization: ApiKey ...` lands in the request headers — end-to-end validation of the Preact → directive shim → `esSettingsSvc` → `Search` factory → `splainerSearchShim` → splainer-search 3.0.0 → fetch chain. This is the first "wire-level Playwright as merge gate."

**Vitest 4 OXC quirk.** Vitest 4 switched from esbuild to oxc; `esbuild.jsxImportSource: 'preact'` is silently ignored. The durable workaround is a `resolve.alias` mapping `react/jsx-runtime` and `react/jsx-dev-runtime` to the Preact equivalents.

## Phase 7 — `Settings` island and `useAceEditor`

**Behavioral changes:** None.

Replaced `controllers/settings.js` and the 140-line `<form ng-controller="SettingsCtrl">` block in `index.html`. Extracted the three-ref Ace machinery into a shared `useAceEditor` hook so the next editor-wrapping island doesn't copy-paste it. A new Playwright test mutates the store, clicks Rerun, intercepts the ES request, and asserts the marker landed in the captured body.

## Phase 8 — `DocSelector` island

**Behavioral changes:** None.

Third island; first one that coexists with an un-migrated Angular child (`<doc-row>`). The island owns the `altQuery` form and error banner; the result list's `ng-repeat` over `currSearch.docs` stays in the directive's inlined template. They share `currSearch` and `selectDoc` on the directive's isolate scope — a deliberate cross-framework bridge that survives only until Phase 9a deletes `<doc-row>`.

The shim absorbs the entire body of the old `DocSelectorCtrl.explainOther` (searcher construction, engine-specific arg parsing, extractor dispatch, `maxScore` ratcheting). The island is near-pure UI. This is the pattern: shim-heavy when the controller body is all Angular glue and the UI is simple; island-heavy when the reverse.

**Destroyed-scope guard added to the shim** (`if (scope.$$destroyed) return;` at the top of the post-resolution `.then`). The directive lives on an isolate scope inside a modal that can close mid-request, so the race window is strictly wider than it was before the isolate scope existed. Without the guard, the follow-up `$apply` throws and the page-error spy fires on every test after it.

Karma shim spec uses **native Promises** in fake searchers (not `$q`) because `$q` resolves synchronously inside `$apply` and collides with the shim's nested `$apply`. Production is fine because 3.0.0 uses native fetch.

## Phase 8.5 — Test-hook prep

**Behavioral changes:** None.

Added `data-testid` attributes to the still-Angular templates so the chart-click Playwright test for Phase 9 could be written and merged against known-good code, then survive the rewrite unchanged. One new test: `clicking stacked-chart Detailed link opens the explain modal`, which also asserts ESC closes the modal.

## Phase 9 — DocRow, StackedChart, Dialog, DocExplain

Four islands land in sequence. 9a inverts the integration boundary (Preact parent, Angular child); 9b un-inverts it; 9c introduces the native `<dialog>` pattern; 9d deletes the last Angular controller in this cluster.

### 9a — `DocRow` island (first split shim; DOMPurify lands)

**Behavioral changes:** Rendering moves to Preact. The modal opener logic and chart-compile path are unchanged.

First **split** shim — neither shim-heavy nor island-heavy. The island owns rendering (title, snippets, thumbnail, image, child chart slot); the shim opens both `$uibModal.open` calls (Detailed explain, show raw doc) and `$compile`s the still-Angular `<stacked-chart>` child into a slot the island exposes via a `registerChartHost` callback. **First inversion of the integration boundary — Preact parent, Angular child** — bounded to one phase by design.

**DOMPurify arrives** for the `ng-bind-html` replacement. Two named wrappers, `SanitizedSpan` and `SanitizedAnchor`, instead of one polymorphic `<SanitizedHtml tag={...}>` — a string-typed `tag` prop is an injection footgun. Three XSS regression tests are the merge gate. **Any island that previously had `ng-bind-html` now requires DOMPurify.**

Deferred to 9b/9c: the deep `$watch('doc', rerender, true)` is O(doc-size) per tick; the `doc.showDetailed` closure leak is preserved from the old controller and fixed when the modal pattern moves to `<dialog>`.

### 9b — `StackedChart` island (un-inverts the boundary)

**Behavioral changes:** None.

`stackedChart.jsx` replaces the Angular `<stacked-chart>` directive. `docRow.jsx` now renders `<StackedChart>` as a JSX child — the chart-host slot, `registerChartHost`, and the Phase 9a compile bridge are all deleted. The 190-line DocRow shim collapses to ~96 lines.

**Pattern:** never introduce Preact-parent / Angular-child inversions, even temporarily — the chart-host bridge was scoped to one phase and bounded by 9b's delivery. Future migrations should migrate the child the same phase as the parent.

Preact 10 batches state updates via debounced microtask; tests that click a button and assert post-state DOM need a `new Promise(r => setTimeout(r, 0))` after the click. First `.spec.jsx` in the suite (renders JSX directly rather than going through `mount()`).

### 9c — Native `<dialog>` pattern + `DetailedDoc` island

**Behavioral changes:** `$uibModal` replaced by native `<dialog>`. Modal open/close keyboard and focus behavior inherit from the browser.

Established the `useDialogModal` hook and a `modalRegistry.js` global `openDocModal(kind, doc, opts)` entry. `DetailedDoc` replaces `controllers/detailedDoc.js` + `views/detailedDoc.html`. The DocRow shim's `openShowDoc` switches from `$uibModal.open` to `openDocModal('detailedDoc', ...)`.

### 9d — `DocExplain` island + final deletes

**Behavioral changes:** Four intentional. See list below.

**Intentional differences from Angular:**
- The Full Explain tab renders `<pre>` with pretty-printed JSON instead of `<json-explorer>`'s tree.
- Clicking a nested alt-doc title sets `altDoc` without opening a stacked modal (bugfix).
- `maxScore` no longer ratchets across queries (old code flagged this as "latent oddity").
- The `scope.doc.showDetailed` closure-leak from Phase 9a is fixed by removing the mutation entirely (DocExplain receives `explainOther` as a prop instead).

`explainOther` moves into `directives/searchResults.js` here and is passed as a prop — it moves again in Phase 10 and again in Phase 12. Nine files deleted, including the still-Angular `docSelector.js` + spec (the whole DocSelector flow now lives under DocExplain's alt-query form). Deep `$watch` is kept after verifying mutate-in-place semantics.

### `StartUrl` + `SolrSettingsWarning`

`controllers/startUrl.js` + `views/startUrl.html` become `startUrl.jsx` (three tabs, `CustomHeaders` + `useAceEditor` for the ES/OS panes). Solr URL warnings live in `solrSettingsWarning.jsx`, imported by `searchResults.jsx` and bundled into `dist/searchResults.js`.

## Phase 10 — `SearchResults` island

**Behavioral changes:** None.

`views/searchResults.html` is deleted. The pane is `<search-results-island curr-search="currSearch">`, mounting `searchResults.jsx`, which renders the search-state branches (`WAITING_FOR_SEARCH`, `IN_ERROR`, `DID_SEARCH`), doc list, grouping, query details, and pagination, with `DocRow` and `SolrSettingsWarning` as JSX children.

`SearchResultsCtrl` is intentionally still present at ~40 LOC: it owns `currSearch` and `search.reset()`. The island only owns local parsed-vs-raw JSON toggles. `explainOther` lives in `directives/searchResults.js` and is passed into both the island and DocExplain.

## Phase 11 — Extract services to ESM (edge-in)

All four phases follow the two-file extraction pattern. Same `angular.forEach` → `.forEach`, `angular.isDefined(x)` → `x !== undefined`, `angular.isString(x)` → `typeof x === 'string'` swaps (verified line-by-line safe for the data in play); same thin Angular wrapper delegating to a pure module registered on `globalThis.SplainerServices`.

### 11a: `esSettingsSvc`, `osSettingsSvc`, `splSearchSvc`

**Behavioral changes:** None.

`splSearch.js` exports `states`, `engines`, and `createSearch(Search, settings, overridingExplains)`. The `Search` constructor is passed as a parameter — the pure module has no Angular dependency. `esSettings.js` and `osSettings.js` are near-identical URL parsers differing only in `whichEngine`; kept separate to minimize blast radius (merged later in 13a cleanup).

### 11b: `solrSettingsSvc`

**Behavioral changes:** None.

`solrUrlSvc` and `fieldSpecSvc` from `splainerSearchShim` are passed as leading parameters — the same DI-via-params pattern `splSearch.js` established with `Search`. `angular.copy(parsedUrl.solrArgs)` becomes `JSON.parse(JSON.stringify(...))`; safe here because `solrArgs` is `{string: string[]}` with no `undefined`, `Date`, `RegExp`, or cycles. A deep-clone safety test pins the no-mutation contract that `angular.copy` was enforcing.

### 11c: `settingsStoreSvc` → `SettingsStore`

**Behavioral changes:** Intentional parity with Angular. One dropped dependency (`angular-local-storage`), one persistence defaulting fix.

Every shim directive deep-watches `settingsStoreSvc.settings`, and every search action flows through it — this is the extraction that makes Phase 12 possible. Several deliberate choices the current code still depends on:

- **`ls.` localStorage prefix preserved.** `angular-local-storage`'s default config prefixes every key with `'ls' + '.'`, and the app never called `setPrefix()`. The native `localStorage` replacement writes and reads `ls.*` directly so existing user data survives. `lsGet` handles both JSON-encoded values (what `angular-local-storage` wrote) and bare strings (possible legacy) via a `JSON.parse` try/catch.
- **`decodeURIComponent`, not `URLSearchParams`.** `$location.search()` used `decodeURIComponent`, which does *not* decode `+` as space; `URLSearchParams` encodes spaces as `+` per `application/x-www-form-urlencoded`. Preserving the old encoding means hash writes use manual `encodeURIComponent` and skip null/undefined values (matching `$location.search(obj)`'s omission semantics). Bookmark round-trip is load-bearing.
- **`subscribe(fn) → unsubscribe`** replaces the deep `$watch`. Preact signals were rejected as premature (would couple the pure module to Preact); `EventTarget` was equivalent but more verbose. The shim directives bridge by subscribing in `link` and calling `scope.$applyAsync(rerender)` on notification — **`$applyAsync`, not `$apply`**, because `save()` can fire from inside an existing `.then()` mid-digest and `$apply` would throw "already in progress."
- **`startUrl: ''` added to all three engine sub-object defaults.** The old code left `startUrl` undefined, and combined with the null-skip in `buildHashString` this prevents the literal string `"undefined"` leaking into the URL hash.
- **`_lsSupported` cached at module init.** `angular-local-storage` cached a boolean; the new code avoids a write+remove probe on every `save()` by IIFE-caching it once.

`headerType` is deliberately not persisted — matches the old code exactly. URL bootstrap (reading `$location.search()` at load) is intentionally kept in `directives/startUrl.js` at this phase; moving it to the store would change timing and require the store to understand search-trigger side effects. It moves out in Phase 12.

### 11d — `Search` factory → pure constructor

**Behavioral changes:** One fix, one intentional improvement. See below.

Kept as a constructor function, not ES6 class — consistency with the other extractions. The **deps bag pattern** lands here: `solrUrlSvc`, `fieldSpecSvc`, `searchSvc`, `normalDocsSvc` are packed into a single `deps` object and passed as the first constructor argument. The Angular wrapper returns a curried constructor: `new WrappedSearch(...)` transparently yields a `SearchCtor` instance because `new` uses an explicitly-returned object. (This wrapper is deleted in Phase 13c.)

`$q.defer()` is removed from both `search()` and `page()`. Angular's digest no longer runs off native promise microtasks, so the directive's `onPage` callback now does `.then(fn, fn).then(() => scope.$applyAsync())` in both branches — **this is why `onPage` chains `$applyAsync`** in the current shim. `search()` didn't need the fix because `SearchResultsCtrl` still wraps it in its own `$q.defer()` at this phase.

**Bug fix in `page()` error handling.** The old code had no error handler; a rejected paging request left the `$q` deferred forever-pending and froze the UI. The new code sets `IN_ERROR`, clears `paging`, and surfaces the error.

**Latent bug fix.** Old `page()` error path referenced `self.state = self.IN_ERROR`, which pointed at an instance property set post-construction by `splSearch.createSearch`. Replaced with `states.IN_ERROR` (the canonical constant available during construction). Functionally equivalent — the `createSearch` call-site is the authority for state constants.

**Settings snapshot.** `angular.copy(searchSettings)` becomes a two-level `Object.assign` that preserves top-level methods (`searchUrl`, `fieldSpecStr`, `searchArgsStr`) while isolating nested engine sub-objects. `JSON.parse(JSON.stringify(...))` was rejected because it silently strips functions.

## Phase 12 — Delete Angular

**Behavioral changes:** None intended. Two subtle gotchas called out below.

`bootstrap.js` (~200 lines, IIFE) replaces `SearchResultsCtrl`, all five directive shims, `dispatchOnClick`, `app.js`, `splainerSearchShim.js`, and every Angular service wrapper.

Responsibilities: resolve services from `globalThis.SplainerServices.*` and `SplainerSearchWired getDefaultWiredServices()`, curry a `WrappedSearch` constructor with the deps bag, expose `currSearch`/`search`/`explainOther`/`onPage`/`onPublish`/`onSearch`, parse `window.location.hash` on boot (using `decodeURIComponent` — see Phase 11c), mount the three page-level islands, subscribe to `store.subscribe(renderAll)` for settings reactivity, and bind navbar click handlers.

`index.html` loses `ng-app`, `ng-controller`, every `ng-*` attribute, every Angular `<script>` tag (including `angular-sanitize`, `angular-local-storage`, `angular-ui-bootstrap`, `angular-ui-ace`, `ng-json-explorer`), and every Angular wrapper script. Replaced with `<div id="...">` mount points and `<script src="scripts/bootstrap.js">`. Seventeen files deleted, five directories removed. Karma, `angular-mocks`, `grunt-karma`, `grunt-ngmin`, and the full Karma test tree are dropped from `package.json`; `yarn test` is now `vitest run`.

**Gotchas worth remembering, because the bugs reappear on the next `ng-class` refactor:**

- **`explainOther` is non-trivial.** It uses five splainer-search services directly and dispatches across three engine branches. Absorbed into `bootstrap.js` as a real function body, not a pass-through.
- **`solrSettings` API is asymmetric** with `esSettings`/`osSettings`. Solr's `fromTweakedSettings` requires `solrUrlSvc` + `fieldSpecSvc` as leading args; the ES/OS variants don't. The Angular wrappers curried these; `bootstrap.js` passes them explicitly at each call site.
- **Paging requires dual renders** — sync for the spinner, async for the results. Without this the UI freezes mid-page.
- **`customHeaders` is NOT mounted by `bootstrap.js`** — it's a JSX child of `startUrl` and `settings` internally. No top-level mount point.
- **`ng-class` merges classes; `el.className = ...` replaces them.** The Tweak button's right chevron had a static `class="glyphicon glyphicon-chevron-right"` that `ng-class` never touched. The first port naively replaced the class attribute entirely, silently dropping the static classes. Fix: keep the right chevron class constant; only the left chevron toggles.

Two Playwright tests that reached into Angular internals via `window.angular.element(...).injector().get('settingsStoreSvc')` were updated to use `window.SplainerServices.settingsStore`.

## Phase 13 — Vite production build, jQuery and Grunt removal, ESM conversion

### 13a — Kill Grunt, kill jQuery, land a copy-based production build

**Behavioral changes:** None visible to users. Three dropped vendors (jQuery, Bootstrap JS, `grunt-*`).

jQuery audit found 26 calls across three files — all low-complexity. `panes.js` converts `$(el).show()/.hide()` to `el.style.display = 'block'/'none'` (explicit `'block'`, not `''` — clearing the inline style falls back to the stylesheet's `display: none` for `.pane_east`), `$(document).on()` to `addEventListener`. `ace-config.js` converts `$('#id')` to `getElementById`, etc. `bootstrap.js` dispatches `CustomEvent` instead of `jQuery(document).trigger()`.

Bootstrap 3's JS is a jQuery plugin system — it throws without jQuery. Audit confirmed the only usage was `data-toggle="tooltip"` (converted to plain `title`); all modals migrated to native `<dialog>` in 9c, tabs managed by Preact state. Bootstrap **CSS** is retained.

`scripts/build.mjs` is the new production build. Vite's module-aware `vite build` can't process plain `<script>`-tag IIFE globals — it skips non-`type="module"` tags. Instead, a straightforward Node script does what `copy:app` + `copy:dist` did: pre-build island/service IIFEs, copy `app/` to `dist/`, cherry-pick vendor files from `node_modules/`. Only files referenced by HTML `<script>`/`<link>` tags are copied — no wholesale dump.

Deleted: `Gruntfile.js` (325 lines), 21 Grunt-related dev dependencies, `es5-shim`, `json3`, IE conditional-comment cruft, the stale Universal Analytics snippet (Google sunset UA in July 2023), `ng-json-explorer` CSS references, and the `<!-- build:js -->` / `<!-- build:css -->` Grunt `usemin` blocks. `playwright.config.js` now runs `yarn dev:vite`; `.circleci/config.yml` extracts `dist/` instead of `app/` + `node_modules/`.

### 13a cleanup + test hardening

**Behavioral changes:** Two bug fixes, no other changes.

**DRY passes.** `esSettings.js` and `osSettings.js` (97% identical) merge behind `createJsonEngineSettings(engine)` in `jsonEngineSettings.js`. A shared `formatJson.js` utility replaces three copies of `JSON.stringify(JSON.parse(str), null, 2)`. The `persistToLocalStorage` loop in `settingsStore.js` iterates `PERSIST_ENGINES × PERSIST_FIELDS` instead of 15 hand-written `lsSet` calls — eliminating the risk of adding a field to load but forgetting to save. Dead CSS (~11 selectors from the Angular migration) removed.

**Two bug fixes:**
- **`useDialogModal` double-fire `onClose`**. `closedRef` idempotency guard added inside the hook so callers don't need their own.
- **Sidebar chevron desync**. `sidebarOpen` (bootstrap.js) and `toggled` (panes.js) drifted when "Splain This!" opened the sidebar via `openEast` — every subsequent Tweak click showed reversed chevrons. Fix: set `sidebarOpen = true` and update chevrons in `onSearch` *before* dispatching `openEast`.

**Test hardening.** CircleCI pipeline was deploying to splainer.io without ever running `yarn test`; added a `test` job as a prerequisite of `build`. Shared jsdom dialog polyfill extracted to `test-helpers/jsdom-dialog-polyfill.js` (loaded via `setupFiles` — runs before every spec, no per-file boilerplate). Shared test factories (`makeRoot`, `makeSearchDoc`) extracted to `test-helpers/factories.js` and adopted across ten spec files. `formatJson` and `jsonEngineSettings` gained direct unit coverage (previously only tested transitively).

### 13b — ESM module conversion (one entry point)

**Behavioral changes:** None.

`app/scripts/main.js` absorbs `bootstrap.js`'s orchestration and imports everything as real ESM — islands, services, `panes`, the new CodeMirror config. Replaces 15 `<script>` tags with one `<script type="module" src="scripts/main.js">`. `panes.js` exports `openEast`/`closeEast`/`toggleEast` directly; `modalRegistry.js` imports `detailedDoc` and `docExplain` modules directly instead of reading `window.SplainerIslands.openDocModal`. Every `globalThis` assignment in island and service source files is deleted.

`vite.config.js` goes from `appType: 'mpa'` to standard Vite ESM dev + build. `scripts/build.js` is rewritten to use `vite build` plus a selective vendor copy for the remaining IIFE scripts (`urijs`, `splainer-search-wired`). Preact UMD tags are removed — Vite bundles Preact from ESM imports. `index.html` shrinks from 143 lines / 18 scripts to 120 lines / 5 scripts. *(Those two vendor IIFEs were later removed: splainer-search is imported as ESM from `splainer-search/wired`; see appendix.)*

`package.json` gets `"type": "module"`; `.mjs` files rename to `.js`; `'use strict'` is removed from every file (ES modules are always strict). `build:islands` and `build:islands:watch` scripts are deleted — Vite processes ESM imports directly.

**One test-only global is retained:** `window.SplainerServices.settingsStore` is set in `main.js` for Playwright e2e access.

Final output: one `main-*.js` bundle (69 KB, 24 KB gzip) + vendor scripts, with Vite bundling all CSS into a single file.

### 13c — Drop the `WrappedSearch` shim

**Behavioral changes:** None. Byte-equivalent call path.

With `main.js` as the sole `Search` caller, the curried `WrappedSearch` constructor (the `new`-returns-object trick from Phase 11d) is strictly simpler to inline. `createSearch(Search, settings, overridingExplains)` becomes `createSearch(Search, deps, settings, overridingExplains)`; the pure module passes `deps` as the first constructor argument directly. The test fake's signature changes to match, and a `expect(search._deps).toBe(fakeDeps)` assertion pins the contract.

State-constant attachment (`NO_SEARCH`, `DID_SEARCH`, `WAITING_FOR_SEARCH`, `IN_ERROR`) still happens post-construction in `createSearch`; `Search.js` still uses the closure-captured `states` parameter internally. The Phase 11d `states.IN_ERROR` fix is still load-bearing.

The Phase 11a/11d/12 entries above intentionally still describe the old `WrappedSearch` signature — historical record of what each phase looked like at the time.

## Phase 14a — Replace Ace with CodeMirror 6

**Behavioral changes:** Editor changes, CSP win. Line numbers restored in Phase 15h. No other visible change.

**Why.** Ace uses `new Function()` internally, which requires `'unsafe-eval'` in any CSP. CodeMirror 6 is CSP-clean, ~35 KB gzipped for the set of extensions used here (vs ~400 KB of eager Ace), and ESM-first — Vite bundles it into `main.js` instead of requiring separate `<script>` tags.

**Scope.** Only two consumers actually used Ace: `customHeaders.jsx` and `startUrl.jsx`. `settings.jsx` always used a plain `<textarea>`.

**`ace-config.js` deleted, not ported.** It was resize-polling element IDs (`es-query-params-editor`, `os-query-params-editor`) that don't exist anywhere in the current DOM — the real editors use `data-role` attributes.

**New hook: `useCodeMirror`.** API mirrors `useAceEditor` — `(value, onChange, { readOnly, tabSize, useWrapMode })` — so consumer diffs were one-line import swaps. Same three-ref pattern (`viewRef`, `onChangeRef`, `suppressRef`) guarding the same echo loop. A one-shot `useEffect` creates the `EditorView`; value-sync dispatches a `changes` transaction instead of tearing down the view; `readOnly`-sync uses a `Compartment.reconfigure`. **e2e escape hatch:** the `EditorView` is stashed on the container DOM node as `container.__cmView` on mount, replacing the old `window.ace.edit(container).getValue()` read in Playwright specs.

**jsdom gate preserved at the consumer level.** Both islands check `CM6_AVAILABLE = !/jsdom/i.test(navigator.userAgent)` and render `TextareaFallback` with the same `data-role` and onChange contract. The hook itself doesn't gate on jsdom — `useCodeMirror.spec.jsx` exercises CM6 directly against jsdom for non-layout operations (doc state, dispatch, compartments, destroy). First spec in the repo to use `@testing-library/preact`'s `render`/`rerender`/`unmount`, because manual mount + microtask-flush didn't reliably commit the mount effect.

The four CM6 packages are pinned individually (`@codemirror/state`, `@codemirror/view`, `@codemirror/lang-json`, `@codemirror/commands`) rather than the meta `codemirror` package — avoids pulling HTML/CSS/Python/etc. language modes the app will never use.

**Historical gotcha (wired IIFE era):** postinstall used to rebuild `dist/splainer-search-wired.js` when missing. **Current:** the app imports `splainer-search/wired` as ESM; postinstall only checks that `wired.js` exists. If `yarn install` leaves an empty or partial `splainer-search` tree, fix the install — there is no separate library `dist/` build step in this repo anymore.

### 14a cleanup — Last IIFE

`settingsStore.js` still had one surviving IIFE wrapper (`var _lsSupported = (function(){ ... })()`) — an init pattern, not a module boundary. Converted to a named `detectLocalStorage()` function. Zero behavior change.

## Phase 15 — Cross-version audit and parity fixes

**Motivation.** `splainer.io` serves a frozen 2024-03-17 Angular build from S3 over plain HTTP. The `deangularize` branch needs a repeatable way to compare user-visible behavior against that build before cutover — manual screenshot comparison misses behavioral regressions, and the hermetic smoke suite explicitly mocks backends so it can't catch cross-environment differences. Phase 15 builds the audit tool, then iterates on the divergences it surfaces.

**Design principle:** assertions are **user-visible-text-based**, not selector-based. Prod uses Angular directives + `ng-include` partials; local uses Preact JSX with `data-role` hooks. Neither convention is portable, so the lowest-common-denominator is the text a human reader would see regardless of framework. Structural selectors are captured for review but not asserted on.

### 15a — Audit suite scaffolding

Three Playwright projects: `smoke-local` (existing hermetic mocked suite), `audit-prod` (live `http://splainer.io`), `audit-local` (live `http://localhost:5173`). Audit scenarios drive state via URL hash fragments — no interactive setup. Per-scenario capture writes a full-page screenshot, a `state.json` (structural snapshot, console log, network requests, framework-fingerprint booleans), all attached via `testInfo.attach` and wrapped in `try/finally` so a test that throws mid-wait still produces its diagnostics.

**Prod is HTTP, not HTTPS** — S3 doesn't terminate TLS; `https://splainer.io` returns a connection reset. The audit is comparing `deangularize` against a 2024-03-17 snapshot, not live `main`. **Prod has a latent non-default-query bug**: `solrSettingsSvc.fromParsedUrl` strips args via `removeUnsupported()` and defaults to `q=*:*` if empty, so `#?solr=...q=batman` renders Batman results but persists `q=*:*` back to the hash. deangularize is strictly more correct; documented as a known-prod-bug in the diff.

### 15b — Audit diff script, `data-role` unification, DocRow spacing

Three loosely-coupled changes from the same audit-driven review pass.

**`scripts/audit-diff.js`.** Walks audit result directories, pairs scenarios by name, emits a colorized per-scenario report. Set-based line diff, not Myers — prod and local can produce the same visible text in different DOM traversal orders, and a line-based diff would report false reorderings.

**`data-testid` → `data-role` unification.** `docRow.jsx`, `stackedChart.jsx`, and `docExplain.jsx` used `data-testid` (testing-library convention) while every other island used `data-role`. Unified to `data-role`. Deliberately kept `data-testid` in `useCodeMirror.spec.jsx` — it uses testing-library's `getByTestId()` API, a different concern.

**DocRow field-label spacing.** deangularize rendered `title:Foo`, prod rendered `title: Foo`. Root cause: JSX strips trailing whitespace adjacent to a closing tag, so `<label>{fieldName}: </label>` emitted just `title:`. Fix: `<label>{fieldName}:</label>{' '}<SanitizedSpan .../>`. `{' '}` survives JSX whitespace handling because it's an expression.

Audit divergence count: 172 → 56 on first clean run. Most of the drop was the spacing fix times ~10 rows times 7 scenarios.

### 15c — Hash encoding parity

**`encodeUriQuery` helper in `settingsStore.js`.** Runs `encodeURIComponent` then selectively unescapes `%40`, `%3A`, `%24`, `%2C`, `%3B` back to `@`, `:`, `$`, `,`, `;`. Mirrors Angular's `encodeUriQuery` exactly. Keeps URL hashes human-readable (`solr=http://host:8983/...` instead of `solr=http%3A%2F%2Fhost%3A8983`), which matters because splainer's entire UX is shareable URLs.

**`parseHash` in `main.js`.** Applies `value.replace(/\+/g, ' ')` before `decodeURIComponent`. Matches Angular's `$location.search()` treatment of `+` as space. Without this, bookmarks like `fieldSpec=id+title` parsed as the literal `"id+title"` instead of `"id title"`. The existing smoke test navigated to exactly this URL but only asserted a request fired, not that the field spec parsed correctly, so the regression had been silently present since Phase 12. The smoke test is now tightened to poll `localStorage['ls.solr_fieldSpecStr']` for `"id title"` after loading the hash.

### 15d — Overview-truncation upstream fix

**Bug (upstream, splainer-search 3.0.0).** `getHighlightSnippet` in `normalDocsSvc.js` pre-stringifies `subFieldValue` before calling `.slice(0, 200)`:

```js
var raw = subFieldValue == null ? '' : String(subFieldValue);
snip = escapeHtml(raw.slice(0, 200));
```

For multi-valued Solr fields like TMDB's `overview` (returned as a single-element array), this turned a no-op `Array.slice` into a real character truncation, cutting unhighlighted fields mid-sentence on `q=*:*`. The 2024 Angular build called `.slice(0, 200)` directly on the polymorphic value — on a 1-element array that's a no-op — and `escapeHtml`'s `String()` coercion produced the full joined text. An earlier refactor added `String()` as null-safety without realizing it was stepping on load-bearing polymorphism.

**Category: load-bearing accident** — `Array.slice` and `String.slice` share a name and argument shape but interpret the count parameter differently. A classic polymorphism footgun.

**Fix.** Reverted to polymorphic slice with a null guard kept intact. Upstream commit `975cd98`, splainer-search 616 → 618 tests. Regression tests cover array-wrapped and primitive-string field values separately. splainer.io `package.json` bumped to `#975cd98`; the postinstall rebuilds the wired IIFE automatically.

**Why upstream, not downstream.** The bug is strictly library-side.

### 15e — Audit reliability

Post-review hardening of the audit infrastructure. Generalized empty-results wait path (was hard-coded to `solr=`); tightened `expectMaxDocRows` loose-equality (missing field now means "no cap," not `<= undefined`); bumped the body-text-length poll to `intervals: [500]` to dodge the "Execution context was destroyed" race against Vite HMR and live-prod navigation. 

**Fix:** scenario-anchor wait before capture — after the generic "body has text" gate, wait for `scenario.expectBodyText[0]` to actually appear before capturing state. Eliminates the sporadic audit-prod flakes where the Search Controls panel hadn't rendered radio labels yet at capture time. Escalated into scope when it started blocking validation of the other fixes. `audit-diff.js` exit code on missing results directory changed from 0 to 1 — the `&&` chain in `yarn test:e2e:audit` otherwise falsely reported success on an audit that produced no output.

### 15f — `WeightExplain` docId upstream fix

**Bug (upstream).** `WeightExplain` in `services/queryExplainSvc.js` was leaking internal Lucene docIds into user-facing match labels. A description like `weight(text_all:batman in 2508) [DefaultSimilarity], result of:` produced the label `text_all:batman in 2508` instead of `text_all:batman` — so the stacked chart showed one row per docId instead of one aggregated row.

**Regression history** (two commits, not one):
- **`72367c2`** (2023, splainer-search: "add test for multiplicative boosts in Solr") replaced the working prod regex `/weight\((.*?)\s+in\s+\d+?\)/` with `/^weight\((?!FunctionScoreQuery).*/` — no capture group at all. `match[1]` was always undefined, the `if (match.length > 1)` branch was dead, and every weight description fell through to the raw full description. The author was fixing a multiplicative-boost handling issue and didn't realize the original `\s+in\s+\d+?\)` anchor was doing a second load-bearing job.
- **`eb2e09d`** (2026, splainer-search: Algolia / Search API / explain edge cases) partially restored with `/^weight\(((?!FunctionScoreQuery).*)\)/` — captured the inner argument, but the greedy `.*` with no docId anchor kept the tail `in 2508`. The commit comment even described the new (wrong) behavior as `"extract text:foo in 1234"`.

splainer.io's frozen 2024-03-17 S3 build predates `72367c2`, which is why prod showed correct behavior and the `deangularize` branch didn't.

**Category: another load-bearing accident.** The original `\s+in\s+\d+?\)` anchor did *two* things simultaneously — it cut off the docId tail from the captured group, and it structurally rejected descriptions that had no `in N` tail (like top-level `weight(FunctionScoreQuery(...))`), causing them to fall through to the else branch and keep their full description. The `FunctionScoreQuery` negative lookahead that the refactor added was redundant: `services/explainSvc.js:95` already routes top-level function-score weights to `ProductExplain` before they can reach `WeightExplain`.

**Upstream fix.** Restored `/^weight\((.*?)\s+in\s+\d+\)/` with an inline comment documenting why the anchor is load-bearing so the next refactor can't regress it a third time. A parameterized regression test covers four docId shapes plus the no-docId fall-through for `weight(FunctionScoreQuery(...))`. Upstream commit `45bfd2f`; splainer-search 618 → 620. splainer.io bumped to `#45bfd2f`.

**Audit impact.** 42 → 30 divergences. Every scenario now reports body-text identity between prod and local.

### 15g — Interactive scenarios + mobile viewport

**Schema change: `afterLoad` + two-phase wait.** Scenarios gain an optional `afterLoad(page)` callback that runs between the initial load wait and the anchor wait. The loop is now: `waitForScenarioLoad` → `scenario.afterLoad` → `waitForScenarioAnchor`. The anchor wait was also broadened from `expectBodyText[0]` to every item in the array, closing a flake where the first item settled fast but later items (like audit-prod's Search Controls radio labels) were still missing at capture time. **Rule:** if your wait predicate is narrower than your assertion predicate, you've built in a race.

**New scenarios.** `solr-detailed-explain-modal` hash-loads `q=*:*`, clicks the first Detailed link via `getByText('Detailed')`, waits for the `"Explain for"` modal header — covers the DocExplain path that hash-driven scenarios skip. `es-custom-headers-panel` boots empty, clicks the ES tab, opens Advanced Settings, waits for the `"Custom Headers"` heading.

**New project `audit-local-mobile`** (Pixel 5, local-only). Prod is frozen; doubling runtime for a side that can never change is negative ROI. Pixel 5 (Chromium) over iPhone 12 (WebKit) so CI doesn't pull WebKit and the variable isolates to viewport/isMobile rather than mixing in rendering-engine differences.

### 15h — Island parity polish

Three findings from 15g, each requiring a **direction check** before becoming a "fix" — the audit is framework-agnostic about which side is better, so every divergence needs categorizing as regression / improvement / prod bug / neutral noise.

1. **Bookmarkable engine tabs** (regression fix). The 2024 Angular build's `<a href="#es_">` tabs were intercepted by Bootstrap tab JS and Angular `$location`, which rewrote the hash to `#/es_` on click — the active tab was shareable via URL. Preact `useState` lost this. Added `parseTabHash()` / `writeTabHash()` in `startUrl.jsx`, matching the `#/(solr|es|os)_` format exactly. On mount: URL hash → `settings.whichEngine` → default `'solr'`. On click: `history.replaceState`, not `location.hash` assignment (don't accumulate one history entry per tab click). The `href` attribute is deliberately kept as `#<tab>_` without the leading slash — only the runtime-written hash uses `#/<tab>_`. This matches prod's source shape so `smoke.spec.js`'s `a[href="#es_"]` selector keeps working.

2. **CodeMirror 6 line numbers** (regression fix). Phase 14a's minimal extension set dropped `lineNumbers` by accident, not design. One-line fix: added `lineNumbers` to the `@codemirror/view` import and included `lineNumbers()` as the first entry in the extensions array.

3. **Detailed-explain modal close button** (improvement, kept). Prod's `$uibModal` has no close button at all — relies on ESC / backdrop click. The refactor added an explicit `<button class="close" aria-label="Close">×</button>` for discoverability. Direction check says prod has a usability gap; kept the button. Wrapped `×` in `<span aria-hidden="true">` so assistive tech reads "Close" instead of "multiplication sign."

Final audit state after 15h: 27/27 green, zero flakes across multiple consecutive runs. Body-text is fully identical across all scenarios. Remaining divergences are all framework fingerprints (`splainerServicesGlobal`, `angularFootprint`), prod's non-default-query round-trip bug (15a), and one intentional a11y improvement.

## Phase 16 — Mutation testing + CI floor

**Motivation.** Coverage-by-line is not bug-catching power. A shallow "does it render" test executes every line of a component without asserting a single user-visible contract. Stryker mutates the source and re-runs the tests; any surviving mutant is a line your tests execute but don't verify.

**Fresh baseline after `yarn stryker:full`:** 62.42% overall (797 killed / 390 survived / 2 timeout / 91 no-coverage). Services aggregate 77.63% (healthy); islands aggregate 56.22% (shallow). Hot files: `docExplain.jsx` 32%, `startUrl.jsx` 46%, `Search.js` 63%.

**Pragmatic triage.** A first-pass plan identified ~130 mutants across 10 areas. A second-pass review roughly halved it on three principles:

1. **Mutation score is descriptive up to ~70%, prescriptive beyond it.** Pinning the remaining 30% produces brittle tests on className strings and inline style props — they break on every cosmetic refactor.
2. **E2e is the real safety net for UI.** Smoke specs already drive CodeMirror in a real browser. Unit assertions that duplicate e2e coverage add maintenance cost without catching extra bugs.
3. **Structurally unreachable code needs annotations, not tests.** `CM6_AVAILABLE` guards and jsdom `showModal`-absence branches can't be killed from jsdom by construction. `// Stryker disable all` with a comment naming the e2e file is the right tool.

**What shipped.** 33 new Vitest cases across eight spec files, plus three Stryker annotation sites. High-value deltas: `docExplain.jsx` 32 → 65 (a new `describe('tab switching')` block that mounts the component and asserts which `<pre>` actually has `display: block` after each tab click — all three tabs live in the DOM simultaneously with CSS-hidden inactive panes, so the existing tests silently passed regardless of which tab was active); `Search.js` 63 → 82 (grouped-results round-trip, `page()` error handler coverage); `startUrl.jsx` 46 → 65 (nav tab active-class, `EngineAdvanced` per-pane gate); `customHeaders.jsx` 57 → 74 (`null` input guard, `headerType: undefined` default, byte-exact header round-trip through the onChange contract).

Overall 62.42% → 71.66%. Killed 797 → 886; survived 390 → 291; NoCoverage 91 → 61.

**Three Stryker annotations.** `startUrl.jsx` and `customHeaders.jsx` `CM6_AVAILABLE` guards; `useDialogModal.js` `if (typeof dlg.showModal === 'function')` branch. Only the conditionally-unreachable guards are annotated — the else-branches remain mutation-testable. Stryker disable comments are stripped by esbuild's minifier in production builds; verified zero bundle impact.

**CI floor enforced.** `stryker.config.json` `thresholds` was unset, so `break: null` meant Stryker never exited non-zero. Bumped to `{ high: 80, low: 60, break: 70 }`. Current 71.66% gives ~1.66 points of headroom — enough to absorb the known-upstream RuntimeError mutant on `docExplain.jsx:117`, tight enough that a meaningful test deletion trips the threshold.

**E2e coupling documented.** Added a header comment to `e2e/smoke.spec.js` calling out that the Stryker disable annotations are load-bearing — they silence mutants on code paths that only this e2e file covers, so deleting those flows uncovers mutation-testing gaps.

**Lesson that generalizes.** The `docExplain` spec had 12 passing tests, 93% line coverage, and a 32% mutation score — because every test read `.textContent` but none asserted which tab was visible. When a mutation report flags a JSX file as weak, the fix is almost never "write more mount tests" — it's "add assertions on user-visible behavior after an interaction."

## Phase 14b (pending) — CSP + localStorage namespace

With Ace gone, `script-src 'self'` CSP becomes possible via a `<meta>` tag — no server-side nonce needed for static S3 hosting.

---

## Appendix — Correctness fixes independent of the Angular removal

Two upstream splainer-search bugs surfaced by the cross-version audit were fixed in the library, not in splainer. Both were **load-bearing accidents** — a refactor replaced a working pattern with a "cleaner" version that looked equivalent but dropped an invariant nobody had commented as load-bearing.

| Phase | Bug | Symptom | Fix |
|---|---|---|---|
| 15d | `normalDocsSvc.getHighlightSnippet` pre-stringified multi-valued Solr fields before `.slice(0, 200)`, turning a no-op `Array.slice` into a real character truncation | Unhighlighted `overview` fields cut mid-sentence on `q=*:*` | Upstream `975cd98`: restore polymorphic slice with null guard; regression tests for array and string inputs |
| 15f | `WeightExplain` regex `/^weight\(((?!FunctionScoreQuery).*)\)/` greedy-captured the Lucene docId tail | Stacked chart showed one row per docId (`text_all:batman in 2508`, …) instead of one aggregated row | Upstream `45bfd2f`: restore `/^weight\((.*?)\s+in\s+\d+\)/`, parameterized regression covering four docId shapes |

Both fixes were SHA-bumped into splainer.io via `package.json` (`splainer-search.git#<sha>`).

**Later:** the app dropped the `splainer-search-wired.js` IIFE and global `URI` script in favor of `import { getDefaultWiredServices } from 'splainer-search/wired'` in `main.js` (Vite bundles splainer-search and its `urijs` dependency). `scripts/ensure-splainer-search.js` now only verifies `node_modules/splainer-search/wired.js` exists after install.
