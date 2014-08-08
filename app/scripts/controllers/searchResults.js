'use strict';

/**
 * @ngdoc function
 * @name frontendApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the frontendApp
 */
angular.module('splain-app')
  .controller('SearchResultsCtrl', function ($scope, solrSearchSvc, solrUrlSvc, esSearchSvc, fieldSpecSvc, normalDocsSvc, settingsStoreSvc) {
    $scope.search = {};
    $scope.search.searcher = null;
    $scope.search.docs = [];
    $scope.search.NO_SEARCH = 0;
    $scope.search.DID_SEARCH = 1;
    $scope.search.WAITING_FOR_SEARCH = 2;
    $scope.search.IN_ERROR = 3;

    
    var searchSettings = settingsStoreSvc.get();

    var reset = function() {
      $scope.search.linkUrl = '#';
      $scope.search.state = $scope.search.WAITING_FOR_SEARCH;
      $scope.search.paging = false;
      $scope.search.docs.length = 0;
      $scope.search.numFound = 0;
      $scope.search.maxScore = 0;
      $scope.search.displayedResults = 0;
    };
    reset();
    $scope.search.state = $scope.search.NO_SEARCH;

    var createSearcher = function(fieldSpec, parsedArgs) {
      if (searchSettings.whichEngine === settingsStoreSvc.ENGINES.ELASTICSEARCH) {
        try {
          parsedArgs = angular.fromJson(searchSettings.searchArgsStr); 
        } catch (SyntaxError) {
          parsedArgs = '';
        }
          
        return esSearchSvc.createSearcher(fieldSpec.fieldList(),
                                          searchSettings.searchUrl, parsedArgs, '');
        
      } else {
        parsedArgs = solrUrlSvc.parseSolrArgs(searchSettings.searchArgsStr);
        return solrSearchSvc.createSearcher(fieldSpec.fieldList(),
                                            searchSettings.searchUrl, parsedArgs, '');
      }
    };

    $scope.search.search = function() {
      var promise = Promise.create($scope.search.search);
      var fieldSpec = fieldSpecSvc.createFieldSpec(searchSettings.fieldSpecStr);
      var parsedArgs = null;
      $scope.search.searcher = createSearcher(fieldSpec, parsedArgs);
      reset();
      
      $scope.search.searcher.search()
      .then(function() {
        $scope.search.linkUrl = $scope.search.searcher.linkUrl;
        $scope.search.numFound = $scope.search.searcher.numFound;
        if ($scope.search.searcher.inError) {
          $scope.search.state = $scope.search.IN_ERROR;
          return;
        }

        angular.forEach($scope.search.searcher.docs, function(doc) {
          var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
          if (normalDoc.score > $scope.search.maxScore) {
            $scope.search.maxScore = normalDoc.score;
            console.log('new max score' + $scope.search.maxScore);
          }
          $scope.search.docs.push(normalDoc);
          $scope.search.displayedResults++;
        });
        $scope.search.state = $scope.search.DID_SEARCH;
        promise.complete();
      });
      return promise;
    };

    $scope.search.moreResults = function() {
      return ($scope.search.displayedResults < $scope.search.numFound);
    };
    
    $scope.search.page = function() {
      if ($scope.search.searcher === null) {
        return;
      }

      var fieldSpec = fieldSpecSvc.createFieldSpec(searchSettings.fieldSpecStr);
      $scope.search.searcher = $scope.search.searcher.pager();
      if ($scope.search.searcher) {
        $scope.search.paging = true;
        $scope.search.searcher.search()
        .then(function() {
          $scope.search.paging = false;
          if ($scope.search.searcher.inError) {
            $scope.search.state = $scope.search.IN_ERROR;
            return;
          }
          angular.forEach($scope.search.searcher.docs, function(doc) {
              var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
              $scope.search.docs.push(normalDoc);
              $scope.search.displayedResults++;
          });
        });
      }
    };
  });
