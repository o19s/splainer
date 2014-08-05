'use strict';

/**
 * @ngdoc function
 * @name frontendApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the frontendApp
 */
angular.module('splain-app')
  .controller('SearchResultsCtrl', function ($scope, solrSearchSvc, esSearchSvc, fieldSpecSvc, normalDocsSvc, settingsStoreSvc) {
    $scope.search = {};
    $scope.search.searcher = null;
    $scope.search.docs = [];
    $scope.search.NO_SEARCH = 0;
    $scope.search.DID_SEARCH = 1;
    $scope.search.WAITING_FOR_SEARCH = 2;
    $scope.search.IN_ERROR = 3;

    
    var solrSettings = settingsStoreSvc.get();

    var reset = function() {
      $scope.search.linkUrl = '#';
      $scope.search.state = $scope.search.WAITING_FOR_SEARCH;
      $scope.search.docs.length = 0;
      $scope.search.numFound = 0;
      $scope.search.maxScore = 0;
    };
    reset();
    $scope.search.state = $scope.search.NO_SEARCH;

    $scope.search.search = function() {
      var promise = Promise.create($scope.search.search);
      var fieldSpec = fieldSpecSvc.createFieldSpec(solrSettings.fieldSpecStr);
      var parsedArgs = null;
      if (solrSettings.hasOwnProperty('elasticsearch')) {
        parsedArgs = angular.fromJson(solrSettings.solrArgsStr); 
        $scope.search.solrSearcher = esSearchSvc.createSearcher(fieldSpec.fieldList(),
                                                                solrSettings.solrUrl, parsedArgs, '');
        
      } else {
        parsedArgs = solrSearchSvc.parseSolrArgs(solrSettings.solrArgsStr);
        $scope.search.solrSearcher = solrSearchSvc.createSearcher(fieldSpec.fieldList(),
                                                                solrSettings.solrUrl, parsedArgs, '');
      }
      reset();
      
      $scope.search.solrSearcher.search()
      .then(function() {
        $scope.search.linkUrl = $scope.search.solrSearcher.linkUrl;
        $scope.search.numFound = $scope.search.solrSearcher.numFound;
        if ($scope.search.solrSearcher.inError) {
          $scope.search.state = $scope.search.IN_ERROR;
          return;
        }

        angular.forEach($scope.search.solrSearcher.docs, function(doc) {
          var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
          if (normalDoc.score > $scope.search.maxScore) {
            $scope.search.maxScore = normalDoc.score;
            console.log('new max score' + $scope.search.maxScore);
          }
          $scope.search.docs.push(normalDoc);
        });
        $scope.search.state = $scope.search.DID_SEARCH;
        promise.complete();
      });
      return promise;
    };
  });
