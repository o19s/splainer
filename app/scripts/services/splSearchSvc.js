'use strict';

/**
 * Angular shim for the pure splSearch module (splSearch.js).
 *
 * Phase 11a: constants (states, engines) and createSearch live in
 * globalThis.SplainerServices.splSearch. This wrapper still injects the
 * Angular `Search` factory and passes it through to createSearch — the
 * Search factory itself is extracted in Phase 11d.
 *
 * Deleted in Phase 12 when the controller is removed.
 */
angular.module('splain-app').service('splSearchSvc', [
  'Search',
  function (Search) {
    var svc = globalThis.SplainerServices && globalThis.SplainerServices.splSearch;
    if (!svc) {
      throw new Error(
        'splSearchSvc: SplainerServices.splSearch global is missing — ' +
          'check that scripts/services/dist/splSearch.js is loaded before this script.',
      );
    }

    this.states = svc.states;
    this.engines = svc.engines;

    this.createSearch = function (searchSettings, overridingExplains) {
      return svc.createSearch(Search, searchSettings, overridingExplains);
    };
  },
]);
