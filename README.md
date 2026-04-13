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

For prerequisites, Yarn/Docker workflows, `splainer-search` integration, and testing, see [DEVELOPERS_GUIDE.md](DEVELOPERS_GUIDE.md).

## Who?

Created by [OpenSource Connections](http://opensourceconnections.com).

Thanks to all the [community contributors](https://github.com/o19s/splainer/graphs/contributors) for finding bugs and sharing fixes!.

## License

Released under [Apache 2](LICENSE.txt)
