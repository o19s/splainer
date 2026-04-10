'use strict';

/**
 * Pure-JS settings store — no Angular dependency.
 *
 * Extracted from the Angular settingsStoreSvc (Phase 11c). The Angular
 * service file (settingsStoreSvc.js) is now a thin wrapper that delegates
 * to globalThis.SplainerServices.settingsStore.
 *
 * Key design decisions:
 *   - Native localStorage (replaces angular-local-storage wrapper).
 *   - window.location.hash for URL sync (replaces $location.search).
 *   - subscribe(fn) → unsubscribe for reactivity (replaces $watch).
 *   - Mutate-in-place + explicit save() — same contract as before.
 *   - No key prefix change (deferred to Phase 14 with migration path).
 */

var ENGINES = {
  SOLR: 'solr',
  ELASTICSEARCH: 'es',
  OPENSEARCH: 'os',
};

var defaultEsArgs = '!{\n  "query": {\n    "match_all": {}\n  }\n}    ';

// --- localStorage helpers ---

// angular-local-storage 0.7.1 with default config prefixes every key
// with 'ls.' (prefix 'ls' + separator '.'). The app never called
// setPrefix(), so all existing user data sits under 'ls.*' keys.
// We must use the same prefix for back-compat.
var LS_PREFIX = 'ls.';

