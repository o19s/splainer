'use strict';

/**
 * Angular wrapper for the pure Search constructor (services/Search.js).
 *
 * Phase 11d: the real logic lives in globalThis.SplainerServices.Search
 * (built from services/Search.js by vite.islands.config.js). This file
 * injects the four splainer-search services from Angular DI, packs them
 * into a deps bag, and returns a curried constructor that splSearchSvc
 * passes to splSearch.createSearch().
 *
 * Deleted in Phase 12 when Angular DI is removed.
 */
angular.module('splain-app').factory('Search', [
  'solrUrlSvc',
  'fieldSpecSvc',
  'searchSvc',
  'normalDocsSvc',
  function (solrUrlSvc, fieldSpecSvc, searchSvc, normalDocsSvc) {
    var SearchCtor = globalThis.SplainerServices && globalThis.SplainerServices.Search;
    if (!SearchCtor) {
      throw new Error(
        'Search factory: SplainerServices.Search global is missing — ' +
          'check that scripts/services/dist/Search.js is loaded before this script.',
      );
    }

    var deps = {
      solrUrlSvc: solrUrlSvc,
      fieldSpecSvc: fieldSpecSvc,
      searchSvc: searchSvc,
      normalDocsSvc: normalDocsSvc,
    };

    // Return a constructor that curries the deps bag. splSearch.createSearch()
    // calls `new Search(searchSettings, overridingExplains, states, engines)`,
    // so the wrapper must accept those 4 positional args and prepend deps.
    return function WrappedSearch(searchSettings, overridingExplains, states, engines) {
      return new SearchCtor(deps, searchSettings, overridingExplains, states, engines);
    };
  },
]);
