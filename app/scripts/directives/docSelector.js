'use strict';

angular.module('splain-app')
  .directive('docSelector', function () {
    return {
      restrict: 'E',
      priority: 1000,
      scope: {
          docSelection: '=',
      },
      templateUrl: 'views/docSelect.html',
      controller: 'DocSelectorCtrl'
    };
  });
