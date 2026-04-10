import { describe, it, expect } from 'vitest';
import { states, engines, createSearch } from './splSearch.js';

describe('splSearch', () => {
  describe('states', () => {
    it('exposes the four search states', () => {
      expect(states.NO_SEARCH).toBe(0);
      expect(states.DID_SEARCH).toBe(1);
      expect(states.WAITING_FOR_SEARCH).toBe(2);
      expect(states.IN_ERROR).toBe(3);
    });
  });

  describe('engines', () => {
    it('exposes the three engine identifiers', () => {
      expect(engines.SOLR).toBe('solr');
      expect(engines.ELASTICSEARCH).toBe('es');
      expect(engines.OPENSEARCH).toBe('os');
    });
  });

  describe('createSearch', () => {
    function FakeSearch(settings, overridingExplains, st, eng) {
      this._settings = settings;
      this._overridingExplains = overridingExplains;
      this._states = st;
      this._engines = eng;
    }

    it('creates a Search instance with state constants attached', () => {
      var settings = { whichEngine: 'solr' };
      var search = createSearch(FakeSearch, settings);

      expect(search).toBeInstanceOf(FakeSearch);
      expect(search.NO_SEARCH).toBe(states.NO_SEARCH);
      expect(search.DID_SEARCH).toBe(states.DID_SEARCH);
      expect(search.WAITING_FOR_SEARCH).toBe(states.WAITING_FOR_SEARCH);
      expect(search.IN_ERROR).toBe(states.IN_ERROR);
    });

    it('passes states and engines to the Search constructor', () => {
      var settings = { whichEngine: 'es' };
      var search = createSearch(FakeSearch, settings);

      expect(search._states).toBe(states);
      expect(search._engines).toBe(engines);
    });

    it('passes overridingExplains through', () => {
      var settings = { whichEngine: 'solr' };
      var explains = { doc1: 'explain' };
      var search = createSearch(FakeSearch, settings, explains);

      expect(search._overridingExplains).toBe(explains);
    });

    it('defaults whichEngine to solr when unset', () => {
      var settings = {};
      createSearch(FakeSearch, settings);

      expect(settings.whichEngine).toBe('solr');
    });

    it('preserves existing whichEngine', () => {
      var settings = { whichEngine: 'es' };
      createSearch(FakeSearch, settings);

      expect(settings.whichEngine).toBe('es');
    });
  });
});
