'use strict';

angular.module('splain-app')
  .controller('SolrSettingsCtrl', function ($scope, solrSearchSvc, fieldSpecSvc, normalDocsSvc, settingsStoreSvc) {

    $scope.searchSettings = settingsStoreSvc.get();

    $scope.searchSettings.publishSearcher = function() {
      settingsStoreSvc.parse();

      $scope.search.search()
      .then(function() {
        settingsStoreSvc.commit();
      });
    };
    
  });
