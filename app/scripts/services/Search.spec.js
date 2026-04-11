import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Search } from './Search.js';

/**
 * Phase 11d: Vitest specs for the pure Search constructor.
 *
 * The Search constructor accepts a deps bag + searchSettings +
 * overridingExplains + states + engines. These tests verify the
 * constructor's behavior without Angular DI.
 */

var states = {
  NO_SEARCH: 0,
  DID_SEARCH: 1,
  WAITING_FOR_SEARCH: 2,
  IN_ERROR: 3,
};

var engines = {
  SOLR: 'solr',
  ELASTICSEARCH: 'es',
  OPENSEARCH: 'os',
};

function makeDeps(overrides) {
  return Object.assign(
    {
      solrUrlSvc: { parseSolrArgs: vi.fn().mockReturnValue({}) },
      fieldSpecSvc: { createFieldSpec: vi.fn().mockReturnValue({ id: 'id' }) },
      searchSvc: { createSearcher: vi.fn() },
      normalDocsSvc: {
        createNormalDoc: vi.fn(function (fs, doc) {
          return { score: function () { return 1.0; }, _doc: doc };
        }),
      },
    },
    overrides,
  );
}

function makeSettings(overrides) {
  return Object.assign(
    {
      whichEngine: 'solr',
      searchUrl: function () { return 'http://example.com'; },
      fieldSpecStr: function () { return 'title'; },
      searchArgsStr: function () { return ''; },
      solr: { searchArgsStr: 'q=*:*', customHeaders: '' },
      es: { searchArgsStr: '{}', customHeaders: '' },
      os: { searchArgsStr: '{}', customHeaders: '' },
    },
    overrides,
  );
}

function makeSearcher(overrides) {
  var defaults = {
    linkUrl: 'http://link',
    numFound: 0,
    docs: [],
    grouped: {},
    inError: false,
    search: vi.fn().mockResolvedValue(),
    pager: vi.fn().mockReturnValue(null),
  };
  return Object.assign(defaults, overrides);
}

