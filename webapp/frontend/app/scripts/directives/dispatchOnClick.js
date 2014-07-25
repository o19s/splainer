'use strict';

angular.module('splain-app')
  .directive('dispatchOnClick', function () {
    return {
      restrict: 'A',
      priority: 1000,
      link: function togglerLink(scope, element, attrs) {
        element.on('click', function() {
          var clickCustomEvt = attrs.dispatchOnClick;
          element.trigger(clickCustomEvt);
        });
      }
    };
  });
