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
        // We should broadcast we are doing a search to tell SearchResultsCtrl
        // to set the showQueryDetails to false.
        $scope.search.search()
        .then(function() {
          settingsStoreSvc.save();
        });
      };

      var runSolrSearch = function(overridingFieldSpec) {
        // Should be setSolrSettings()
        settingsStoreSvc.settings.whichEngine = 'solr';
        solrSettingsSvc.fromStartUrl($scope.start.solrSettings.startUrl, $scope.start.solrSettings, overridingFieldSpec);
        search();
      };

      var setEsSettings = function(settings) {
        $scope.start.esSettings.startUrl      = settings.searchUrl;
        $scope.start.esSettings.searchArgsStr = settings.searchArgsStr;
        $scope.start.esSettings.fieldSpecStr = settings.fieldSpecStr;
        esSettingsSvc.fromStartUrl($scope.start.esSettings);
      };

      var runEsSearch = function(settings) {
        settingsStoreSvc.settings.whichEngine = 'es';
        setEsSettings(settings);
        search();
      };

      // If we have something set in the URL, use that
      var overridingFieldSpec;
      if ($location.search().hasOwnProperty('fieldSpec')) {
        overridingFieldSpec = $location.search().fieldSpec;
      }
      if ($location.search().hasOwnProperty('solr')) {
        $scope.start.solrSettings.startUrl = $location.search().solr;
        runSolrSearch(overridingFieldSpec);
      } else if ($location.search().hasOwnProperty('esUrl')) {
        var settings = {
          searchUrl:      $location.search().esUrl,
          searchArgsStr:  $location.search().esQuery,
          fieldSpecStr: overridingFieldSpec
        };

        runEsSearch(settings);
      }

      $scope.start.submitSolr = function() {
        runSolrSearch();
      };

      $scope.start.autoIndent = function() {
        $scope.start.esSettings.searchArgsStr = JSON.stringify(JSON.parse($scope.start.esSettings.searchArgsStr), null, 2);
      };

      $scope.start.submitEs = function() {
        var settings = {
          searchUrl:      $scope.start.esSettings.startUrl,
          searchArgsStr:  $scope.start.esSettings.searchArgsStr,
        };

        runEsSearch(settings);
      };
    }
  ]);
