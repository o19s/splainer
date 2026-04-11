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
   - **CI test gate.** The CircleCI pipeline built Docker images and deployed to splainer.io without ever running `yarn test`. Added a `test` job (`cimg/node:20.19`, `yarn install --frozen-lockfile`, `yarn test`) as a prerequisite of `build` — merges to `main` are now gated on passing tests. Added `restore_cache`/`save_cache` keyed on `yarn.lock` checksum for `node_modules/` and `~/.cache/yarn`.
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

### **Phase 13c — Post-migration cleanup: drop `WrappedSearch` shim.** ✅ *Done.*
   - **Removed `WrappedSearch` from `main.js`.** Phases 11a/11d/12 above describe a curried constructor (`function WrappedSearch(settings, explains, states, engines) { return new Search(deps, settings, explains, states, engines); }`) that packed the deps bag at a call site where `createSearch` didn't know about deps. With the Angular wrapper gone and `main.js` as the sole consumer, threading `deps` through `createSearch` directly is strictly simpler and removes the `new`-returns-object trick that Phase 11d relied on.
   - **Signature change:** `createSearch(Search, settings, overridingExplains)` → `createSearch(Search, deps, settings, overridingExplains)`. The pure module (`splSearch.js`) now passes `deps` as the first constructor argument directly; `main.js` imports `{ Search }` from `./services/Search.js` and calls `createSearch(Search, deps, store.settings)` at both the boot site and `search.reset()`.
   - **Test fake updated:** `FakeSearch(settings, explains, st, eng)` → `FakeSearch(deps, settings, explains, st, eng)` in `splSearch.spec.js`. Added `expect(search._deps).toBe(fakeDeps)` assertion to pin the deps-passing contract — without it, the fake would silently accept the new argument order and lose coverage of what `createSearch` is supposed to thread through.
   - **No behavior change.** The new call path is byte-equivalent to the old one at the `Search` constructor entry point. Both boot-time instantiation and `search.reset()` produce a `Search` instance with the same `deps`, `settings`, `overridingExplains`, `states`, and `engines` arguments as before. State-constant attachment (`NO_SEARCH`, `DID_SEARCH`, `WAITING_FOR_SEARCH`, `IN_ERROR`) still happens in `createSearch` post-construction; `Search.js` continues to use the closure-captured `states` parameter internally (see the "latent bug fixed" note in Phase 11d — still load-bearing).
   - **Phase 11a/11d/12 descriptions of `WrappedSearch` and the old `createSearch` signature are intentionally left in place** as historical record of what each phase looked like at the time. This entry supersedes them for the current state of the code.
   - **ESLint hygiene fix:** added `.test-dist/**` to the `ignores` array in `eslint.config.js`. The Stryker mutation-test runner emits instrumented copies of the source tree into `.test-dist/` (gitignored), and ESLint was picking them up with bogus `no-undef` errors for `window`/`document`/`localStorage`/`setTimeout` because that directory doesn't match any `files` block with browser globals. `yarn lint` now exits 0 on a clean tree.
   - **Files (3 modified, 1 config):** `app/scripts/main.js`, `app/scripts/services/splSearch.js`, `app/scripts/services/splSearch.spec.js`, `eslint.config.js`.
   - **Test count:** 202 Vitest (unchanged — one test renamed from "passes states and engines" → "passes deps, states and engines"), 14 Playwright e2e (unchanged). All pass.

