## The Splainer!

[![Build Status](https://circleci.com/gh/o19s/splainer.svg?style=svg)](https://circleci.com/gh/o19s/splainer)

The sandbox that explains your search results for you so you don't have to go digging through explain debug! Paste in your Solr or Elasticsearch query URL and go. Try it out [here](http://splainer.io).

## Why?

You're a search developer trying to tune search results with Solr or Elasticsearch. You're engaged in [search relevancy](http://opensourceconnections.com/blog/2014/06/10/what-is-search-relevancy/) work.

You're probably stuck with the question of *why*? Why do search results come back in the order that they do? Solr and Elasticsearch exposes an explain syntax for you to try to explain search scoring. Unfortunately outside the simplest tasks, its a nightmare to read through. There are parsers like [explain.solr.pl](http://explain.solr.pl) but they require a lot of manual copy/pasting of explain information to the tool.

Splainer is different by being a *sandbox*. Paste in your Solr or Elasticsearch URL, query parameters and all. As you work with your query, changing parameters, Splainer shows you parsed and summarized explain information alongside your documents. Continue working and see how the search results change.

Read the blog post introducing Splainer [here](http://opensourceconnections.com/blog/2014/08/18/introducing-splainer-the-open-source-search-sandbox-that-tells-you-why/)

Splainer forms the core of the open source tool [Quepid](http://quepid.com) that allows you to do this over multiple queries against expert-graded search results to track search changes over a longer period of time.

## Using Splainer

Take the [tour](http://splainer.io/help.html) to see how you'd use Splainer.

### Using Splainer locally

We have a Docker image published at https://hub.docker.com/r/o19s/splainer that you can use (its run command and port may differ from the `Dockerfile` in this repo — check the image docs).

This repository’s `Dockerfile` runs the **Vite dev server** on **port 5173**. Example:

`docker run --rm -p 5173:5173 splainer` (after `docker build -t splainer .`) then open http://localhost:5173

### Splainer Package for Solr

We have a Solr Package of Splainer that is compatible with Solr 9+.   Learn more in the [solr-splainer-package](./solr-splainer-package/README.md)

## Developing Splainer

### Prerequisites

* **Node.js** >= 20.12 (matches [`splainer-search`](https://github.com/o19s/splainer-search) and CI).
* **[Yarn classic](https://classic.yarnpkg.com/lang/en/docs/install/)** (v1). The repo uses `only-allow yarn` on install.

Splainer is a **Preact** + **Vite** front end; unit tests use **Vitest**, end-to-end tests use **Playwright**.

### Local dev (Yarn)

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

### With Docker installed

From the root of the project:

```
docker build -t splainer .
docker run --rm -p 5173:5173 splainer
```

Then open http://localhost:5173.

### Using `docker-compose`

From the root of the project:

```
docker-compose build
docker-compose run --rm --service-ports app
```

The compose file maps **5173** and starts `yarn dev` (Vite) bound to `0.0.0.0`.

### Using Docker Compose to test splainer-search with splainer

* By default, `package.json` installs [`splainer-search`](https://github.com/o19s/splainer-search) from GitHub (pinned commit) so Docker and CI do not need a sibling `../splainer-search` folder. When [PR #160](https://github.com/o19s/splainer-search/pull/160) changes, update the commit hash in that dependency URL and run `yarn install`. The `postinstall` script (`scripts/ensure-splainer-search.js`) checks that `splainer-search/wired.js` is present (the app imports it and Vite bundles it; no separate IIFE build step).
* For a live local checkout instead, run `yarn add splainer-search@file:../splainer-search` (or keep that change uncommitted), or copy `docker-compose.override.yml.example` to `docker-compose.override.yml` and mount your `splainer-search` tree into `node_modules/splainer-search` as in that example.

https://docs.docker.com/compose/extends/

### Testing Notes

* **Unit / component tests:** [Vitest](https://vitest.dev/) (`yarn test`), specs under `tests/`.
* **End-to-end tests:** [Playwright](https://playwright.dev/) (`yarn test:e2e`), specs under `e2e/`.
* The `./tests/splainer_test_links.html` file is a list of links that invoke Splainer, both the local version and the deployed version against Solr and Elasticsearch, and is a great manual check that bookmark URLs and integrations still behave. Use it to make sure existing links still work.

## Who?

Created by [OpenSource Connections](http://opensourceconnections.com).

Thanks to all the [community contributors](https://github.com/o19s/splainer/graphs/contributors) for finding bugs and sharing fixes!.

## License

Released under [Apache 2](LICENSE.txt)
