# Preact Islands

This directory holds the Preact JSX islands that are progressively replacing splainer's Angular controllers + templates. Each island is built by `vite.islands.config.js` into `dist/<name>.js` (an IIFE that references `window.preact.*` as externals) and wrapped by an Angular directive shim under `app/scripts/directives/`.

## Architecture in one paragraph

The Angular directive shim is the integration boundary. It mounts the Preact island into its own DOM element, watches the parent scope, and re-renders on every digest. Preact's reconciler diffs efficiently, so calling `mount()` on every `$watch` tick is cheap and idempotent. On `$destroy` the shim unmounts. Inside the island it's pure Preact: hooks, JSX, props, callbacks. The island knows nothing about Angular.

## Shim-heavy vs. island-heavy

Every migration PR has to decide where the controller's old logic lives: inside the island, or inside the directive shim that wraps it. The choice is not aesthetic — it follows the *shape* of the controller body.

| If the controller body is... | Put it in... | Reason |
|---|---|---|
| 100% Angular DI glue (`searchSvc.createSearcher`, `solrUrlSvc.parseSolrArgs`, etc.) with no UI semantics | The **shim** | The island has no Angular DI; injecting these would require shipping Angular into the island's bundle. |
| 100% UI state and event handling (form fields, validation, render branching) | The **island** | Preact's component model is the natural home for UI state. |
| Mixed — some DI glue + some UI state | **Split**: DI glue in the shim (passed to the island as a callback prop), UI state in the island | Keeps the island portable for the eventual PR 11 deletion of Angular. |

**Worked examples from prior PRs:**

- **PR 6 (`customHeaders`) — island-heavy.** No DI; the controller body was pure form state. The shim is ~50 lines, all integration boilerplate.
- **PR 7 (`settings`) — island-heavy.** Same shape as PR 6.
- **PR 8 (`docSelector`) — shim-heavy.** The old controller's `explainOther` was 100% splainer-search service plumbing. The relocated body lives in the shim's `link` function and is passed to the island as `onExplainOther`. The island is nearly pure UI.
- **PR 9a (`docRow`) — split.** The island owns rendering (title, snippets, thumbnail, image, child chart slot). The shim opens the `$uibModal.open(...)` call for the "Detailed" modal — that survives until PR 9bc rewrites the modal pattern. The shim also `$compile`s the still-Angular `<stacked-chart>` child into a slot the island provides.

## Shared hooks

Reusable Preact hooks live at the root of this directory alongside the island sources (e.g. `useAceEditor.js`) — flat layout, not a `hooks/` subdirectory. The first one (`useAceEditor`, extracted in PR 7) wraps the Ace editor lifecycle with the three refs every imperative-third-party-library wrapper needs:

1. `instanceRef` — the library instance.
2. `onChangeRef` — the latest `onChange` prop, updated via a no-deps `useEffect`. Without this, change handlers capture stale closures from the first render.
3. `suppressRef` — an echo-suppression flag wrapped in `try/finally` around every programmatic mutation. Without this, programmatic `setValue` fires the library's own change event, which calls back into the parent scope *during* a digest, and the cycle corrupts state.

Skip any of the three and you get stale-closure bugs, infinite loops, or silently dropped input. **Canonical pattern** — copy it for any future Ace / CodeMirror / chart / editor wrapper.

## Adding a new island

1. Write `app/scripts/islands/<name>.jsx`. Export `mount(rootEl, props...)` and `unmount(rootEl)`. Attach to `globalThis.SplainerIslands.<name>` as a side effect at module-load time.
2. Append `{ name, entry }` to the `islands` array in `vite.islands.config.js`.
3. Write a Vitest spec at `<name>.spec.js` next to the source. Use jsdom environment. Spec tests the mounted DOM, not Preact internals.
4. Write the directive shim at `app/scripts/directives/<name>.js`. Copy the PR 6 / PR 7 / PR 8 pattern: `link` function, deep `$watch` if the island takes reactive props, `$on('$destroy')` cleanup, idempotent re-mount on every digest.
5. Add `<script src="scripts/islands/dist/<name>.js"></script>` to `app/index.html`, ordered *before* the directive shim's script tag.
6. Delete the old controller (if any). Karma's `app/scripts/**/*.js` glob auto-picks-up the new dist file; no Karma config change needed.
7. Run `yarn build:islands && yarn test && yarn test:e2e && yarn test:new`. All four (Karma, Playwright, Vitest, build) must be green.

## Outbound-request tests as the merge gate

Every island that touches user-configurable behavior should have **one Playwright test that intercepts the outbound request and asserts the config landed on the wire** — not internal scope mutation. Internal contract tests catch refactor regressions; outbound-request tests catch silent integration breaks across the entire chain (Preact island → directive shim → Angular
service → splainer-search → fetch). The PR 6 custom-headers test that asserts `Authorization: ApiKey ...` reaches the backend is the canonical example. Pattern recorded in PR 6 audit notes.
