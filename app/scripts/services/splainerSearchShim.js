'use strict';

/**
 * Angular compatibility shim for splainer-search 3.0.0.
 *
 * splainer-search 3.0.0 is framework-agnostic ESM. The pre-built wired IIFE
 * (dist/splainer-search-wired.js) exposes `SplainerSearchWired` on the global
 * object (`window` in the browser) with a `getDefaultWiredServices()` factory
 * that returns a pre-wired graph
 * of all the services splainer's controllers used to inject from the legacy
 * `o19s.splainer-search` Angular module.
 *
 * This shim re-exposes those services as Angular factories on the splain-app
 * module, with the *exact* names and shapes the existing controllers expect,
 * so PR 5 is a near-zero-diff dependency swap.
 *
 * When PRs 6–10 rewrite each view away from Angular, the controllers will
 * import from `splainer-search` directly and the corresponding factory below
 * gets deleted. The shim is the migration's life-support layer; it should
 * shrink with every PR until it disappears in PR 11.
 */
// Use Angular's array-injection form throughout so the shim survives any
// minifier without depending on grunt-ngmin. The rest of splainer's services
// follow this convention; PR 5 should not introduce drift.
angular
  .module('splain-app')
  .factory('_wiredSplainerSearch', [
    function () {
      var wired = window.SplainerSearchWired;
      if (typeof wired === 'undefined') {
        throw new Error(
          'splainerSearchShim: SplainerSearchWired global is missing — ' +
            'check that node_modules/splainer-search/dist/splainer-search-wired.js ' +
            'is loaded before this script.',
        );
      }
      // Lazy-loaded once internally; safe to call multiple times.
      return wired.getDefaultWiredServices();
    },
  ])
  .factory('searchSvc', [
    '_wiredSplainerSearch',
    function (_wiredSplainerSearch) {
      return _wiredSplainerSearch.searchSvc;
    },
  ])
  .factory('fieldSpecSvc', [
    '_wiredSplainerSearch',
    function (_wiredSplainerSearch) {
      return _wiredSplainerSearch.fieldSpecSvc;
    },
  ])
  .factory('normalDocsSvc', [
    '_wiredSplainerSearch',
    function (_wiredSplainerSearch) {
      return _wiredSplainerSearch.normalDocsSvc;
    },
  ])
  .factory('solrUrlSvc', [
    '_wiredSplainerSearch',
    function (_wiredSplainerSearch) {
      return _wiredSplainerSearch.solrUrlSvc;
    },
  ])
  .factory('esUrlSvc', [
    '_wiredSplainerSearch',
    function (_wiredSplainerSearch) {
      return _wiredSplainerSearch.esUrlSvc;
    },
  ])
  .factory('solrExplainExtractorSvc', [
    '_wiredSplainerSearch',
    function (_wiredSplainerSearch) {
      return _wiredSplainerSearch.solrExplainExtractorSvc;
    },
  ])
  .factory('esExplainExtractorSvc', [
    '_wiredSplainerSearch',
    function (_wiredSplainerSearch) {
      return _wiredSplainerSearch.esExplainExtractorSvc;
    },
  ]);
