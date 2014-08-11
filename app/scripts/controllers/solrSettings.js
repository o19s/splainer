'use strict';

angular.module('splain-app')
  .controller('SolrSettingsCtrl', function ($scope, settingsStoreSvc, solrSettingsSvc) {

    $scope.searchSettings = settingsStoreSvc.settings;

    $scope.searchSettings.publishSearcher = function() {
      solrSettingsSvc.fromTweakedSettings($scope.searchSettings);

      $scope.search.search()
      .then(function() {
        settingsStoreSvc.save();
      });
    };
    
  });
