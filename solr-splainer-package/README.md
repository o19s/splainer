# Splainer Solr Plugin

This project lets you install Splainer into your Solr as a plugin.
You can access it via http://localhost:8983/v2/splainer and avoids common CORS and other network problems that you might encounter using the hosted http://splainer.io site.

## Installing Into Solr

```
bin/solr start -c -Denable.packages=true
bin/solr package add-repo splainer "https://raw.githubusercontent.com/o19s/splainer/main/solr-splainer-package/repo/" 
bin/solr package list-available
bin/solr package install solr-splainer
bin/solr package deploy solr-splainer -y -cluster
```



## Building and installation

This plugin requires a manual custom step added after you run the main `grunt dist` process in the Splainer application that builds a complete webapp in the `../dist` directory.  _This should be automated someday ;-( _.

1. Copy the following Javascript and paste it at the bottom of `/dist/scripts/app.js`:

```
/* Override default config values for talking to Solr
 * JSONP->GET
 * */
angular.module('o19s.splainer-search')
  .value('defaultSolrConfig', {
    sanitize:     true,
    highlight:    true,
    debug:        true,
    numberOfRows: 10,
    escapeQuery:  true,
    apiMethod:    'GET'
  });
```

1. Export the private key:

```
export SOLR_PACKAGE_SIGNING_PRIVATE_KEY_PATH=~/ssh/solr-private-key.pem
```

1. Build the package:

```
mvn package
```

1. Now for testing, host the solr-splainer-package/repo locally:

First copy the generated jar into the repo directory:

```
cp target/solr-splainer-package* repo/
```

```
python -m http.server
```

1. In a Run Solr and install the package:

    tar -xf solr-9.3.0.tgz; cd solr-9.3.0/
    bin/solr start -c -e films -Denable.packages=true
    bin/solr package add-repo splainer-dev "http://localhost:8000/repo/" 
    bin/solr package list-available
    bin/solr package install solr-splainer
    bin/solr package deploy solr-splainer -y -cluster

1. Navigate to http://localhost:8983/v2/splainer on the browser.

## Changes to make it work in Solr Admin UI

See [diff from main project](https://github.com/o19s/splainer/compare/main...softwaredoug:solr-splainer:main#diff-18e01ac6a833fb1b20ffbad54f0ad8834a765e766f72cccda1e56cb942864d25R30)

* Changes communication with Solr to use GET instead af JSONP, same way the Admin UI communicates with Solr










## Who?

Based on Another Hack by [Doug Turnbull](http://softwaredoug.com) https://github.com/softwaredoug/solr-splainer.   This works if you can't use Solr Packages in your environment.

Created by [OpenSource Connections](http://opensourceconnections.com).

Thanks to all the [community contributors](https://github.com/o19s/splainer/graphs/contributors) for finding bugs and sharing fixes!.

## License

Released under [Apache 2](LICENSE.txt)
