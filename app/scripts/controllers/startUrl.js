'use strict';

angular.module('splain-app')
  .controller('StartUrlCtrl', function ($scope, solrSettingsSvc, settingsStoreSvc) {
    // initialize the start URL
    $scope.start = {};
    $scope.start.startUrl = 'http://localhost:8983/solr/collection1/select';
    var storedStartUrl = settingsStoreSvc.settings.startUrl;
    if (storedStartUrl !== null) {
      $scope.start.startUrl = storedStartUrl;
    }

    $scope.start.submit = function() {
      // push start URL into settings and go!
      var settings = settingsStoreSvc.settings;
      solrSettingsSvc.fromStartUrl($scope.start.startUrl, settings);
      $scope.search.search()
      .then(function() {
        settingsStoreSvc.save();
      });
    
    };
  });
