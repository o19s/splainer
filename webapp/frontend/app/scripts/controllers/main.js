'use strict';

/**
 * @ngdoc function
 * @name frontendApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the frontendApp
 */
angular.module('splain-app')
  .controller('MainCtrl', function ($scope, solrSearchSvc, fieldSpecSvc, normalDocsSvc, settingsStoreSvc) {
    $scope.main = {};
    $scope.main.searcher = null;
    $scope.main.docs = [];
    $scope.main.NO_SEARCH = 0;
    $scope.main.DID_SEARCH = 1;
    $scope.main.WAITING_FOR_SEARCH = 2;
    $scope.main.IN_ERROR = 2;
    $scope.main.state = $scope.main.NO_SEARCH;
    
    var solrSettings = settingsStoreSvc.get();

    $scope.main.search = function() {
      var promise = Promise.create($scope.main.search);
      var fieldSpec = fieldSpecSvc.createFieldSpec(solrSettings.fieldSpecStr);
      var parsedArgs = solrSearchSvc.parseSolrArgs(solrSettings.solrArgsStr);
      $scope.main.solrSearcher = solrSearchSvc.createSearcher(fieldSpec.fieldList(),
                                                              solrSettings.solrUrl, parsedArgs, '');
      $scope.main.state = $scope.main.WAITING_FOR_SEARCH;
      $scope.main.solrSearcher.search()
      .then(function() {
        $scope.main.docs.length = 0;
        angular.forEach($scope.main.solrSearcher.docs, function(doc) {
          $scope.main.docs.push(normalDocsSvc.createNormalDoc(fieldSpec, doc));
        });
        $scope.main.state = $scope.main.DID_SEARCH;
        promise.complete();
      });
      return promise;
    };
  });
