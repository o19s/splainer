'use strict';

angular.module('splain-app')
  .controller('StartUrlCtrl', function ($scope, solrSettingsSvc, settingsStoreSvc, $location) {
    // initialize the start URL
    $scope.start = {};
    $scope.start.settings = settingsStoreSvc.settings;

    var onStartUrl = function(overridingFieldSpec) {
      solrSettingsSvc.fromStartUrl($scope.start.settings.startUrl, $scope.start.settings, overridingFieldSpec);
      search();
    };

    var search = function() {
      $scope.search.search()
      .then(function() {
        settingsStoreSvc.save();
      });
    };

    var setEsSettings = function(settings) {
      $scope.start.settings.whichEngine   = 'es';
      $scope.start.settings.searchUrl     = settings.searchUrl;
      $scope.start.settings.searchArgsStr = settings.searchArgsStr;
    };

    var runEsSearch = function(settings) {
      setEsSettings(settings);
      search();
    };

    if ($location.search().hasOwnProperty('solr')) {
      $scope.start.settings.startUrl = $location.search().solr;
      var overridingFieldSpec;
      if ($location.search().hasOwnProperty('fieldSpec')) {
        overridingFieldSpec = $location.search().fieldSpec;
      }
      onStartUrl(overridingFieldSpec);
    } else if ($location.search().hasOwnProperty('esUrl')) {
      var settings = {
        searchUrl:      $location.search().esUrl,
        searchArgsStr:  $location.search().esQuery,
      };

      runEsSearch(settings);
    }

    $scope.start.submitSolr = function() {
      $scope.start.settings.whichEngine = 'solr';
      onStartUrl();
    };

    $scope.start.submitEs = function() {
      var settings = {
        searchUrl:      $scope.start.settings.startUrl,
        searchArgsStr:  $scope.start.settings.searchArgsStr,
      };

      runEsSearch(settings);
    };
  });
