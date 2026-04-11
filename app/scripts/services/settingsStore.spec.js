import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSettingsStore } from './settingsStore.js';

// angular-local-storage 0.7.1 default prefix
var LS_PREFIX = 'ls.';

// Mock localStorage and window.location.hash for each test.
function setupMocks(storageContents) {
  // Prepend ls. prefix to keys to match real browser state
  var store = {};
  Object.keys(storageContents).forEach(function (k) {
    store[LS_PREFIX + k] = storageContents[k];
  });

  vi.stubGlobal('localStorage', {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(store, key)
        ? store[key]
        : null;
    },
    setItem: function (key, val) {
      store[key] = val;
    },
    removeItem: function (key) {
      delete store[key];
    },
  });

  // Stub location.hash — just track what was written
  var hashValue = '';
  Object.defineProperty(window, 'location', {
    value: {
      get hash() {
        return hashValue;
      },
      set hash(v) {
        hashValue = v;
      },
    },
    writable: true,
    configurable: true,
  });

  return { store: store };
}

describe('settingsStore (pure module)', function () {
  beforeEach(function () {
    setupMocks({});
  });

  // --- Initialization ---

  it('initializes with sane defaults when localStorage is empty', function () {
    var svc = createSettingsStore();
    var s = svc.settings;

    expect(s.whichEngine).toBe('solr');
    expect(s.solr.searchUrl).toBe('');
    expect(s.solr.fieldSpecStr).toBe('');
    expect(s.solr.searchArgsStr).toBe('');
    expect(s.solr.customHeaders).toBe('');
    expect(s.solr.headerType).toBe('None');
    expect(s.es.headerType).toBe('Custom');
    expect(s.os.searchArgsStr).toContain('"match_all"');
  });

  it('initializes ES searchArgsStr as valid JSON', function () {
    var svc = createSettingsStore();
    expect(function () {
      JSON.parse(svc.settings.es.searchArgsStr);
    }).not.toThrow();
  });

  it('loads values from localStorage (JSON-encoded with ls. prefix)', function () {
    setupMocks({
      solr_startUrl: JSON.stringify('http://localhost:8983/solr?q=*:*'),
      solr_searchUrl: JSON.stringify('http://localhost:8983/solr'),
      solr_fieldSpecStr: JSON.stringify('id:foo title:bar'),
      solr_searchArgsStr: JSON.stringify('!q=*:*'),
      whichEngine: JSON.stringify('solr'),
    });

    var svc = createSettingsStore();
    var s = svc.settings;
    expect(s.solr.startUrl).toBe('http://localhost:8983/solr?q=*:*');
    expect(s.solr.searchUrl).toBe('http://localhost:8983/solr');
    expect(s.solr.fieldSpecStr).toBe('id:foo title:bar');
    // The ! prefix is stripped on load
    expect(s.solr.searchArgsStr).toBe('q=*:*');
    expect(s.whichEngine).toBe('solr');
  });

  it('loads bare (non-JSON-encoded) localStorage values for back-compat', function () {
    setupMocks({
      solr_startUrl: 'http://example.com/solr?q=test',
      whichEngine: 'es',
    });

    var svc = createSettingsStore();
    expect(svc.settings.solr.startUrl).toBe('http://example.com/solr?q=test');
    expect(svc.settings.whichEngine).toBe('es');
  });

  it('defaults whichEngine to solr when localStorage has empty value', function () {
    setupMocks({
      whichEngine: JSON.stringify(''),
    });
    var svc = createSettingsStore();
    expect(svc.settings.whichEngine).toBe('solr');
  });

  // --- Convenience methods ---

  it('searchUrl() returns the active engine searchUrl', function () {
    var svc = createSettingsStore();
    svc.settings.es.searchUrl = 'http://es:9200/idx/_search';
    svc.settings.whichEngine = 'es';
    expect(svc.settings.searchUrl()).toBe('http://es:9200/idx/_search');
  });

  it('fieldSpecStr() returns the active engine fieldSpecStr', function () {
    var svc = createSettingsStore();
    svc.settings.solr.fieldSpecStr = 'id title';
    svc.settings.whichEngine = 'solr';
    expect(svc.settings.fieldSpecStr()).toBe('id title');
  });

  it('searchArgsStr() returns the active engine searchArgsStr', function () {
    var svc = createSettingsStore();
    svc.settings.os.searchArgsStr = '{"query":{}}';
    svc.settings.whichEngine = 'os';
    expect(svc.settings.searchArgsStr()).toBe('{"query":{}}');
  });

  // --- Save: localStorage persistence ---

  it('save() persists all fields to localStorage with ls. prefix', function () {
    var env = setupMocks({});
    var svc = createSettingsStore();
    var s = svc.settings;

    s.solr.startUrl = 'http://solr/q';
    s.solr.searchUrl = 'http://solr';
    s.solr.fieldSpecStr = 'id title';
    s.solr.searchArgsStr = 'q=*:*';
    s.solr.customHeaders = 'X-Foo: bar';
    s.whichEngine = 'solr';
    svc.save();

    expect(JSON.parse(env.store[LS_PREFIX + 'solr_startUrl'])).toBe('http://solr/q');
    expect(JSON.parse(env.store[LS_PREFIX + 'solr_searchUrl'])).toBe('http://solr');
    expect(JSON.parse(env.store[LS_PREFIX + 'solr_fieldSpecStr'])).toBe('id title');
    // searchArgsStr stored with ! prefix
    expect(JSON.parse(env.store[LS_PREFIX + 'solr_searchArgsStr'])).toBe('!q=*:*');
    expect(JSON.parse(env.store[LS_PREFIX + 'solr_customHeaders'])).toBe('X-Foo: bar');
    expect(JSON.parse(env.store[LS_PREFIX + 'whichEngine'])).toBe('solr');
  });

  it('save() persists ES settings', function () {
    var env = setupMocks({});
    var svc = createSettingsStore();
    var s = svc.settings;

    s.es.searchUrl = 'http://es:9200/idx';
    s.es.searchArgsStr = '{"query":{}}';
    s.es.fieldSpecStr = 'title';
    s.whichEngine = 'es';
    svc.save();

    expect(JSON.parse(env.store[LS_PREFIX + 'es_searchUrl'])).toBe('http://es:9200/idx');
    expect(JSON.parse(env.store[LS_PREFIX + 'es_searchArgsStr'])).toBe('!{"query":{}}');
    expect(JSON.parse(env.store[LS_PREFIX + 'es_fieldSpecStr'])).toBe('title');
  });

  // --- Save → Load round-trip ---

  it('round-trips startUrl through save and reload', function () {
    setupMocks({});
    var svc1 = createSettingsStore();
    svc1.settings.solr.startUrl = 'http://solr:8983/collection1/select?q=test&fq=category:books';
    svc1.settings.whichEngine = 'solr';
    svc1.save();

    // Create a new store reading from the same storage
    var svc2 = createSettingsStore();
    expect(svc2.settings.solr.startUrl).toBe(
      'http://solr:8983/collection1/select?q=test&fq=category:books',
    );
  });

  // --- Save: URL hash sync ---

  it('save() omits undefined/null values from hash (no literal "undefined")', function () {
    setupMocks({});
    var svc = createSettingsStore();
    svc.settings.whichEngine = 'solr';
    // Don't set startUrl — it defaults to '' now, but test the guard too
    svc.settings.solr.startUrl = undefined;
    svc.save();

    expect(window.location.hash).not.toContain('undefined');
  });

  it('save() writes Solr params to location.hash with %20 encoding', function () {
    setupMocks({});
    var svc = createSettingsStore();
    var s = svc.settings;

    s.solr.startUrl = 'http://solr?q=test';
    s.solr.fieldSpecStr = 'id title';
    s.whichEngine = 'solr';
    svc.save();

    expect(window.location.hash).toContain('solr=');
    expect(window.location.hash).toContain('fieldSpec=');
    // Must use %20 (not +) for back-compat with existing bookmarked URLs
    expect(window.location.hash).toContain('id%20title');
    expect(window.location.hash).not.toContain('id+title');
  });

  it('save() preserves `:` `@` `$` `,` `;` literal in the hash (matches Angular encodeUriQuery)', function () {
    // Freezes the encoding shape that the legacy Angular build emits and
    // that the audit expects to see (see e2e/audit.spec.js and its
    // test:e2e:audit run). Any change to buildHashString that reverts to
    // plain encodeURIComponent will break this test deliberately.
    setupMocks({});
    var svc = createSettingsStore();
    var s = svc.settings;

    s.solr.startUrl = 'http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=*:*';
    s.solr.fieldSpecStr = 'id title';
    s.whichEngine = 'solr';
    svc.save();

    // The scheme colon stays literal.
    expect(window.location.hash).toContain('http:');
    expect(window.location.hash).not.toContain('http%3A');
    // Port colons stay literal.
    expect(window.location.hash).toContain(':8985');
    expect(window.location.hash).not.toContain('%3A8985');
    // `@` stays literal (relevant for the `reader:reader@host` OS default).
    s.os.searchUrl = 'https://reader:reader@quepid-opensearch.dev.o19s.com:9000/tmdb/_search';
    s.os.searchArgsStr = '{"query":{"match_all":{}}}';
    s.whichEngine = 'os';
    svc.save();
    expect(window.location.hash).toContain('reader:reader@');
    expect(window.location.hash).not.toContain('reader%3Areader%40');
    // Slashes are still percent-encoded (matches Angular's behavior —
    // encodeUriQuery unescapes `:@$,;` but not `/`).
    expect(window.location.hash).toContain('%2F');
    // `&` is still encoded within values — if it weren't, `&` in a query
    // body would break the outer hash param parsing.
    s.solr.startUrl = 'http://solr?q=a&b=c';
    s.whichEngine = 'solr';
    svc.save();
    // The outer `&` between hash params stays literal (as a separator),
    // but the `&` inside the solr= value must be encoded.
    var hash = window.location.hash;
    var solrIdx = hash.indexOf('solr=');
    var nextAmpIdx = hash.indexOf('&fieldSpec', solrIdx);
    var solrValue = hash.slice(solrIdx + 'solr='.length, nextAmpIdx);
    expect(solrValue).toContain('%26');
    expect(solrValue).not.toContain('q=a&b=c');
  });

  it('save() writes ES params to location.hash', function () {
    setupMocks({});
    var svc = createSettingsStore();
    var s = svc.settings;

    s.es.searchUrl = 'http://es:9200/idx';
    s.es.searchArgsStr = '{"query":{}}';
    s.es.fieldSpecStr = 'title';
    s.whichEngine = 'es';
    svc.save();

    expect(window.location.hash).toContain('esUrl=');
    expect(window.location.hash).toContain('esQuery=');
    expect(window.location.hash).toContain('fieldSpec=');
  });

  it('save() writes OS params to location.hash', function () {
    setupMocks({});
    var svc = createSettingsStore();
    var s = svc.settings;

    s.os.searchUrl = 'http://os:9200/idx';
    s.os.searchArgsStr = '{"query":{}}';
    s.os.fieldSpecStr = '*';
    s.whichEngine = 'os';
    svc.save();

    expect(window.location.hash).toContain('osUrl=');
    expect(window.location.hash).toContain('osQuery=');
    expect(window.location.hash).toContain('fieldSpec=');
  });

  // --- Subscribe ---

  it('subscribe() fires callback on save()', function () {
    setupMocks({});
    var svc = createSettingsStore();
    var calls = 0;
    svc.subscribe(function () {
      calls++;
    });

    svc.save();
    expect(calls).toBe(1);
    svc.save();
    expect(calls).toBe(2);
  });

  it('unsubscribe stops notifications', function () {
    setupMocks({});
    var svc = createSettingsStore();
    var calls = 0;
    var unsub = svc.subscribe(function () {
      calls++;
    });

    svc.save();
    expect(calls).toBe(1);

    unsub();
    svc.save();
    expect(calls).toBe(1); // no second call
  });

  it('multiple subscribers all fire', function () {
    setupMocks({});
    var svc = createSettingsStore();
    var a = 0;
    var b = 0;
    svc.subscribe(function () { a++; });
    svc.subscribe(function () { b++; });

    svc.save();
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  // --- ENGINES constant ---

  it('exposes ENGINES constant', function () {
    var svc = createSettingsStore();
    expect(svc.ENGINES.SOLR).toBe('solr');
    expect(svc.ENGINES.ELASTICSEARCH).toBe('es');
    expect(svc.ENGINES.OPENSEARCH).toBe('os');
  });

  // --- Full round-trip ---

  it('round-trips every persisted field across all three engines', function () {
    // Writes a distinctive value into every (engine, field) pair, calls
    // save(), then loads a new store from the same backing storage and
    // verifies the exact same values are restored. Pins both the write
    // and read key-construction paths — a drift in either (e.g. the
    // `engines` array at init vs. the `PERSIST_ENGINES` array at save)
    // would fail at least one field.
    setupMocks({});
    var svc1 = createSettingsStore();
    var fixtures = {
      solr: {
        customHeaders: '{"X-Solr":"1"}',
        searchUrl: 'http://solr.example/select',
        startUrl: 'http://solr.example/select?q=x',
        fieldSpecStr: 'id solr_title',
        searchArgsStr: 'q=*:*&fq=live:true',
      },
      es: {
        customHeaders: '{"X-ES":"2"}',
        searchUrl: 'http://es.example/idx/_search',
        startUrl: 'http://es.example/idx/_search?pretty',
        fieldSpecStr: 'id es_title',
        searchArgsStr: '{"query":{"match_all":{}}}',
      },
      os: {
        customHeaders: '{"X-OS":"3"}',
        searchUrl: 'http://os.example/idx/_search',
        startUrl: 'http://os.example/idx/_search?pretty',
        fieldSpecStr: 'id os_title',
        searchArgsStr: '{"query":{"term":{"k":"v"}}}',
      },
    };
    ['solr', 'es', 'os'].forEach(function (engine) {
      Object.keys(fixtures[engine]).forEach(function (field) {
        svc1.settings[engine][field] = fixtures[engine][field];
      });
    });
    svc1.settings.whichEngine = 'es';
    svc1.save();

    var svc2 = createSettingsStore();
    expect(svc2.settings.whichEngine).toBe('es');
    ['solr', 'es', 'os'].forEach(function (engine) {
      Object.keys(fixtures[engine]).forEach(function (field) {
        expect(svc2.settings[engine][field]).toBe(fixtures[engine][field]);
      });
    });
  });

  // --- buildHashString separator & leading `?` ---

  it('joins multiple hash params with `&` and prefixes with `?`', function () {
    // Two pinning assertions on buildHashString's output shape without
    // hitting the encodeUriQuery special cases already covered elsewhere.
    setupMocks({});
    var svc = createSettingsStore();
    svc.settings.whichEngine = 'solr';
    svc.settings.solr.startUrl = 'http://a';
    svc.settings.solr.fieldSpecStr = 'id';
    svc.save();
    // `?` is the literal leading char — not any other punctuation.
    expect(window.location.hash.charAt(0)).toBe('?');
    // With two params the single `&` separator is literally present.
    expect(window.location.hash.split('&')).toHaveLength(2);
  });
});
