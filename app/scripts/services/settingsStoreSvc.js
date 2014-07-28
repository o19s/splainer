'use strict';

// Executes a solr search and returns
// a set of queryDocs
angular.module('splain-app')
  .service('settingsStoreSvc', function settingsStoreSvc(localStorageService, solrSearchSvc) {
    
    var deleteUnwantedArgs = function(argsToUse) {
        delete argsToUse.fl;
        delete argsToUse.wt;
        delete argsToUse.rows;
    };

    var parseUserSettings = function(userSettings) {
      var parsedUrl = solrSearchSvc.parseSolrUrl(userSettings.solrUrl);
      if (parsedUrl !== null && parsedUrl.solrArgs && Object.keys(parsedUrl.solrArgs).length > 0) {
        var argsToUse = angular.copy(parsedUrl.solrArgs);
        deleteUnwantedArgs(argsToUse);
        userSettings.solrArgsStr = solrSearchSvc.formatSolrArgs(argsToUse);
        if (parsedUrl.solrArgs.hasOwnProperty('fl')) {
          var fl = parsedUrl.solrArgs.fl;
          userSettings.fieldSpecStr = fl[0];
        }
      } 
      userSettings.solrUrl = parsedUrl.solrEndpoint();
    };
    
    var initSolrArgs = function() {
      var solrSettings = {solrUrl: '', fieldSpecStr: '', solrArgsStr: ''};
      var localStorageTryGet = function(key) {
        var val = localStorageService.get(key);
        if (val !== null) {
          solrSettings[key] = val;
        } else {
          solrSettings[key] = '';
        }
      };
      if (localStorageService.isSupported) {
        localStorageTryGet('solrUrl');
        localStorageTryGet('fieldSpecStr');
        localStorageTryGet('solrArgsStr');
      }
      return solrSettings;
    };
    
    var trySaveSolrArgs= function(solrSettings) {
      if (localStorageService.isSupported) {
        localStorageService.set('solrUrl', solrSettings.solrUrl);
        localStorageService.set('fieldSpecStr', solrSettings.fieldSpecStr);
        localStorageService.set('solrArgsStr', solrSettings.solrArgsStr);
      }
    };

    // init from local storage if there
    var solrSettings = initSolrArgs();

    this.get = function() {
      return solrSettings;
    };

    /*
     * save changes to settings
     * */
    this.parse = function() {
      parseUserSettings(solrSettings);
    };

    this.commit = function() {
      trySaveSolrArgs(solrSettings);
    };

    this.fromStartUrl = function(startUrl) {
      solrSettings.solrUrl = startUrl;
      this.parse();
    };
  });
