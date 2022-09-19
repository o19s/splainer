'use strict';

angular.module('splain-app')
  .controller('SettingsCtrl', [
    '$scope',
    'settingsStoreSvc',
    'solrSettingsSvc',
    'esSettingsSvc',
    'osSettingsSvc',
    function ($scope, settingsStoreSvc, solrSettingsSvc, esSettingsSvc, osSettingsSvc) {

      $scope.settings = settingsStoreSvc.settings;
      $scope.workingSettings = settingsStoreSvc.settings[settingsStoreSvc.settings.whichEngine];
      $scope.workingWhichEngine = settingsStoreSvc.settings.whichEngine;

      $scope.$watch('settings.whichEngine', function() {
        $scope.workingWhichEngine = settingsStoreSvc.settings.whichEngine;
      });

      $scope.$watch('workingWhichEngine', function() {
        $scope.workingSettings = settingsStoreSvc.settings[$scope.workingWhichEngine];
      });

      $scope.autoIndent = function() {
        if ($scope.workingWhichEngine === 'es' || $scope.workingWhichEngine === 'os')  {
          $scope.workingSettings.searchArgsStr = JSON.stringify(JSON.parse($scope.workingSettings.searchArgsStr), null, 2);
        }
      };

      $scope.aceSettings = function(_editor) {
        _editor.session.setTabSize(2);
      };

      $scope.publishSearcher = function() {
        if ( $scope.workingWhichEngine === 'solr' ) {
          settingsStoreSvc.settings.whichEngine = 'solr';
          solrSettingsSvc.fromTweakedSettings($scope.workingSettings);
        } else if ( $scope.workingWhichEngine === 'es' ) {
          settingsStoreSvc.settings.whichEngine = 'es';
          esSettingsSvc.fromTweakedSettings($scope.workingSettings);
        } else if ( $scope.workingWhichEngine === 'os' ) {
          settingsStoreSvc.settings.whichEngine = 'os';
          osSettingsSvc.fromTweakedSettings($scope.workingSettings);
        }

        $scope.search.search()
        .then(function() {
          settingsStoreSvc.save();
        });
      };
    }
  ]);
