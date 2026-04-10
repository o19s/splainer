'use strict';

/**
 * Angular directive shim for the Preact searchResults island.
 * Mounts the island and wires explainOther, pagination, and Solr services.
 *
 * Element: <search-results-island curr-search="currSearch"></search-results-island>
 */
angular.module('splain-app').directive('searchResultsIsland', [
  'settingsStoreSvc',
  'searchSvc',
  'solrUrlSvc',
  'fieldSpecSvc',
  'solrExplainExtractorSvc',
  'esExplainExtractorSvc',
  function (
    settingsStoreSvc,
    searchSvc,
    solrUrlSvc,
    fieldSpecSvc,
    solrExplainExtractorSvc,
    esExplainExtractorSvc,
  ) {
    return {
      restrict: 'E',
      scope: {
        currSearch: '=',
      },
      link: function (scope, element) {
        var rootEl = element[0];
        var island = window.SplainerIslands && window.SplainerIslands.searchResults;
        if (!island) {
          throw new Error(
            'searchResultsIsland directive: SplainerIslands.searchResults global ' +
              'is missing — check that app/scripts/islands/dist/searchResults.js is loaded.',
          );
        }

        // --- explainOther (absorbed from directives/docRow.js) ---
        // Builds a splainer-search searcher from current settings, runs
        // searcher.explainOther(altQuery), normalizes results via the
        // appropriate engine extractor. Returns Promise<{docs, maxScore}>.
        function explainOther(altQuery) {
          var settings = settingsStoreSvc.settings;
          var fieldSpec = fieldSpecSvc.createFieldSpec(settings.fieldSpecStr());
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
          var searcher = searchSvc.createSearcher(
            fieldSpec,
            settings.searchUrl(),
            args,
            '',
            {},
            settings.whichEngine,
          );
          return searcher.explainOther(altQuery, fieldSpec).then(function () {
            var normalizedDocs = [];
            if (searcher.type === 'solr') {
              normalizedDocs = solrExplainExtractorSvc.docsWithExplainOther(
                searcher.docs,
                fieldSpec,
                searcher.othersExplained,
              );
            } else if (searcher.type === 'es' || searcher.type === 'os') {
              normalizedDocs = esExplainExtractorSvc.docsWithExplainOther(
                searcher.docs,
                fieldSpec,
              );
            }
            var altMaxScore = 0;
            normalizedDocs.forEach(function (d) {
              if (d.score() > altMaxScore) altMaxScore = d.score();
            });
            return { docs: normalizedDocs, maxScore: altMaxScore };
          });
        }

        // Pagination — wraps currSearch.page() in $apply so the $q
        // deferred chain processes within a digest cycle.
        function onPage() {
          scope.$apply(function () {
            scope.currSearch.page();
          });
        }

        function rerender() {
          island.mount(rootEl, {
            currSearch: scope.currSearch,
            explainOther: explainOther,
            solrUrlSvc: solrUrlSvc,
            onPage: onPage,
          });
        }

        // O(1) watches — identity + scalars. Each expression is a
        // cheap reference/number comparison, no deep walking.
        //
        // Why these specific properties:
        //   - currSearch identity: catches reset() (new Search instance)
        //   - state: catches search lifecycle (NO_SEARCH → WAITING → DID/ERROR)
        //   - docs.length: catches pagination (page() pushes new docs)
        //   - paging: catches the loading flag during pagination
        //   - numFound: set in search success, rendered in "N Total Results"
        //   - engine: set by SearchResultsCtrl.then() AFTER Search.search()
        //     resolves — separate $q callback, may settle after state watcher
        //   - searcher: new reference each search, carries queryDetails
        scope.$watchGroup(
          [
            function () {
              return scope.currSearch;
            },
            function () {
              return scope.currSearch && scope.currSearch.state;
            },
            function () {
              return scope.currSearch && scope.currSearch.docs && scope.currSearch.docs.length;
            },
            function () {
              return scope.currSearch && scope.currSearch.paging;
            },
            function () {
              return scope.currSearch && scope.currSearch.numFound;
            },
            function () {
              return scope.currSearch && scope.currSearch.engine;
            },
            function () {
              return scope.currSearch && scope.currSearch.searcher;
            },
          ],
          rerender,
        );

        scope.$on('$destroy', function () {
          island.unmount(rootEl);
        });

        rerender();
      },
    };
  },
]);
