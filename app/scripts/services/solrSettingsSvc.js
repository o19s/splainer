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
      return searchArgsStr;//.split('&').join('\n&'); // remove &
    };

    var fromParsedUrl = function(userSettings, parsedUrl) {
      var argsToUse = angular.copy(parsedUrl.solrArgs);
      solrUrlSvc.removeUnsupported(argsToUse);
      userSettings.searchArgsStr = newlineSolrArgs(solrUrlSvc.formatSolrArgs(argsToUse));
      if (userSettings.searchArgsStr.trim().length === 0) {
        userSettings.searchArgsStr = 'q=*:*';
      }
      if (parsedUrl.solrArgs.hasOwnProperty('fl')) {
        var fl = parsedUrl.solrArgs.fl;
        userSettings.fieldSpecStr = fl[0];
      } else {
        userSettings.fieldSpecStr = '*';
      }
      userSettings.searchUrl = parsedUrl.solrEndpoint();
    };

    /* Update/sanitize settings from user input when tweaking
     * (ie user updates solr URL or search args, fields, etc)
     * */
    this.fromTweakedSettings = function(searchSettings) {
      if (searchSettings.searchArgsStrShow) {
        searchSettings.searchArgsStr = searchSettings.searchArgsStrShow.split('\n').join('&');
      }

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
      if (parsedUrl !== null) {
        fromParsedUrl(searchSettings, parsedUrl);
      }

      searchSettings.searchArgsStrShow = searchSettings.searchArgsStr.split('&').join('\n');

      return searchSettings;
    };

  });
