Version numbers correspond to `package.json` version.  Follows the _major.minor.bugfix_ naming pattern.

# 3.0.0 (UNRELEASED)

Major modernization and “deangularize” work: the app is a single Vite-built ESM bundle with Preact islands and plain JS bootstrap.

## Build and tooling

- **Docker:** Node 20 base image; remove deprecated `MAINTAINER` and unsupported Debian packages.
- **Build:** Replace Grunt with `scripts/build.js`; unify on one Vite build from `main.js`; dev server on port **5173**.
- **Lint / format:** Replace JSHint with ESLint + Prettier; target ES2018+; add `eslint-plugin-react-hooks`; restrict installs to Yarn (`only-allow`).
- **Dependencies:** `splainer-search` consumed as ESM; `postinstall` simplified (`scripts/ensure-splainer-search.js`).

## Testing and CI

- **Unit:** Vitest; specs live under `tests/` with `@app` and `@test` path aliases.
- **E2E:** Playwright smoke tests; migration audit comparing prod vs local; audit diff, `data-role` / `data-testid` hooks; interactive and mobile projects with viewport pinning.
- **CI:** Vitest on CircleCI; expanded coverage; Stryker / e2e relationship documented in migration notes.

## UI and application architecture

- Remove Angular shell in favor of plain JS bootstrap; UI moved to **Preact islands** (settings, custom headers, start URL, Solr warnings, doc selector, doc row, stacked chart, detailed explain modal, document explain, search results).
- Extract pure modules: `settingsStore`, `solrSettings`, and islands `Search` service; remove `WrappedSearch` shim and thread dependencies through `createSearch`.
- **CodeMirror 6** replaces Ace for JSON editing (CSP-friendly); line numbers and related UX improvements.
- Bookmarkable engine tabs; modal accessibility improvements.
- DRY Elasticsearch / OpenSearch settings; shared `formatJson` and unified search args; UI and dead-CSS cleanup; security hardening.
- Vendor the GitHub fork ribbon asset to avoid broken camo/S3 hotlinks.
- **Solr 10** and vanilla JS path aligned with current Solr usage.

## Fixes

- Match legacy hash encoding and `+` decoding in `fieldSpec` for URL/state compatibility.

## Documentation

- Expand migration narrative (`MIGRATION_CHANGES.md`), developers guide, and islands README.

## Maintenance since 2.20.1 (2023–2024, prior to 1.0.0)

These landed in git after the 2.20.1-tagged era but before the 2026 modernization burst:

- Solr package release follow-ups (artifact paths, related release wiring).
- Update failing test links and Dockerfile improvements ([#96](https://github.com/o19s/splainer/pull/96)).

---

# 2.20.1 (2023-08-07)

- Introduce versioning to the Splainer project.  The http://splainer.io website has been around for years, and we've just pushed changes as they arrive.   We are now introducing a changelog process, and labeling the current state as "2.20.1" to match the commit https://github.com/o19s/splainer/commit/46cded05908e5d06ebee03f2cccaf836c60f9438#diff-7ae45ad102eab3b6d7e7896acd08c427a9b25b346470d7bc6507b6481575d519.
- Splainer.io can NOW be deployed into your Solr environment using [Solr Packages](https://solr.apache.org/guide/solr/latest/configuration-guide/package-manager.html).  See the package [README.md](./solr-splainer-package/README.md) for more details.  https://github.com/o19s/splainer/pull/97.