### **Phase 14a — Replace Ace with CodeMirror 6.** ✅ *Done.*
   - **Rationale:** Ace uses `new Function()` internally, which requires `'unsafe-eval'` in any Content Security Policy. CodeMirror 6 is CSP-clean, smaller (≈35KB gzipped for the minimal set used here vs ≈400KB of Ace vendor scripts loaded eagerly), and ESM-first — so Vite bundles it into `main.js` instead of requiring separate `<script>` tags.
   - **Scope correction:** the Phase 14 forecast above (pre-implementation) said "three island updates (`customHeaders.jsx`, `startUrl.jsx`, `settings.jsx`)". Only TWO consumers actually used Ace — `customHeaders.jsx` and `startUrl.jsx`. `settings.jsx` uses a plain `<textarea>` and always has; the forecast was wrong. Verified by grep before implementing.
   - **Dead code deleted: `ace-config.js`.** The old resize-polling side-effect module targeted element IDs (`es-query-params-editor`, `os-query-params-editor`) that don't exist anywhere in the current DOM — the real editors use `data-role` attributes. The module ran on every page load, polled for a non-existent `#queryParams` element every 500ms, and silently no-op'd for an unknown stretch of time. Removed outright rather than ported.
   - **New hook: `app/scripts/islands/useCodeMirror.js`.** API mirrors the old `useAceEditor` shape intentionally — `(value, onChange, { readOnly, tabSize, useWrapMode })` — so consumer diffs were one-line import swaps. Internals:
      - Same three-ref pattern (`viewRef`, `onChangeRef`, `suppressRef`) for the echo-loop guard during external value sync.
      - One-shot `useEffect` (`[]` deps) creates the `EditorView` on mount; value-sync effect dispatches a `changes` transaction on prop change instead of tearing down the view; readOnly-sync effect uses a `Compartment.reconfigure` for runtime swapping.
      - Extension set: `history`, `json`, `keymap([indentWithTab, ...defaultKeymap, ...historyKeymap])`, `EditorState.tabSize`, the readOnly compartment, a small theme injecting `height: 100%` and `overflow: auto` on `.cm-scroller` (so the caller's fixed-height container fills correctly), and an `updateListener` that fires `onChange` for user edits but not for echo-dispatches.
      - **e2e escape hatch:** the EditorView is stashed on the container DOM node as `container.__cmView` on mount and deleted on unmount. Playwright specs read the current document via `container.__cmView.state.doc.toString()` — replacing the old `window.ace.edit(container).getValue()` pattern.
   - **jsdom gate preserved at the consumer level.** Both `customHeaders.jsx` and `startUrl.jsx` now check a module-level `CM6_AVAILABLE` constant (`!/jsdom/i.test(navigator.userAgent)`) instead of `typeof window.ace !== 'undefined'`. When false, they render the existing `TextareaFallback` component — same `data-role` attributes, same onChange contract, so all existing Vitest specs kept passing unchanged. The hook itself doesn't gate on jsdom; the new `useCodeMirror.spec.jsx` exercises it directly in jsdom and proves CM6 runs there for non-layout operations (doc state, dispatch, compartments, destroy).
   - **New spec: `useCodeMirror.spec.jsx`** (9 tests). Uses `@testing-library/preact`'s `render`/`rerender`/`unmount` (first spec in this repo to do so) because manual `render(..., root)` + microtask-flush didn't reliably commit the mount effect — `testing-library/preact` knows how to wait for Preact's effect queue. Coverage: mount+__cmView exposure, initial value, value re-sync without view tear-down, echo-loop suppression, user-edit onChange, latest-prop propagation (no stale closure), readOnly initial, readOnly runtime toggle, unmount cleanup.
   - **`index.html`** — deleted both Ace `<script>` tags (`ace.js` and `ext-language_tools.js`). The latter was vestigial: it set up Ace's language-tools extension but the app never used autocomplete. Remaining vendor scripts: just `urijs` + `splainer-search-wired`.
   - **`main.js`** — removed the `import './ace-config.js';` side-effect import. Header comment updated to drop "ace" from the vendor-globals list.
   - **`scripts/build.js`** — removed 4 vendor-copy entries (`ace.js`, `ext-language_tools.js`, `worker-json.js`, `mode-json.js`). Header comment updated.
   - **`e2e/smoke.spec.js`** — the `window.ace.edit(container).getValue()` read at line ~195 is replaced with `container.__cmView && container.__cmView.state.doc.toString()`, with the textarea-fallback path preserved for symmetry. Comment at line ~155 updated to say "where CodeMirror 6 is active" instead of "where window.ace is loaded".
   - **`package.json`** — `ace-builds` removed; `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-json`, `@codemirror/commands` added. Deliberately chose the four individual packages over the meta `codemirror` package to avoid pulling in HTML/CSS/Python/etc. language modes the app will never use.
   - **Stale comments fixed** in `settings.spec.js`, `startUrl.spec.js`, `customHeaders.jsx` (the `// jsdom has no window.ace ...` framing was already slightly wrong because `settings.jsx` never used Ace at all).
   - **Files (1 new hook, 1 new spec, 9 modified, 2 deleted):**
      - new `app/scripts/islands/useCodeMirror.js`, `app/scripts/islands/useCodeMirror.spec.jsx`
      - modified `app/scripts/islands/customHeaders.jsx`, `app/scripts/islands/startUrl.jsx`, `app/scripts/main.js`, `app/index.html`, `scripts/build.js`, `e2e/smoke.spec.js`, `app/scripts/islands/settings.spec.js`, `app/scripts/islands/startUrl.spec.js`, `package.json`
      - deleted `app/scripts/ace-config.js`, `app/scripts/islands/useAceEditor.js`
   - **Test count:** 211 Vitest (+9 new `useCodeMirror` specs), 14 Playwright e2e (unchanged — smoke.spec.js line 149 now exercises the real CM6 view in Chromium). All pass.
   - **Known gotcha for future contributors:** the `scripts/ensure-splainer-search-dist.js` postinstall builds `node_modules/splainer-search/dist/splainer-search-wired.js` only when the marker file is missing. If something wipes `dist/` without removing the marker (which happens if you `rm -rf dist/` manually, or if a `yarn remove` cycle clears it), `yarn add` and `yarn remove` will skip the rebuild and the app will fail to boot in the browser with `TypeError: Cannot read properties of undefined (reading 'getDefaultWiredServices')`. Workaround: run `node scripts/ensure-splainer-search-dist.js` directly. Not caused by this phase — the skip-if-present guard has been there since Phase 11a — but flagged because this migration is the first phase to hit it (unit tests don't touch the wired IIFE, only e2e does).

### **Phase 14a cleanup — Remove the last IIFE.** ✅ *Done* (commit `0fc4811`).
   - Tiny stylistic follow-up to Phase 13b's ESM conversion. `settingsStore.js` still had one IIFE wrapper (`var _lsSupported = (function () { ... })();`) that escaped the Phase 13b sweep because it was an initialization pattern, not a module boundary.
   - Converted to a named `detectLocalStorage()` function plus a separate call: `var _lsSupported = detectLocalStorage();`. Zero behavior change, zero new tests — the existing `settingsStore.spec.js` suite covers the caller path unchanged.
   - Files: `app/scripts/services/settingsStore.js` (5 lines changed).

### **Phase 15 — Cross-version audit + parity fixes.**

**Motivation:** splainer.io still runs the 2024-03-17 frozen Angular build from S3 (`http://splainer.io`, not HTTPS — the S3 bucket doesn't terminate TLS). The deangularize branch needs a repeatable way to compare user-visible behavior between the two builds before cutover — manual screenshot comparison misses behavioral regressions, and the existing hermetic smoke suite explicitly mocks backends so it can't catch cross-environment differences at all. Phase 15 builds that audit tool, then iterates on the divergences it surfaces.

**Design principle carried throughout:** assertions are **user-visible-text-based**, not selector-based. Prod uses Angular directives and `ng-include` partials; local uses Preact JSX islands with `data-role` hooks. Neither convention is portable across frameworks, so the lowest-common-denominator assertion surface is text that a human reader would see regardless of rendering engine. Structural selectors are captured in the attachment for diff review but not asserted on.

#### **Phase 15a — Initial Playwright audit suite.** ✅ *Done* (commit `0f1eec9`).
   - new `e2e/audit.spec.js` (394 lines), modified `playwright.config.js` (44 lines).
   - **Three Playwright projects:** `smoke-local` (existing hermetic mocked suite, localhost:5173), `audit-prod` (live `http://splainer.io`), `audit-local` (live `http://localhost:5173`). `testMatch` filters route `smoke.spec.js` to the local project and `audit.spec.js` to both audit projects.
   - Audit scenarios drive state via URL hash fragments (no interactive setup). Initial set: `boot` and `solr-tmdb-default` (q=*:* against the Quepid TMDB demo endpoint embedded in splainer's defaults).
   - **Per-scenario capture:** full-page screenshot + a `state.json` with structural snapshot (title, URL, hash, engine-tab/radio selectors, `data-role` hook presence, body text length/sample/full, framework-fingerprint booleans for `servicesWired` and `angularFootprint`) + console log + network request list. All three attached via `testInfo.attach` so they land in `playwright-report/` grouped by project.
   - **Wait strategy:** `page.goto` uses `waitUntil: 'domcontentloaded'` (avoids blocking on analytics/CDN subresources that can stall against live prod). `expect.poll` on body-text length to confirm the app mounted.
   - **Capture-on-failure:** screenshot + structural capture + attachments are wrapped in `try { ... } finally { ... }` so a test that throws during the wait phase still produces all its diagnostics in the HTML report. Without this, the most diagnostic-rich data would be lost exactly when it was needed most (observed during initial debugging — an early failing run had *no* attachments because the failure came before the attach block).
   - **Gotchas worth remembering:**
      - `splainer.io` is served from S3 over **plain HTTP**, not HTTPS — `https://splainer.io` returns a connection reset. The `prodURL` constant in `playwright.config.js` is `http://`. Mixed-content blocking isn't a concern because prod is HTTP and the default Quepid demo backends are also HTTP.
      - The frozen prod build is from 2024-03-17 (per S3's `Last-Modified`). The audit is comparing `deangularize` against that snapshot, not live `main`. A branch-to-branch comparison would require serving a local build of `main` on :5174 and adding a fourth project — not done, considered out of scope for pre-cutover parity validation.
      - Prod has a latent bug for non-default Solr queries: `solrSettingsSvc.fromParsedUrl` strips args via `removeUnsupported()` and defaults to `q=*:*` if the result is empty, so `#?solr=...q=batman` renders Batman results but persists `q=*:*` back to the hash. Local is strictly more correct here; the audit flags it as a divergence, review-time context explains it. This is *prod being wrong*, not local regressing — documented in the audit diff output as a known-prod-bug.

#### **Phase 15b — Audit diff script + `data-role` unification + DocRow spacing fix.** ✅ *Done* (commit `9af7d08`).

Three loosely-coupled changes bundled into one commit because they all came out of the same audit-driven review pass.

   1. **new `scripts/audit-diff.js`** (240 lines, zero dependencies). Walks `test-results/audit-audit-*-audit-{prod,local}/*.state.json`, pairs scenarios by name, emits a colorized per-scenario report: structural fields that differ (prod vs local side-by-side) plus a set-based line diff of body text. Set semantics rather than Myers diff because prod (Angular transclusion) and local (Preact JSX) can produce the same visible text in different DOM traversal orders, and a line-based diff would report false reorderings as real changes. `audit.spec.js` was updated so the state/console/requests files are written to `testInfo.outputPath` first, then attached via `{ path }`, producing a single on-disk source of truth for both the HTML report and the diff script.

   2. **`data-testid` → `data-role` unification.** `docRow.jsx`, `stackedChart.jsx`, and `docExplain.jsx` used `data-testid` (testing-library convention) while every other island used `data-role`. The audit surfaced this as a silent inconsistency — its union selector had to accept both shapes. Unified everything to `data-role` (the majority convention in the codebase). Renamed in 11 files total: the 3 source `.jsx` files, 4 unit spec files (`docRow.spec.js`, `searchResults.spec.jsx`, `docExplain.spec.jsx`, `stackedChart.spec.jsx`), the e2e suite `e2e/smoke.spec.js`, `e2e/audit.spec.js`, and updated inline comments. **Deliberately kept `data-testid`** in `app/scripts/islands/useCodeMirror.spec.jsx:15` because it uses `@testing-library/preact`'s `getByTestId()` helper — that's testing-library's API convention, orthogonal from the e2e-hook convention, and renaming it would force a switch to a raw `container.querySelector` just to preserve a surface-level consistency with no real value.

   3. **DocRow field-label spacing fix** — local was rendering `title:Foo` (no space after colon) while prod rendered `title: Foo`. Root cause: JSX whitespace rules strip trailing space adjacent to a closing tag, so `<label>{fieldName}: </label>` was emitting just `title:`. Fix: split the space into an explicit JSX expression child — `<label>{fieldName}:</label>{' '}<SanitizedSpan .../>`. `{' '}` survives JSX's whitespace handling because it's an expression, not a text literal. Net effect: ~10 chars per rendered doc row, matching prod.

   - **Scripts:** added `yarn test:e2e:audit` (runs both audit projects then the diff) and `yarn test:e2e:audit:diff` (just the diff, uses last audit results). Named under `test:e2e:` to avoid colliding with yarn's built-in `yarn audit` security-audit subcommand.
   - **Scenario expansion:** `e2e/audit.spec.js` grew from 2 scenarios to 7 in the same commit (`boot`, `solr-tmdb-default`, `solr-tmdb-query` with q=batman asserting "Batman" appears, `solr-rich-fieldspec` with `id+title+overview`, `solr-empty-results` with a nonsense query asserting zero doc rows, `es-tmdb-match-all`, `os-tmdb-match-all`). ES/OS scenarios use `esHash` / `osHash` helpers that mirror the hash param shape (`esUrl`/`esQuery`/`fieldSpec`) that `main.js:270` and prod's `$location.search()` both parse identically — cross-version hash compatibility is load-bearing for user bookmarks.
   - **Audit divergence count:** 172 → 56 on first clean run after this commit. The spacing fix accounted for most of the drop (one line per doc row × ~10 rows × multiple scenarios); the `data-role` unification reclassified selector-miss "divergences" that weren't really divergent; the rest was noise normalization.

#### **Phase 15c — Hash encoding parity.** ✅ *Done* (commit `ae676b9`).

Restores byte-for-byte hash encoding compatibility with the 2024 Angular build so existing user bookmarks round-trip visually identical between prod and local. The Phase 11c comment at `settingsStore.js:55` already flagged "encodeURIComponent (spaces as %20) instead of URLSearchParams (spaces as +) for back-compat with existing bookmarks" — this phase extends that same principle to the other reserved characters Angular's `encodeUriQuery` handles.

   1. **new `encodeUriQuery` helper in `settingsStore.js`** — runs `encodeURIComponent` then selectively unescapes `%40`, `%3A`, `%24`, `%2C`, `%3B` back to literal `@`, `:`, `$`, `,`, `;`. Mirrors Angular's `encodeUriQuery` exactly. Keeps URL hashes human-readable (`solr=http://host:8983/...` instead of `solr=http%3A%2F%2Fhost%3A8983`) — which matters here because splainer's entire UX is shareable URLs in the address bar. `buildHashString` now uses `encodeUriQuery` on values; keys still use plain `encodeURIComponent` because splainer's key set is closed (`solr`/`esUrl`/`osUrl`/`fieldSpec`/`esQuery`/`osQuery`) and never contains reserved chars.

   2. **`parseHash` in `main.js`** — now applies form-encoded decoding: `value.replace(/\+/g, ' ')` before `decodeURIComponent`. Matches Angular's `$location.search()` which treats `+` as a space in query values. Without this fix, bookmarks like `#?...&fieldSpec=id+title` parsed as the literal field name `"id+title"` instead of the intended `"id title"`. **The existing smoke test at `smoke.spec.js:74` navigated to exactly this URL but only asserted that a request was fired, not that the field spec parsed correctly** — so the regression had been silently present since the original deangularize parseHash was written in Phase 12.

   3. **Tests.**
      - new `settingsStore.spec.js` case freezes the emitted hash shape for a URL with `:`, `@`, and `&` (asserts `:` stays literal, `@` stays literal, `&` inside values gets encoded as `%26` so it doesn't break the outer `&`-delimited param parser).
      - Tightened `smoke.spec.js` bookmark test to also poll `localStorage['ls.solr_fieldSpecStr']` for `"id title"` (space) after loading `#?...&fieldSpec=id+title`. Catches the `parseHash` `+`→space behavior end-to-end through the persistence path — the kind of assertion the original test missed.

   - **Round-trip verification:** audit-diff confirmed byte-for-byte identical hashes on `boot`, `es-tmdb-match-all`, `os-tmdb-match-all`, and the default Solr scenario. The `solr-tmdb-query` and `solr-empty-results` scenarios still show hash divergences, but the cause is prod's pre-existing non-default-query round-trip bug (see Phase 15a gotchas), not encoding.

#### **Phase 15d — Overview-truncation upstream fix.** ✅ *Done* (upstream commit `975cd98`, splainer-search pin bump landed in commit `69a5ecf`).

**The bug (upstream, in splainer-search 3.0.0).** `getHighlightSnippet` in `services/normalDocsSvc.js` pre-stringifies `subFieldValue` before calling `.slice(0, 200)`:

```js
var raw = subFieldValue == null ? '' : String(subFieldValue);
snip = escapeHtml(raw.slice(0, 200));
```

For multi-valued Solr fields like TMDB's `overview` (returned as `["long text..."]`), this turned a no-op array slice into a real char truncation, cutting long unhighlighted fields mid-sentence on `q=*:*`-style queries. The 2024 Angular build's `getHighlightSnippet` called `.slice(0, 200)` *directly* on the polymorphic value — `Array.prototype.slice(0, 200)` on a 1-element array is a no-op (the count exceeds the array length), and `escapeHtml`'s `String()` coercion produced the full joined text. An earlier refactor added the `String()` wrap as null-safety without realizing it was stepping on the load-bearing polymorphism.

**Category: load-bearing accident.** The old behavior worked because nobody documented the `Array.slice` semantics as load-bearing, and the refactor broke it by reaching for `String.slice` semantics. The two methods share a name and an argument shape but have different interpretations of the count parameter — a classic polymorphism footgun.

**Fix upstream.** Reverted to the polymorphic slice with a null guard kept intact for the refactor's original goal:

```js
if (subFieldValue == null) {
  snip = '';
} else {
  snip = escapeHtml(subFieldValue.slice(0, 200));
}
```

Added two regression tests in `test/vitest/normalDocsSvc.test.js`: one covering array-wrapped fields (must NOT truncate) and one covering primitive strings (MUST still cap at 200 chars as a sensible preview cap). Shipped as upstream commit `975cd98` on `o19s/splainer-search#splainer-rewrite`; 616 → 618 tests, all green. The `.cursor/rules/GENERAL.md` in splainer-search explicitly asks contributors to highlight any divergence from the Angular version's behavior, so this was the right layer for the fix.

**splainer.io pin bump.** `package.json` dependency bumped from `splainer-search.git#2754904` to `#975cd98`. The `ensure-splainer-search-dist.js` postinstall rebuilds `node_modules/splainer-search/dist/splainer-search-wired.js` from the new source automatically. Audit verified: `solr-rich-fieldspec` overview lines went from `[210, 210, 210, ...]` chars on local (hard cap) to full text matching prod byte-for-byte.

**Architectural note on layer choice.** Three options were considered for this fix: (1) app-layer workaround in `docRow.jsx buildSnippets` that reads `doc.subs` directly when the library returned a truncated fallback, (2) patch `node_modules/splainer-search` in the postinstall script, (3) upstream fix + SHA bump. Option 3 was chosen because the bug is strictly library-side — the `.cursor/rules` mandate for Angular-parity is in splainer-search, so the fix belongs there. A downstream shim would have silently absorbed the regression and hidden it from any other consumer of the library.

#### **Phase 15e — Audit reliability cleanup.** ✅ *Done* (same commit `69a5ecf` as 15d).

Post-review hardening pass over the audit infrastructure — four small items plus one bonus fix that got promoted into scope when it blocked validation of the other four.

   - `e2e/audit.spec.js`:
      - **Empty-results wait path generalized.** Was hard-coded to check for `solr=` in the hash, which would silently skip future ES/OS empty-results scenarios and produce mid-render captures. Now triggers for any non-boot scenario with `expectMinDocRows === 0`.
      - **`expectMaxDocRows` loose equality.** `!== null` → `!= null` so a scenario author who forgets to set the field gets "no cap" semantics instead of a confusing `docRowCount <= undefined` failure.
      - **`intervals: [500]` on the body-text-length poll** — slows cross-process `page.evaluate` cadence by ~5×. Targets the "Execution context was destroyed" race that the old ~100ms default cadence was hitting against Vite HMR and live-prod navigation.
      - **Bonus: scenario-anchor wait before capture.** After the generic "body has text" gate, wait for `scenario.expectBodyText[0]` to actually appear in `body.innerText` before capturing state. Eliminates the "prod's Search Controls panel hasn't rendered the engine radio labels yet" flake that was producing sporadic red runs on `audit-prod`. Escalated into scope when it started blocking validation of the other four fixes — a flake that blocks validation of your fix stops being low-priority polish and becomes a hard blocker.
   - `scripts/audit-diff.js`:
      - **`process.exit(0)` → `process.exit(1)`** on missing results directory. The pipeline is `yarn test:e2e:audit = playwright && diff`, so exit-0 on a missing-data condition would let the `&&` chain falsely report success on an audit that produced no output. A missing results dir is a real pipeline failure and needs to be loud. Short-circuit evaluation of `&&` is load-bearing in CI contexts, and the whole point of the audit is to be trusted as a cutover gate.
   - **Test counts:** 212 Vitest (unchanged), 14 smoke e2e (unchanged), 14 audit e2e (unchanged — 7 scenarios × 2 projects). All green, first run, zero flakes after the anchor wait landed.
   - **Audit divergence count:** 45 → 42. The −3 drop wasn't from fixing a specific divergence — it was a second-order effect of the anchor wait reducing capture-timing variance, which quieted previously-noisy divergences that were artifacts of capturing state at slightly different render stages between runs. A good reminder that making a wait more deterministic also reduces diff noise, not just flake rate.
   - **What remains in the diff (42 divergences):** framework fingerprints (`servicesWired`, `angularFootprint`, `engineRadiosProd`, `dataRoles`) — expected, informational; `text_all:batman in <N>` Lucene docId leak in hot match descriptions on local-only — another "load-bearing accident" in splainer-search 3.0.0, deferred; prod's non-default-query hash round-trip bug (see 15a gotchas); `*:*` and `Detailed` body-text visibility differences in solr-tmdb-default — not yet investigated; derivative `bodyTextLen` deltas.

#### **Phase 15f — WeightExplain docId upstream fix.** ✅ *Done* (upstream splainer-search commit `45bfd2f`, splainer.io SHA bump landed in commit `4aabe47`).

**The bug (upstream).** `WeightExplain` in splainer-search 3.0.0's `services/queryExplainSvc.js` was leaking the internal Lucene docId tail into user-facing match labels. A Solr explain description like `weight(text_all:batman in 2508) [DefaultSimilarity], result of:` was producing the label `text_all:batman in 2508` instead of `text_all:batman` — so the stacked chart under each doc row showed a row per Lucene docId (`text_all:batman in 2508`, `text_all:batman in 46651`, …) rather than a single aggregated `text_all:batman` row. The docId is a Lucene internal and duplicates the doc row's own id column anyway.

**Regression history across two commits** (not one — the Phase 11 extraction was *not* the origin):

- **`72367c2` (2023-07-05, splainer-search "add test for multiplicative boosts in Solr")** — replaced the working prod regex `/weight\((.*?)\s+in\s+\d+?\)/` with a broken `/^weight\((?!FunctionScoreQuery).*/` that had no capture group at all. `match[1]` was always `undefined`, the `if (match.length > 1)` branch was dead, and every weight description fell through to `realExplanation = description` (the full raw Solr line, including `weight(`, `in N`, `[DefaultSimilarity]`, `, result of:`). The author was trying to fix a multiplicative-boost handling issue for `weight(FunctionScoreQuery(...))` and swapped the regex without realizing the original's `\s+in\s+\d+?\)` anchor was doing a second, load-bearing job.
- **`eb2e09d` (2026-04-03, splainer-search "fix: Algolia objects paging, Search API pager, explain and Vectara edge cases")** — a partial restoration. Added a capture group: `/^weight\(((?!FunctionScoreQuery).*)\)/`. This fixed the "raw full description" problem for non-FunctionScoreQuery cases by capturing the inner argument, but kept the greedy `.*` with no docId anchor — so the tail `in 2508` was still captured. The commit even updated the comment to describe the new (wrong) behavior: *"extract text:foo in 1234"*. Prod's comment had read *"extract text:foo"*.

splainer.io's frozen 2024-03-17 S3 build predates `72367c2`, which is why prod exhibits the correct behavior and the deangularize branch didn't.

**Category: load-bearing accident** — same pattern as Phase 15d's overview truncation. The old regex worked because `\s+in\s+\d+?\)` did *two* things simultaneously: (1) it cut off the docId from the captured group, and (2) it structurally rejected descriptions that didn't have an `in N` tail (like top-level `weight(FunctionScoreQuery(...))`), causing them to fall through to the else branch and keep their full description. The FunctionScoreQuery negative lookahead the refactor added was redundant defensive code — `services/explainSvc.js:95` already routes top-level function-score weights to `ProductExplain` before they can reach `WeightExplain`, so the case the lookahead was guarding against can't happen in practice.

**Upstream fix.** Restored the original regex `/^weight\((.*?)\s+in\s+\d+\)/` with an added comment documenting why the anchor is load-bearing (so the next refactor can't regress it a third time). Updated the existing test that was pinning the buggy behavior (`expect(expl.explanation()).toEqual('text:foo in 1234')` → `.toEqual('text:foo')`) and added a parameterized regression test covering four docId shapes plus the no-docId fall-through for `weight(FunctionScoreQuery(...))`. splainer-search test count 618 → 620, all green.

**Downstream pin bump.** `splainer-search.git#975cd98` → `#45bfd2f` in `package.json`. The postinstall `ensure-splainer-search-dist.js` auto-rebuilt `node_modules/splainer-search/dist/splainer-search-wired.js` from the new source. The SHA bump was bundled into the same commit (`4aabe47`) as the Phase 15g audit expansion below, so the commit message mentions both.

**Audit impact.** 42 → 30 divergences (−12, which is the 10 `text_all:batman in N` lines + 1 `text_all:batman` "only in prod" + 1 `bodyTextLen` derivative). **Every scenario now reports `✓ body text lines identical (set diff)`** — zero body-text divergences remain between prod and local. That's the floor for the current scenario set; the remaining 30 are all structural-field noise (framework fingerprints + prod's non-default-query hash bug).

#### **Phase 15g — Audit coverage expansion: interactive scenarios + mobile viewport.** ✅ *Done* (same commit `4aabe47`).

Three distinct additions, bundled in one commit because they share an `audit.spec.js` schema extension.

**Schema change: `afterLoad` + two-phase wait.**

The existing `SCENARIOS` array was hash-driven-only — every scenario loaded a bookmarkable URL fragment and captured state. This works for pages that can be reached declaratively but misses everything that requires a click (modal opens, tab switches, panel expansions). Added an optional `afterLoad(page)` callback field that runs between the initial load wait and the anchor wait. The test loop splits into three phases:

1. **`waitForScenarioLoad`** — runs after `page.goto`. Waits for the hash-driven initial state to mount (body text, doc rows if expected, empty-results view if that shape). This is the "page rendered the hash" gate.
2. **`scenario.afterLoad(page)`** — optional. Does its own waiting for the interaction to reach a stable state (e.g. modal header visible, panel expanded). Scenarios without `afterLoad` skip this phase transparently.
3. **`waitForScenarioAnchor`** — runs after `afterLoad`. Waits for the scenario's first `expectBodyText` item to appear in `body.innerText`. Runs *after* `afterLoad` so interactive scenarios check their post-interaction state, not the pre-interaction state.

The anchor wait was also **broadened from `expectBodyText[0]` to every item in the array**, closing a flake where the first item settled fast but later items (like `'Elasticsearch'` on audit-prod's boot — the Search Controls radio label that takes an extra ~500ms to render) were still missing at capture time. Waiting on the full assertion scope eliminates the "pre-capture wait predicate narrower than assertion predicate" race.

**Viewport pin moved file-level → per-project.**

`e2e/audit.spec.js` previously used `test.use({ viewport: { width: 1400, height: 900 } })` at the file level, which overrides project-level `use` config. Moved to explicit per-project viewport in `playwright.config.js` so different projects can declare different viewports. The three desktop projects (`smoke-local`, `audit-prod`, `audit-local`) all got explicit `viewport: { width: 1400, height: 900 }` so they don't drift if `devices['Desktop Chrome']` defaults change.

**New scenarios.**

   - **`solr-detailed-explain-modal`** — hash-loads `q=*:*` Solr results, then `afterLoad` clicks the first "Detailed" link via `page.getByText('Detailed', { exact: true }).first()` and waits for the `"Explain for"` modal header text. Covers the DocExplain island path that all previous hash-driven scenarios skipped entirely. The text-based locators work across frameworks because prod's `<stacked-chart>` Angular directive and local's `<StackedChart>` Preact island both render an `<a>` with the literal text "Detailed", and both modal variants (Angular's `$uibModal` + local's native `<dialog>`) emit "Explain for:" in the header.
   - **`es-custom-headers-panel`** — hash-empty boot, then `afterLoad` clicks the ES tab (`a[href="#es_"]`), clicks the "Advanced Settings" button via `getByRole('button', { name: 'Advanced Settings' })` scoped to `#es_`, and waits for the `"Custom Headers"` section header. Thin scenario by design — the thicker "configure headers and assert wire impact" path is already covered hermetically by smoke.spec.js. The audit's value-add here is cross-version UI parity for the tab-switch + panel-expansion flow, not wire-level header handling.

**New project: `audit-local-mobile`.**

Uses `devices['Pixel 5']` (~393×851, `isMobile: true`, `hasTouch: true`, Chromium-based). Deliberately **local-only**, not paired with a prod-mobile project:

   - Prod is a frozen 2024 build with no ongoing development; its mobile layout is whatever it is, and there's no regression risk on that side.
   - Doubling the audit runtime for a side that can never change would be negative ROI.
   - The diff script's `DIR_RE` regex `/^audit-audit-(.+)-audit-(prod|local)$/` doesn't match `-audit-local-mobile`, so mobile runs land in `test-results/` without polluting the cross-version diff. Review mobile screenshots via `npx playwright show-report`.
   - **Chose Pixel 5 (Chromium) over iPhone 12 (WebKit)** for two reasons: (1) no extra browser engine to install in CI (WebKit isn't currently pulled), and (2) using the same engine as the desktop audits isolates the variable to viewport/isMobile rather than mixing in Chromium-vs-WebKit rendering differences. The goal of mobile is "catch responsive-layout regressions," not "cover iOS-specific rendering."

**`test:e2e:audit` script now includes all 3 audit projects** (prod, local, local-mobile). The diff script still pairs only the desktop results; mobile lands as coverage-only. Single-command workflow: `yarn test:e2e:audit` runs 27 tests (9 scenarios × 3 projects) and emits the diff report.

**Findings surfaced by the new scenarios** (raw audit output — fixes land in 15h below):

   - `es-custom-headers-panel`: `hash: prod "#/es_" vs local ""`. Prod's Angular `$location` rewrites the tab anchor click into a URL hash update; local's Preact tab handler doesn't touch the URL. The 2024 build made tab state bookmarkable; the deangularize branch lost that by accident.
   - `es-custom-headers-panel`: 5 lines `1 2 3 4 5` only in prod. These are Ace editor gutter line numbers. Phase 14a's CodeMirror 6 migration dropped line numbers from the extension set; audit caught the behavior change.
   - `solr-detailed-explain-modal`: `× only in local`. The Preact dialog's close button text. Prod's `$uibModal` template has no close button at all — relies on ESC/backdrop-click for dismissal. Local's explicit × button is a UX improvement, not a regression.

**Test counts.** Unit: 212/212 unchanged. Audit e2e: 14 → **27** (9 scenarios × 3 projects, up from 7 × 2). Smoke e2e: 14/14 unchanged. All green on first run after the interactive scenarios landed.

#### **Phase 15h — Island parity polish from audit findings.** ✅ *Done* (commit `b49fbb2`).

Three small fixes addressing the three findings from Phase 15g. Each one required a **direction check** before becoming a "fix" — the audit is framework-agnostic about which side is better, so every divergence needs to be categorized as (1) regression — restore old, (2) improvement — document and keep, (3) prod bug — keep new, or (4) neutral — accept noise. Of the three findings, two were regressions (fix) and one was an improvement (polish only).

1. **Bookmarkable engine tabs** (`app/scripts/islands/startUrl.jsx`) — regression fix.

   The 2024 Angular build's `<a href="#es_">` tabs were intercepted by Bootstrap 3's tab JS and Angular's `$location`, which rewrote the URL hash to `#/es_` (leading slash, Angular's default path-like hash format) on click. This made the active tab shareable via URL — a 2024 bookmark pointing at `http://splainer.io/#/es_` would land on the ES tab. The deangularize `startUrl.jsx` used Preact `useState` for tab selection and called `e.preventDefault()` on the click, so the URL never changed.

   Added `parseTabHash()` and `writeTabHash()` helpers matching the exact `#/(solr|es|os)_` format. On mount, initial tab precedence is: URL hash → `settings.whichEngine` from localStorage → `'solr'` default. On click, `window.history.replaceState(null, '', '#/<tab>_')` writes the new hash. `replaceState` rather than assigning to `location.hash` so the back button doesn't accumulate one history entry per tab click.

   **`href` deliberately kept as `#<tab>_`** (no leading slash), matching prod's *source* shape. Only the rendered URL via `replaceState` uses the `#/<tab>_` *runtime* shape, matching what prod's Angular `$location` produces. Keeping the attribute matches `smoke.spec.js:161`'s `a[href="#es_"]` selector and `audit.spec.js`'s ES tab locator, so no test updates were needed for either suite. An earlier iteration of this fix accidentally changed `href` to `#/es_`, which broke the audit selector for `es-custom-headers-panel` — caught by the audit itself on the validation run.

   **Two new `startUrl.spec.js` tests** pin the contract: "writes `#/<tab>_` on tab click" (asserts `window.location.hash` post-click) and "initializes active tab from `#/<tab>_` in URL on mount" (sets a hash, mounts, asserts the matching pane is active). Also added a `beforeEach` that resets `window.location.hash` via `history.replaceState(null, '', pathname)` — jsdom shares one window across tests in a file, and without the reset a test that clicked a tab would leak its hash into the next test.

2. **CodeMirror 6 line numbers** (`app/scripts/islands/useCodeMirror.js`) — regression fix.

   Phase 14a shipped CM6 with a minimal extension set that deliberately omitted many features — but line numbers were dropped by accident, not design. Prod's Ace editor showed a line-number gutter; the audit's `es-custom-headers-panel` scenario caught 5 extra "1 2 3 4 5" lines in prod's body text that weren't present on local. One-line fix: added `lineNumbers` to the `@codemirror/view` import and included `lineNumbers()` as the first entry in the extensions array.

3. **Detailed-explain modal close button a11y polish** (`app/scripts/islands/docExplain.jsx`) — **not** a regression; intentional improvement.

   Prod's `views/detailedExplain.html` template has no close button at all — it relies on `$uibModal`'s ESC-key and backdrop-click behaviors. The deangularize refactor added an explicit `<button class="close" aria-label="Close">×</button>` for discoverability. The audit flagged `× only in local`, but the direction check identified this as a UX improvement (prod's ESC-only dismissal is a real usability gap for users who don't know the shortcut).

   Kept the button. Added a **small a11y polish** by wrapping the `×` in `<span aria-hidden="true">`, so assistive tech announces the button via its `aria-label="Close"` instead of reading the `×` character literally (which would render as "multiplication sign" or "times" depending on the screen reader). Visually identical to sighted users, more correct for screen reader users.

   **Audit divergence unchanged** after this polish — `aria-hidden` affects the accessibility tree, not CSS visibility, and `innerText` (which the audit reads) is CSS-visibility-based. The `×` still shows up in `body.innerText`. Documented as intentional improvement in the diff output rather than a residual regression.

**Audit impact of 15h's fixes.** 30 → 41 divergences at peak (audit-local added hash tracking + 5 more new scenarios on mobile) then back down as parity fixes land. `es-custom-headers-panel` hash field divergence gone. Line numbers now identical. The `×` persists by design. Body-text remains fully identical across all scenarios. Final audit state: **27/27 green, zero flakes across multiple consecutive runs**; remaining divergences all have documented explanations (framework fingerprints, prod's non-default-query round-trip bug, one intentional a11y improvement).

**Test counts.** Vitest: 212 → **214** (+2 new bookmarkable-tab tests). Smoke e2e: 14/14 unchanged. Audit e2e: 27/27.

**Cross-phase lessons captured inline:**

   - **"Direction check" before fixing.** Every audit divergence falls into one of four categories: regression (restore old), improvement (keep new), prod bug (keep new), or neutral (accept). Jumping straight from "divergence detected" to "fix it" can regress real improvements. The `×` close button was the clearest case this session — my first instinct was to treat it as something to eliminate, but the direction check surfaced it as prod having a usability gap that the refactor deliberately closed.
   - **Wait predicate scope must match assertion predicate scope.** If the pre-capture wait checks fewer invariants than the assertion does, you've built in a race. Every flake this session traced back to a wait pinning on only one anchor while the assertion checked several. Rule to remember: *if you're waiting on `expectBodyText[0]`, you're going to flake on `expectBodyText[1..n]`*.
   - **Load-bearing accidents in refactored libraries.** Both upstream splainer-search fixes this session (Phase 15d overview truncation, Phase 15f WeightExplain docId) were the same pattern: a refactor replaced a working polymorphic/regex pattern with a "cleaner" version that looked equivalent on its face but dropped an invariant that wasn't verbosely commented as load-bearing. The `Array.slice` vs `String.slice` polymorphism case and the regex `\s+in\s+\d+` anchor case were both doing a second, invisible job. When reviewing a refactor that touches polymorphic method calls or structural regex patterns, the question to ask is *"what is the old code doing that looks redundant but isn't?"* The answer is the next audit divergence.

### **Phase 16 — Mutation-testing pass + CI floor.** ✅ *Done.*

**Motivation.** The Phase 13a test hardening brought vitest coverage up to 246 passing specs, but coverage-by-line is not the same as bug-catching power. A shallow "does it render" test can run every line of a component without asserting on a single user-visible contract. Stryker mutation testing makes that gap legible: it mutates the source and re-runs the tests, and any mutant that survives is a line your tests execute but don't actually verify. The existing Stryker config was landed in an earlier phase but had never been run to completion against the current codebase; the incremental cache on disk (`reports/stryker-incremental.json`, timestamped 2026-04-10 13:39) predated the Phase 14a Ace→CodeMirror swap, so the first task was figuring out what was real versus cache rot.

**Stale-report forensics.** The pre-flush report showed **47.8% mutation score** (463 killed / 497 survived / 8 timeout) across 12 files. Inspection found that ~70 of the "survived" mutants lived in code that no longer existed: all 60 mutants on `useAceEditor.js` (file deleted in commit `4db56e8`), plus the `typeof window !== 'undefined' && window.ace ? <AceArgsEditor …> : <TextareaArgsFallback …>` branches in `settings.jsx` and `startUrl.jsx` (also deleted). Stryker's incremental cache persists source text per file across runs, so mutants on deleted lines keep counting as "survived" until a `--force` rerun flushes them. The survivors-hot-line analysis was initially computed against this stale data before I noticed the discrepancy. **Rule of thumb for next time:** before acting on any Stryker incremental report, cross-check the "hot lines" against `git log -- <file>` and confirm the source text in the report matches the live file — the cache is a liability when source has moved under it.

**Fresh baseline after `yarn stryker:full`.** 62.42% mutation score (797 killed / 390 survived / 2 timeout / 91 no-coverage) across 20 files. The fresh run pulled in `app/scripts/services/**/*.js` (which Stryker's config had always been told to mutate but weren't in the stale cache) and `useCodeMirror.js` (added after the prior run). Services alone hit **77.63%** aggregate — a healthy floor. Islands hit **56.22%**, reflecting the "shallow render test" anti-pattern that mutation testing is designed to expose. Per-file: `docExplain.jsx` 32%, `startUrl.jsx` 46%, `useDialogModal.js` 47%, `useCodeMirror.js` 56%, `settings.jsx` 61%, `searchResults.jsx` 65%, `Search.js` 63%.

**Pragmatic-engineer triage.** A first-pass recommendation identified 10 areas and ~130 mutants to chase. A pragmatic second-pass review cut the list roughly in half, on three principles:

   1. **Mutation-score-for-its-own-sake is a trap.** Mutation testing is *descriptive* up to ~70% (it tells you where coverage is shallow) and *prescriptive* beyond it (each additional point costs disproportionately more). The remaining 30% of survivors after 70% are typically `StringLiteral` mutants on className strings and `ObjectLiteral` mutants on inline style props — pinning these with assertions produces fragile tests that break on every cosmetic refactor.
   2. **E2e is the real safety net for UI.** `e2e/smoke.spec.js` already drives the CodeMirror 6 path in a real browser (verifies `container.__cmView.state.doc.toString()` after the mount effect runs) and the Playwright audit suite catches cross-version divergences. Unit-level assertions that duplicate e2e coverage add maintenance cost without catching bugs the rest of the suite wouldn't.
   3. **Structurally unreachable code needs annotations, not tests.** Several files have intentional jsdom-detection guards (`const CM6_AVAILABLE = typeof window !== 'undefined' && typeof navigator !== 'undefined' && !/jsdom/i.test(navigator.userAgent || '')`) that route unit tests through a textarea fallback while real browsers get CodeMirror 6. Mutants in those guards cannot be killed from jsdom by construction. The right tool is `// Stryker disable all` with a comment naming the e2e file that covers the real-browser path.

**Items dropped from the original plan:**
   - Island-registration smoke tests (the `if (typeof globalThis !== 'undefined') { globalThis.SplainerIslands… }` footers referenced in the stale report no longer exist — removed in Phase 14a cleanup commit `0fc4811` when the last IIFE was deleted).
   - `settings.jsx` collapsible-header click tests (`ArrowFunction`/`BooleanLiteral` survivors on `onClick={() => setUrlOpen((v) => !v)}`) — a click-and-assert-collapse test would pin to `.glyphicon-minus-sign`/`.glyphicon-plus-sign` classnames that a CSS refactor would flip, and the failure mode (clicking a header does nothing) is annoying but not dangerous.
   - Assertion strengthening in `detailedDoc.spec.jsx`, `docRow.spec.js`, `solrSettingsWarning.spec.js`, `useDialogModal.spec.jsx` — all "rendered text should match literal X" changes. Header copy rots; e2e audit catches user-visible text drift already.
   - The `Search.js:131` maxScore assertion — maxScore only drives the score bar width, the failure mode is cosmetic.
   - `useCodeMirror.js` CM6 extension-config internals — testing `EditorState.tabSize.of(tabSize)` or the `EditorView.theme({...})` literal means reading into CM6's internal API, which is fragile and low-signal.

**What actually got implemented.** 33 new vitest cases across 8 spec files, plus 3 Stryker annotations. In priority order by bug-catching value:

   1. **`docExplain.spec.jsx`** — 8 new cases. The big win: a `tab switching` describe block that mounts `<DocExplain>` and asserts which `<pre>` has `display: block` vs `display: none` after each of `summarized`/`hot`/`full` is clicked, plus the nav `<li>` `active` class. The existing tests verified tab *content* text but never verified which tab was *visible*; all three `<pre>` blocks live in the DOM simultaneously with CSS-hidden inactive tabs, which makes text-based assertions silently pass regardless of which tab is active. Also added: nav `<li>` active-class parity, tab-click `preventDefault` assertion (so anchors don't scroll the page), empty-state mounts for `doc={null}` and `explainOther` resolving with `undefined` / partial objects (pins the `(result && result.docs) || []` and `(result && result.maxScore) || 0` defaults in `handleResults`). **`docExplain.jsx`: 32.0% → 65.3% (+33.3).**
   2. **`Search.spec.js`** — 6 new cases. Existing suite had zero coverage of the grouped-results code path (`for (var i = 0; i < group.docs.length; i++)` normalization in `search()`, and the `Object.prototype.hasOwnProperty.call(self.grouped, groupByKey)` append guard in `page()`) — 19 NoCoverage mutants lived here. Added: grouped-fixture round-trip through `search()` asserting `createNormalDoc` is called per grouped doc; `page()` appends grouped docs under existing group-by keys; `page()` deep-clone assertion (pins the `JSON.parse(JSON.stringify(...))` isolation); `page()` skips groups whose key wasn't in the first page; paged-searcher rejection sets `IN_ERROR` with `errorMsg` from `msg.searchError`; paged-rejection without `searchError` falls back to empty string (pins the `msg && msg.searchError ? msg.searchError : ''` shape in the `pageFailure` handler). The existing `search()` error handler had coverage; the `page()` error handler was a separate, untested code path. **`Search.js`: 62.8% → 81.9% (+19.1).**
   3. **`startUrl.spec.js`** — 6 new cases. `nav tab active class` describe block pinning `class={activeTab === t.key ? 'active' : ''}` on the nav `<li>` (distinct from the existing tests that only asserted the `.tab-pane` div's active class); `EngineAdvanced gate` describe block asserting `EngineAdvanced` renders inside `#es_` and `#os_` panes but NOT inside `#solr_` (pins `(t.key === 'es' || t.key === 'os') && <EngineAdvanced …>`); a `searchArgsStr: undefined` mount test pinning `value={value || ''}` in `TextareaArgsFallback`. **`startUrl.jsx`: 46.3% → 65.4% (+19.1).**
   4. **`settings.spec.js`** — 4 new cases. `engine radio checked state` describe block mounting `Settings` with each of `solr`/`es`/`os` as `workingWhichEngine` and asserting only the matching `input[type="radio"]` is `:checked`. The existing round-trip tests clicked radios and observed side effects on other form fields, but never asserted that the `checked` attribute itself tracked `workingWhichEngine === '<engine>'`. Also pins the click-to-flip transition. **`settings.jsx`: 61.3% → 67.5% (+6.2).**
   5. **`customHeaders.spec.js`** — 4 new cases. `mount(null, ...)` throws per the input-validation guard; `headerType: undefined` falls back to `'None'` (pins `settings.headerType || 'None'`); byte-exact round-trip of a typed API-key header through the `onChange` callback (pins the value-propagation contract for data that leaves the browser). **`customHeaders.jsx`: 57.4% → 73.7% (+16.3).**
   6. **`settingsStore.spec.js`** — 2 new cases. A full round-trip test that writes every persisted (engine, field) pair across all three engines, calls `save()`, then loads a fresh store from the same backing storage and deep-equals every field. Pins both the write and read key-construction paths — a drift in either (e.g. the `engines` array at init vs. the `PERSIST_ENGINES` array at save) would fail at least one field and the ~30 `StringLiteral` survivors on those arrays collapse to a single assertion failure. Plus a `buildHashString` separator/prefix test asserting `hash.charAt(0) === '?'` and that two params emit exactly one `&`. Deliberately *not* trying to kill every individual string-literal mutant in the defaults — pinning the contract once beats pinning every literal. **`settingsStore.js`: 76.7% → 81.3% (+4.6).**
   7. **`useCodeMirror.spec.jsx`** — 3 new cases. A `PlainEditor` test component that calls `useCodeMirror(value, onChange)` with no options object, asserting `view.state.readOnly === false` (pins the `readOnly = false` destructuring default at `useCodeMirror.js:28`); `value={undefined}` mount asserting `doc.toString() === ''` (pins `value || ''` at `:71`); `value: "hello"` → rerender with `value={undefined}` asserting the view syncs to an empty doc (pins `(value || '') === current` at `:91`). Originally slotted for annotation, but a pragmatic second look showed these are actually testable with small additions rather than jsdom-blocked — the `|| ''` fallbacks and the destructuring defaults just needed inputs that nothing else in the suite provided. **`useCodeMirror.js`: 55.6% → 58.3% (+2.7).**

**Stryker annotations (3 sites).** Per-line `// Stryker disable` directives at:
   - `startUrl.jsx` lines 18–22: the `CM6_AVAILABLE` guard (`typeof window !== 'undefined' && typeof navigator !== 'undefined' && !/jsdom/i.test(navigator.userAgent || '')`) — jsdom path unreachable, real-browser path in `e2e/smoke.spec.js`.
   - `useDialogModal.js` lines 24–25: the `if (typeof dlg.showModal === 'function') { dlg.showModal(); }` branch — jsdom lacks `HTMLDialogElement.showModal`, the else branch (`dlg.setAttribute('open', '')`) is what actually runs in unit tests, e2e drives the real `showModal` path.
   - `customHeaders.jsx` lines 19–22: the same `CM6_AVAILABLE` guard shape as `startUrl.jsx`.

   **Only the conditionally-unreachable guards get annotated** — the else-branches in each case remain mutation-testable. Multi-line guards use `// Stryker disable all` / `// Stryker restore all` pairs rather than `disable next-line`, which only covers one line of source. The directive syntax is Stryker's primary per-line opt-out mechanism; the config-level alternatives (`mutate` file-level exclude, `mutator.excludedMutations` global mutator class) are too blunt — file-level exclusion would kill all mutation testing on `startUrl.jsx` to silence 6 unreachable-guard mutants. **Build impact: zero.** Verified by inspecting `dist/assets/main-*.js` after `yarn build` — the only `jsdom` reference in the 368 KB bundle is the runtime regex itself; all `// Stryker disable` comments and their reason text are stripped by Vite's esbuild minifier (non-legal comments are dropped by default in production mode).

**Dead items confirmed.** The original plan called for adding island-registration smoke tests to `docExplain.spec.jsx` / `settings.spec.js` / `startUrl.spec.js` to cover the `if (typeof globalThis !== 'undefined') { globalThis.SplainerIslands.* = … }` footers flagged as hot lines in the stale report. Grep against the live source confirmed these footers no longer exist — removed in Phase 14a cleanup commit `0fc4811`. The fresh run correctly had zero survivors in those line ranges. No-op; the stale report had misled the initial plan.

**CI floor enforced.** `stryker.config.json` previously had no explicit `thresholds` field, so Stryker was using its defaults (`{ high: 80, low: 60, break: null }`) and `break: null` meant the run never exited non-zero regardless of score. Bumped to `{ high: 80, low: 60, break: 70 }`. The next run that drops below 70% will fail. 1.66 points of headroom from the current 71.66% baseline — enough to absorb the existing 1 RuntimeError mutant (a Stryker/vitest-runner upstream bug on `docExplain.jsx:117` where `ArrayDeclaration` → `["Stryker was here"]` crashes the runner with `TypeError: Cannot convert object to primitive value`; 1 mutant out of 1181 is rounding error), tight enough that a meaningful test deletion trips the threshold. Without this bump the whole exercise would bit-rot: in six months someone would delete the `docExplain` tab-switching tests and no one would notice.

**E2e coupling documented.** Added a header comment to `e2e/smoke.spec.js` calling out that the `// Stryker disable all` annotations in `customHeaders.jsx`, `startUrl.jsx`, and `useDialogModal.js` are load-bearing — they silence mutants on code paths that only this e2e file covers, so deleting the CodeMirror / dialog flows uncovers mutation-testing gaps. Two minutes of work to prevent a subtle coupling gap.

**Final mutation scores after rerun.**

| File | Before | After | Δ |
|---|---|---|---|
| **Islands (aggregate)** | 56.22% | 66.25% | **+10.03** |
| docExplain.jsx | 32.0% | 65.3% | **+33.3** |
| startUrl.jsx | 46.3% | 65.4% | **+19.1** |
| customHeaders.jsx | 57.4% | 73.7% | **+16.3** |
| settings.jsx | 61.3% | 67.5% | +6.2 |
| useDialogModal.js | 46.7% | 50.0% | +3.3 |
| useCodeMirror.js | 55.6% | 58.3% | +2.7 |
| **Services (aggregate)** | 77.63% | 84.37% | **+6.74** |
| Search.js | 62.8% | 81.9% | **+19.1** |
| settingsStore.js | 76.7% | 81.3% | +4.6 |
| **Overall** | **62.42%** | **71.66%** | **+9.24** |

Killed 797 → 886 (+89). Survived 390 → 291 (−99). NoCoverage 91 → 61 (−30). Timeouts 2 → 4 (Stryker/vitest interaction, not actionable). 1 RuntimeError on the known-upstream `ArrayDeclaration` mutant.

**What stayed on the table and why.**
   - `useDialogModal.js` still at 50% — survivors cluster around the `if (dlg && dlg.open) dlg.close()` cleanup branches. Testing the "close while already closed" path is an edge case no real user hits; a test would pin a code path that was written defensively for robustness, not for a known bug. Left alone.
   - `useCodeMirror.js` still at 58% — survivors are `tabSize`, `useWrapMode`, Compartment internals, and `EditorView.theme({...})` literals. Testing these means reading into CM6 internals, which is fragile and couples the test suite to CodeMirror's private API. Left alone.
   - `searchResults.jsx` at 64.6%, untouched — the biggest remaining single-file gap. The pragmatic cut deferred it because the hot lines are cosmetic (className strings, inline styles on Bootstrap containers) rather than bug-catching. A targeted pass could lift it but would move the needle less than the docExplain pass did and at higher test-maintenance cost. Deferred; revisit if a bug surfaces in the results-rendering path.

**Files (modified, 11 total).**
   - **source** (4): `app/scripts/islands/startUrl.jsx`, `app/scripts/islands/useDialogModal.js`, `app/scripts/islands/customHeaders.jsx` (Stryker disable annotations), `stryker.config.json` (`thresholds.break: 70`)
   - **tests** (7): `app/scripts/islands/docExplain.spec.jsx` (+8), `app/scripts/services/Search.spec.js` (+6), `app/scripts/islands/startUrl.spec.js` (+6), `app/scripts/islands/settings.spec.js` (+4), `app/scripts/islands/customHeaders.spec.js` (+4), `app/scripts/services/settingsStore.spec.js` (+2), `app/scripts/islands/useCodeMirror.spec.jsx` (+3)
   - **docs** (1): `e2e/smoke.spec.js` (header comment, Stryker coupling note)

**Test counts.** Vitest: 214 → **246** (+32 — one fewer than the +33 cases added because one `it.each` collapses into the count differently). All 246 pass. Smoke e2e: 14/14 unchanged. Audit e2e: 27/27.

**Cross-phase lessons captured inline:**
   - **Incremental mutation caches rot silently.** Stryker's `reports/stryker-incremental.json` persists per-file source text and mutants across runs. When the underlying source moves, deleted lines keep counting as "survived" until a `--force` rerun flushes them. Before spending effort on an incremental report, confirm the cache matches the live file — cross-check one hot line against `git log`. Don't trust the percentage.
   - **Mutation score is descriptive-then-prescriptive.** Under ~70% the score tells you where coverage is shallow; over 70% each additional point costs disproportionately more and typically requires brittle assertions on cosmetic surfaces (class names, inline styles). Know when to stop and commit the gains behind a CI threshold instead of chasing asymptotes.
   - **Annotations > configuration when the blockage is structural.** Stryker offers file-level exclusion via `stryker.config.json`'s `mutate` array and global mutator exclusion via `mutator.excludedMutations`, but neither gives per-line precision. When a few lines of code are genuinely unreachable under the unit runner (jsdom detecting itself out of CodeMirror, `showModal` missing), `// Stryker disable all` with a comment naming the e2e file that covers the real path is the right tool — the build strips the comments, e2e remains the authority, and the score reflects meaningful coverage instead of structural artifacts.
   - **Test coverage and bug coverage are different things.** The docExplain spec had 12 passing tests, 93% line coverage, and a 32% mutation score because every test read `.textContent` but none asserted which tab was visible. A `describe('tab switching')` block of 5 behavioral assertions added +33 points on that file alone. When a mutation report flags a JSX file as weak, the fix is almost never "write more mount tests" — it's "add assertions on user-visible behavior after an interaction."

### **Phase 14b — Add strict CSP + optional localStorage key namespace.**
   - With Ace gone, `script-src 'self'` CSP becomes possible via a `<meta>` tag (no server-side nonce needed for static S3 hosting). `localStorage` key namespace (`ls.*` → `splainer:v3:*`) is low-value — optional, requires migration path for existing users.
