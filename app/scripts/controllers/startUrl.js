'use strict';

angular.module('splain-app')
  .controller('StartUrlCtrl', function ($scope, solrSettingsSvc, settingsStoreSvc) {
    // initialize the start URL
    $scope.start = {};
    $scope.start.settings = settingsStoreSvc.settings;

    $scope.start.submit = function() {
      // push start URL into settings and go!
      solrSettingsSvc.fromStartUrl($scope.start.settings.startUrl, $scope.start.settings);
      $scope.search.search()
      .then(function() {
        settingsStoreSvc.save();
      });
    
    };
  });
