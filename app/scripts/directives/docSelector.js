'use strict';

/**
 * Angular shim around the Preact `docSelector` island
 * (app/scripts/islands/docSelector.jsx, built to dist/docSelector.js).
 *
 * Replaces app/scripts/controllers/docSelector.js and app/views/docSelect.html
 * (PR 8). The island owns only the altQuery form + error banner. The result
 * list (ng-repeat over currSearch.docs rendering <doc-row>) is still Angular,
 * inlined below in the `template` string, because <doc-row> is not migrated
 * until PR 9. See PR8_DOCSELECTOR_ISLAND.md for the Option-A rationale.
 *
 * The 6 splainer-search services that the old controller injected
 * (searchSvc, solrUrlSvc, settingsStoreSvc, fieldSpecSvc,
 * solrExplainExtractorSvc, esExplainExtractorSvc) move here — the island
 * knows nothing about Angular DI. The `onExplainOther` callback holds the
 * relocated body of the old controller's explainOther.
 *
 * <!-- TODO(PR9): replace the Angular ng-repeat below with a <doc-row-list>
 *      island once DocRow is migrated. -->
 */
angular.module('splain-app').directive('docSelector', [
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
        docSelection: '=',
      },
      template:
        '<div class="doc-selector-island-root" data-role="doc-selector-root"></div>' +
        '<hr />' +
        '<div class="container" ng-repeat="doc in currSearch.docs">' +
        '  <doc-row' +
        '    detailed-explain-link="false"' +
        '    max-score="currSearch.maxScore"' +
        '    doc="doc"' +
        '    ng-click="selectDoc(doc)"' +
        '  ></doc-row>' +
        '  <hr />' +
        '</div>',
      link: function (scope, element) {
        // currSearch + selectDoc live on the directive's isolate scope so
        // the legacy ng-repeat block (still Angular) keeps working. The
        // island writes results back into scope.currSearch via onExplainOther.
        scope.currSearch = { maxScore: 0 };

        scope.selectDoc = function (doc) {
          scope.docSelection = doc;
        };

        // The island mounts into the first child of the directive element
        // (the data-role="doc-selector-root" div above). We look it up by
        // attribute rather than by index to survive template edits.
        var rootEl = element[0].querySelector('[data-role="doc-selector-root"]');
        var island = window.SplainerIslands && window.SplainerIslands.docSelector;
        if (!island) {
          throw new Error(
            'docSelector directive: SplainerIslands.docSelector global is missing — ' +
              'check that app/scripts/islands/dist/docSelector.js is loaded.',
          );
        }

        // Relocated body of the old DocSelectorCtrl.explainOther. Returns a
        // promise so the island can toggle its pending/error state. Mirrors
        // PR 5's .catch on splainer-search 3.0.0's new rejection contract:
        // the rejection propagates to the island, which renders err.message.
        function onExplainOther(altQuery) {
          var settings = settingsStoreSvc.settings;
          // Same fieldSpec instance is handed to both createSearcher and
          // explainOther — splainer-search expects this pairing.
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
          // Preserve existing behavior: reset docs before the request so
          // the legacy ng-repeat clears while the request is in flight.
          // The current Angular controller does this the same way — do not
          // "fix" it in this PR (strangler-fig rule). PR 12 can revisit.
          scope.$apply(function () {
            scope.currSearch.docs = [];
          });
          return searcher
            .explainOther(altQuery, fieldSpec)
            .then(function () {
              // Destroyed-scope guard: the modal this directive lives in
              // can close mid-request (user hits Esc / clicks the backdrop).
              // The old controller ran on a longer-lived scope so this race
              // was tighter; the isolate-scope shim widens the window, and
              // without this guard the follow-up $apply throws and the
              // pageerror spy in the Playwright smoke suite fires on any
              // subsequent test. PR 12 can do a proper cancel token.
              if (scope.$$destroyed) return;
              var normalizedDocs;
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
              scope.$apply(function () {
                scope.currSearch.numFound = searcher.numFound;
                scope.currSearch.lastQuery = altQuery;
                scope.currSearch.docs = normalizedDocs;
                // Preserve the original maxScore semantics: never resets,
                // only ratchets up. Latent oddity; out of scope for PR 8.
                angular.forEach(scope.currSearch.docs, function (doc) {
                  if (doc.score() > scope.currSearch.maxScore) {
                    scope.currSearch.maxScore = doc.score();
                  }
                });
              });
            });
        }

        function rerender() {
          island.mount(rootEl, {}, { onExplainOther: onExplainOther });
        }

        scope.$on('$destroy', function () {
          island.unmount(rootEl);
        });

        // No $watch — intentional deviation from the PR 6/7 shim pattern.
        // The island takes no reactive props (settings are read lazily
        // inside onExplainOther at submit time), owns its own form state,
        // and has no external data to sync. A single mount is sufficient.
        rerender();
      },
    };
  },
]);
