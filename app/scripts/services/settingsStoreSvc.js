'use strict';

angular.module('splain-app')
  .service('settingsStoreSvc', function settingsStoreSvc(localStorageService, solrSearchSvc) {
    
    var deleteUnwantedArgs = function(argsToUse) {
        delete argsToUse.fl;
        delete argsToUse.wt;
        delete argsToUse.rows;
    };

    var parseUserSettings = function(userSettings) {
      var parsedUrl = solrSearchSvc.parseSolrUrl(userSettings.searchUrl);
      // es testing TODO determine if this is an elasticsearch endpoint better
      if (parsedUrl.port === '9200') {
        userSettings.searchUrl = parsedUrl.solrEndpoint();
        userSettings.whichEngine = this.ENGINES.ELASTICSEARCH;
        return;
      }

      userSettings.whichEngine = this.ENGINES.SOLR;
      if (parsedUrl !== null && parsedUrl.solrArgs && Object.keys(parsedUrl.solrArgs).length > 0) {
        var argsToUse = angular.copy(parsedUrl.solrArgs);
        deleteUnwantedArgs(argsToUse);
        userSettings.searchArgsStr = solrSearchSvc.formatSolrArgs(argsToUse);
        if (parsedUrl.solrArgs.hasOwnProperty('fl')) {
          var fl = parsedUrl.solrArgs.fl;
          userSettings.fieldSpecStr = fl[0];
        }
      } 
      userSettings.searchUrl = parsedUrl.solrEndpoint();
    };
    
    var initSearchArgs = function() {
      var searchSettings = {searchUrl: '', fieldSpecStr: '', searchArgsStr: ''};
      var localStorageTryGet = function(key) {
        var val;
        try {
          val = localStorageService.get(key);
        } catch (SyntaxError) {
          val = null;
        }
          
        if (val !== null) {
          searchSettings[key] = val;
        } else {
          searchSettings[key] = '';
        }
      };
      if (localStorageService.isSupported) {
        localStorageTryGet('searchUrl');
        localStorageTryGet('fieldSpecStr');
        localStorageTryGet('searchArgsStr');
        localStorageTryGet('whichEngine');
      }
      searchSettings.searchArgsStr = searchSettings.searchArgsStr.slice(1);
      return searchSettings;
    };
    
    var trySaveSolrArgs= function(searchSettings) {
      if (localStorageService.isSupported) {
        localStorageService.set('searchUrl', searchSettings.searchUrl);
        localStorageService.set('fieldSpecStr', searchSettings.fieldSpecStr);
        localStorageService.set('searchArgsStr', '?' + searchSettings.searchArgsStr);
        localStorageService.set('whichEngine', searchSettings.whichEngine);
      }
    };

    // init from local storage if there
    var searchSettings = initSearchArgs();

    this.ENGINES.SOLR = 0;
    this.ENGINES.ELASTICSEARCH = 1;

    this.get = function() {
      return searchSettings;
    };

    /*
     * save changes to settings
     * */
    this.parse = function() {
      parseUserSettings(searchSettings);
    };

    this.commit = function() {
      trySaveSolrArgs(searchSettings);
    };

    this.fromStartUrl = function(startUrl) {
      searchSettings.searchUrl = startUrl;
      this.parse();
    };
  });
