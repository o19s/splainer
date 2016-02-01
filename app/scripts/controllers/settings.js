'use strict';

angular.module('splain-app')
  .controller('SettingsCtrl', [
    '$scope',
    'settingsStoreSvc',
    'solrSettingsSvc',
    'esSettingsSvc',
    function ($scope, settingsStoreSvc, solrSettingsSvc, esSettingsSvc) {

      $scope.searchSettings = settingsStoreSvc.settings;

      $scope.searchSettings.publishSearcher = function() {
        if ( $scope.searchSettings.whichEngine === 'solr' ) {
          solrSettingsSvc.fromTweakedSettings($scope.searchSettings);
        } else if ( $scope.searchSettings.whichEngine === 'es' ) {
          esSettingsSvc.fromTweakedSettings($scope.searchSettings);
        }

        $scope.search.search()
        .then(function() {
          settingsStoreSvc.save();
        });
      };
    }
  ]);
