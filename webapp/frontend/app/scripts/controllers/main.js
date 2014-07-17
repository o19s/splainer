'use strict';

/**
 * @ngdoc function
 * @name frontendApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the frontendApp
 */
angular.module('splain-app')
  .controller('MainCtrl', function ($scope) {
    $scope.main = {};
    $scope.main.searcher = null;
    $scope.main.docs = [];
  });
