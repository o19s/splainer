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

We have a Docker image published at https://hub.docker.com/r/o19s/splainer that you can use:

`docker run -d -p 9000:9000 o19s/splainer` and then go to http://localhost:9000

## Developing Splainer

### Npm/Yarn Dev Environment

Splainer is written using AngularJS project. It requires npm, grunt, and yarn.

Be sure you've installed npm, yarn, and grunt on your machine.

* On a Mac [follow these instructions](http://thechangelog.com/install-node-js-with-homebrew-on-os-x/)
* On Ubuntu [follow these instructions](https://rtcamp.com/tutorials/nodejs/node-js-npm-install-ubuntu/)
* Use npm to install Grunt globally on your system (may require sudo)

```
npm install -g grunt-cli
```

* Install yarn [follow these instructions](https://yarnpkg.com/en/docs/install)

### With Npm/Yarn installed

From the root of the project, you should be able to run the following:

```
yarn
grunt test
grunt serve
```

Now browse to http://localhost:9000.

To build the project, simply run `grunt dist` to build the static artifacts in the dist/ folder.

```
grunt dist
```

You can test out the static artifacts via `ruby -run -e httpd -- -p 5000 ./dist` and going to http://localhost:5000.

### With Docker installed

From the root of the project, you should run:

```
docker build -t splainer  .
docker run -p 9000:9000 splainer:latest
```

or use the following shortcuts if you have `ruby` installed:

```
bin/docker b
```

then to run the server run

```
bin/docker s
```

### Using `docker-compose`

From the root of the project,

    docker-compose build
    docker-compose run --rm --service-ports app

### Docker Extras
* `docker-compose.override.yml.example` can be copied to `docker-compose.override.yml` and use it to override environment variables or work with a local copy of the [`splainer-search`](https://github.com/o19s/splainer-search) JS library during development defined in `docker-compose.yml`.  Example is included.

https://docs.docker.com/compose/extends/

### Testing Notes

* Unit tests are written using Karma.

* The `./tests/splainer_test_links.html` file is a list of links that invoke Splainer, both the local version and the deployed version against Solr and Elasticsearch, and is a great test to make sure the behavior hasn't reverted.  Use this to make sure existing links still work!

## Who?

Created by [OpenSource Connections](http://opensourceconnections.com).

Thanks to all the [community contributors](https://github.com/o19s/splainer/graphs/contributors) for finding bugs and sharing fixes!.

## License

Released under [Apache 2](LICENSE.txt)
