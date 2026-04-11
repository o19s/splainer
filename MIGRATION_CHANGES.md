# Removing Angular from Splainer — Migration Options

**Context:** Splainer was an Angular 1.8.3 SPA (~1,336 LOC across 24 files: 8 controllers, 5 directives, 5 services, 12 templates) that consumes `splainer-search` 2.20.1 (Angular-wrapped IIFE) via the `o19s.splainer-search` module. We dropped Angular and consume the framework-agnostic `splainer-search` 3.0.0 (ESM + IIFE dist) from `../splainer-search`.

---

## Options Considered

- Preact + Vite
   - Pros: modern, fast dev loop, ecosystem; component model is natural successor to controllers + templates.
   - Cons: Still a framework, contributors need JSX literacy.
- React + Vite
   - Pros: modern, widely utilized, component model.
   - Cons: Overkill for this small of an application.
- Svelte or Vue + Vite
   - Pros: modern, fast dev loop.
   - Cons: Less widely adopted than React.
- Vanilla JS + tiny template helper
   - Pros: Smallest possible runtime (~5 KB), no transpilation required, no need to use source maps.
   - Cons: Loops/lists are more verbose; may not be familiar to individuals with a background in a componentized framework (React, Vue, Angular...).
   - Decision: Initially preferred for "minimum dependencies" — rejected when CustomHeaders proved verbose even at its simplest.
- Lit (Web Components) + Vite
   - Pros: Uses native web tech.
   - Cons: Adoption is still low.

## Migration Method
- Strangler Fig Pattern
   - Swap splainer-search 2.20.1 with 3.0.0 behind an Angular shim.
   - Replace views one at a time.

## Notes

> **localStorage holds connection settings** including custom headers (which can include API keys / basic auth). The migration is a good moment to (i) stop logging them, (ii) namespace the keys (`splainer:v3:*`) so an old XSS payload from a 2.x bundle can't read v3 secrets, (iii) document that this is *user-supplied* trust and Splainer is not a credential vault.

## Migration Phases

### **Phase 1 — Foundations.** ✅ *Done.* 
   - Prettier + ESLint configs, used to perform a formatting pass over the Angular codebase.
   - Dockerfile bumped from `node:14` → `node:20` and `libappindicator1` removed (gone from Debian Bookworm).

### **Phase 2 — Add Vitest alongside Karma.** ✅ *Done.* 
   - Vitest 4.x installed (matching `splainer-search` 3.0.0), `vitest.config.js` scoped to `src/**/*.{test,spec}.js`, `npm run test:new` script added, one proof-of-life spec at `src/smoke.test.js`. 
   - Existing Karma specs untouched and keep guarding Angular code until each controller is deleted.

### **Phase 3 — Playwright smoke flows.** ✅ *Done.* 
   - `@playwright/test` installed, `playwright.config.js` auto-boots `grunt serve` on :9000, 
   - 4 active smoke tests in `e2e/smoke.spec.js`: app-boots, URL-input-accepts-value, bookmarked-URL hash round-trip, and settings-persist-via-localStorage. 
   - Solr responses are mocked via `page.route('http://fake-solr.test/**')` returning canned JSON with CORS headers. 

### **Phase 4 — Bundler swap** for risk control. ✅ *Done.* 
   - `vite@^8` installed, `vite.config.js` with `root: 'app'`, `appType: 'mpa'`, and `configureServer` middleware shim that mirrors some of `Gruntfile.js`.
   - New script: `yarn dev:vite` serves on :5173. 
   - `SPLAINER_DEV=vite yarn test:e2e` runs the full smoke suite against Vite.
   - Grunt remains the default for `npm test` and the production build.

### **Phase 5 — `splainer-search` 2.20.1 → 3.0.0 behind an Angular shim factory.** ✅ *Done.* 
   - Add urijs dependency.
   - Dropped `o19s.splainer-search` from module dependencies.
   - Added `splainerSearchShim.js`, an Angular factory wrapper around `globalThis.SplainerSearchWired.getDefaultWiredServices()`.
   - `e2e/smoke.spec.js` was returning raw JSON from `page.route('http://fake-solr.test/**')`, but splainer-search 3.0.0 prefers JSONP for Solr (dynamic `<script>` injection), so the browser was trying toparse JSON as JavaScript and getting `Unexpected token ':'`. Fixed by reading `json.wrf` from the request URLand wrapping the response as `callback({...});` with `Content-Type: application/javascript`.
      - TODO: Is this correct behavior for splainer-search?
   - `splainerSearchShim.js` converted to Angular's array-injection form to match the rest of splainer's services and survive any minifier without `grunt-ngmin`.
   - `e2e/smoke.spec.js` console-error / pageerror spy lifted into a `beforeEach`/`afterEach` so every test failsloudly on any uncaught exception — this is the primitive that caught the JSONP bug, every test should get it for free.
   - `waitForTimeout(500)` in the persist test replaced with `expect.poll` (Playwright anti-pattern).
   - New Playwright test: `search error path surfaces an error message` — closes the highest-priority coveragegap left by the 6 xdescribe'd Karma specs (the `WAITING_FOR_SEARCH → IN_ERROR` transition). This is the highest-risk path under 3.0.0's promise-rejection contract; the test mocks Solr returning 500 and asserts the user sees error feedback.

