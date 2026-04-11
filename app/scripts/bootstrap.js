'use strict';

/**
 * Application bootstrap — replaces Angular module wiring, SearchResultsCtrl,
 * all directive shims, splainerSearchShim, and Angular service wrappers.
 *
 * Phase 12: this IIFE runs after all island and service dist scripts have
 * loaded. It wires the pure ESM services and Preact islands together with
 * plain JS — no framework, no DI container, no digest cycle.
 */
(function () {
  // --- Service references (replaces Angular DI) ---

  var wired = window.SplainerSearchWired.getDefaultWiredServices();
  var store = window.SplainerServices.settingsStore;
  var splSearch = window.SplainerServices.splSearch;
  var SearchCtor = window.SplainerServices.Search;
  var solrSettings = window.SplainerServices.solrSettings;
  var esSettings = window.SplainerServices.esSettings;
  var osSettings = window.SplainerServices.osSettings;

  var solrUrlSvc = wired.solrUrlSvc;
  var fieldSpecSvc = wired.fieldSpecSvc;
  var searchSvc = wired.searchSvc;
  var normalDocsSvc = wired.normalDocsSvc;
  var solrExplainExtractorSvc = wired.solrExplainExtractorSvc;
  var esExplainExtractorSvc = wired.esExplainExtractorSvc;

  // --- Curried Search constructor (replaces factories/Search.js) ---

  var deps = {
    solrUrlSvc: solrUrlSvc,
    fieldSpecSvc: fieldSpecSvc,
    searchSvc: searchSvc,
    normalDocsSvc: normalDocsSvc,
  };

  function WrappedSearch(searchSettings, overridingExplains, states, engines) {
    return new SearchCtor(deps, searchSettings, overridingExplains, states, engines);
  }

  // --- App state (replaces SearchResultsCtrl $scope) ---

  var currSearch = splSearch.createSearch(WrappedSearch, store.settings);
  var search = {};

  search.search = function () {
    return currSearch.search().then(function () {
      currSearch.engine = store.settings.whichEngine;
      renderAll();
    });
  };

  search.reset = function () {
    currSearch = splSearch.createSearch(WrappedSearch, store.settings);
    renderAll();
  };

  // --- explainOther (absorbed from directives/searchResults.js) ---

  function explainOther(altQuery) {
    var settings = store.settings;
    var fieldSpec = fieldSpecSvc.createFieldSpec(settings.fieldSpecStr());
    var args;
    if (settings.whichEngine === 'es' || settings.whichEngine === 'os') {
      try {
        args = JSON.parse(settings.searchArgsStr());
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
    return searcher.explainOther(altQuery, fieldSpec).then(function () {
      var normalizedDocs = [];
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
      var altMaxScore = 0;
      normalizedDocs.forEach(function (d) {
        if (d.score() > altMaxScore) altMaxScore = d.score();
      });
      return { docs: normalizedDocs, maxScore: altMaxScore };
    });
  }

  // --- Pagination (dual-render: synchronous start + async completion) ---

  function onPage() {
    var promise = currSearch.page();
    renderAll();
    if (promise && typeof promise.then === 'function') {
      promise.then(
        function () { renderAll(); },
        function () { renderAll(); },
      );
    }
  }

  // --- Settings publish (absorbed from directives/settings.js) ---

  function onPublish(whichEngine, workingSettings) {
    store.settings.whichEngine = whichEngine;
    if (whichEngine === 'solr') {
      solrSettings.fromTweakedSettings(solrUrlSvc, fieldSpecSvc, workingSettings);
    } else if (whichEngine === 'es') {
      esSettings.fromTweakedSettings(workingSettings);
    } else if (whichEngine === 'os') {
      osSettings.fromTweakedSettings(workingSettings);
    }
    search.search().then(function () {
      store.save();
    });
  }

  // --- Search submit from startUrl (absorbed from directives/startUrl.js) ---

  function runSearchAndSave() {
    return search.search().then(function () {
      store.save();
    });
  }

  function runSolr(overridingFieldSpec) {
    store.settings.whichEngine = 'solr';
    var solr = store.settings.solr;
    solrSettings.fromStartUrl(solrUrlSvc, fieldSpecSvc, solr.startUrl, solr, overridingFieldSpec);
    return runSearchAndSave();
  }

  // Bug-for-bug parity with legacy StartUrlCtrl: on a user-driven submit,
  // fieldSpecStr is written as undefined so esSettings/osSettings re-derives
  // it from the URL's stored_fields param. See startUrl directive comments.
  function applyExtra(target, extra) {
    if (extra && extra.searchUrl !== undefined) target.startUrl = extra.searchUrl;
    if (extra && extra.searchArgsStr !== undefined) target.searchArgsStr = extra.searchArgsStr;
    target.fieldSpecStr = extra ? extra.fieldSpecStr : undefined;
  }

  function runEs(extra) {
    store.settings.whichEngine = 'es';
    var es = store.settings.es;
    applyExtra(es, extra);
    esSettings.fromStartUrl(es);
    return runSearchAndSave();
  }

  function runOs(extra) {
    store.settings.whichEngine = 'os';
    var os = store.settings.os;
    applyExtra(os, extra);
    osSettings.fromStartUrl(os);
    return runSearchAndSave();
  }

  function onSearch(engine) {
    document.dispatchEvent(new CustomEvent('openEast'));
    if (engine === 'solr') runSolr();
    else if (engine === 'es') runEs();
    else if (engine === 'os') runOs();
  }

  // --- DOM references ---

  var searchResultsMount = document.getElementById('search-results-mount');
  var startUrlMount = document.getElementById('start-url-mount');
  var settingsMount = document.getElementById('settings-mount');
  var forkRibbon = document.getElementById('fork-ribbon');
  var helpLink = document.getElementById('help-link');
  var tweakBtn = document.getElementById('tweak-btn');
  var tweakChevronLeft = document.getElementById('tweak-chevron-left');
  var tweakChevronRight = document.getElementById('tweak-chevron-right');
  var startUrlWrapper = document.getElementById('start-url-wrapper');

  // --- Sidebar state (replaces $scope.devSettingsSolr.sidebar) ---

  var sidebarOpen = false;

  // --- Render all islands + visibility toggles ---

  function renderAll() {
    var isNoSearch = currSearch.state === currSearch.NO_SEARCH;

    // Visibility toggles (replaces ng-show)
    forkRibbon.style.display = isNoSearch ? '' : 'none';
    helpLink.style.display = isNoSearch ? 'none' : '';
    tweakBtn.style.display = isNoSearch ? 'none' : '';
    startUrlWrapper.style.display = isNoSearch ? '' : 'none';

    // Mount islands
    window.SplainerIslands.searchResults.mount(searchResultsMount, {
      currSearch: currSearch,
      explainOther: explainOther,
      solrUrlSvc: solrUrlSvc,
      onPage: onPage,
    });

    window.SplainerIslands.startUrl.mount(
      startUrlMount,
      { settings: store.settings },
      { onSearch: onSearch },
    );

    window.SplainerIslands.settings.mount(
      settingsMount,
      { settings: store.settings, currSearch: currSearch },
      onPublish,
    );
  }

  // --- Chevron toggle for Tweak button ---

  function updateChevrons() {
    tweakChevronLeft.className = sidebarOpen ? 'glyphicon glyphicon-chevron-left' : '';
    tweakChevronRight.className = 'glyphicon glyphicon-chevron-right';
  }

  // --- Event bindings (replaces ng-click / dispatch-on-click) ---

  var brandBtn = document.getElementById('brand-btn');
  brandBtn.addEventListener('click', function (e) {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('closeEast'));
    sidebarOpen = false;
    updateChevrons();
    search.reset();
  });

  tweakBtn.addEventListener('click', function (e) {
    e.preventDefault();
    sidebarOpen = !sidebarOpen;
    updateChevrons();
    document.dispatchEvent(new CustomEvent('toggleEast'));
  });

  // --- Settings reactivity (replaces $watch + $applyAsync) ---

  store.subscribe(renderAll);

  // --- Hash-URL bootstrap (replaces $location.search in startUrl directive) ---

  function parseHash() {
    var hash = window.location.hash;
    // Angular $location with hashPrefix('') uses #?key=val&key2=val2
    var qIndex = hash.indexOf('?');
    if (qIndex === -1) return {};
    var qs = hash.slice(qIndex + 1);
    var params = {};
    qs.split('&').forEach(function (pair) {
      var eqIndex = pair.indexOf('=');
      if (eqIndex === -1) {
        params[decodeURIComponent(pair)] = '';
      } else {
        params[decodeURIComponent(pair.slice(0, eqIndex))] =
          decodeURIComponent(pair.slice(eqIndex + 1));
      }
    });
    return params;
  }

  var searchParams = parseHash();
  var overridingFieldSpec;
  if (Object.prototype.hasOwnProperty.call(searchParams, 'fieldSpec')) {
    overridingFieldSpec = searchParams.fieldSpec;
  }
  if (Object.prototype.hasOwnProperty.call(searchParams, 'solr')) {
    store.settings.solr.startUrl = searchParams.solr;
    runSolr(overridingFieldSpec);
  } else if (Object.prototype.hasOwnProperty.call(searchParams, 'esUrl')) {
    runEs({
      searchUrl: searchParams.esUrl,
      searchArgsStr: searchParams.esQuery,
      fieldSpecStr: overridingFieldSpec,
    });
  } else if (Object.prototype.hasOwnProperty.call(searchParams, 'osUrl')) {
    runOs({
      searchUrl: searchParams.osUrl,
      searchArgsStr: searchParams.osQuery,
      fieldSpecStr: overridingFieldSpec,
    });
  }

  // --- Initial render ---

  renderAll();
})();
