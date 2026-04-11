# Preact Islands

Preact JSX components that make up splainer's UI. Each island is an ES module imported by `app/scripts/main.js` and mounted into a DOM element.

## Architecture

`main.js` is the single entry point. It imports all islands and services as ES modules, creates the settings store and search state, then calls each island's `mount()` function to render into named `<div>` mount points in `index.html`. Preact's reconciler diffs efficiently, so calling `mount()` repeatedly (e.g. after search completes) is cheap and idempotent.

Modals (`detailedDoc`, `docExplain`) are opened via `modalRegistry.js`, which imports them statically and renders into `#splainer-modal-root`.

## Shared hooks

Reusable Preact hooks live at the root of this directory alongside the island sources (e.g. `useAceEditor.js`) — flat layout, not a `hooks/` subdirectory. The `useAceEditor` hook wraps the Ace editor lifecycle with three refs every imperative-third-party-library wrapper needs:

1. `instanceRef` — the library instance.
2. `onChangeRef` — the latest `onChange` prop, updated via a no-deps `useEffect`. Without this, change handlers capture stale closures from the first render.
3. `suppressRef` — an echo-suppression flag wrapped in `try/finally` around every programmatic mutation. Without this, programmatic `setValue` fires the library's own change event, which calls back into the parent, and the cycle corrupts state.

Skip any of the three and you get stale-closure bugs, infinite loops, or silently dropped input.

## Adding a new island

1. Write `app/scripts/islands/<name>.jsx`. Export `mount(rootEl, props...)` and `unmount(rootEl)`.
2. Write a Vitest spec at `<name>.spec.js` next to the source. Use jsdom environment.
3. Import the island's `mount` function in `app/scripts/main.js` and call it from `renderAll()`.
4. Add a `<div id="<name>-mount">` to `app/index.html` if the island needs a top-level mount point. (Islands rendered as JSX children of other islands, like `CustomHeaders` inside `StartUrl`, don't need one.)
5. Run `yarn test && yarn test:e2e`. Both must be green.

## Outbound-request tests as the merge gate

Every island that touches user-configurable behavior should have one Playwright test that intercepts the outbound request and asserts the config landed on the wire — not internal state mutation. The custom-headers test that asserts `Authorization: ApiKey ...` reaches the backend is the canonical example.
