'use strict';

/**
 * Angular shim around the Preact docRow island
 * (app/scripts/islands/docRow.jsx). Mounts the island, deep-watches the
 * doc, and opens the two modals via $uibModal until the dialog pattern
 * lands in 9c/9d.
 *
 * Why scope.doc.showDetailed is mutated: existing Playwright tests
 * (`docSelector island: altQuery reaches the backend on the wire`,
 * `... backend error surfaces the error banner`, `detailed explain
 * modal renders the explain tree content`) drive the explain modal
 * via `scope.doc.showDetailed()` rather than clicking the chart link.
 * The doc-side handle has to keep working until 9d removes the
 * doc-mutation entirely along with the latent closure leak it carries
 * (the doc outlives the directive's isolate scope).
 */
angular.module('splain-app').directive('docRow', [
  '$uibModal',
  'settingsStoreSvc',
  function ($uibModal, settingsStoreSvc) {
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

        function openDetailed() {
          $uibModal.open({
            templateUrl: 'views/detailedExplain.html',
            controller: 'DocExplainCtrl',
            size: 'lg',
            resolve: {
              doc: function () {
                return scope.doc;
              },
              canExplainOther: function () {
                var allowed = ['es', 'os', 'solr'];
                return allowed.includes(settingsStoreSvc.settings.whichEngine);
              },
            },
          });
        }

        function openShowDoc(doc) {
          window.SplainerIslands.openDocModal('detailedDoc', doc, {});
        }

        function rerender() {
          // See file header for why we mutate the doc object here.
          scope.doc.showDetailed = openDetailed;
          island.mount(rootEl, scope.doc, {
            maxScore: scope.maxScore,
            onShowDoc: openShowDoc,
            onShowDetailed: openDetailed,
          });
        }

        // Deep watch on doc — splainer-search mutates docs in place
        // (highlighted snippets, computed scores) so reference equality
        // misses changes. Do not swap to $watchCollection without
        // verifying the mutate-in-place assumption first
        // (memory: feedback_deep_watch). 9d revisits this.
        scope.$watch('doc', rerender, true);
        scope.$watch('maxScore', rerender);

        scope.$on('$destroy', function () {
          island.unmount(rootEl);
        });
      },
    };
  },
]);
