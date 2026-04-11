/**
 * Application entry point. Imports all islands and services as ES modules.
 * Vendor scripts without ESM exports (splainer-search, urijs, ace) are
 * loaded via <script> tags and accessed from window.*.
 */

import { openEast, closeEast, toggleEast } from './panes.js';
import './ace-config.js';
import { mount as mountSearchResults } from './islands/searchResults.jsx';
import { mount as mountStartUrl } from './islands/startUrl.jsx';
import { mount as mountSettings } from './islands/settings.jsx';
import { createSettingsStore } from './services/settingsStore.js';
import { createSearch } from './services/splSearch.js';
import { Search } from './services/Search.js';
import { fromStartUrl as solrFromStartUrl, fromTweakedSettings as solrFromTweakedSettings } from './services/solrSettings.js';
import { fromStartUrl as esFromStartUrl, fromTweakedSettings as esFromTweakedSettings } from './services/esSettings.js';
import { fromStartUrl as osFromStartUrl, fromTweakedSettings as osFromTweakedSettings } from './services/osSettings.js';

// Vendor globals (loaded via <script> tags)

var wired = window.SplainerSearchWired.getDefaultWiredServices();

var solrUrlSvc = wired.solrUrlSvc;
var fieldSpecSvc = wired.fieldSpecSvc;
var searchSvc = wired.searchSvc;
var normalDocsSvc = wired.normalDocsSvc;
var solrExplainExtractorSvc = wired.solrExplainExtractorSvc;
var esExplainExtractorSvc = wired.esExplainExtractorSvc;

// Settings store singleton
var store = createSettingsStore();

// Curried Search constructor (packs the deps bag)
var deps = {
  solrUrlSvc: solrUrlSvc,
  fieldSpecSvc: fieldSpecSvc,
  searchSvc: searchSvc,
  normalDocsSvc: normalDocsSvc,
};

function WrappedSearch(searchSettings, overridingExplains, _states, _engines) {
  return new Search(deps, searchSettings, overridingExplains, _states, _engines);
}

// App state
var currSearch = createSearch(WrappedSearch, store.settings);
var search = {};

search.search = function () {
  return currSearch.search().then(function () {
    currSearch.engine = store.settings.whichEngine;
    renderAll();
  });
};

search.reset = function () {
  currSearch = createSearch(WrappedSearch, store.settings);
  renderAll();
};

// explainOther

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
  tweakChevronRight.className = 'glyphicon glyphicon-chevron-right';
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

// Expose for Playwright e2e tests.
window.SplainerServices = { settingsStore: store };

renderAll();
