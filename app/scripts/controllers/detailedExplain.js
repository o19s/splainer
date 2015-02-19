'use strict';

angular.module('splain-app')
  .controller('DocExplainCtrl', function DocExplainCtrl($scope, doc) {
    // this controller is a bit silly just because
    // modals need their own controller
    $scope.doc = doc;
    $scope.altDoc = null;
  });
