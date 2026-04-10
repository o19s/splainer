'use strict';

/**
 * Pure-JS search service constants and factory — no Angular dependency.
 *
 * Extracted from the Angular splSearchSvc (Phase 11a). The Angular
 * service file (splSearchSvc.js) is now a thin wrapper that delegates
 * to globalThis.SplainerServices.splSearch.
 *
 * `createSearch` accepts the Search constructor as its first argument
 * so this module has no dependency on the Angular `Search` factory.
 * The Angular wrapper passes the injected factory through.
 */

export var states = {
  NO_SEARCH: 0,
  DID_SEARCH: 1,
  WAITING_FOR_SEARCH: 2,
  IN_ERROR: 3,
};

export var engines = {
  SOLR: 'solr',
  ELASTICSEARCH: 'es',
  OPENSEARCH: 'os',
};

export function createSearch(Search, searchSettings, overridingExplains) {
  var search = new Search(searchSettings, overridingExplains, states, engines);

  search.NO_SEARCH = states.NO_SEARCH;
  search.DID_SEARCH = states.DID_SEARCH;
  search.WAITING_FOR_SEARCH = states.WAITING_FOR_SEARCH;
  search.IN_ERROR = states.IN_ERROR;

  if (!searchSettings.whichEngine) {
    searchSettings.whichEngine = engines.SOLR;
  }

  return search;
}

if (typeof globalThis !== 'undefined') {
  globalThis.SplainerServices = globalThis.SplainerServices || {};
  globalThis.SplainerServices.splSearch = { states, engines, createSearch };
}
