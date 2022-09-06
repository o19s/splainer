'use strict';

angular.module('splain-app')
  .service('splSearchSvc', [
    'Search',
    function splSearchSvc(Search) {
      var thisSvc = this;

      thisSvc.states = {
        NO_SEARCH:          0,
        DID_SEARCH:         1,
        WAITING_FOR_SEARCH: 2,
        IN_ERROR:           3
      };

      thisSvc.engines = {
        SOLR:           'solr',
        ELASTICSEARCH:  'es',
        OPENSEARCH:     'os'
      };

      this.createSearch = function(searchSettings, overridingExplains) {
        var search = new Search(searchSettings, overridingExplains, thisSvc.states, thisSvc.engines);

        search.NO_SEARCH          = thisSvc.states.NO_SEARCH;
        search.DID_SEARCH         = thisSvc.states.DID_SEARCH;
        search.WAITING_FOR_SEARCH = thisSvc.states.WAITING_FOR_SEARCH;
        search.IN_ERROR           = thisSvc.states.IN_ERROR;

        if (!searchSettings.whichEngine) {
          searchSettings.whichEngine = thisSvc.engines.SOLR;
        }

        return search;
      };
    }
  ]);
