'use strict';

angular.module('splain-app')
  .controller('DocSelectorCtrl', function DocExplainCtrl($scope, searchSvc, solrUrlSvc, settingsStoreSvc) {
    // this controller is a bit silly just because
    // modals need their own controller

    var addToSolrArgs = function(solrArgsStr, newParams) {
      var solrArgs = solrUrlSvc.parseSolrArgs(solrArgsStr);
      angular.forEach(newParams, function(value, arg) {
        solrArgs[arg] = value;
      });
      return solrUrlSvc.formatSolrArgs(solrArgs);
    };


    $scope.altQuery = '';

    $scope.explainOther = function(altQuery) {
      var searchSettings = settingsStoreSvc.settings;

      // explainOther by passing a explainOther=<luceneQuery> to
      // the user's current settings and rerunning the search
      searchSettings = angular.copy(searchSettings);
      // we should be using the solrUrlSvc to do this
      searchSettings.searchArgsStr = addToSolrArgs(searchSettings.searchArgsStr,
                                                   {'explainOther': [altQuery]});
      var explainOtherSearch = searchSvc.createSearch(searchSettings);
      explainOtherSearch.search()
      .then(function() {
        // but we don't get anything but an explain, so let's re-search
        // and try to pull back the right data
        searchSettings = angular.copy(searchSettings);
        searchSettings.searchArgsStr = 'q=' + altQuery;
        $scope.currSearch = searchSvc.createSearch(searchSettings, explainOtherSearch.searcher.othersExplained);
        $scope.currSearch.search();
      });
    };


    $scope.selectDoc = function(doc) {
      console.log('selected: ' + doc.id);
      $scope.docSelection = doc;
    };
  });
