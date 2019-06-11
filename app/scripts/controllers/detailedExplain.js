'use strict';

angular.module('splain-app')
  .controller('DocExplainCtrl', function DocExplainCtrl($scope, doc, canExplainOther) {
    // this controller is a bit silly just because
    // modals need their own controller
    $scope.doc = doc;
    $scope.altDoc = null;
    $scope.canExplainOther = canExplainOther;
    $scope.toggled = false;
    $scope.toggleCompare = function() {
      $scope.toggled = !$scope.toggled;
      if (!$scope.toggled) {
        $scope.altDoc = null;
      }
    };
  });
