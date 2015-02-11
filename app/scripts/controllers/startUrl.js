'use strict';

angular.module('splain-app')
  .controller('StartUrlCtrl', function ($scope, solrSettingsSvc, settingsStoreSvc, $location) {
    // initialize the start URL
    $scope.start = {};
    $scope.start.settings = settingsStoreSvc.settings;

    var onStartUrl = function() {
      solrSettingsSvc.fromStartUrl($scope.start.settings.startUrl, $scope.start.settings);
      $scope.search.search()
      .then(function() {
        settingsStoreSvc.save();
      });
    };

    if ($location.search().hasOwnProperty('solr')) {
      $scope.start.settings.startUrl = $location.search().solr;
      onStartUrl();
    }

    $scope.start.submit = function() {
      onStartUrl();
    };
  });
