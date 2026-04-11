/**
 * Search state constants and factory. createSearch(Search, deps, settings)
 * produces a Search instance with state constants attached.
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

export function createSearch(Search, deps, searchSettings, overridingExplains) {
  var search = new Search(deps, searchSettings, overridingExplains, states, engines);

  search.NO_SEARCH = states.NO_SEARCH;
  search.DID_SEARCH = states.DID_SEARCH;
  search.WAITING_FOR_SEARCH = states.WAITING_FOR_SEARCH;
  search.IN_ERROR = states.IN_ERROR;

  if (!searchSettings.whichEngine) {
    searchSettings.whichEngine = engines.SOLR;
  }

  return search;
}
