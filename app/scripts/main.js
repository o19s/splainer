/**
 * Application entry point. Imports all islands and services as ES modules.
 * splainer-search services come from the library wired graph (bundled by Vite).
 */

import { getDefaultWiredServices } from 'splainer-search/wired';

import { openEast, closeEast, toggleEast } from './panes.js';
import { mount as mountSearchResults } from './islands/searchResults.jsx';
import { mount as mountStartUrl } from './islands/startUrl.jsx';
import { mount as mountSettings } from './islands/settings.jsx';
import { createSettingsStore, getLastWrittenHash } from './services/settingsStore.js';
import { createSearch } from './services/splSearch.js';
import { Search } from './services/Search.js';
import { fromStartUrl as solrFromStartUrl, fromTweakedSettings as solrFromTweakedSettings } from './services/solrSettings.js';
import { fromStartUrl as esFromStartUrl, fromTweakedSettings as esFromTweakedSettings } from './services/esSettings.js';
import { fromStartUrl as osFromStartUrl, fromTweakedSettings as osFromTweakedSettings } from './services/osSettings.js';

var wired = getDefaultWiredServices();

var solrUrlSvc = wired.solrUrlSvc;
var fieldSpecSvc = wired.fieldSpecSvc;
var searchSvc = wired.searchSvc;
var normalDocsSvc = wired.normalDocsSvc;
var solrExplainExtractorSvc = wired.solrExplainExtractorSvc;
var esExplainExtractorSvc = wired.esExplainExtractorSvc;

// Settings store singleton
var store = createSettingsStore();

var deps = {
  solrUrlSvc: solrUrlSvc,
  fieldSpecSvc: fieldSpecSvc,
  searchSvc: searchSvc,
  normalDocsSvc: normalDocsSvc,
};

// App state
var currSearch = createSearch(Search, deps, store.settings);
var search = {};

search.search = function () {
  return currSearch.search().then(function () {
    currSearch.engine = store.settings.whichEngine;
    renderAll();
  });
};

search.reset = function () {
  currSearch = createSearch(Search, deps, store.settings);
  renderAll();
};

// explainOther — same createSearcher options as Search (customHeaders for ES/OS/Solr).

