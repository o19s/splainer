'use strict';

// Executes a solr search and returns
// a set of queryDocs
angular.module('splain-app')
  .service('solrSearchSvc', function solrSearchSvc($http) {
    // AngularJS will instantiate a singleton by calling 'new' on this function
    var activeQueries = 0;

    var buildUrl = function(url, urlArgs) {
      var baseUrl = url + '?';
      angular.forEach(urlArgs, function(values, param) {
        angular.forEach(values, function(value) {
          baseUrl += param + '=' + value + '&';
        });
      });
      // percentages need to be escaped before
      // url escaping
      baseUrl = baseUrl.replace(/%/g, '%25');
      return baseUrl.slice(0, -1); // take out last & or trailing ? if no args
    };

    var searchSvc = this;
    var buildTokensUrl = function(fieldList, solrUrl, idField, docId) {
      var escId = encodeURIComponent(searchSvc.escapeUserQuery(docId));
      var tokensArgs = {
        'indent': ['true'],
        'wt': ['xml'],
        //'q': [idField + ':' + escId],
        'facet': ['true'],
        'facet.field': [],
        'facet.mincount': ['1'],
      };
      angular.forEach(fieldList, function(fieldName) {
        if (fieldName !== 'score') {
          tokensArgs['facet.field'].push(fieldName);
        }
      });
      return buildUrl(solrUrl, tokensArgs) + '&q=' + idField + ':'  + escId;
    };

    var buildSolrUrl = function(fieldList, solrUrl, solrArgs, queryText) {
      solrArgs.fl = [fieldList.join(' ')];
      solrArgs.wt = ['json'];
      solrArgs.debug = ['true'];
      solrArgs['debug.explain.structured'] = ['true'];
      var baseUrl = buildUrl(solrUrl, solrArgs);
      baseUrl = baseUrl.replace(/#\$query##/g, encodeURIComponent(queryText));
      return baseUrl;
    };

    var SolrSearcher = function(fieldList, solrUrl, solrArgs, queryText) {
      this.callUrl = this.linkUrl = '';
      this.callUrl = buildSolrUrl(fieldList, solrUrl, solrArgs, queryText);
      this.linkUrl = this.callUrl.replace('wt=json', 'wt=xml');
      this.linkUrl = this.linkUrl + '&indent=true&echoParams=all';
      this.docs = [];
      this.numFound = 0;
      this.inError = false;


      this.search = function() {
        var url = this.callUrl + '&json.wrf=JSON_CALLBACK';
        this.inError = false;
        
        var promise = Promise.create(this.search);
        var that = this;

        var getExplData = function(data) {
          if (data.hasOwnProperty('debug')) {
            var dbg = data.debug;
            if (dbg.hasOwnProperty('explain')) {
              return dbg.explain;
            }
          }
          return {};
        };

        activeQueries++;
        $http.jsonp(url).success(function(data) {
          activeQueries--;
          that.numFound = data.response.numFound;
          var explDict = getExplData(data);
          angular.forEach(data.response.docs, function(solrDoc) {
            solrDoc.url = function(idField, docId) {
              return buildTokensUrl(fieldList, solrUrl, idField, docId);
            };
            solrDoc.explain = function(docId) {
              if (explDict.hasOwnProperty(docId)) {
                return explDict[docId];
              } else {
                return '';
              }
            };
            that.docs.push(solrDoc);
          });
          promise.complete();
        }).error(function() {
          activeQueries--;
          that.inError = true;
          promise.complete();
        });
        return promise;

      };
    };

    this.createSearcherFromSettings = function(settings, queryText) {
      return new SolrSearcher(settings.createFieldSpec().fieldList(), settings.solrUrl,
                              settings.selectedTry.solrArgs, queryText);
    };

    this.createSearcher = function (fieldList, solrUrl, solrArgs, queryText) {
      return new SolrSearcher(fieldList, solrUrl, solrArgs, queryText);
    };

    this.activeQueries = function() {
      return activeQueries;
    };
    
    this.escapeUserQuery = function(queryText) {
      var escapeChars = ['+', '-', '&', '!', '(', ')', '[', ']',
                         '{', '}', '^', '"', '~', '*', '?', ':', '\\'];
      var regexp = new RegExp('(\\' + escapeChars.join('|\\') + ')', 'g');
      return queryText.replace(regexp, '\\$1');
    };

    this.parseSolrArgs = function(argsStr) {
      var splitUp = argsStr.split('?');
      if (splitUp.length === 2) {
        argsStr = splitUp[1];
      }
      var vars = argsStr.split('&');
      var rVal = {};
      angular.forEach(vars, function(qVar) {
        var nameAndValue = qVar.split('=');
        if (nameAndValue.length === 2) {
          var name = nameAndValue[0];
          var value = nameAndValue[1];
          if (!rVal.hasOwnProperty(name)) {
            rVal[name] = [value];
          } else {
            rVal[name].push(value);
          }
        }
      });
      return rVal;
    };

  });
