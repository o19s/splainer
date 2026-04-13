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

This plugin requires a manual custom step added after you run the main `yarn dist` process in the Splainer application that builds a complete webapp in the `../dist` directory.  _This should be automated someday ;-( _.

1. Configure Splainer to use GET instead of JSONP for Solr connections:

**To change the API method from JSONP to GET:**

Edit `dist/node_modules/splainer-search/dist/splainer-search-wired.js` and locate the `defaultSolrConfig` object (around line 4060).
Search for `values/defaultSolrConfig.js`.

Change:

```javascript
apiMethod: "JSONP"
```

to:

```javascript
apiMethod: "GET"
```

This change ensures Splainer communicates with Solr using GET requests (same as the Solr Admin UI) instead of JSONP, which is the appropriate method when Splainer is running as a plugin inside Solr.

1. With the `solr-splainer-package` directory:

```
cd ./solr-splainer-package
```

1. Export the private key:

```
export SOLR_PACKAGE_SIGNING_PRIVATE_KEY_PATH=~/.ssh/solr-private-key.pem
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

And then serve them up:

```
python -m http.server
```

1. In a Run Solr and install the package:

    tar -xf solr-10.0.0.tgz; cd solr-10.0.0/
    bin/solr start -e films -Denable.packages=true
    bin/solr package add-repo splainer-dev "http://localhost:8000/repo/" 
    bin/solr package list-available
    bin/solr package install solr-splainer
    bin/solr package deploy solr-splainer -y -cluster

1. Navigate to http://localhost:8983/v2/splainer on the browser.

## Who?

Based on Another Hack by [Doug Turnbull](http://softwaredoug.com) https://github.com/softwaredoug/solr-splainer.   This works if you can't use Solr Packages in your environment.

Created by [OpenSource Connections](http://opensourceconnections.com).

Thanks to all the [community contributors](https://github.com/o19s/splainer/graphs/contributors) for finding bugs and sharing fixes!.

## License

Released under [Apache 2](LICENSE.txt)
