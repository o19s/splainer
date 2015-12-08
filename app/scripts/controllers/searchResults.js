'use strict';

/**
 * @ngdoc function
 * @name frontendApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the frontendApp
 */
angular.module('splain-app')
  .controller('SearchResultsCtrl', function ($scope, spl_searchSvc, settingsStoreSvc) {


    $scope.search = {};

    /* Initiate a new search with the latest settings
     * */
    $scope.search.search = function() {
      var promise = Promise.create($scope.search.search);
      $scope.search.reset();
      $scope.currSearch.search()
      .then(function() {
        promise.complete();
      });
      return promise;
    };

    $scope.search.reset = function() {
      var searchSettings = settingsStoreSvc.settings;
      $scope.currSearch = spl_searchSvc.createSearch(searchSettings);
    };

    $scope.search.reset();

  });
