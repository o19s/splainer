'use strict';

/**
 * @ngdoc function
 * @name frontendApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the frontendApp
 */
angular.module('splain-app')
  .controller('SearchResultsCtrl', function ($scope, $q, splSearchSvc, settingsStoreSvc) {

    $scope.search = {};

    $scope.showParsedQueryDetails = false;
    $scope.showQueryDetails = false;

    /* Initiate a new search with the latest settings
     * */
    $scope.search.search = function() {
      $scope.showParsedQueryDetails = false;
      $scope.showQueryDetails = false;
      var deferred = $q.defer();
      $scope.currSearch.search()
      .then(function() {
        $scope.currSearch.engine = settingsStoreSvc.settings.whichEngine;
        deferred.resolve();
      });
      return deferred.promise;
    };

    $scope.search.reset = function() {
      var searchSettings = settingsStoreSvc.settings;
      $scope.currSearch = splSearchSvc.createSearch(searchSettings);
      $scope.showParsedQueryDetails = false;
      $scope.showQueryDetails = false;
    };

    $scope.search.reset();

  });
