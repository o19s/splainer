'use strict';

angular.module('splain-app')
  .controller('SettingsCtrl', [
    '$scope',
    'settingsStoreSvc',
    'solrSettingsSvc',
    'esSettingsSvc',
    function ($scope, settingsStoreSvc, solrSettingsSvc, esSettingsSvc) {

      $scope.settings = settingsStoreSvc.settings;
      $scope.workingSettings = settingsStoreSvc.settings[settingsStoreSvc.settings.whichEngine];
      $scope.workingWhichEngine = settingsStoreSvc.settings.whichEngine;

      $scope.$watch('settings.whichEngine', function() {
        $scope.workingWhichEngine = settingsStoreSvc.settings.whichEngine;
      });

      $scope.$watch('workingWhichEngine', function() {
        $scope.workingSettings = settingsStoreSvc.settings[$scope.workingWhichEngine];
      });


      $scope.publishSearcher = function() {
        if ( $scope.workingWhichEngine === 'solr' ) {
          settingsStoreSvc.settings.whichEngine = 'solr';
          solrSettingsSvc.fromTweakedSettings($scope.workingSettings);
        } else if ( $scope.workingWhichEngine === 'es' ) {
          settingsStoreSvc.settings.whichEngine = 'es';
          esSettingsSvc.fromTweakedSettings($scope.workingSettings);
        }

        $scope.search.search()
        .then(function() {
          settingsStoreSvc.save();
        });
      };
    }
  ]);
