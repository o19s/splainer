'use strict';

/**
 * Angular shim around the Preact `docRow` island
 * (app/scripts/islands/docRow.jsx, built to dist/docRow.js).
 *
 * Replaces app/scripts/controllers/docRow.js (deleted in PR 9a) and
 * app/views/docRow.html (no longer referenced; the island owns rendering).
 *
 * The shim is split-style (see islands/README.md): the *island* owns
 * rendering, but the shim retains two responsibilities:
 *
 *   1. Opening the modals via $uibModal — both the "Detailed" explain
 *      modal (used by the still-Angular <stacked-chart> child) and the
 *      "show raw doc" modal (called from the island's title-click
 *      handler). Both go away in PR 9bc when the modal pattern moves to
 *      native <dialog>.
 *
 *   2. $compile-ing the still-Angular <stacked-chart> child into a slot
 *      the island provides via the registerChartHost callback. This is
 *      an inversion of PR 8's pattern (Preact-parent / Angular-child)
 *      and is bounded to a single PR — stackedChart becomes its own
 *      island in 9bc, at which point this whole shim collapses to ~20
 *      lines.
 *
 * The doc.showDetailed mutation that the old controller did is preserved
 * here: <stacked-chart>'s template references `detailed()` which is
 * isolate-bound to `doc.showDetailed`, so the doc object must have it
 * attached before <stacked-chart> compiles. doc.showDoc is gone — only
 * the island's title link consumed it, and the island calls onShowDoc
 * directly via a prop.
 */
angular.module('splain-app').directive('docRow', [
  '$uibModal',
  '$compile',
  'settingsStoreSvc',
  function ($uibModal, $compile, settingsStoreSvc) {
    return {
      restrict: 'E',
      priority: 1000,
      scope: {
        doc: '=',
        maxScore: '=',
      },
      // No templateUrl — the island renders the row, the shim mounts it
      // into the directive's element. The element is initially empty.
      template: '',
      link: function (scope, element) {
        var rootEl = element[0];
        var island = window.SplainerIslands && window.SplainerIslands.docRow;
        if (!island) {
          throw new Error(
            'docRow directive: SplainerIslands.docRow global is missing — ' +
              'check that app/scripts/islands/dist/docRow.js is loaded.',
          );
        }

        // Modal openers — relocated bodies of the old DocRowCtrl methods.
        // Identical resolve shape so DocExplainCtrl / DetailedDocCtrl
        // continue to receive `doc` and `canExplainOther` exactly as
        // before. Both are deleted in PR 9bc.
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
          $uibModal.open({
            templateUrl: 'views/detailedDoc.html',
            controller: 'DetailedDocCtrl',
            resolve: {
              doc: function () {
                return doc;
              },
            },
          });
        }

        // Track the chart-host element the island reports on each render.
        // The island calls registerChartHost(el) on every render; we
        // re-$compile <stacked-chart> into the latest host whenever the
        // host identity changes (it survives re-renders within a single
        // mount but resets across unmount/remount). Compiling on every
        // change is the simplest correct strategy.
        //
        // **Why the early-return is safe** (load-bearing, non-obvious):
        // Preact's reconciler does not query real DOM children — it
        // tracks its own children via vnode metadata. When the island
        // re-renders (e.g. after the deep $watch on doc fires), Preact
        // diffs its empty-children vtree for the chart-host <div>
        // against the vnode children it created (also empty). It never
        // notices the Angular-injected <stacked-chart> child and
        // therefore never removes it. The chart compiles ONCE and
        // survives every subsequent re-render. If this property ever
        // changes (e.g. Preact gains "remove unknown DOM children"
        // semantics), the chart will vanish on the second digest tick
        // after first mount, and the symptom will be "the Detailed link
        // disappears mid-test" — not "chart was never created."
        var compiledChart = null;
        var currentChartHost = null;

        function registerChartHost(hostEl) {
          if (!hostEl || hostEl === currentChartHost) return;
          currentChartHost = hostEl;
          // Tear down a previous compiled chart if it existed.
          if (compiledChart) {
            compiledChart.scope().$destroy();
            compiledChart.remove();
            compiledChart = null;
          }
          // <stacked-chart> reads `hots` and `detailed` off the parent
          // scope. We use a child scope of the directive's isolate scope
          // so the bindings resolve to scope.doc / scope.maxScore as
          // expected. The detailed binding is `doc.showDetailed`, which
          // we attach below before compile time.
          var chartScope = scope.$new();
          var chartEl = angular.element(
            '<stacked-chart hots="doc.hotMatchesOutOf(maxScore)" detailed="doc.showDetailed"></stacked-chart>',
          );
          $compile(chartEl)(chartScope);
          angular.element(hostEl).append(chartEl);
          compiledChart = chartEl;
        }

        function rerender() {
          if (!scope.doc) return;
          // Attach the modal opener to the doc object so the still-
          // Angular <stacked-chart> child's `detailed="doc.showDetailed"`
          // binding has something to call. Mirrors the old controller's
          // behavior, including a known latent issue we're knowingly
          // preserving rather than fixing in 9a:
          //
          //   *Latent closure leak* (also present in the old controller):
          //   we never `delete scope.doc.showDetailed` on $destroy. The
          //   doc object outlives the directive (it lives in the parent's
          //   currSearch.docs); after destroy, doc.showDetailed still
          //   points to `openDetailed`, a closure capturing the destroyed
          //   isolate scope. If a stale reference calls it, the modal
          //   still opens (the closure resolves doc via the destroyed-
          //   but-not-GC'd scope) — functional but leaky. Strangler-fig:
          //   not introduced by 9a, not fixed by 9a. Goes away in PR 9bc
          //   when the modal pattern moves to native <dialog> and the
          //   doc-mutation pattern is replaced by a prop callback.
          scope.doc.showDetailed = openDetailed;

          // Preact's reconciler diffs the new tree against the existing
          // one — calling mount on every $watch tick is cheap and
          // idempotent, exactly like the PR 6/7 pattern.
          island.mount(rootEl, scope.doc, {
            onShowDoc: openShowDoc,
            registerChartHost: registerChartHost,
          });
        }

        // Deep watch on doc — splainer-search may mutate the doc object
        // in place (highlighted snippets, computed scores) so reference
        // equality is not enough.
        scope.$watch('doc', rerender, true);
        scope.$watch('maxScore', rerender);

        scope.$on('$destroy', function () {
          if (compiledChart) {
            compiledChart.scope().$destroy();
            compiledChart.remove();
            compiledChart = null;
          }
          island.unmount(rootEl);
        });

        // First render. The $watch above will fire on the next digest,
        // but we mount immediately so the DOM is populated before any
        // user interaction.
        rerender();
      },
    };
  },
]);
