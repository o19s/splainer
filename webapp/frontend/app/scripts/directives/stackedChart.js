'use strict';
angular.module('splain-app')
  .filter('stackChartColor', function() {
    var colorClasses = ['red', 'orange', 'green', 'blue'];
    return function(input) {
      var idx = (input % colorClasses.length);
      return 'chart-area ' + colorClasses[idx];
    };
});

angular.module('splain-app')
  .filter('stackChartHeight', function() {

    return function(input) {
      return {'height': input + '%'};
    };
});

angular.module('splain-app')
  .directive('stackedChart', function () {
    return {
      restrict: 'E',
      priority: 1000,
      scope: {
          hots: '='
      },
      templateUrl: 'views/stackedChart.html'
    };
  });
    
