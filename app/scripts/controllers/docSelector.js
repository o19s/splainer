'use strict';

angular.module('splain-app').controller('DocSelectorCtrl', [
  '$scope',
  'searchSvc',
  'splSearchSvc',
  'solrUrlSvc',
  'settingsStoreSvc',
  'fieldSpecSvc',
  'solrExplainExtractorSvc',
  'esExplainExtractorSvc',
  function DocExplainCtrl(
    $scope,
    searchSvc,
    splSearchSvc,
    solrUrlSvc,
    settingsStoreSvc,
    fieldSpecSvc,
    solrExplainExtractorSvc,
    esExplainExtractorSvc,
  ) {
    var createSearcher = function (fieldSpec, settings) {
      var args;
      if (settings.whichEngine === 'es' || settings.whichEngine === 'os') {
        try {
          args = angular.fromJson(settings.searchArgsStr());
        } catch (_e) {
          args = '';
        }
      } else {
        args = solrUrlSvc.parseSolrArgs(settings.searchArgsStr());
      }

      return searchSvc.createSearcher(
        fieldSpec,
        settings.searchUrl(),
        args,
        '',
        {},
        settings.whichEngine,
      );
    };

    $scope.currSearch = { maxScore: 0 };
    $scope.altQuery = '';

    $scope.explainOther = function (altQuery) {
      var settings = settingsStoreSvc.settings;
      var fieldSpec = fieldSpecSvc.createFieldSpec(settings.fieldSpecStr());
      var searcher = createSearcher(fieldSpec, settings);

      $scope.currSearch.docs = []; // reset the array for a new search
      // splainer-search 3.0.0 rejects on HTTP/parse errors instead of
      // resolving with { error }; the .catch below preserves the prior
      // user-visible behavior of surfacing failures via currSearch.errorMsg.
      searcher.explainOther(altQuery, fieldSpec).then(function () {
        $scope.currSearch.numFound = searcher.numFound;
        $scope.currSearch.lastQuery = altQuery;

        var normalizedDocs;
        if (searcher.type === 'solr') {
          normalizedDocs = solrExplainExtractorSvc.docsWithExplainOther(
            searcher.docs,
            fieldSpec,
            searcher.othersExplained,
          );
        } else if (searcher.type === 'es') {
          normalizedDocs = esExplainExtractorSvc.docsWithExplainOther(searcher.docs, fieldSpec);
        } else if (searcher.type === 'os') {
          // use ES for now
          normalizedDocs = esExplainExtractorSvc.docsWithExplainOther(searcher.docs, fieldSpec);
        }

        $scope.currSearch.docs = normalizedDocs;

        angular.forEach($scope.currSearch.docs, function (doc) {
          if (doc.score() > $scope.currSearch.maxScore) {
            $scope.currSearch.maxScore = doc.score();
            console.log('new max score: ' + $scope.currSearch.maxScore);
          }
        });
      }).catch(function (err) {
        $scope.currSearch.errorMsg = (err && err.message) || String(err);
      });
    };

    $scope.selectDoc = function (doc) {
      console.log('selected: ' + doc.id);
      $scope.docSelection = doc;
    };
  },
]);
