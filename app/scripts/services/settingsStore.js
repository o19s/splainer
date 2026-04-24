/**
 * Settings store — owns localStorage persistence, URL hash sync, and
 * subscribe/unsubscribe reactivity for settings changes.
 */

var ENGINES = {
  SOLR: 'solr',
  ELASTICSEARCH: 'es',
  OPENSEARCH: 'os',
};

var defaultEsArgs = '!{\n  "query": {\n    "match_all": {}\n  }\n}    ';

// --- localStorage helpers ---

// 'ls.' prefix for back-compat with existing user data.
var LS_PREFIX = 'ls.';

function lsGet(key) {
  try {
    var val = localStorage.getItem(LS_PREFIX + key);
    // Values are JSON-encoded; fall back to raw string for legacy data.
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
function detectLocalStorage() {
  try {
    var k = '__splainer_ls_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch (_e) {
    return false;
  }
}
var _lsSupported = detectLocalStorage();

// URL hash helpers — preserve visual parity with the legacy Angular build
// (see audit.spec.js). Two distinct back-compat decisions live here:
//
//   1. Spaces as %20, not + — matches encodeURIComponent, not URLSearchParams.
//   2. `:` `@` `$` `,` `;` kept literal — matches Angular's encodeUriQuery
//      helper, which runs encodeURIComponent then selectively unescapes
//      those reserved characters. This keeps hash URLs human-readable
//      (`solr=http://host:8983/...` instead of `solr=http%3A%2F%2Fhost%3A8983`),
//      which matters here because splainer's whole UX is shareable URLs
//      in the address bar.
//
// Both encodings decode identically under decodeURIComponent, so old
// bookmarks and new ones remain interchangeable.

function encodeUriQuery(val) {
  return encodeURIComponent(val)
    .replace(/%40/gi, '@')
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/%3B/gi, ';');
}

function buildHashString(paramsObj) {
  var parts = [];
  var keys = Object.keys(paramsObj);
  for (var i = 0; i < keys.length; i++) {
    var val = paramsObj[keys[i]];
    // Skip null/undefined to avoid encoding as literal "undefined".
    if (val == null) continue;
    parts.push(encodeURIComponent(keys[i]) + '=' + encodeUriQuery(val));
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

var PERSIST_FIELDS = ['customHeaders', 'searchUrl', 'startUrl', 'fieldSpecStr', 'searchArgsStr'];
var PERSIST_ENGINES = ['solr', 'es', 'os'];

function persistToLocalStorage(s) {
  if (!_lsSupported) return;

  PERSIST_ENGINES.forEach(function (engine) {
    PERSIST_FIELDS.forEach(function (field) {
      var value = s[engine][field];
      // searchArgsStr is stored with a `!` prefix (legacy format quirk).
      if (field === 'searchArgsStr') value = '!' + value;
      lsSet(engine + '_' + field, value);
    });
  });

  lsSet('whichEngine', s.whichEngine);
}

function bookmarkParamsFromSettings(s) {
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
  return params;
}

var lastWrittenHash = '';

export function getLastWrittenHash() { return lastWrittenHash; }

function persistToUrl(s) {
  var h = buildHashString(bookmarkParamsFromSettings(s));
  lastWrittenHash = h;
  window.location.hash = h;
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

