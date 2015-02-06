'use strict';

angular.module('splain-app')
  .controller('StartUrlCtrl', function ($scope, solrSettingsSvc, settingsStoreSvc, $location) {
    // initialize the start URL
    $scope.start = {};
    $scope.start.settings = settingsStoreSvc.settings;

    var onStartUrl = function() {
      // push start URL into settings and go!
      solrSettingsSvc.fromStartUrl($scope.start.settings.startUrl, $scope.start.settings);
      $scope.search.search()
      .then(function() {
        settingsStoreSvc.save();
      });
    };

    if ($location.search().hasOwnProperty('solr')) {
      /*$scope.start.settings.startUrl = $location.search().solr;
      onStartUrl();*/
    }

    $scope.$watch(function() {
      return $location.search().solr;
    }, function() {
      var solrParam = $location.search().solr;
      if (solrParam.indexOf('http') === 0) {
        $scope.start.settings.startUrl = $location.search().solr;
        onStartUrl();
      }
    });

    $scope.start.submit = function() {
      onStartUrl();
    };
  });
