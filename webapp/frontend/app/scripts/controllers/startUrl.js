'use strict';

angular.module('splain-app')
  .controller('StartUrlCtrl', function ($scope, localStorageService, settingsStoreSvc) {
    // initialize the start URL
    $scope.start = {};
    $scope.start.startUrl = 'http://localhost:8983/solr/collection1/select';
    if (localStorageService.isSupported) {
      var storedStartUrl = localStorageService.get('startUrl');
      $scope.start.startUrl = storedStartUrl;
    }

    $scope.start.submit = function() {
      // push start URL into settings and go!
      settingsStoreSvc.fromStartUrl($scope.start.startUrl);
      $scope.main.search()
      .then(function() {
        settingsStoreSvc.commit();
        if (localStorageService.isSupported) {
          localStorageService.set('startUrl', $scope.start.startUrl);
        }
      });
    
    };
  });
