# Splainer developers guide

How to build, run, and test Splainer from this repository. For what Splainer is and how to use it, see [README.md](README.md).

## Prerequisites

* **Node.js** >= 20.12 (matches [`splainer-search`](https://github.com/o19s/splainer-search) and CI).
* **[Yarn classic](https://classic.yarnpkg.com/lang/en/docs/install/)** (v1). The repo uses `only-allow yarn` on install.

Splainer is a **Preact** + **Vite** front end; unit tests use **Vitest**, end-to-end tests use **Playwright**. For how the UI is split into islands (mount points, modals, list keys, hooks, and adding a new island), see [app/scripts/islands/README.md](app/scripts/islands/README.md).

## Local dev (Yarn)

From the repository root:

```
yarn install
yarn dev
```

Open http://localhost:5173 (Vite dev server).

Other useful commands:

```
yarn build          # production build → dist/ (via scripts/build.js)
yarn test           # Vitest (islands + services)
yarn test:e2e       # Playwright
yarn lint           # ESLint
```

To serve the built static site locally (after `yarn build`), use any static file server pointed at `dist/`, for example:

```
npx --yes serve dist -p 5000
```

## With Docker installed

From the root of the project:

```
docker build -t splainer .
docker run --rm -p 5173:5173 splainer
```

Then open http://localhost:5173.

## Using `docker-compose`

From the root of the project:

```
docker-compose build
docker-compose run --rm --service-ports app
```

The compose file maps **5173** and starts `yarn dev` (Vite) bound to `0.0.0.0`.

## Using Docker Compose to test splainer-search with splainer

* By default, `package.json` lists [`splainer-search`](https://github.com/o19s/splainer-search) as an npm dependency (see the `splainer-search` version there). To upgrade the library, change that version in `package.json` and run `yarn install`. The `postinstall` script ([`scripts/ensure-splainer-search.js`](scripts/ensure-splainer-search.js)) checks that `node_modules/splainer-search/wired.js` exists after install (the app imports `splainer-search/wired` and Vite bundles it).
* To work against a local `splainer-search` checkout, run `yarn add splainer-search@file:../splainer-search` (or keep that change uncommitted), or copy `docker-compose.override.yml.example` to `docker-compose.override.yml` and mount your `splainer-search` tree over `node_modules/splainer-search` as in that example.

https://docs.docker.com/compose/extends/

## Testing notes

* **Unit / component tests:** [Vitest](https://vitest.dev/) (`yarn test`), specs under `tests/` (Preact island specs under `tests/islands/`).
* **End-to-end tests:** [Playwright](https://playwright.dev/) (`yarn test:e2e`), specs under `e2e/`.
* The `./tests/splainer_test_links.html` file is a list of links that invoke Splainer, both the local version and the deployed version against Solr and Elasticsearch, and is a great manual check that bookmark URLs and integrations still behave. Use it to make sure existing links still work.
