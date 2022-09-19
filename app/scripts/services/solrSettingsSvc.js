'use strict';

angular.module('splain-app')
  .service('solrSettingsSvc', function solrSettingsSvc(solrUrlSvc, fieldSpecSvc) {

    var reconstructFullUrl = function(userSettings) {
      var fieldSpec = fieldSpecSvc.createFieldSpec(userSettings.fieldSpecStr);
      var fl = null;
      if (fieldSpec.subs !== '*') {
        fl = [fieldSpec.title];
        angular.forEach(fieldSpec.subs, function(subFieldName) {
          fl.push(subFieldName);
        });
        fl = [fl.join(' ')];
      }
      var parsedArgs = solrUrlSvc.parseSolrArgs(userSettings.searchArgsStr);
      if (fl !== null) {
        parsedArgs.fl = fl;
      }
      return solrUrlSvc.buildUrl(userSettings.searchUrl, parsedArgs);
    };

    var newlineSolrArgs = function(searchArgsStr) {
      return searchArgsStr.split('&').join('\n&');
    };

    var fromParsedUrl = function(userSettings, parsedUrl, overrideFieldSpec) {
      var argsToUse = angular.copy(parsedUrl.solrArgs);
      solrUrlSvc.removeUnsupported(argsToUse);
      userSettings.searchArgsStr = newlineSolrArgs(solrUrlSvc.formatSolrArgs(argsToUse));
      if (userSettings.searchArgsStr.trim().length === 0) {
        userSettings.searchArgsStr = 'q=*:*';
      }
      if (overrideFieldSpec) {
        userSettings.fieldSpecStr = overrideFieldSpec;
      } else if (parsedUrl.solrArgs.hasOwnProperty('fl')) {
        var fl = parsedUrl.solrArgs.fl;
        userSettings.fieldSpecStr = fl[0];
      } else {
        userSettings.fieldSpecStr = 'title, *';
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
    this.fromStartUrl = function(newStartUrl, searchSettings, overrideFieldSpec) {
      searchSettings.whichEngine = 'solr';
      searchSettings.startUrl = newStartUrl;
      var parsedUrl = solrUrlSvc.parseSolrUrl(newStartUrl);
      if (parsedUrl !== null) {
        fromParsedUrl(searchSettings, parsedUrl, overrideFieldSpec);
      }
      return searchSettings;
    };

  });
