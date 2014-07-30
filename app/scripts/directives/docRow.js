'use strict';

angular.module('splain-app')
  .directive('docRow', function () {
    return {
      restrict: 'E',
      priority: 1000,
      scope: {
          doc: '=',
          maxScore: '='
      },
      templateUrl: 'views/docRow.html',
      controller: 'DocRowCtrl'
    };
  });