function explainOther(altQuery) {
  var settings = store.settings;
  var activeSettings = settings[settings.whichEngine];
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
    {
      customHeaders: activeSettings.customHeaders,
    },
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

// Dual-render: synchronous for spinner, async for results.
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

// Settings publish
function onPublish(whichEngine, workingSettings) {
  store.settings.whichEngine = whichEngine;
  if (whichEngine === 'solr') {
    solrFromTweakedSettings(solrUrlSvc, fieldSpecSvc, workingSettings);
  } else if (whichEngine === 'es') {
    esFromTweakedSettings(workingSettings);
  } else if (whichEngine === 'os') {
    osFromTweakedSettings(workingSettings);
  }
  search.search().then(function () {
    store.save();
  });
}

function runSearchAndSave() {
  return search.search().then(function () {
    store.save();
  });
}

function runSolr(overridingFieldSpec) {
  store.settings.whichEngine = 'solr';
  var solr = store.settings.solr;
  solrFromStartUrl(solrUrlSvc, fieldSpecSvc, solr.startUrl, solr, overridingFieldSpec);
  return runSearchAndSave();
}

// fieldSpecStr is intentionally undefined so esSettings/osSettings re-derives
// it from the URL's stored_fields param.
function applyExtra(target, extra) {
  if (extra && extra.searchUrl !== undefined) target.startUrl = extra.searchUrl;
  if (extra && extra.searchArgsStr !== undefined) target.searchArgsStr = extra.searchArgsStr;
  target.fieldSpecStr = extra ? extra.fieldSpecStr : undefined;
}

function runEs(extra) {
  store.settings.whichEngine = 'es';
  var es = store.settings.es;
  applyExtra(es, extra);
  esFromStartUrl(es);
  return runSearchAndSave();
}

function runOs(extra) {
  store.settings.whichEngine = 'os';
  var os = store.settings.os;
  applyExtra(os, extra);
  osFromStartUrl(os);
  return runSearchAndSave();
}

function onSearch(engine) {
  sidebarOpen = true;
  updateChevrons();
  openEast();
  if (engine === 'solr') runSolr();
  else if (engine === 'es') runEs();
  else if (engine === 'os') runOs();
}

// DOM references
var searchResultsMount = document.getElementById('search-results-mount');
var startUrlMount = document.getElementById('start-url-mount');
var settingsMount = document.getElementById('settings-mount');
var forkRibbon = document.getElementById('fork-ribbon');
var helpLink = document.getElementById('help-link');
var tweakBtn = document.getElementById('tweak-btn');
var tweakChevronLeft = document.getElementById('tweak-chevron-left');
var tweakChevronRight = document.getElementById('tweak-chevron-right');
var startUrlWrapper = document.getElementById('start-url-wrapper');

var sidebarOpen = false;

function renderAll() {
  var isNoSearch = currSearch.state === currSearch.NO_SEARCH;

  // Visibility toggles (replaces ng-show)
  forkRibbon.style.display = isNoSearch ? '' : 'none';
  helpLink.style.display = isNoSearch ? 'none' : '';
  tweakBtn.style.display = isNoSearch ? 'none' : '';
  startUrlWrapper.style.display = isNoSearch ? '' : 'none';

  mountSearchResults(searchResultsMount, {
    currSearch: currSearch,
    explainOther: explainOther,
    solrUrlSvc: solrUrlSvc,
    onPage: onPage,
  });

  mountStartUrl(
    startUrlMount,
    { settings: store.settings },
    { onSearch: onSearch },
  );

  mountSettings(
    settingsMount,
    { settings: store.settings, currSearch: currSearch },
    onPublish,
  );
}

// Chevron toggle for Tweak button

function updateChevrons() {
  tweakChevronLeft.className = sidebarOpen ? 'glyphicon glyphicon-chevron-left' : '';
  tweakChevronRight.className = sidebarOpen ? '' : 'glyphicon glyphicon-chevron-right';
}

// Event bindings

var brandBtn = document.getElementById('brand-btn');
brandBtn.addEventListener('click', function (e) {
  e.preventDefault();
  closeEast();
  sidebarOpen = false;
  updateChevrons();
  search.reset();
});

tweakBtn.addEventListener('click', function (e) {
  e.preventDefault();
  sidebarOpen = !sidebarOpen;
  updateChevrons();
  toggleEast();
});

// Settings reactivity
store.subscribe(renderAll);

// Hash-URL bootstrap
//
// Form-encoded parsing: `+` in values decodes to space. This matches the
// 2024 Angular $location.search() behavior that existing user bookmarks
// rely on — e.g., `fieldSpec=id+title` must parse to `"id title"`, not the
// literal `"id+title"`. decodeURIComponent alone does NOT do this (it
// leaves `+` untouched), so we normalize `+` → ` ` on the value side
// before decoding. Keys are decoded strictly because splainer keys are
// always the fixed names `solr`/`esUrl`/`fieldSpec`/... with no `+` in them.
function parseHash() {
  var hash = window.location.hash;
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
        decodeURIComponent(pair.slice(eqIndex + 1).replace(/\+/g, ' '));
    }
  });
  return params;
}

function applyBookmarkFromHash() {
  var p = parseHash();
  var fieldSpec = p.fieldSpec;
  if (p.solr) {
    store.settings.solr.startUrl = p.solr;
    runSolr(fieldSpec);
  } else if (p.esUrl) {
    runEs({ searchUrl: p.esUrl, searchArgsStr: p.esQuery, fieldSpecStr: fieldSpec });
  } else if (p.osUrl) {
    runOs({ searchUrl: p.osUrl, searchArgsStr: p.osQuery, fieldSpecStr: fieldSpec });
  }
}

applyBookmarkFromHash();

window.addEventListener('hashchange', function () {
  if (window.location.hash.slice(1) === getLastWrittenHash()) return;
  applyBookmarkFromHash();
});

// Expose for Playwright e2e tests.
window.SplainerServices = { settingsStore: store };

renderAll();
