'use strict';

angular.module('splain-app')
  .controller('SettingsCtrl', [
    '$scope',
    'settingsStoreSvc',
    'solrSettingsSvc',
    'esSettingsSvc',
    function ($scope, settingsStoreSvc, solrSettingsSvc, esSettingsSvc) {

      $scope.whichEngine = settingsStoreSvc.settings.whichEngine;
      $scope.searchSettings = settingsStoreSvc.settings[$scope.whichEngine];

      $scope.$watch('whichEngine', function() {
        $scope.searchSettings = settingsStoreSvc.settings[$scope.whichEngine];
      });

      $scope.searchSettings.publishSearcher = function() {
        if ( $scope.whichEngine === 'solr' ) {
          solrSettingsSvc.fromTweakedSettings($scope.searchSettings);
        } else if ( $scope.whichEngine === 'es' ) {
          esSettingsSvc.fromTweakedSettings($scope.searchSettings);
        }

        $scope.search.search()
        .then(function() {
          settingsStoreSvc.save();
        });
      };
    }
  ]);
