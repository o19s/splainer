'use strict';

angular.module('splain-app')
  .controller('StartUrlCtrl', [
    '$scope',
    '$location',
    'settingsStoreSvc',
    'solrSettingsSvc',
    'esSettingsSvc',
    function (
      $scope,
      $location,
      settingsStoreSvc,
      solrSettingsSvc,
      esSettingsSvc
    ) {
      // initialize the start URL
      $scope.start = {};
      $scope.start.solrSettings = settingsStoreSvc.settings.solr;
      $scope.start.esSettings = settingsStoreSvc.settings.es;
      $scope.start.whichEngine = settingsStoreSvc.settings.whichEngine;



      var search = function() {
        $scope.search.search()
        .then(function() {
          settingsStoreSvc.save();
        });
      };

      var runSolrSearch = function(overridingFieldSpec) {
        solrSettingsSvc.fromStartUrl($scope.start.solrSettings.startUrl, $scope.start.solrSettings, overridingFieldSpec);
        search();
      };

      var setEsSettings = function(settings) {
        $scope.start.esSettings.startUrl      = settings.searchUrl;
        $scope.start.esSettings.searchArgsStr = settings.searchArgsStr;
        esSettingsSvc.fromStartUrl($scope.start.esSettings);
      };

      var runEsSearch = function(settings) {
        setEsSettings(settings);
        search();
      };

      // If we have something set in the URL, use that
      if ($location.search().hasOwnProperty('solr')) {
        $scope.start.solrSettings.startUrl = $location.search().solr;
        var overridingFieldSpec;
        if ($location.search().hasOwnProperty('fieldSpec')) {
          overridingFieldSpec = $location.search().fieldSpec;
        }
        runSolrSearch(overridingFieldSpec);
      } else if ($location.search().hasOwnProperty('esUrl')) {
        var settings = {
          searchUrl:      $location.search().esUrl,
          searchArgsStr:  $location.search().esQuery,
        };

        runEsSearch(settings);
      }

      $scope.start.submitSolr = function() {
        settingsStoreSvc.settings.whichEngine = 'solr';
        runSolrSearch();
      };

      $scope.start.submitEs = function() {
        settingsStoreSvc.settings.whichEngine = 'es';
        var settings = {
          searchUrl:      $scope.start.esSettings.startUrl,
          searchArgsStr:  $scope.start.esSettings.searchArgsStr,
        };

        runEsSearch(settings);
      };
    }
  ]);
