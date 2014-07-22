'use strict';

angular.module('splain-app')
  .controller('SolrSettingsCtrl', function ($scope, solrSearchSvc, fieldSpecSvc, normalDocsSvc, localStorageService) {

    /*
     * Take user input settings, massage them
     * if only URL provided etc
     */
    var parseUserSettings = function(userSettings) {
      var parsedUrl = solrSearchSvc.parseSolrUrl(userSettings.solrUrl);
      if (userSettings.solrArgsStr.trim() === '' && parsedUrl !== null) {
        var argsToUse = angular.copy(parsedUrl.solrArgs);
        delete argsToUse.fl; 
        userSettings.solrArgsStr = solrSearchSvc.formatSolrArgs(argsToUse);
      } 
      if (userSettings.fieldSpecStr.trim() === '' && parsedUrl !== null && parsedUrl.solrArgs.hasOwnProperty('fl')) {
        var fl = parsedUrl.solrArgs.fl;
        userSettings.fieldSpecStr = fl[0];
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
      if (localStorageService.isSupported()) {
        localStorageTryGet('solrUrl');
        localStorageTryGet('fieldSpecStr');
        localStorageTryGet('solrArgsStr');
      }
      return solrSettings;
    };

    var trySaveSolrArgs= function(solrSettings) {
      if (localStorageService.isSupported()) {
        localStorageService.set('solrUrl', solrSettings.solrUrl);
        localStorageService.set('fieldSpecStr', solrSettings.fieldSpecStr);
        localStorageService.set('solrArgsStr', solrSettings.solrArgsStr);
      }
    };

    $scope.solrSettings = initSolrArgs();

    $scope.solrSettings.publishSearcher = function() {
      parseUserSettings($scope.solrSettings);
      console.log('publishing search');
      var fieldSpec = fieldSpecSvc.createFieldSpec(this.fieldSpecStr);
      var parsedArgs = solrSearchSvc.parseSolrArgs(this.solrArgsStr);
      $scope.main.solrSearcher = solrSearchSvc.createSearcher(fieldSpec.fieldList(), this.solrUrl, parsedArgs, '');
      $scope.main.solrSearcher.search()
      .then(function() {
        trySaveSolrArgs($scope.solrSettings);
        $scope.main.docs.length = 0;
        angular.forEach($scope.main.solrSearcher.docs, function(doc) {
          $scope.main.docs.push(normalDocsSvc.createNormalDoc(fieldSpec, doc));
        });
      });
    };
    
  });
