'use strict';

/**
 * Pure-JS Search constructor — no Angular dependency.
 *
 * Extracted from the Angular Search factory (Phase 11d). The Angular
 * factory file (factories/Search.js) is now a thin wrapper that injects
 * the four splainer-search services via DI and packs them into `deps`.
 *
 * deps = { solrUrlSvc, fieldSpecSvc, searchSvc, normalDocsSvc }
 *
 * The constructor is passed to splSearch.createSearch(), which attaches
 * state constants and handles whichEngine defaulting.
 */

function Search(deps, searchSettings, overridingExplains, states, engines) {
  var self = this;

  // Attributes
  self.searcher = null;

  // Functions
  self.reset = reset;
  self.hasGroup = hasGroup;
  self.moreResults = moreResults;
  self.getOverridingExplain = getOverridingExplain;
  self.search = search;
  self.page = page;

  if (Object.prototype.hasOwnProperty.call(searchSettings, 'whichEngine')) {
    self.engine = searchSettings.whichEngine;
  } else {
    self.engine = 'solr';
  }

  // Bootstrap
  self.reset();

  var createSearcher = function (fieldSpec, parsedArgs, searchSettings) {
    var activeSettings = searchSettings[searchSettings.whichEngine];

    if (searchSettings.whichEngine === engines.ELASTICSEARCH) {
      try {
        parsedArgs = JSON.parse(searchSettings.es.searchArgsStr);
      } catch (e) {
        parsedArgs = '';
        console.error(e);
      }
    } else if (searchSettings.whichEngine === engines.OPENSEARCH) {
      try {
        parsedArgs = JSON.parse(searchSettings.os.searchArgsStr);
      } catch (e) {
        parsedArgs = '';
        console.error(e);
      }
    } else {
      parsedArgs = deps.solrUrlSvc.parseSolrArgs(searchSettings.solr.searchArgsStr);
    }

    return deps.searchSvc.createSearcher(
      fieldSpec,
      searchSettings.searchUrl(),
      parsedArgs,
      '',
      {
        customHeaders: activeSettings.customHeaders,
      },
      searchSettings.whichEngine
    );
  };

  var groupedResultToNormalDocs = function (fieldSpec, groupedByResp) {
    Object.keys(groupedByResp).forEach(function (key) {
      groupedByResp[key].forEach(function (group) {
        for (var i = 0; i < group.docs.length; i++) {
          group.docs[i] = deps.normalDocsSvc.createNormalDoc(fieldSpec, group.docs[i]);
        }
      });
    });
  };

  function reset() {
    self.displayedResults = 0;
    self.numFound = 0;
    self.docs = [];
    self.grouped = {};
    self.maxScore = 0.0;
    self.linkUrl = '#';
    self.settings = {
      searchArgsStr: function () {
        return '';
      },
    };
    self.paging = false;
    self.state = states.NO_SEARCH;
    self.overridingExplains = {};
    self.errorMsg = '';

    if (overridingExplains) {
      self.overridingExplains = overridingExplains;
    }
  }

  function hasGroup() {
    return Object.keys(self.grouped).length > 0;
  }

  function moreResults() {
    return self.displayedResults < self.numFound;
  }

  function getOverridingExplain(doc, fieldSpec) {
    var idFieldName = fieldSpec.id;
    var id = doc[idFieldName];

    if (id && Object.prototype.hasOwnProperty.call(self.overridingExplains, id)) {
      return self.overridingExplains[id];
    }
    return null;
  }

  function search() {
    var fieldSpec = deps.fieldSpecSvc.createFieldSpec(searchSettings.fieldSpecStr());
    var parsedArgs = null;

    self.searcher = createSearcher(fieldSpec, parsedArgs, searchSettings);
    self.reset();
    self.state = states.WAITING_FOR_SEARCH;
    self.errorMsg = '';
    // Snapshot searchSettings so the island sees what was searched, not
    // what the user edited after the search started. Object.assign
    // preserves the top-level methods (searchUrl, fieldSpecStr,
    // searchArgsStr) that angular.copy also preserved; nested engine
    // sub-objects are cloned individually so in-place mutations to the
    // live store don't leak into the snapshot.
    self.settings = Object.assign({}, searchSettings, {
      solr: Object.assign({}, searchSettings.solr),
      es: Object.assign({}, searchSettings.es),
      os: Object.assign({}, searchSettings.os),
    });

    return self.searcher.search().then(
      function success() {
        self.linkUrl = self.searcher.linkUrl;
        self.numFound = self.searcher.numFound;

        self.searcher.docs.forEach(function (doc) {
          var overridingExpl = self.getOverridingExplain(doc, fieldSpec);
          var normalDoc = deps.normalDocsSvc.createNormalDoc(fieldSpec, doc, overridingExpl);

          if (normalDoc.score() > self.maxScore) {
            self.maxScore = normalDoc.score();
          }

          self.docs.push(normalDoc);
          self.displayedResults++;
        });

        self.grouped = JSON.parse(JSON.stringify(self.searcher.grouped));
        groupedResultToNormalDocs(fieldSpec, self.grouped);

        self.state = states.DID_SEARCH;
      },
      function searchFailure(msg) {
        self.state = states.IN_ERROR;
        self.linkUrl = self.searcher.linkUrl;
        self.errorMsg = msg.searchError;
        // Intentionally does not re-throw: callers (searchResultsCtrl)
        // chain .then() with no .catch(), so a rejection would become
        // an unhandled promise rejection. Returning from the error
        // handler produces a resolved promise — same behavior as the
        // old $q.defer() + deferred.resolve() pattern.
      }
    );
  }

  function page() {
    if (self.searcher === null) {
      return;
    }

    var fieldSpec = deps.fieldSpecSvc.createFieldSpec(searchSettings.fieldSpecStr());
    self.searcher = self.searcher.pager();

    if (self.searcher) {
      self.paging = true;

      return self.searcher.search().then(function () {
        self.paging = false;

        if (self.searcher.inError) {
          self.state = states.IN_ERROR;
          return;
        }

        self.searcher.docs.forEach(function (doc) {
          var overridingExpl = self.getOverridingExplain(doc, fieldSpec);
          var normalDoc = deps.normalDocsSvc.createNormalDoc(fieldSpec, doc, overridingExpl);

          self.docs.push(normalDoc);
          self.displayedResults++;
        });

        var grouped = JSON.parse(JSON.stringify(self.searcher.grouped));
        groupedResultToNormalDocs(fieldSpec, grouped);

        Object.keys(grouped).forEach(function (groupByKey) {
          if (Object.prototype.hasOwnProperty.call(self.grouped, groupByKey)) {
            var groupByToAppend = self.grouped[groupByKey];
            groupByToAppend.push.apply(groupByToAppend, grouped[groupByKey]);
          }
        });
      }, function pageFailure(msg) {
        // The old code had no error handler — the $q deferred stayed
        // forever-pending and the UI froze mid-page. With native
        // promises that becomes an unhandled rejection. This handler
        // is an intentional improvement: surface the error to the user.
        self.paging = false;
        self.state = states.IN_ERROR;
        self.errorMsg = msg && msg.searchError ? msg.searchError : '';
      });
    }
  }
}

export { Search };

if (typeof globalThis !== 'undefined') {
  globalThis.SplainerServices = globalThis.SplainerServices || {};
  globalThis.SplainerServices.Search = Search;
}