### **Phase 6 — `CustomHeaders` island.** ✅ *Done.* 
   - First Preact JSX island. Establishes the patterns every subsequent Phase copies.
   - new `vite.islands.config.js` (Vite library mode build externalizing `preact` and `preact/hooks`, IIFE output to`app/scripts/islands/dist/`), 
   - new `app/scripts/islands/customHeaders.jsx` (Preact JSX with `useEffect`+`useRef` for Ace editor lifecycle,textarea fallback for jsdom)
   - new `app/scripts/islands/customHeaders.spec.js` (6 Vitest specs against the textarea fallback path), 
   - Added Preact, Testing Library, JSDom dependencies.
   - `build:islands`/`build:islands:watch` scripts; `test` script chains `yarn build:islands && grunt test` 
   - `vitest.config.js` (jsdom env, `resolve.alias` mapping `react/jsx*-runtime` → `preact/jsx*-runtime`)
   - `test/karma.conf.js` (load preact + hooks UMDs, exclude `.jsx` sources and `.spec.{js,jsx}` files)
   - `app/index.html` (load preact + preact/hooks UMDs and `scripts/islands/dist/customHeaders.js`)
   - `app/scripts/directives/customHeaders.js` (rewritten as shim that mounts the island on every `$watch` tick)
   - **deleted** `app/scripts/controllers/customHeaders.js`, `.gitignore` (`app/scripts/islands/dist/`)   
   - **Patterns established:**
      - island sources live at `app/scripts/islands/*.jsx`, built to `dist/*.js` IIFEs that attach to `window.SplainerIslands.<name>`
      - the Angular directive shim is the integration boundary — `link` function, deep `$watch`, idempotent `mount` on every digest, `$on('$destroy')` for cleanup;
      - Vitest specs import the `.jsx` source directly and use the textarea fallback for editor-style components
      - Karma loads the *built* island IIFE alongside the rest of `app/scripts/`. 
      - Total cost per future island: write `.jsx` + spec, add to `vite.islands.config.js` entries, copy-paste a 50-line directive shim. 
      - any island wrapping an imperative third-party library (Ace, CodeMirror, charts, etc.) needs three primitives: `useRef` for the library instance, `useRef` for the latest `onChange` prop updated via a no-deps `useEffect`, and `useRef` for an echo-suppression flag wrapped in `try/finally` around every programmatic mutation. Skip any of the three and you get stale-closure bugs, infinite loops, or silently dropped input.
   - any user-config feature should have one Playwright test that intercepts the outbound request and asserts the config landed on the wire — *not* internal scope mutation. Internal contract tests catch refactor regressions; outbound-request tests catch silent integration breaks.
   - **Vitest 4 OXC quirk worth recording:** Vitest 4 transitioned from esbuild to oxc for transforms; the documented `esbuild.jsxImportSource: 'preact'` config key is silently ignored (Vitest emits a "Both esbuild and oxc options were set. oxc options will be used" warning). The durable workaround across versions is a `resolve.alias` mapping `react/jsx-dev-runtime` and `react/jsx-runtime` to their Preact equivalents. 
   - added a Playwright test that opens the StartUrl ES tab, expands Advanced Settings, picks "API Key", and asserts the Ace editor body contains the API Key template — closes the highest-priority gap (zero browser-level coverage of the Ace lifecycle, the multi-call-site rendering, or the directive shim's `$watch` integration).
   - `package.json` `test:e2e` and `test:e2e:ui` now chain `yarn build:islands` so a stale or missing build can't silently break the suite.
   - Removed the defensive `|| {}` default on `scope.settings` in the directive shim — Angular's `scope: { settings:'=' }` declaration already guarantees the binding, the default was hiding caller bugs.
   - `AceEditor`'s change handler captured `onChange` in a stale closure from the first render — it was always calling the *first* `onChange` prop, never subsequent ones.  Fixed by tracking the latest prop in `onChangeRef`and updating it via `useEffect(() => { onChangeRef.current = onChange; })` rather than during render (a React anti-pattern).
   - An *echo loop*: when the value-sync `useEffect` called `editor.setValue()`, Ace fired its `change` event synchronously, our handler called back into Angular's `$apply` *during* the digest, the cycle got corrupted, and the editor body silently stayed empty after a header-type change. Fixed by adding a `suppressRef` flag wrapped in`try/finally` so a transient `setValue` throw can't strand the flag in the suppressed state and silently swallow user input.
   - Added `it.each(['None', 'Custom', 'API Key'])` parameterized Vitest spec covering the 3 settings shapes splainer's call sites use (Solr/OS default `None`, ES default `Custom`, plus the API Key template) — fast regression localization for any future change that breaks one shape but not the others
   - added Playwright test `configured custom headers reach the search backend on the actual HTTP request`.Intercepts the outbound ES request via `page.route('**/fake-es.test/**', ...)`, captures `route.request().header()`, configures custom headers in the UI (open ES tab → set URL → expand Advanced Settings → pick API Key), submits the search, and asserts `Authorization: ApiKey ...` is present in the captured request.
   - It validates the entire Phase 5 + 6 chain end-to-end (Preact island → Angular directive shim → `startesSettings` → `Search.js` factory → `splainerSearchShim` → splainer-search 3.0.0 wired services → fetch). 

### **Phase 7 — `Settings` island.** ✅ *Done* (commit `fea3d51`).
   - Second island; established the `useAceEditor` shared hook. 
   - Replaced `controllers/settings.js` + the 140-line `<form ng-controller="SettingsCtrl">` block in `app/index.html`. 
   - Playwright "outbound-request test as the merge gate" precedent set: the new `settings island: configured search args reach the backend on the wire` test intercepts the ES request, mutates the store, clicks Rerun, and asserts the marker landed in the captured body — end-to-end validation of the island → shim → `esSettingsSvc.fromTweakedSettings` → splainer-search 3.0.0 → fetch chain. 
   - Karma directive spec (`test/spec/directives/settings.js`) covers the three-engine `onPublish` dispatch branches that the single-engine Playwright test can't reach. 
   - **Pattern:** any island wrapping an imperative third-party library should use the shared `useAceEditor` hook rather than copy-pasting the ref machinery.

### **Phase 8 — `DocSelector` island.** ✅ *Done.* 
   - Third island; first non-form island and first island coexisting with an un-migrated Angular child directive (`<doc-row>`). The island owns only the altQuery form + error banner; the result list's `ng-repeat` over `currSearch.docs` rendering `<doc-row>` stays in the directive's inlined template, bridged by shared `currSearch` / `selectDoc` on the directive's isolate scope.
   - Logic lives in the shim, not the island — the directive shim absorbed the entire body of the old `DocSelectorCtrl.explainOther` (searcher construction, engine-specific arg parsing, extractor dispatch, `maxScore` ratcheting). The island is nearly pure UI.
   - **Pattern:** shim-heavy when the controller body is 100% Angular-service glue with no UI semantics; island-heavy when the reverse. 
   - **Playwright coverage** — two new smoke tests (`docSelector island: altQuery reaches the backend on the wire` and `docSelector island: backend error surfaces the error banner`) open the detailed-explain modal programmatically via `scope.doc.showDetailed()` on the first doc-row (bypassing the stacked-chart click-through, which couples to splainer-search's explain-tree parsing), then drive the DocSelector form and assert the outbound request. 
   - A Karma directive spec (`test/spec/directives/docSelector.js`, 8 tests) covers the shim's explainOther body across all three engine branches + a destroyed-scope regression test (the Playwright tests only exercise the Solr path).
   - **Gotchas worth remembering:**
      - the Karma spec uses **native Promises** (not `$q`) in fake searchers — `$q` resolves synchronously during `$apply` and collides with the shim's nested `$apply` inside `.then()`. Production is fine because splainer-search 3.0.0 uses native fetch.
      - The inlined template's `ng-repeat` compiles `<doc-row>` per result, so the spec overrides `<doc-row>` with a no-op directive stub via `$compileProvider.directive('docRow', ...)` — duck-typing fake docs to satisfy the real `DocRowCtrl` would balloon the test.
      - **Destroyed-scope guard added to the shim** (`if (scope.$$destroyed) return;` at the top of the post-resolution `.then`). The directive lives on an isolate scope inside the detailed-explain modal, which can close mid-request; the isolate scope is shorter-lived than the old controller's parent scope, so the race window is strictly *wider* than it was before — without the guard, the follow-up `$apply` throws and the Playwright pageerror spy fires on every subsequent test.

### **Phase 8.5 — Test-hook prep for PR 9.** ✅ *Done.* 
   - Adds `data-testid` attributes on the *outgoing* Angular templates so the chart-click Playwright test can be written and merged against known-good code, then survive the next phase rewrite unchanged.
   - `e2e/smoke.spec.js` (new test `clicking stacked-chart Detailed link opens the explain modal` — clicks the Detailed link via testid with no `scope.*` shortcut, asserts modal header visible, asserts body contains the explain string `weight(title:canned` from the canned Solr response, **then asserts ESC closes the modal**). 

### **Phase 9a — `DocRow` island (split mode).** ✅ *Done* (commit `ba46fa3`).
   - Fourth island; first **split** shim — neither shim-heavy nor island-heavy. 
   - The island owns rendering (title, snippets, thumbnail, image, child chart slot); the shim opens both `$uibModal.open(...)` calls (Detailed explain + show raw doc) and `$compile`s the still-Angular `<stacked-chart>` child into a slot the island provides via a `registerChartHost` callback. 
   - **First inversion of the integration boundary** — Preact-parent / Angular-child instead of the other way around. Bounded to a single phase by design: 9b makes stacked-chart its own island and the inversion goes away. 
   - new `app/scripts/islands/docRow.jsx` (~165 lines) including DOMPurify-backed `SanitizedSpan` / `SanitizedAnchor` wrappers; 
   - new `app/scripts/islands/docRow.spec.js` (12 specs incl. 3 XSS regressions); 
   - new `app/scripts/islands/README.md`
   - rewritten `app/scripts/directives/docRow.js` (~190-line shim, the bulk being the chart-host plumbing); 
   - deleted `app/scripts/controllers/docRow.js`
   - `package.json` (added `dompurify ^3.3.3`, exact pin per Security's "pin everything"); 
   - `vite.islands.config.js` (added `docRow` entry); 
   - `app/index.html` (added `<script src="scripts/islands/dist/docRow.js"></script>`); 
   - new Karma directive spec `test/spec/directives/docRow.js` (~290 lines, 13 tests covering shim wiring + modal openers + chart-compile path + destroy); 
   - deleted the cross-framework `currSearch.docs` / `selectDoc` bridge from Phase 8 (the load-bearing payback of 9a). 
   - **Patterns:**
      - the SanitizedSpan/SanitizedAnchor split — two named wrappers instead of one polymorphic `<SanitizedHtml tag={...}>`, because a string-typed `tag` prop is an injection footgun;
      - DOMPurify is required for any island that previously had `ng-bind-html`, the XSS regression tests are the merge gate;
   - **Hooks layout reversal:** Phase 9 mandated `app/scripts/islands/hooks/`; landed flat (`app/scripts/islands/useDialogModal.js`, etc.) instead, matching where `useAceEditor.js` already lived from Phase 7. 
   - **Known issues deferred to 9bc**: deep `$watch('doc', rerender, true)` is O(doc-size) per digest tick (mitigation candidates: `$watchCollection` after verifying mutate-in-place assumption, or watch a stable identity property); latent closure leak on `doc.showDetailed` (preserved from the old controller, fixed when the modal pattern moves to `<dialog>` and the doc-mutation is replaced by a prop callback); `$watchGroup(['doc', 'maxScore'], rerender)` would collapse two watchers into one; `SettingsStoreSvc` engine allowlist is hardcoded in two places (`directives/docRow.js` resolve and `directives/docSelector.js`).

### **Phase 9bc → split into 9b/9c/9d.** The original Phase 9 treated 9bc as a single PR; split into three after confirming it was too large for one review. 
   - **Locked decision:** 9b (StackedChart) → 9c (dialog pattern + DetailedDoc) → 9d (DocExplain + final deletes).

#### **Phase 9b — `StackedChart` island.** ✅ *Done.*
- Fifth island; smallest and most reversible of the 9bc trio. Replaces the still-Angular `<stacked-chart>` directive with a Preact island; the docRow island renders `<StackedChart>` directly as a JSX child instead of providing a chart-host slot for `$compile` injection. **The chart-host inversion bridge from 9a is gone** (it was transitional).
- new `app/scripts/islands/stackedChart.jsx`
- new `app/scripts/islands/stackedChart.spec.jsx` (7 specs including a malicious-description XSS regression — first `.spec.jsx` in the suite, vitest config already accepted the extension)
- modified `app/scripts/islands/docRow.jsx` (renders `<StackedChart>` as a child, all `useRef`/`useLayoutEffect`/`registerChartHost` plumbing deleted, JSDoc trimmed from 50 lines to 8, `mount()` collapsed to default-param + spread)
- modified `app/scripts/islands/docRow.spec.js` (3 chart-host tests deleted, 3 chart-aware tests added, new `makeDocWithChart()` helper to keep chart-agnostic tests decoupled from the chart's render shape); modified `app/scripts/directives/docRow.js` (190-line shim collapsed to 96 — chart-compile machinery deleted, JSDoc trimmed, dead `if (!scope.doc) return;` defensive guard deleted, redundant explicit-first-render `rerender()` deleted, `var allowed` allowlist still duplicated with `directives/docSelector.js` because 9b doesn't touch the latter); 
- modified `test/spec/directives/docRow.js` (2 chart-host Karma tests + 1 dead duplicate destroy test deleted, new `onShowDetailed` prop test added). 
- **Patterns**
   - **`.spec.jsx` extension** when a spec wants to render JSX directly rather than via the island's `mount()` export;
   - **Preact 10 batches state updates via debounced microtask** — tests that click a button and assert post-state DOM need `await new Promise(r => setTimeout(r, 0))` after the click;
   - **never introduce Preact-parent / Angular-child inversions, even temporarily** — the chart-host bridge was scoped to one phase by 9a's plan and bounded by 9b's delivery; future migrations should migrate the child the same phase. 

#### **Phase 9c — Native `<dialog>` modal pattern + DetailedDoc island.** ✅ *Done* (commit `458279b`). 
   - Established the `useDialogModal` hook and the `modalRegistry.js` global `openDocModal(kind, doc, opts)` entry point. 
   - DetailedDoc island replaces `controllers/detailedDoc.js` + `views/detailedDoc.html`. 
   - The docRow shim's `openShowDoc` switched from `$uibModal.open` to `openDocModal('detailedDoc', ...)`. 
   - New Playwright test `clicking a doc-row title opens the detailed doc view with field data`.

#### **Phase 9d — DocExplain island + final deletes.** ✅ *Done.* 
   - Migrated the explain-tree modal (three tabs, alt-doc compare, alt-query form with nested DocRow result list) to a Preact island. 
   - **`explainOther` moved again in Phase 10** into `directives/searchResults.js` (DocExplain receives it as a prop from the search-results shim). `scope.doc.showDetailed` mutation removed (closure-leak fix). 
   - Deep `$watch` kept (mutate-in-place verified). 
   - **Deleted (9 files):** `controllers/detailedExplain.js`, `directives/stackedChart.js`, `directives/docSelector.js`, `islands/docSelector.jsx` + spec, `views/detailedExplain.html`, `views/stackedChart.html`, `test/spec/directives/docSelector.js`. 
   - Redundant Playwright test deleted (subsumed by 8.5 canary + Vitest). 
   - **Behavior diffs (intentional):** Full Explain tab renders `<pre>` with pretty-printed JSON instead of `<json-explorer>` tree; nested alt-doc title-click sets altDoc without opening a stacked modal (bugfix); maxScore no longer ratchets across queries (old code flagged this as "latent oddity"). 

#### **`StartUrl` island + `SolrSettingsWarning` auxiliary.** ✅ *Done.* 
   - Replaced `controllers/startUrl.js` + `views/startUrl.html` with `app/scripts/islands/startUrl.jsx` (three tabs, `CustomHeaders` + `useAceEditor` for ES/OS advanced settings) and `directives/startUrl.js`. 
   - Solr URL warnings for missing `wt=json` live in `solrSettingsWarning.jsx`, imported by `searchResults.jsx` and **bundled into** `dist/searchResults.js` (a separate `vite.islands.config.js` entry also emits `dist/solrSettingsWarning.js` for symmetry / direct testing; `index.html` only needs the searchResults script).

### **Phase 10 — `SearchResults` island (results pane).** ✅ *Done.* 
   - `app/views/searchResults.html` removed; the pane is `<search-results-island curr-search="currSearch">` mounting `searchResults.jsx`, which renders search states (`WAITING_FOR_SEARCH`, `IN_ERROR`, `DID_SEARCH`), doc list, grouping, query details, and pagination, with `DocRow` and `SolrSettingsWarning` as JSX children. 
   - **`SearchResultsCtrl` is intentionally still present** (~40 LOC): it owns `currSearch` (`splSearchSvc.createSearch`), `search.search()` / `search.reset()`, and resetting the query-detail toggles when those run; the island holds only local toggle state for parsed vs raw JSON (`useState`). 
   - **`explainOther`** (splainer-search service wiring) lives in `directives/searchResults.js` and is passed into the island and into DocExplain. 
   - Vitest: `app/scripts/islands/searchResults.spec.jsx`. 

### **Phase 11 — Extract services to ESM (edge-in order).**

#### **Phase 11a — Easy extractions: `esSettingsSvc`, `osSettingsSvc`, `splSearchSvc`.** ✅ *Done.*
   - Established the **two-file extraction pattern**: each Angular service becomes a pure ESM module (the real logic, testable with Vitest, importable by islands) plus a thin Angular wrapper (reads from `globalThis.SplainerServices.*`, keeps DI working during transition). Same strangler-fig approach the islands use with `globalThis.SplainerIslands.*`.
   - `angular.forEach` → `Array.prototype.forEach`, `angular.isDefined(x)` → `x !== undefined`, `angular.isString(x)` → `typeof x === 'string'` — all semantically equivalent for the data types in this code (verified line-by-line).
   - `splSearch.js` exports `states`, `engines`, and `createSearch(Search, settings, overridingExplains)`. The `Search` constructor is passed as a parameter so the module has no Angular dependency; the wrapper injects the Angular `Search` factory and passes it through.
   - `esSettings.js` and `osSettings.js` are near-identical URL parsers differing only in `whichEngine` value. Kept separate to minimize blast radius; merge is a future refactoring opportunity.
   - **Build integration:** `vite.islands.config.js` gained a `services` array and `servicesDistDir`; `configFor` takes `isService` flag to skip Preact externals and use `SplainerService_` IIFE prefix. `build-islands.mjs` processes `[...islands, ...services]`.
   - new `app/scripts/services/esSettings.js`, `osSettings.js`, `splSearch.js` (pure ESM modules)
   - new `app/scripts/services/esSettings.spec.js` (9 Vitest specs), `osSettings.spec.js` (9 specs), `splSearch.spec.js` (5 specs)
   - rewritten `app/scripts/services/esSettingsSvc.js`, `osSettingsSvc.js`, `splSearchSvc.js` (thin Angular wrappers)
   - modified `vite.islands.config.js`, `scripts/build-islands.mjs`, `app/index.html` (3 service dist scripts load before Angular wrappers), `test/karma.conf.js` (exclude ESM sources + Vitest specs), `vitest.config.js` (include `app/scripts/services/**/*.spec.js`), `.gitignore` (added `app/scripts/services/dist/`)
   - **Test coverage:** credentials-in-URL branch and multi-query-param iteration covered for both ES and OS (previously untested in any layer). OS round-trip test (fromStartUrl → tweak → fromTweakedSettings) added — ES already had this in Karma.
   - **Karma integration test validates the wrapper chain:** Karma loads `dist/esSettings.js` (IIFE, sets global) → `esSettingsSvc.js` (Angular wrapper, reads global) → `test/spec/services/esSettingsSvc.js` (4 Jasmine specs). All 24 Karma tests pass through the new delegation layer.

#### **Phase 11b — Medium extraction: `solrSettingsSvc`.** ✅ *Done.*
   - Same two-file extraction pattern as 11a: pure ESM module (`solrSettings.js`) + thin Angular wrapper (`solrSettingsSvc.js`).
   - **Dependency strategy:** `solrUrlSvc` and `fieldSpecSvc` (from `splainerSearchShim`) are passed as leading parameters to the pure module's exported functions — same dependency-injection-via-params pattern established by `splSearch.js` accepting the `Search` constructor. The Angular wrapper injects both from DI and threads them through; callers see the same 2–3 argument API as before.
   - `angular.forEach` (1 call, iterating `fieldSpec.subs`) → `Array.prototype.forEach`. Safe: `subs` is always an array when `!== '*'` (guaranteed by `fieldSpecSvc.createFieldSpec`).
   - `angular.copy` (1 call, deep-cloning `parsedUrl.solrArgs`) → `JSON.parse(JSON.stringify(...))`. Safe: `solrArgs` is `{string: string[]}` — no `undefined`, `Date`, `RegExp`, or circular refs.
   - Wrapper converted from implicit injection (`function(solrUrlSvc, fieldSpecSvc)`) to array-injection form (`['solrUrlSvc', 'fieldSpecSvc', function(...)]`) — survives minification without `ngmin`.
   - **Files (2 new, 4 modified):**
      - new `app/scripts/services/solrSettings.js` (pure ESM module, ~87 lines)
      - new `app/scripts/services/solrSettings.spec.js` (11 Vitest specs: URL parsing, newline formatting, default fieldSpec, override fieldSpec, wildcard subs, explicit subs fl inclusion, deep-clone safety)
      - rewritten `app/scripts/services/solrSettingsSvc.js` (thin Angular wrapper, ~35 lines)
      - modified `vite.islands.config.js` (added `solrSettings` to `services` array)
      - modified `app/index.html` (added `dist/solrSettings.js` script tag, loads after `splainer-search-wired.js` and before the Angular wrapper)
      - modified `test/karma.conf.js` (added `solrSettings.js` to ESM exclude list)
   - **Test coverage:** deep-clone safety test verifies `JSON.parse(JSON.stringify(...))` doesn't mutate the original `parsedUrl.solrArgs` (the whole reason `angular.copy` was used). `subs === '*'` branch (wildcard fieldSpec → no `fl` in rebuilt URL) now covered — previously untested in any layer.
   - **Karma integration tests (7 specs) unchanged** — validate the full chain: `dist/solrSettings.js` (IIFE, sets global) → `solrSettingsSvc.js` (wrapper, injects `solrUrlSvc`/`fieldSpecSvc` from DI, reads global) → `test/spec/services/solrSettingsSvc.js`. All 24 Karma tests pass.
   - **Design note:** `fromStartUrl` accepts `fieldSpecSvc` as a parameter but doesn't use it (only `fromTweakedSettings` does, via `reconstructFullUrl`). Kept for uniform signature across both exports — the wrapper curries both services identically, which is simpler than per-function param lists for zero runtime cost.

#### **Phase 11c — Hard extraction: `settingsStoreSvc` → standalone `SettingsStore`.** ✅ *Done.*
   - **The keystone.** Every shim directive deep-watched `settingsStoreSvc.settings`; every search action flows through it. Same two-file extraction pattern as 11a/11b: pure ESM module (`settingsStore.js`) + thin Angular wrapper (`settingsStoreSvc.js`).
   - Replaced `localStorageService` (Angular plugin, `angular-local-storage` ~0.7.1) with native `localStorage` API. The `ls.` key prefix is preserved for back-compat — `angular-local-storage`'s default config prefixes every key with `ls.` (prefix `'ls'` + separator `'.'`), and the app never called `setPrefix()`, so all existing user data sits under `ls.*` keys. `lsGet` handles both JSON-encoded values (written by `angular-local-storage` via `JSON.stringify`) and bare strings (possible legacy data) via a `JSON.parse` try/catch fallback.
   - Replaced `$location.search()` with direct `window.location.hash` writes using manual `encodeURIComponent` serialization. `URLSearchParams` was rejected because it encodes spaces as `+` (per the `application/x-www-form-urlencoded` spec), but Angular's `$location.search()` uses `decodeURIComponent` which does NOT decode `+` as space — spaces must be `%20`. `buildHashString` also skips `null`/`undefined` values, matching Angular's `$location.search(obj)` behavior (which omits keys with nullish values).
   - **Reactive binding replacement:** `subscribe(fn) → unsubscribe` replaces Angular's deep `$watch` on `settingsStoreSvc.settings`. This is the architectural pivot point where Angular's reactivity model stops being load-bearing for settings changes. Preact signals were rejected as premature — they'd couple the "pure module" to Preact. EventTarget was equivalent but more verbose. The subscribe callback list fires on every `save()` call.
   - Shim directives bridge by subscribing in `link` and calling `scope.$applyAsync(rerender)` on notification. `$applyAsync` (not `$apply`) because `save()` can be called from inside a `.then()` that fires within an existing `$apply` — nesting `$apply` throws `$digest already in progress`; `$applyAsync` coalesces into the next digest cycle.
   - `_lsSupported` cached at module init via IIFE — the old code checked `localStorageService.isSupported` (a cached boolean); the new code avoids a write+remove test on every `save()`.
   - `startUrl: ''` added to all three engine sub-object defaults (solr/es/os). The old code left `startUrl` undefined in the initial object (only populated from localStorage). Combined with the `buildHashString` null guard, this prevents encoding `undefined` as the literal string `"undefined"` in the URL hash.
   - URL bootstrap (reading `$location.search()` on page load) intentionally kept in `directives/startUrl.js` — moving it to the store would change timing (currently runs after Angular bootstraps and the directive links) and require the store to understand search-trigger side effects (`runSolr`, `runEs`, `runOs`). Moves to the store in Phase 12 when directives are deleted.
   - Key namespace migration (`splainer:v3:*`) intentionally deferred to Phase 14 — changing key names is a breaking change requiring a migration path (read old keys, write new, delete old) and would cause real user pain if snuck into a refactor.
   - **Files (2 new, 7 modified):**
      - new `app/scripts/services/settingsStore.js` (pure ESM module, ~200 lines)
      - new `app/scripts/services/settingsStore.spec.js` (22 Vitest specs: init defaults, JSON-encoded load, bare-string back-compat, convenience methods, localStorage round-trip, URL hash encoding with %20, undefined-in-URL guard, subscribe/unsubscribe, ENGINES constant)
      - rewritten `app/scripts/services/settingsStoreSvc.js` (thin Angular wrapper, ~30 lines, down from 157)
      - modified `app/scripts/directives/settings.js` (deep `$watch` → `subscribe` + `$applyAsync`, `unsub()` on `$destroy`)
      - modified `app/scripts/directives/startUrl.js` (deep `$watch` → `subscribe` + `$applyAsync`, `unsub()` on `$destroy`)
      - modified `vite.islands.config.js` (added `settingsStore` to `services` array)
      - modified `app/index.html` (added `dist/settingsStore.js` script tag)
      - modified `test/karma.conf.js` (added `settingsStore.js` to ESM exclude list)
      - rewritten `test/spec/services/settingsStoreSvc.js` (6 Karma specs testing wrapper delegation: settings identity, ENGINES constant, save delegation, subscribe/unsubscribe, settings shape, subscribe-fires-on-save)
   - **Karma singleton note:** the IIFE creates one `settingsStore` instance for the entire Karma run (unlike Angular DI which re-instantiated per `module()` call). Currently safe — no Karma test depends on initial `whichEngine` state. Resolves itself in Phase 12 when Angular DI is removed.
   - **`headerType` not persisted** — confirmed this matches the old code exactly. `headerType` was never saved/loaded from localStorage; it resets to defaults on every page load (`'None'` for solr/os, `'Custom'` for es). Not a regression.

#### **Phase 11d — Hard extraction: `Search` factory → pure constructor.** ✅ *Done.*
   - Same two-file extraction pattern as 11a–c: pure ESM module (`services/Search.js`) + thin Angular wrapper (`factories/Search.js`).
   - **Kept as constructor function** — not converted to ES6 class. Every other Phase 11 extraction used factory functions; consistency wins over style.
   - **Deps-bag pattern:** the four splainer-search services (`solrUrlSvc`, `fieldSpecSvc`, `searchSvc`, `normalDocsSvc`) are packed into a single `deps` object by the Angular wrapper and passed as the first constructor parameter. The pure module never touches Angular DI.
   - **Angular wrapper returns a curried constructor:** `WrappedSearch(settings, explains, states, engines)` calls `new SearchCtor(deps, settings, explains, states, engines)` and returns the result. `new WrappedSearch(...)` transparently produces a `SearchCtor` instance because JavaScript's `new` operator uses the explicitly returned object when a constructor returns one.
   - **`$q.defer()` removed (×2):** `search()` and `page()` return the native Promise chain from `self.searcher.search().then(...)` directly. No `async/await` needed.
   - **`angular.fromJson` (×2) → `JSON.parse`**, `angular.copy` (×2) → two-level `Object.assign` (settings snapshot) / `JSON.parse(JSON.stringify(...))` (grouped results), **`angular.forEach` (×4) → native `.forEach` / `Object.keys().forEach`**. `catch (SyntaxError)` shadowing the global constructor renamed to `catch (e)`.
   - **Settings snapshot:** `angular.copy(searchSettings)` replaced with a two-level `Object.assign` that preserves the top-level methods (`searchUrl`, `fieldSpecStr`, `searchArgsStr`) while isolating nested engine sub-objects (`solr`, `es`, `os`). `JSON.parse(JSON.stringify(...))` was rejected because it silently strips functions.
   - **Digest integration for `page()`:** the old `$q.defer().resolve()` inside `page()`'s `.then()` callback triggered an Angular digest via `$evalAsync`. With native Promises the `.then()` fires as a microtask outside Angular's digest cycle. The directive's `onPage` callback now chains `.then(fn, fn)` on the returned promise and calls `scope.$applyAsync()` in both resolve and reject paths so the `$watchGroup` picks up state changes. `search()` didn't need this fix — the controller wraps it in its own `$q.defer()` which triggers the digest.
   - **`page()` error handling (intentional improvement):** the old code had no error handler — if `searcher.search()` rejected during pagination, the `$q` deferred stayed forever-pending and the UI froze. The new code adds a `pageFailure` handler that sets `IN_ERROR` state, clears `paging`, and surfaces the error message.
   - **Latent bug fixed:** `self.state = self.IN_ERROR` in the old `page()` error path referenced an instance property set post-construction by `splSearch.createSearch()`. Replaced with `states.IN_ERROR` (the canonical constant available during construction). Functionally equivalent at runtime but semantically correct.
   - **Files (2 new, 5 modified):**
      - new `app/scripts/services/Search.js` (pure ESM module, ~230 lines)
      - new `app/scripts/services/Search.spec.js` (20 Vitest specs: constructor, reset, hasGroup, moreResults, getOverridingExplain, search success/failure/engine-dispatch/JSON-fallback, page success/error/null-pager, settings snapshot isolation)
      - rewritten `app/scripts/factories/Search.js` (thin Angular wrapper, ~40 lines, down from 214)
      - new `test/spec/factories/Search.js` (4 Karma specs: wrapper type, instance methods, initial state, globalThis delegation)
      - modified `app/scripts/directives/searchResults.js` (`onPage` chains `.then(fn, fn)` → `$applyAsync` for digest trigger)
      - modified `vite.islands.config.js` (added `Search` to `services` array)
      - modified `app/index.html` (added `dist/Search.js` script tag after `dist/settingsStore.js`)
      - modified `test/karma.conf.js` (added `Search.js` to ESM exclude list)
   - **Phase 11 is now complete.** All Angular services and factories are extracted to pure ESM modules with thin Angular wrappers. Phase 12 (remove shim directives + controller) can proceed.

### **Phase 12 — Remove Angular: shim directives, controller, DI, and all Angular deps.** ✅ *Done.*
   - **New file: `app/scripts/bootstrap.js`** (~200 lines, IIFE). Replaces `SearchResultsCtrl`, all 5 directive shims, `dispatchOnClick`, `app.js` module wiring, `splainerSearchShim.js`, and all Angular service wrappers. Responsibilities:
      1. Obtains service refs from `globalThis.SplainerServices.*` and `SplainerSearchWired.getDefaultWiredServices()`.
      2. Creates a curried `WrappedSearch` constructor (packs `{ solrUrlSvc, fieldSpecSvc, searchSvc, normalDocsSvc }` deps bag — same role as `factories/Search.js`).
      3. Creates `currSearch` + `search` facade (`.search()`, `.reset()`) — absorbed from `SearchResultsCtrl`.
      4. Defines `explainOther(altQuery)` — non-trivial business logic (~20 lines) absorbed from the `searchResults` directive shim. Uses 5 splainer-search services (`searchSvc`, `solrUrlSvc`, `fieldSpecSvc`, `solrExplainExtractorSvc`, `esExplainExtractorSvc`) directly from the `wired` bag. Replaces `angular.fromJson` → `JSON.parse`.
      5. Defines `onPage()` with dual-render pattern: `renderAll()` synchronously (show paging spinner), then `currSearch.page().then(renderAll, renderAll)` on completion.
      6. Defines `onPublish(whichEngine, workingSettings)` — absorbed from `settings` directive shim. Dispatches `fromTweakedSettings` to the matching engine service. **Asymmetry:** `solrSettings.fromTweakedSettings` requires `solrUrlSvc` + `fieldSpecSvc` as leading params (the Angular wrapper curried these); `esSettings`/`osSettings` do not.
      7. Defines `onSearch(engine)` — absorbed from `startUrl` directive shim. Fires `$(document).trigger('openEast')` for pane auto-open (jQuery stays; removal deferred to Phase 13).
      8. Parses `window.location.hash` on boot for bookmark URLs (replaces `$location.search()`). **Must use `decodeURIComponent`**, not `URLSearchParams` — `URLSearchParams` decodes `+` as space, but Angular's `$location.search()` used `decodeURIComponent` which doesn't. Mismatch would break bookmarked URLs with spaces encoded as `%20`.
      9. Mounts all three page-level islands (`searchResults`, `startUrl`, `settings`) into `<div id="...">` mount points.
      10. Provides a `renderAll()` function that re-mounts all islands with current state (Preact's reconciler diffs cheaply). Called: after `search()` resolves (after setting `currSearch.engine`), after `reset()`, on `page()` start + completion, on `store.subscribe` callback, and on boot.
      11. Subscribes to `store.subscribe(renderAll)` for settings reactivity — replaces Angular `$watch`/`$applyAsync` bridge.
      12. Tracks a `sidebarOpen` boolean for the Tweak-button chevron toggle (replaces `$scope.devSettingsSolr.sidebar`). Fires `$(document).trigger('toggleEast')` on click.
      13. Binds `onclick` handlers for the navbar: Splainer logo → `closeEast` + `search.reset()`; Tweak button → `toggleEast` + chevron flip.
   - **`index.html` rewrite:**
      - Removed `ng-app="splain-app"` from `<body>`.
      - Removed `ng-controller="SearchResultsCtrl"` from `div.pane_container`.
      - Replaced `<search-results-island>`, `<start-url-island>`, `<settings-island>` custom elements with `<div id="search-results-mount">`, `<div id="start-url-mount">`, `<div id="settings-mount">`.
      - Replaced all `ng-show` with `id` attributes + `style="display:none"` toggled by `renderAll()`.
      - Replaced `ng-click` and `dispatch-on-click` with `id` attributes bound in `bootstrap.js`.
      - Replaced `ng-class` chevron toggles with `id` attributes updated by `bootstrap.js`.
      - Removed `ng-json-explorer` CSS (line 11) — detailedDoc island handles JSON via Preact `<pre>`.
      - Removed all Angular `<script>` tags: `angular.js`, `angular-sanitize.js`, `angular-local-storage`, `angular-ui-bootstrap`, `angular-ui-ace`, `ng-json-explorer`.
      - Removed all Angular shim/wrapper script tags: `app.js`, `splainerSearchShim.js`, `factories/Search.js`, all 5 directives, all 5 `*Svc.js` wrappers, `controllers/searchResults.js`.
      - Added `<script src="scripts/bootstrap.js"></script>` after island/service dist scripts and before `ace-config.js`.
      - Updated `<!-- build:js -->` comment blocks for Grunt `useminPrepare` compatibility.
   - **Deleted files (17):**
      - Directives: `customHeaders.js`, `dispatchOnClick.js`, `searchResults.js`, `settings.js`, `startUrl.js`
      - Controllers: `searchResults.js`
      - Angular service wrappers: `settingsStoreSvc.js`, `splSearchSvc.js`, `solrSettingsSvc.js`, `esSettingsSvc.js`, `osSettingsSvc.js`
      - Angular app module: `app.js`
      - Angular shim: `splainerSearchShim.js`
      - Angular factory wrapper: `factories/Search.js`
      - Karma tests: `test/spec/directives/settings.js`, `test/spec/factories/Search.js`, `test/spec/services/esSettingsSvc.js`, `test/spec/services/solrSettingsSvc.js`, `test/spec/services/settingsStoreSvc.js`
      - Karma mocks: `test/mock/mockExplain.js`, `test/mock/mockHelpers.js`, `test/mock/mockLocalStorageService.js`, `test/mock/mockLocationSvc.js`
      - Karma config: `test/karma.conf.js`, `test/karma.debug.conf.js`
   - **Deleted directories:** `app/scripts/directives/`, `app/scripts/controllers/`, `app/scripts/factories/`, `test/spec/`, `test/mock/`
   - **Modified `package.json`:** removed from `dependencies`: `angular`, `angular-local-storage`, `angular-sanitize`, `angular-ui-ace`, `angular-ui-bootstrap`, `ng-json-explorer`. Removed from `devDependencies`: `angular-mocks`, `grunt-karma`, `grunt-ngmin`, `jasmine-core`, `karma`, `karma-chrome-launcher`, `karma-coverage`, `karma-jasmine`, `puppeteer`. Updated `test` script: `yarn build:islands && vitest run` (was `yarn build:islands && grunt test`).
   - **Modified `Gruntfile.js`:** removed `karma` task config, removed `ngmin` task config, removed `karma:unit` from `jsTest` watcher tasks and `test` task, removed `ngmin` from `build` task.
   - **Modified `ace-config.js`:** updated comment on line 8 (no functional change).
   - **Gotchas worth remembering:**
      - `explainOther` is non-trivial business logic, not a pass-through — uses 5 splainer-search services directly and must be carefully ported.
      - `solrSettings` API is asymmetric with `esSettings`/`osSettings` — requires `solrUrlSvc` + `fieldSpecSvc` as leading params. The Angular wrappers curried these; the bootstrap passes them explicitly.
      - Paging requires dual renders (synchronous for spinner, async for results) — without this the UI freezes during pagination.
      - `$q.defer()` pattern in `SearchResultsCtrl` is unnecessary — `currSearch.search()` already returns a native Promise (splainer-search 3.0.0). Bootstrap uses it directly.
      - The `customHeaders` island is NOT mounted by `bootstrap.js` — it is rendered as a JSX child by the `startUrl` and `settings` islands internally. No top-level mount point needed.
      - Grunt's `useminPrepare` reads `<!-- build:js -->` blocks from `index.html` — these blocks must be updated or the prod build breaks. Full Grunt removal deferred to Phase 13.
      - **Chevron `ng-class` merge semantics:** Angular's `ng-class` *merges* dynamic classes with the static `class` attribute — it never removes static classes. Naively replacing `ng-class` with `element.className = ...` *replaces* everything, silently stripping static classes. The Tweak button's right chevron had a static `class="glyphicon glyphicon-chevron-right"` that `ng-class` never touched — the initial implementation dropped it when toggling. Fix: keep the right chevron class constant (it was always `glyphicon glyphicon-chevron-right` in the old app). The left chevron toggles correctly (it had no static class).
      - `ng-scope` class on the header element was added by Angular at runtime, never in the source HTML — do not hardcode it.
   - **Playwright e2e tests:** 2 tests that accessed Angular internals via `window.angular.element(...).injector().get('settingsStoreSvc')` were updated to use the public `window.SplainerServices.settingsStore` API. Stale Angular references in test comments (`$apply`, `$digest`, `settingsStoreSvc`, `directive shim`, `ng-repeat`) updated throughout. All 14 tests pass.
   - **Vitest specs pass unchanged** — they test pure ESM modules and Preact islands directly, no Angular dependency.

### **Phase 13a — Vite production build + retire Grunt + remove jQuery.** ✅ *Done.*
   - **Roundtable review** (2026-04-10) revised the original Phase 13 plan. Key adjustments: (1) "single Vite entry point" downscoped — the IIFE/globals architecture stays; a copy-based build script replaces Grunt's pipeline without converting to ESM imports; (2) jQuery removal confirmed — audit found only 26 calls across 3 files, all low-complexity native DOM replacements; (3) Phase split into 13a (build swap) and 13b (optional ESM conversion).
   - **jQuery removal.** Rewrote `panes.js` (~8 calls: `$(el).show()`/`.hide()` → `el.style.display = 'block'`/`'none'`, `$(document).on()` → `document.addEventListener()`), `ace-config.js` (~15 calls: `$('#id')` → `getElementById`, `$('.class')` → `querySelectorAll`, `.height()` → `.offsetHeight`/`.style.height`, `$(function(){})` → self-executing IIFE), `bootstrap.js` (3 conditional `jQuery(document).trigger()` → `document.dispatchEvent(new CustomEvent(...))`). Removed `jquery ~3.6.1` from `dependencies`.
      - **Gotcha:** jQuery's `.show()` detects the element's natural display value; naively replacing with `el.style.display = ''` (clearing inline style) falls back to the CSS stylesheet's `display: none` for `.pane_east` and `.east-slider`. Fix: use `'block'` explicitly.
   - **Bootstrap JS removed.** Bootstrap 3.x's JavaScript is a jQuery plugin system (`$.fn.tooltip`, `$.fn.modal`, etc.) — it throws immediately if jQuery is absent. Audit confirmed the only usage was `data-toggle="tooltip"` on the help link (converted to plain `title` attribute). All modals migrated to native `<dialog>` in Phase 9c, tabs managed by Preact state in startUrl island. Only Bootstrap CSS is retained.
   - **Production build script** (`scripts/build.mjs`). The app uses plain `<script>` tags (IIFE globals, not ES modules), so Vite's module-aware `vite build` can't process it directly — it skips non-`type="module"` script tags and leaves broken path references. Instead, a straightforward Node script does what Grunt's `copy:app` + `copy:dist` did:
      1. Runs `yarn build:islands` (pre-builds island/service IIFEs).
      2. Copies `app/` to `dist/`.
      3. Cherry-picks vendor files from `node_modules/` into `dist/node_modules/` (ace, Bootstrap CSS + fonts, URI.js, splainer-search, Preact UMD). Only files actually referenced by HTML `<script>`/`<link>` tags are copied — no wholesale `node_modules/` dump.
      - `--quick` flag skips island rebuild (assumes already built).
      - Image optimization skipped — the project has exactly 2 images (a GIF loader and a small PNG logo).
   - **Removed `<!-- build:js -->` / `<!-- build:css -->` comment blocks** from both HTML files — Grunt/usemin-specific syntax.
   - **Cleaned up `help.html`** — removed stale `ng-json-explorer` CSS reference (library deleted in Phase 12), removed `ng-scope` class from header (added by Angular at runtime, never in source).
   - **Removed IE cruft** from `index.html`: `<!--[if lt IE 7]>` browsehappy message, `oldieshim.js` build block (es5-shim + json3 conditional scripts).
   - **Deleted legacy dependencies (21 packages):**
      - From `dependencies`: `jquery ~3.6.1`, `es5-shim ~4.6.7`, `json3 ~3.3.3`.
      - From `devDependencies`: `grunt`, `grunt-concurrent`, `grunt-contrib-clean`, `grunt-contrib-concat`, `grunt-contrib-connect`, `grunt-contrib-copy`, `grunt-contrib-cssmin`, `grunt-contrib-htmlmin`, `grunt-contrib-imagemin`, `grunt-contrib-uglify`, `grunt-contrib-watch`, `grunt-filerev`, `grunt-newer`, `grunt-postcss`, `grunt-svgmin`, `grunt-usemin`, `load-grunt-tasks`, `time-grunt`, `serve-static`. Also removed orphaned `autoprefixer` (no postcss.config.js existed).
   - **Deleted `Gruntfile.js`** (325 lines).
   - **Updated `playwright.config.js`** — default server command changed from `'grunt serve'` (port 9000) to `'yarn dev:vite'` (port 5173). Removed the `SPLAINER_DEV=vite` override toggle (Vite is now the only server).
   - **Updated `Dockerfile`** — removed `grunt-cli` install, Puppeteer/Chromium dependencies (were for Karma browser tests, deleted in Phase 12). New flow: `yarn install` → `yarn build` → `yarn test`. CMD runs `yarn dev:vite --host 0.0.0.0` for local/Docker usage; production deploy is static files via S3.
   - **Updated `.circleci/config.yml`** — `publish-splainerio` job now extracts `dist/` from the Docker container (`docker cp $id:/home/splainer/dist ./app`) instead of raw `app/` + wholesale `node_modules/`. The S3 sync (`aws s3 sync ./app s3://splainer.io/ --delete`) is unchanged.
   - **Updated `package.json` scripts** — added `"build": "node scripts/build.mjs"` and `"dev": "vite"` (alias for `dev:vite`).
   - **Updated comments** in `vite.config.js` and `vite.islands.config.js` — removed stale Grunt/Angular references.
   - **Files (1 new, 10 modified, 1 deleted):**
      - new `scripts/build.mjs`
      - modified `app/scripts/panes.js`, `app/scripts/ace-config.js`, `app/scripts/bootstrap.js`, `app/index.html`, `app/help.html`, `package.json`, `playwright.config.js`, `Dockerfile`, `.circleci/config.yml`, `vite.config.js`, `vite.islands.config.js`
      - deleted `Gruntfile.js`
   - **Net reduction:** ~5,800 lines (mostly yarn.lock shrinkage from 21 removed dependencies).
   - **Test coverage:** 183 Vitest specs pass, 14 Playwright e2e tests pass. The 3 sidebar-interaction e2e tests (settings rerun, engine switch, search args layout) caught the `.show()` → `display: ''` bug during implementation.

### **Phase 13a cleanup — Dead code removal, DRY, and bug fixes.** ✅ *Done.*
   - **DRY: merged `esSettings.js` / `osSettings.js`** — the two files were 97% identical (same `parseUrl`, `fromStartUrl`, `fromTweakedSettings` with only `whichEngine` differing). Extracted shared logic into `jsonEngineSettings.js` with a `createJsonEngineSettings(engine)` factory. Both files are now thin wrappers (~19 lines each, down from ~70). Since each service is built as a separate IIFE, the shared module is inlined at build time — no new runtime dependency ordering.
   - **Dead CSS removed from `main.css`** — removed 9 unused selectors left over from the Angular migration: `.header`, `.marketing`, `.container-narrow`, `.jumbotron`, `.jumbotron .btn`, `.starter-URL`, `.popover`, `.modal-content`, `.selectableDoc:hover`, `.tweak-button small`, `.tweak-button small a`. Merged the duplicate `.footer` blocks that resulted from the cleanup.
   - **Bug fix: `useDialogModal` double-fire `onClose`** — the `close()` function could fire the `onClose` callback twice (once via the dialog's event, once explicitly). Added a `closedRef` idempotency guard inside the hook so callers don't need their own.
   - **Bug fix: sidebar chevron desync** — `sidebarOpen` (bootstrap.js, controls chevron icons) and `toggled` (panes.js, controls pane visibility) would desync when "Splain This!" opened the sidebar via `openEast`. After that, every Tweak click showed reversed chevrons. Fix: set `sidebarOpen = true` and update chevrons in `onSearch` before dispatching `openEast`.
   - **Removed dead Universal Analytics snippet** from `index.html` — the `analytics.js` / `UA-` property was sunset by Google in July 2023; the script loaded on every page for zero value.
   - **Added `rel="noopener"` to `target="_blank"` links** across `index.html`, `help.html`, and `searchResults.jsx` — defense-in-depth for the user-URL-sourced `currSearch.linkUrl` links.
   - **DRY: `persistToLocalStorage` loop** (`settingsStore.js`) — replaced 15 hand-written `lsSet` calls with a loop over `PERSIST_ENGINES` × `PERSIST_FIELDS`, matching the load side's existing iteration pattern. Eliminates the risk of adding a field to load but forgetting save (or vice versa).
   - **DRY: `formatJson` utility** — extracted the `JSON.stringify(JSON.parse(str), null, 2)` + try/catch pattern (repeated in `docExplain.jsx`, `settings.jsx`, `startUrl.jsx`) into a shared `formatJson.js` module. Each island IIFE inlines it at build time.
   - **DRY: ES/OS `JSON.parse` collapse** (`Search.js`) — merged two identical try/catch branches (differing only by `es`/`os`) into a single `if (engine === 'es' || engine === 'os')` using the already-resolved `activeSettings.searchArgsStr`.
   - **Files (2 new, 10 modified):**
      - new `app/scripts/services/jsonEngineSettings.js`, `app/scripts/islands/formatJson.js`
      - modified `app/scripts/services/esSettings.js`, `app/scripts/services/osSettings.js`, `app/scripts/services/settingsStore.js`, `app/scripts/services/Search.js`, `app/styles/main.css`, `app/scripts/islands/useDialogModal.js`, `app/scripts/islands/docExplain.jsx`, `app/scripts/islands/settings.jsx`, `app/scripts/islands/startUrl.jsx`, `app/scripts/bootstrap.js`, `app/scripts/islands/searchResults.jsx`, `app/index.html`, `app/help.html`
   - **Test coverage:** 183 Vitest specs pass (no test changes required). Expanded to 201 in Phase 13a test hardening (below).

### **Phase 13a test hardening — CI gate, new specs, shared test infrastructure.** ✅ *Done.*
   - **CI test gate.** The CircleCI pipeline built Docker images and deployed to splainer.io without ever running `yarn test`. Added a `test` job (`cimg/node:20.18`, `yarn install --frozen-lockfile`, `yarn test`) as a prerequisite of `build` — merges to `main` are now gated on passing tests. Added `restore_cache`/`save_cache` keyed on `yarn.lock` checksum for `node_modules/` and `~/.cache/yarn`.
   - **Deleted dead test artifacts.** Removed empty `test/vitest/` and `test/e2e/` directories (leftover from the Karma era). Removed `src/smoke.test.js` (proof-of-life spec whose own comment said "delete this once a real module under src/ has its own tests" — 18 real spec files now exist). Preserved `test/splainer_test_links.html` (manual QA cheat-sheet with bookmarkable Solr/ES demo URLs).
   - **New `formatJson.spec.js`** (4 tests) — direct unit coverage for the `formatJson` pure function: valid JSON → pretty-printed, invalid JSON → returned unchanged, empty string → unchanged, nested objects with nulls. Previously only exercised implicitly through `searchResults.spec.jsx`.
   - **New `jsonEngineSettings.spec.js`** (15 tests) — direct unit coverage for `parseUrl()` (protocol/host/pathname extraction, query-string parameters, percent-decoding, no-query-string edge case) and `createJsonEngineSettings()` (`fromStartUrl`: engine assignment, searchUrl extraction, match_all default, searchArgsStr preservation, stored_fields extraction, fieldSpec defaulting, startUrl reconstruction, existing fieldSpec preservation; `fromTweakedSettings`: searchUrl→startUrl, stored_fields append/omit). Previously tested only indirectly through `esSettings.spec.js` and `osSettings.spec.js`.
   - **Shared dialog polyfill** — extracted the identical `installDialogPolyfill()` function (patching `HTMLDialogElement.prototype.showModal/close` for jsdom) from `docExplain.spec.jsx`, `detailedDoc.spec.jsx`, and `useDialogModal.spec.jsx` into `app/scripts/test-helpers/jsdom-dialog-polyfill.js`, loaded via `vitest.config.js` `setupFiles`. Runs before every spec file — no per-file boilerplate needed.
   - **Shared test factories** (`app/scripts/test-helpers/factories.js`) — centralized two patterns duplicated across 9+ spec files:
      - `makeRoot()` — creates a `<div>` appended to `document.body` for island mounting. Replaced inline copies in `docExplain.spec.jsx`, `detailedDoc.spec.jsx`, `docRow.spec.js`, `searchResults.spec.jsx`, `settings.spec.js`, `customHeaders.spec.js`, `stackedChart.spec.jsx`, `useDialogModal.spec.jsx`, `solrSettingsWarning.spec.js`, `startUrl.spec.js`.
      - `makeSearchDoc(overrides)` — creates a minimal splainer-search doc fake covering the full interface (`score()`, `getHighlightedTitle()`, `subSnippets()`, `hasThumb()`, `hasImage()`, `explain()`, `hotMatches()`). Config keys (`explainToStr`, `explainRaw`, `hotStr`, `score`) are destructured out and used to build closures — they don't leak onto the result object via spread. `score` accepts both functions (`score: () => 1.5`) and scalars (`score: 1.5`) — scalars are auto-wrapped. Adopted by `docExplain.spec.jsx`, `docRow.spec.js`, `searchResults.spec.jsx`. `detailedDoc.spec.jsx` keeps its own `makeDoc` (different shape — simple `{id, title, subs}` object, not the splainer-search interface).
   - **Stale comments removed** from `vitest.config.js` — references to "PR 10.5" and Grunt (both completed/deleted in earlier phases).
   - **Files (4 new, 13 modified):**
      - new `app/scripts/test-helpers/jsdom-dialog-polyfill.js`, `app/scripts/test-helpers/factories.js`, `app/scripts/islands/formatJson.spec.js`, `app/scripts/services/jsonEngineSettings.spec.js`
      - modified `.circleci/config.yml`, `vitest.config.js`, `app/scripts/islands/docExplain.spec.jsx`, `app/scripts/islands/detailedDoc.spec.jsx`, `app/scripts/islands/useDialogModal.spec.jsx`, `app/scripts/islands/docRow.spec.js`, `app/scripts/islands/searchResults.spec.jsx`, `app/scripts/islands/settings.spec.js`, `app/scripts/islands/customHeaders.spec.js`, `app/scripts/islands/stackedChart.spec.jsx`, `app/scripts/islands/solrSettingsWarning.spec.js`, `app/scripts/islands/startUrl.spec.js`
      - deleted `src/smoke.test.js`, `test/vitest/` (empty), `test/e2e/` (empty)
   - **Test count:** 183 → 201 (−1 deleted smoke spec, +4 formatJson, +15 jsonEngineSettings). All 201 pass. 14 Playwright e2e tests unaffected.

### **Phase 13b — ESM module conversion.** ✅ *Done.*
   - Converted from IIFE globals (`window.SplainerIslands.*`, `window.SplainerServices.*`) to ES module imports with a single entry point (`app/scripts/main.js`).
   - **`main.js`** absorbs all of `bootstrap.js`'s orchestration logic, importing islands, services, panes, and ace-config as ESM. Replaces 15 `<script>` tags with one `<script type="module" src="scripts/main.js">`.
   - **`panes.js`** converted from IIFE to ESM — exports `openEast`, `closeEast`, `toggleEast` so `main.js` calls them directly instead of going through `CustomEvent` dispatch.
   - **`ace-config.js`** converted from IIFE to ESM side-effect module (imported by `main.js`, runs on import).
   - **`modalRegistry.js`** rewritten from IIFE + `window.SplainerIslands.openDocModal` to ESM — imports `detailedDoc` and `docExplain` directly, exports `openDocModal`. `searchResults.jsx` imports it instead of reading from window global.
   - **Removed `globalThis` assignments** from all 14 island/service source files.
   - **`vite.config.js`** converted from `appType: 'mpa'` (IIFE mode) to standard Vite ESM dev+build with Preact JSX support and `resolve.alias` for `react/jsx-*-runtime` → Preact equivalents.
   - **`scripts/build.js`** rewritten to use `vite build` + selective vendor copy for IIFE scripts (ace, urijs, splainer-search).
   - **Vendor scripts** (ace, urijs, splainer-search) remain as plain `<script>` tags — they have no ESM exports. Preact UMD tags removed (Vite bundles Preact from ESM imports).
   - **`index.html`** reduced from 143 lines / 18 script tags to 120 lines / 5 script tags (4 vendor + 1 module).
   - **`package.json`** — added `"type": "module"` so all `.js` files are ESM by default. Renamed `.mjs` files to `.js` (`scripts/build.js`, `scripts/ensure-splainer-search-dist.js`, `eslint.config.js`). Removed `build:islands` / `build:islands:watch` scripts (no longer needed — Vite processes ESM imports directly). Simplified `test` and `test:e2e` scripts (no pre-build step).
   - **`eslint.config.js`** (renamed from `.mjs`) — updated base rule from `sourceType: 'script'` to `sourceType: 'module'` for all `app/scripts/**/*.js`. Removed redundant per-directory overrides, stale `test/**/*.js` block, `Gruntfile.js` glob, and `islands/dist/**` ignore.
   - **Removed `'use strict'`** from all ESM files (redundant — ES modules are always strict).
   - **Comment cleanup** — removed stale Angular/directive/Phase/PR references from file headers, inline comments, and test descriptions across 22 files. Rewrote `app/scripts/islands/README.md` to describe the current ESM architecture.
   - **`modalRegistry.spec.js`** rewritten with `vi.mock` for island modules — restores full unmount/renderInto assertion coverage (7 tests, up from the interim 5). Handles module-level `current` state leaking between tests via `lastHandle` cleanup.
   - **`searchResults.spec.jsx`** mocks `modalRegistry.js` module via `vi.mock` instead of stubbing `globalThis.SplainerIslands.openDocModal`.
   - **Test-only global retained:** `window.SplainerServices.settingsStore` is set in `main.js` for Playwright e2e access.
   - **Deleted files (5):** `vite.islands.config.js`, `scripts/build-islands.mjs`, `app/scripts/bootstrap.js`, `app/scripts/islands/dist/` (directory), `app/scripts/services/dist/` (directory).
   - **Test count:** 202 Vitest (+1 net: 7 restored modalRegistry tests − 6 in interim), 14 Playwright e2e — all pass.
   - **Build output:** single `main-*.js` bundle (69 KB, 24 KB gzip) + vendor scripts. Vite bundles all CSS into one file.

### **Phase 14 — Security follow-up.** DOMPurify already covers all former `ng-bind-html` sites (landed in 9a).
   - **Phase 14a — Replace Ace with CodeMirror 6** (unblocks strict CSP). Ace uses `new Function()` internally, requiring `'unsafe-eval'` in any CSP. CodeMirror 6 is CSP-clean. Scope: one new `useCodeMirror` hook, three island updates (`customHeaders.jsx`, `startUrl.jsx`, `settings.jsx`), delete `ace-config.js`, update e2e tests. CM6 is ESM-first — bundle as part of `main.js` via Vite (no separate IIFE build needed post-13b).
   - **Phase 14b — Add strict CSP + optional localStorage key namespace.** With Ace gone, `script-src 'self'` CSP becomes possible via a `<meta>` tag (no server-side nonce needed for static S3 hosting). `localStorage` key namespace (`ls.*` → `splainer:v3:*`) is low-value — optional, requires migration path for existing users.
