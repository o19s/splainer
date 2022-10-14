'use strict';

angular.module('splain-app')
  .directive('customHeaders', [
    function () {
      return {
        scope: {
          settings: '='
        },
        controller: 'CustomHeadersCtrl',
        restrict: 'E',
        templateUrl: 'views/customHeaders.html'
      };
    }
  ]);
