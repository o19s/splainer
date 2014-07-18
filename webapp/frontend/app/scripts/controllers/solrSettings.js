'use strict';

angular.module('splain-app')
  .controller('SolrSettingsCtrl', function ($scope, solrSearchSvc, fieldSpecSvc, normalDocsSvc, localStorageService) {

    var initSolrArgs = function() {
      var solrArgs = {solrUrl: '', fieldSpecStr: '', solrArgs: ''};
      var localStorageTryGet = function(key) {
        var val = localStorageService.get(key);
        if (val !== null) {
          solrArgs[key] = val;
        }
      };
      if (localStorageService.isSupported) {
        localStorageTryGet('solrUrl');
        localStorageTryGet('fieldSpecStr');
        localStorageTryGet('solrArgs');
      }
      return solrArgs;
    };

    var trySaveSolrArgs= function(solrArgs) {
      if (localStorageService.isSupported) {
        localStorageService.set('solrUrl', solrArgs.solrUrl);
        localStorageService.set('fieldSpecStr', solrArgs.fieldSpecStr);
        localStorageService.set('solrArgs', solrArgs.solrArgs);
      }
    };




    $scope.solrArgs = initSolrArgs();

    $scope.solrArgs.publishSearcher = function() {
      console.log('publishing search');
      var fieldSpec = fieldSpecSvc.createFieldSpec(this.fieldSpecStr);
      var parsedArgs = solrSearchSvc.parseSolrArgs(this.solrArgs);
      $scope.main.solrSearcher = solrSearchSvc.createSearcher(fieldSpec.fieldList(), this.solrUrl, parsedArgs, '');
      $scope.main.solrSearcher.search()
      .then(function() {
        trySaveSolrArgs($scope.solrArgs);
        $scope.main.docs.length = 0;
        angular.forEach($scope.main.solrSearcher.docs, function(doc) {
          $scope.main.docs.push(normalDocsSvc.createNormalDoc(fieldSpec, doc));
        });
      });
    };
    
  });
