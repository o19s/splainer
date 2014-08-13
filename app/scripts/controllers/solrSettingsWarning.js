'use strict';

angular.module('splain-app')
  .controller('SolrSettingsWarningCtrl', function ($scope, solrUrlSvc) {
    // pick through the warnings on the current settings
    // return array of unique warnings

    // Memoized warnings
    var lastArgsStr = -1;
    var lastWarnings = {};
    var getWarnings = function(argsStr) {
      if (argsStr !== lastArgsStr) {
        var parsed = solrUrlSvc.parseSolrArgs(argsStr);
        lastWarnings = solrUrlSvc.removeUnsupported(parsed);
      }
      lastArgsStr = argsStr;
      return lastWarnings;
    };

    $scope.warnings = {};

    $scope.warnings.shouldWarn = function(argsStr) {
      return (Object.keys(getWarnings(argsStr)).length > 0);
    };
    
    $scope.warnings.messages = function(argsStr) {
      var condensedWarnings = {};
      angular.forEach(getWarnings(argsStr), function(warning, argument) {
        // warning => [arg1, arg2...] 
        if (condensedWarnings.hasOwnProperty(warning)) {
          condensedWarnings[warning].push(argument);
        } else {
          condensedWarnings[warning] = [argument];
        }
      });

      return condensedWarnings;
    };
  });
