## The Splainer!

[![Build Status](https://circleci.com/gh/o19s/splainer.svg?style=svg)](https://circleci.com/gh/o19s/splainer)

The sandbox that explains your search results for you so you don't have to go digging through explain debug! Paste in your Solr URL and go. Try it out [here](http://splainer.io).

## Why?

You're a search developer trying to tune search results with Solr. You're engaged in [search relevancy](http://opensourceconnections.com/blog/2014/06/10/what-is-search-relevancy/) work.

You're probably stuck with the question of *why*? Why do search results come back in the order that they do? Solr/Lucene exposes an explain syntax for you to try to explain search scoring. Unfortunately outside the simplest tasks, its a nightmare to read through. There are parsers like [explain.solr.pl](http://explain.solr.pl) but they require a lot of manual copy/pasting of explain information to the tool.

Splainer is different by being a *sandbox*. Paste in your Solr URL, query parameters and all. As you work with your query, changing parameters, Splainer shows you parsed and summarized explain information alongside your documents. Continue working and see how the search results change.

Read the blog post introducing Splainer [here](http://opensourceconnections.com/blog/2014/08/18/introducing-splainer-the-open-source-search-sandbox-that-tells-you-why/)

Splainer forms the core of our product [Quepid](http://quepid.com) that allows you to do this over multiple queries against expert-graded search results to track search changes over a longer period of time.

## Using Splainer

Take the [tour](http://splainer.io/help.html) to see how you'd use Splainer.

### If you want to work locally, we have a Docker image

`docker run -d -p 9000:9000 -p 35729:35729 o19s/splainer` and then go to http://localhost:9000

## Running the code

### Npm/Bower/Yarn Dev Environment

Splainer is written using AngularJS project. It requires npm, grunt, and yarn (w. bower).

Be sure you've installed npm, bower, and grunt on your machine.

* On a Mac [follow these instructions](http://thechangelog.com/install-node-js-with-homebrew-on-os-x/)
* On Ubuntu [follow these instructions](https://rtcamp.com/tutorials/nodejs/node-js-npm-install-ubuntu/)
* Use npm to install Grunt and Bower globally on your system (may require sudo)

```
npm install -g grunt-cli
npm install -g bower
```

* Install yarn [follow these instructions](https://yarnpkg.com/en/docs/install)

### With Npm/Yarn installed

From the root of the project, you should be able to run the following:

```
bower install --allow-root
yarn
grunt serve
```

To build the project, simply run "grunt" static build artifacts will be placed in the dist/ folder

```
grunt
```

### With Docker installed

From the root of the project, you should run:

```
docker build -t splainer  .
```

or use the following shortcuts if you have `ruby` installed:

```
bin/docker b
```

then to run the server run

```
bin/docker s
```

## Who?

Created by [OpenSource Connections](http://opensourceconnections.com)

## License

Released under [Apache 2](LICENSE.txt)
