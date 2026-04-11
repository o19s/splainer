'use strict';

/**
 * Karma integration tests for the Search Angular wrapper.
 *
 * Phase 11d: the real logic is tested by Vitest (Search.spec.js).
 * These tests verify that the Angular wrapper correctly delegates to the
 * globalThis.SplainerServices.Search constructor, packing the four
 * splainer-search services into the deps bag.
 */
describe('Factory: Search (wrapper)', function () {
  beforeEach(module('splain-app'));

  var Search;

  beforeEach(inject(function (_Search_) {
    Search = _Search_;
  }));

  it('is a function (constructor wrapper)', function () {
    expect(typeof Search).toBe('function');
  });

  it('produces an instance with expected methods', function () {
    var settings = {
      whichEngine: 'solr',
      searchUrl: function () { return 'http://example.com'; },
      fieldSpecStr: function () { return 'title'; },
      searchArgsStr: function () { return ''; },
      solr: { searchArgsStr: 'q=*:*', customHeaders: '' },
      es: { searchArgsStr: '{}', customHeaders: '' },
      os: { searchArgsStr: '{}', customHeaders: '' },
    };

    var states = { NO_SEARCH: 0, DID_SEARCH: 1, WAITING_FOR_SEARCH: 2, IN_ERROR: 3 };
    var engines = { SOLR: 'solr', ELASTICSEARCH: 'es', OPENSEARCH: 'os' };

    var search = new Search(settings, null, states, engines);

    expect(typeof search.reset).toBe('function');
    expect(typeof search.search).toBe('function');
    expect(typeof search.page).toBe('function');
    expect(typeof search.hasGroup).toBe('function');
    expect(typeof search.moreResults).toBe('function');
    expect(typeof search.getOverridingExplain).toBe('function');
  });

  it('initialises in NO_SEARCH state', function () {
    var settings = {
      whichEngine: 'solr',
      searchUrl: function () { return ''; },
      fieldSpecStr: function () { return ''; },
      searchArgsStr: function () { return ''; },
      solr: { searchArgsStr: '', customHeaders: '' },
      es: { searchArgsStr: '{}', customHeaders: '' },
      os: { searchArgsStr: '{}', customHeaders: '' },
    };

    var states = { NO_SEARCH: 0, DID_SEARCH: 1, WAITING_FOR_SEARCH: 2, IN_ERROR: 3 };
    var engines = { SOLR: 'solr', ELASTICSEARCH: 'es', OPENSEARCH: 'os' };

    var search = new Search(settings, null, states, engines);

    expect(search.state).toBe(0);
    expect(search.docs).toEqual([]);
  });

  it('delegates to the globalThis.SplainerServices.Search constructor', function () {
    expect(globalThis.SplainerServices).toBeDefined();
    expect(globalThis.SplainerServices.Search).toBeDefined();
    expect(typeof globalThis.SplainerServices.Search).toBe('function');
  });
});