describe('Search (pure constructor)', () => {
  var deps, settings;

  beforeEach(() => {
    deps = makeDeps();
    settings = makeSettings();
  });

  describe('constructor', () => {
    it('sets engine from searchSettings.whichEngine', () => {
      var s = new Search(deps, makeSettings({ whichEngine: 'es' }), null, states, engines);
      expect(s.engine).toBe('es');
    });

    it('defaults engine to solr when whichEngine is absent', () => {
      var bare = makeSettings();
      delete bare.whichEngine;
      var s = new Search(deps, bare, null, states, engines);
      expect(s.engine).toBe('solr');
    });

    it('initialises in NO_SEARCH state after reset', () => {
      var s = new Search(deps, settings, null, states, engines);
      expect(s.state).toBe(states.NO_SEARCH);
      expect(s.docs).toEqual([]);
      expect(s.numFound).toBe(0);
      expect(s.paging).toBe(false);
    });

    it('stores overridingExplains when provided', () => {
      var explains = { doc1: 'explain-tree' };
      var s = new Search(deps, settings, explains, states, engines);
      expect(s.overridingExplains).toBe(explains);
    });
  });

  describe('reset()', () => {
    it('zeroes state back to initial values', () => {
      var s = new Search(deps, settings, null, states, engines);
      s.numFound = 42;
      s.docs.push('fake');
      s.state = states.DID_SEARCH;
      s.reset();
      expect(s.numFound).toBe(0);
      expect(s.docs).toEqual([]);
      expect(s.state).toBe(states.NO_SEARCH);
    });
  });

  describe('hasGroup()', () => {
    it('returns false when grouped is empty', () => {
      var s = new Search(deps, settings, null, states, engines);
      expect(s.hasGroup()).toBe(false);
    });

    it('returns true when grouped has keys', () => {
      var s = new Search(deps, settings, null, states, engines);
      s.grouped = { category: [] };
      expect(s.hasGroup()).toBe(true);
    });
  });

  describe('moreResults()', () => {
    it('returns true when displayedResults < numFound', () => {
      var s = new Search(deps, settings, null, states, engines);
      s.numFound = 10;
      s.displayedResults = 5;
      expect(s.moreResults()).toBe(true);
    });

    it('returns false when all results displayed', () => {
      var s = new Search(deps, settings, null, states, engines);
      s.numFound = 5;
      s.displayedResults = 5;
      expect(s.moreResults()).toBe(false);
    });
  });

  describe('getOverridingExplain()', () => {
    it('returns explain for matching doc id', () => {
      var explains = { '42': 'explain-tree' };
      var s = new Search(deps, settings, explains, states, engines);
      var result = s.getOverridingExplain({ id: '42' }, { id: 'id' });
      expect(result).toBe('explain-tree');
    });

    it('returns null when no matching explain', () => {
      var s = new Search(deps, settings, {}, states, engines);
      var result = s.getOverridingExplain({ id: '99' }, { id: 'id' });
      expect(result).toBeNull();
    });

    it('returns null when doc has no id value', () => {
      var s = new Search(deps, settings, { '42': 'expl' }, states, engines);
      var result = s.getOverridingExplain({}, { id: 'id' });
      expect(result).toBeNull();
    });
  });

  describe('search()', () => {
    it('transitions to WAITING_FOR_SEARCH then DID_SEARCH on success', async () => {
      var searcher = makeSearcher({
        docs: [{ id: '1' }],
        grouped: {},
      });
      deps.searchSvc.createSearcher.mockReturnValue(searcher);

      var s = new Search(deps, settings, null, states, engines);
      var promise = s.search();

      expect(s.state).toBe(states.WAITING_FOR_SEARCH);

      await promise;

      expect(s.state).toBe(states.DID_SEARCH);
      expect(s.docs.length).toBe(1);
      expect(s.numFound).toBe(0);
      expect(s.linkUrl).toBe('http://link');
    });

    it('snapshots settings preserving methods and isolating nested objects', async () => {
      var searcher = makeSearcher();
      deps.searchSvc.createSearcher.mockReturnValue(searcher);

      var s = new Search(deps, settings, null, states, engines);
      await s.search();

      // top-level is a different object
      expect(s.settings).not.toBe(settings);
      // methods are preserved (not stripped by JSON round-trip)
      expect(typeof s.settings.searchUrl).toBe('function');
      // nested engine objects are isolated (two-level clone)
      expect(s.settings.solr).not.toBe(settings.solr);
      expect(s.settings.es).not.toBe(settings.es);
      expect(s.settings.os).not.toBe(settings.os);
      // but values are equal
      expect(s.settings.solr).toEqual(settings.solr);
    });

    it('sets IN_ERROR state on failure without rejecting', async () => {
      var searcher = makeSearcher({
        search: vi.fn().mockRejectedValue({ searchError: 'connection refused' }),
        linkUrl: 'http://fail-link',
      });
      deps.searchSvc.createSearcher.mockReturnValue(searcher);

      var s = new Search(deps, settings, null, states, engines);
      // Should resolve (not reject) even on search failure
      await expect(s.search()).resolves.toBeUndefined();

      expect(s.state).toBe(states.IN_ERROR);
      expect(s.errorMsg).toBe('connection refused');
      expect(s.linkUrl).toBe('http://fail-link');
    });

    it('uses solrUrlSvc.parseSolrArgs for Solr engine', async () => {
      var searcher = makeSearcher();
      deps.searchSvc.createSearcher.mockReturnValue(searcher);
      deps.solrUrlSvc.parseSolrArgs.mockReturnValue({ q: '*:*' });

      var s = new Search(deps, settings, null, states, engines);
      await s.search();

      expect(deps.solrUrlSvc.parseSolrArgs).toHaveBeenCalledWith('q=*:*');
    });

    it('uses JSON.parse for ES engine searchArgsStr', async () => {
      var esSettings = makeSettings({
        whichEngine: 'es',
        es: { searchArgsStr: '{"query":{"match_all":{}}}', customHeaders: '' },
      });
      var searcher = makeSearcher();
      deps.searchSvc.createSearcher.mockReturnValue(searcher);

      var s = new Search(deps, esSettings, null, states, engines);
      await s.search();

      // createSearcher should have been called with parsed JSON
      var call = deps.searchSvc.createSearcher.mock.calls[0];
      expect(call[2]).toEqual({ query: { match_all: {} } });
    });

    it('falls back to empty string on invalid ES JSON', async () => {
      var esSettings = makeSettings({
        whichEngine: 'es',
        es: { searchArgsStr: 'not-json', customHeaders: '' },
      });
      var searcher = makeSearcher();
      deps.searchSvc.createSearcher.mockReturnValue(searcher);
      var errorSpy = vi.spyOn(console, 'error').mockImplementation(function () {});

      var s = new Search(deps, esSettings, null, states, engines);
      await s.search();

      var call = deps.searchSvc.createSearcher.mock.calls[0];
      expect(call[2]).toBe('');
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('page()', () => {
    it('returns undefined when searcher is null', () => {
      var s = new Search(deps, settings, null, states, engines);
      expect(s.page()).toBeUndefined();
    });

    it('appends docs on successful pagination', async () => {
      // Set up initial search
      var page2Searcher = makeSearcher({
        docs: [{ id: '2' }],
        grouped: {},
      });
      var searcher = makeSearcher({
        docs: [{ id: '1' }],
        grouped: {},
        pager: vi.fn().mockReturnValue(page2Searcher),
      });
      deps.searchSvc.createSearcher.mockReturnValue(searcher);

      var s = new Search(deps, settings, null, states, engines);
      await s.search();

      expect(s.docs.length).toBe(1);

      await s.page();

      expect(s.docs.length).toBe(2);
      expect(s.paging).toBe(false);
    });

    it('sets IN_ERROR when paged searcher reports inError', async () => {
      var page2Searcher = makeSearcher({
        docs: [],
        grouped: {},
        inError: true,
      });
      var searcher = makeSearcher({
        docs: [],
        grouped: {},
        pager: vi.fn().mockReturnValue(page2Searcher),
      });
      deps.searchSvc.createSearcher.mockReturnValue(searcher);

      var s = new Search(deps, settings, null, states, engines);
      await s.search();
      await s.page();

      expect(s.state).toBe(states.IN_ERROR);
    });

    it('does nothing when pager() returns null (no more pages)', async () => {
      var searcher = makeSearcher({
        docs: [],
        grouped: {},
        pager: vi.fn().mockReturnValue(null),
      });
      deps.searchSvc.createSearcher.mockReturnValue(searcher);

      var s = new Search(deps, settings, null, states, engines);
      await s.search();

      var result = s.page();
      expect(result).toBeUndefined();
    });
  });
});
