'use strict';

angular.module('splain-app')
  .controller('StartUrlCtrl', function ($scope, solrSettingsSvc, settingsStoreSvc, $location) {
    // initialize the start URL
    $scope.start = {};
    $scope.start.settings = settingsStoreSvc.settings;

    var onStartUrl = function(overridingFieldSpec) {
      solrSettingsSvc.fromStartUrl($scope.start.settings.startUrl, $scope.start.settings, overridingFieldSpec);
      $scope.search.search()
      .then(function() {
        settingsStoreSvc.save();
      });
    };

    if ($location.search().hasOwnProperty('solr')) {
      $scope.start.settings.startUrl = $location.search().solr;
      var overridingFieldSpec;
      if ($location.search().hasOwnProperty('fieldSpec')) {
        overridingFieldSpec = $location.search().fieldSpec;
      }
      onStartUrl(overridingFieldSpec);
    }

    $scope.start.submit = function() {
      onStartUrl();
    };
  });
