'use strict';

/**
 * Angular shim for the Preact docRow island. Deep-watches the doc and
 * opens explain / show-doc modals via openDocModal.
 *
 * Deep $watch — splainer-search mutates docs in place, so reference
 * equality misses changes. Do not swap to $watchCollection without
 * verifying the mutate-in-place assumption still holds.
 *
 * explainOther — builds a splainer-search searcher from current settings,
 * runs searcher.explainOther, and normalizes results via the appropriate
 * extractor. Returns { docs, maxScore } for the DocExplain island.
 */
angular.module('splain-app').directive('docRow', [
  'searchSvc',
  'solrUrlSvc',
  'settingsStoreSvc',
  'fieldSpecSvc',
  'solrExplainExtractorSvc',
  'esExplainExtractorSvc',
  function (
    searchSvc,
    solrUrlSvc,
    settingsStoreSvc,
    fieldSpecSvc,
    solrExplainExtractorSvc,
    esExplainExtractorSvc,
  ) {
    return {
      restrict: 'E',
      priority: 1000,
      scope: {
        doc: '=',
        maxScore: '=',
      },
      template: '',
      link: function (scope, element) {
        var rootEl = element[0];
        var splainerIslands = window.SplainerIslands || {};
        var island = splainerIslands.docRow;
        if (!island || typeof splainerIslands.openDocModal !== 'function') {
          throw new Error(
            'docRow directive: SplainerIslands.docRow / openDocModal missing — ' +
              'check that the islands/dist/*.js bundles are loaded.',
          );
        }

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

        function openDetailed() {
          window.SplainerIslands.openDocModal('detailedExplain', scope.doc, {
            canExplainOther: ['es', 'os', 'solr'].includes(
              settingsStoreSvc.settings.whichEngine,
            ),
            explainOther: explainOther,
            maxScore: scope.maxScore,
          });
        }

        function openShowDoc(doc) {
          window.SplainerIslands.openDocModal('detailedDoc', doc, {});
        }

        function rerender() {
          island.mount(rootEl, scope.doc, {
            maxScore: scope.maxScore,
            onShowDoc: openShowDoc,
            onShowDetailed: openDetailed,
          });
        }

        scope.$watch('doc', rerender, true);
        scope.$watch('maxScore', rerender);

        scope.$on('$destroy', function () {
          island.unmount(rootEl);
        });
      },
    };
  },
]);