function lsGet(key) {
  try {
    var val = localStorage.getItem(LS_PREFIX + key);
    // angular-local-storage stored JSON-encoded values. For back-compat,
    // try JSON.parse; fall back to raw string if it fails (e.g. plain
    // strings that were stored without encoding by older versions).
    if (val === null) return null;
    try {
      return JSON.parse(val);
    } catch (_e) {
      return val;
    }
  } catch (_e) {
    return null;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch (_e) {
    // localStorage full or unavailable — silently ignore
  }
}

// Cache the support check — avoids a write+remove test on every save().
var _lsSupported = (function () {
  try {
    var k = '__splainer_ls_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch (_e) {
    return false;
  }
})();

// --- URL hash helpers ($location.search with hashPrefix('') → #?key=val) ---
// Manual encodeURIComponent serialization — Angular's $location.search()
// uses decodeURIComponent which does NOT decode '+' as space (unlike the
// application/x-www-form-urlencoded spec that URLSearchParams follows).
// Using encodeURIComponent keeps spaces as %20, matching Angular exactly.

function buildHashString(paramsObj) {
  var parts = [];
  var keys = Object.keys(paramsObj);
  for (var i = 0; i < keys.length; i++) {
    var val = paramsObj[keys[i]];
    // Angular's $location.search(obj) omits keys with undefined/null values.
    // Match that behavior to avoid encoding undefined as literal "undefined".
    if (val == null) continue;
    parts.push(encodeURIComponent(keys[i]) + '=' + encodeURIComponent(val));
  }
  return parts.length ? '?' + parts.join('&') : '';
}

// --- Init ---

function loadSetting(key, engine, defaults, supported) {
  if (!supported) return;
  var prefix = engine ? engine + '_' : '';
  var val = lsGet(prefix + key);
  var target = engine ? defaults[engine] : defaults;
  if (val !== null) {
    target[key] = val;
  }
}

function initSearchArgs() {
  var searchSettings = {
    solr: {
      customHeaders: '',
      headerType: 'None',
      startUrl: '',
      searchUrl: '',
      fieldSpecStr: '',
      searchArgsStr: '',
      whichEngine: 'solr',
    },
    es: {
      customHeaders: '',
      headerType: 'Custom',
      startUrl: '',
      searchUrl: '',
      fieldSpecStr: '',
      searchArgsStr: defaultEsArgs,
      whichEngine: 'es',
    },
    os: {
      customHeaders: '',
      headerType: 'None',
      startUrl: '',
      searchUrl: '',
      fieldSpecStr: '',
      searchArgsStr: defaultEsArgs,
      whichEngine: 'os',
    },
    whichEngine: 'solr',
    searchUrl: function () {
      return this[this.whichEngine].searchUrl;
    },
    fieldSpecStr: function () {
      return this[this.whichEngine].fieldSpecStr;
    },
    searchArgsStr: function () {
      return this[this.whichEngine].searchArgsStr;
    },
  };

  var supported = _lsSupported;

  var fields = ['customHeaders', 'searchUrl', 'startUrl', 'fieldSpecStr', 'searchArgsStr'];
  var engines = ['solr', 'es', 'os'];
  engines.forEach(function (engine) {
    fields.forEach(function (field) {
      loadSetting(field, engine, searchSettings, supported);
    });
  });
  loadSetting('whichEngine', null, searchSettings, supported);

  if (!searchSettings.whichEngine) {
    searchSettings.whichEngine = 'solr';
  }

  // Strip the `!` prefix from searchArgsStr (storage format quirk).
  searchSettings.solr.searchArgsStr = searchSettings.solr.searchArgsStr.slice(1);
  searchSettings.es.searchArgsStr = searchSettings.es.searchArgsStr.slice(1);
  searchSettings.os.searchArgsStr = searchSettings.os.searchArgsStr.slice(1);

  return searchSettings;
}

// --- Save ---

function persistToLocalStorage(s) {
  if (!_lsSupported) return;

  lsSet('solr_customHeaders', s.solr.customHeaders);
  lsSet('solr_startUrl', s.solr.startUrl);
  lsSet('solr_searchUrl', s.solr.searchUrl);
  lsSet('solr_fieldSpecStr', s.solr.fieldSpecStr);
  lsSet('solr_searchArgsStr', '!' + s.solr.searchArgsStr);

  lsSet('es_customHeaders', s.es.customHeaders);
  lsSet('es_startUrl', s.es.startUrl);
  lsSet('es_searchUrl', s.es.searchUrl);
  lsSet('es_fieldSpecStr', s.es.fieldSpecStr);
  lsSet('es_searchArgsStr', '!' + s.es.searchArgsStr);

  lsSet('os_customHeaders', s.os.customHeaders);
  lsSet('os_startUrl', s.os.startUrl);
  lsSet('os_searchUrl', s.os.searchUrl);
  lsSet('os_fieldSpecStr', s.os.fieldSpecStr);
  lsSet('os_searchArgsStr', '!' + s.os.searchArgsStr);

  lsSet('whichEngine', s.whichEngine);
}

function persistToUrl(s) {
  var params = {};
  if (s.whichEngine === 'solr') {
    params.solr = s.solr.startUrl;
    params.fieldSpec = s.solr.fieldSpecStr;
  } else if (s.whichEngine === 'es') {
    params.esUrl = s.es.searchUrl;
    params.esQuery = s.es.searchArgsStr;
    params.fieldSpec = s.es.fieldSpecStr;
  } else if (s.whichEngine === 'os') {
    params.osUrl = s.os.searchUrl;
    params.osQuery = s.os.searchArgsStr;
    params.fieldSpec = s.os.fieldSpecStr;
  }
  window.location.hash = buildHashString(params);
}

// --- Public API ---

export function createSettingsStore() {
  var settings = initSearchArgs();
  var listeners = new Set();

  function save() {
    persistToLocalStorage(settings);
    persistToUrl(settings);
    listeners.forEach(function (fn) {
      fn();
    });
  }

  function subscribe(fn) {
    listeners.add(fn);
    return function unsubscribe() {
      listeners.delete(fn);
    };
  }

  return {
    ENGINES: ENGINES,
    settings: settings,
    save: save,
    subscribe: subscribe,
  };
}

if (typeof globalThis !== 'undefined') {
  globalThis.SplainerServices = globalThis.SplainerServices || {};
  globalThis.SplainerServices.settingsStore = createSettingsStore();
}
