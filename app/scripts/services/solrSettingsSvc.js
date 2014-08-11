'use strict';

angular.module('splain-app')
  .service('solrSettingsSvc', function solrSettingsSvc(solrUrlSvc, fieldSpecSvc) {

    var reconstructFullUrl = function(userSettings) {
      var fieldSpec = fieldSpecSvc.createFieldSpec(userSettings.fieldSpecStr);
      var fl = fieldSpec.fieldList();
      var parsedArgs = solrUrlSvc.parseSolrArgs(userSettings.searchArgsStr);
      parsedArgs.fl = [fl.join(' ')];
      return solrUrlSvc.buildUrl(userSettings.searchUrl, parsedArgs);
    };

    var fromParsedUrl = function(userSettings, parsedUrl) {
      var argsToUse = angular.copy(parsedUrl.solrArgs);
      solrUrlSvc.removeUnsupported(argsToUse);
      userSettings.searchArgsStr = solrUrlSvc.formatSolrArgs(argsToUse);
      if (parsedUrl.solrArgs.hasOwnProperty('fl')) {
        var fl = parsedUrl.solrArgs.fl;
        userSettings.fieldSpecStr = fl[0];
      }
      userSettings.searchUrl = parsedUrl.solrEndpoint();
    };
    
    /* Update/sanitize settings from user input when tweaking
     * (ie user updates solr URL or search args, fields, etc)
     * */ 
    this.fromTweakedSettings = function(searchSettings) {
      var parsedUrl = solrUrlSvc.parseSolrUrl(searchSettings.searchUrl);
      if (parsedUrl !== null && parsedUrl.solrArgs && Object.keys(parsedUrl.solrArgs).length > 0) {
        fromParsedUrl(searchSettings, parsedUrl);
      }
      searchSettings.startUrl = reconstructFullUrl(searchSettings);
      return searchSettings;
    };

    /* Create settings from a pasted in user URL
     * (ie from start screen)
     *
     * */ 
    this.fromStartUrl = function(newStartUrl, searchSettings) {
      searchSettings.whichEngine = 0;
      searchSettings.startUrl = newStartUrl;
      var parsedUrl = solrUrlSvc.parseSolrUrl(newStartUrl);
      if (parsedUrl !== null && parsedUrl.solrArgs && Object.keys(parsedUrl.solrArgs).length > 0) {
        fromParsedUrl(searchSettings, parsedUrl);
      }
      return searchSettings;
    };

  });
