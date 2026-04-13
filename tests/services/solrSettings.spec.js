import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fromStartUrl, fromTweakedSettings } from '@app/services/solrSettings.js';

/**
 * Stub solrUrlSvc — mimics the subset of splainer-search's solrUrlSvc
 * that solrSettings.js actually calls.
 */
function makeSolrUrlSvc() {
  return {
    parseSolrUrl: function (url) {
      // Minimal parser: splits on '?' then parses key=value pairs.
      // Like the real solrUrlSvc, returns a parsed result even for
      // URLs without query params (empty solrArgs object).
      var idx = url.indexOf('?');
      var endpoint = idx === -1 ? url : url.substring(0, idx);
      var args = {};
      if (idx !== -1) {
        var argsStr = url.substring(idx + 1);
        argsStr.split('&').forEach(function (pair) {
          var eqIdx = pair.indexOf('=');
          if (eqIdx === -1) return;
          var key = pair.substring(0, eqIdx);
          var val = pair.substring(eqIdx + 1);
          // solrUrlSvc stores values as arrays
          if (!args[key]) args[key] = [];
          args[key].push(val);
        });
      }
      return {
        solrEndpoint: function () {
          return endpoint;
        },
        solrArgs: args,
      };
    },
    parseSolrArgs: function (argsStr) {
      var args = {};
      // Normalize newline-delimited args back to & delimited, then parse
      var normalized = argsStr.replace(/\n&/g, '&');
      normalized
        .split('&')
        .filter(Boolean)
        .forEach(function (pair) {
          var eqIdx = pair.indexOf('=');
          if (eqIdx === -1) return;
          var key = pair.substring(0, eqIdx).trim();
          var val = pair.substring(eqIdx + 1);
          if (!args[key]) args[key] = [];
          args[key].push(val);
        });
      return args;
    },
    formatSolrArgs: function (args) {
      var pairs = [];
      Object.keys(args).forEach(function (key) {
        args[key].forEach(function (val) {
          pairs.push(key + '=' + val);
        });
      });
      return pairs.join('&');
    },
    buildUrl: function (endpoint, args) {
      var formatted = this.formatSolrArgs(args);
      return formatted ? endpoint + '?' + formatted : endpoint;
    },
    removeUnsupported: function (args) {
      // Matches real implementation: removes fl, wt, json.wrf
      delete args.fl;
      delete args.wt;
      delete args['json.wrf'];
    },
  };
}

/**
 * Stub fieldSpecSvc — mimics splainer-search's fieldSpecSvc.createFieldSpec.
 */
function makeFieldSpecSvc() {
  return {
    createFieldSpec: function (fieldSpecStr) {
      if (!fieldSpecStr || fieldSpecStr === '*' || fieldSpecStr === 'title, *') {
        return { title: 'title', subs: '*' };
      }
      var parts = fieldSpecStr.split(/\s+/);
      return { title: parts[0], subs: parts.slice(1) };
    },
  };
}

function stubSettings() {
  return {
    startUrl: '',
    whichEngine: '',
    searchUrl: '',
    fieldSpecStr: '',
    searchArgsStr: '',
  };
}

describe('solrSettings', () => {
  var solrUrlSvc, fieldSpecSvc;

  beforeEach(() => {
    solrUrlSvc = makeSolrUrlSvc();
    fieldSpecSvc = makeFieldSpecSvc();
  });

  describe('fromStartUrl', () => {
    it('parses start URL into searchUrl + args + fieldSpec', () => {
      var settings = stubSettings();
      var startUrl = 'http://localhost:8983/solr/example?q=*:*&fl=title catch_line';
      fromStartUrl(solrUrlSvc, fieldSpecSvc, startUrl, settings);

      expect(settings.searchUrl).toBe('http://localhost:8983/solr/example');
      expect(settings.fieldSpecStr).toBe('title catch_line');
      expect(settings.searchArgsStr).toBe('q=*:*');
      expect(settings.whichEngine).toBe('solr');
      expect(settings.startUrl).toBe(
        'http://localhost:8983/solr/example?q=*:*&fl=title catch_line',
      );
    });

    it('uses default (*) fieldspec when no fl specified', () => {
      var settings = stubSettings();
      var startUrl = 'http://localhost:8983/solr/example?q=*:*';
      fromStartUrl(solrUrlSvc, fieldSpecSvc, startUrl, settings);

      expect(settings.searchUrl).toBe('http://localhost:8983/solr/example');
      expect(settings.fieldSpecStr).toBe('title, *');
      expect(settings.searchArgsStr).toBe('q=*:*');
      expect(settings.whichEngine).toBe('solr');
      expect(settings.startUrl).toBe('http://localhost:8983/solr/example?q=*:*');
    });

    it('uses start URL even with no args', () => {
      var settings = stubSettings();
      var startUrl = 'http://localhost:8983/solr/example';
      fromStartUrl(solrUrlSvc, fieldSpecSvc, startUrl, settings);

      expect(settings.searchUrl).toBe('http://localhost:8983/solr/example');
      expect(settings.fieldSpecStr).toBe('title, *');
      expect(settings.searchArgsStr).toBe('q=*:*');
      expect(settings.whichEngine).toBe('solr');
      expect(settings.startUrl).toBe('http://localhost:8983/solr/example');
    });

    it('adds newlines to ampersands from startUrl', () => {
      var settings = stubSettings();
      var startUrl = 'http://localhost:8983/solr/example?q=*:*&fq=cat:meow&fl=title catch_line';
      fromStartUrl(solrUrlSvc, fieldSpecSvc, startUrl, settings);

      expect(settings.searchUrl).toBe('http://localhost:8983/solr/example');
      expect(settings.fieldSpecStr).toBe('title catch_line');
      expect(settings.searchArgsStr).toBe('q=*:*\n&fq=cat:meow');
      expect(settings.whichEngine).toBe('solr');
    });

    it('sets empty args to default q=*:*', () => {
      var settings = stubSettings();
      // URL with fl but no query args — after removing fl and unsupported,
      // the args string is empty, so it should default to q=*:*
      var startUrl = 'http://localhost:8983/solr/example?fl=title&wt=json';
      fromStartUrl(solrUrlSvc, fieldSpecSvc, startUrl, settings);

      expect(settings.searchArgsStr).toBe('q=*:*');
    });

    describe('with overrideFieldSpec', () => {
      it('overrides fl from URL', () => {
        var settings = stubSettings();
        var startUrl = 'http://localhost:8983/solr/example?q=*:*&fq=cat:meow&fl=title catch_line';
        var fieldSpec = 'id:banana f:happy';
        fromStartUrl(solrUrlSvc, fieldSpecSvc, startUrl, settings, fieldSpec);

        expect(settings.fieldSpecStr).toBe(fieldSpec);
        expect(settings.searchUrl).toBe('http://localhost:8983/solr/example');
        expect(settings.searchArgsStr).toBe('q=*:*\n&fq=cat:meow');
      });

      it('uses override when URL has no fl', () => {
        var settings = stubSettings();
        var startUrl = 'http://localhost:8983/solr/example?q=*:*&fq=cat:meow';
        var fieldSpec = 'id:banana f:happy';
        fromStartUrl(solrUrlSvc, fieldSpecSvc, startUrl, settings, fieldSpec);

        expect(settings.fieldSpecStr).toBe(fieldSpec);
        expect(settings.searchUrl).toBe('http://localhost:8983/solr/example');
        expect(settings.searchArgsStr).toBe('q=*:*\n&fq=cat:meow');
      });
    });
  });

  describe('fromTweakedSettings', () => {
    it('updates start URL from args updates', () => {
      var settings = stubSettings();
      var startUrl = 'http://localhost:8983/solr/example?q=*:*&fl=title catch_line';
      fromStartUrl(solrUrlSvc, fieldSpecSvc, startUrl, settings);

      settings.searchArgsStr = 'q=*:*\n&fq=blah';
      fromTweakedSettings(solrUrlSvc, fieldSpecSvc, settings);

      expect(settings.startUrl).toContain('blah');
    });

    it('updates start URL from args updates, no fl when subs is wildcard', () => {
      var settings = stubSettings();
      var startUrl = 'http://localhost:8983/solr/example?q=*:*';
      fromStartUrl(solrUrlSvc, fieldSpecSvc, startUrl, settings);

      settings.searchArgsStr = 'q=*:*\n&fq=blah';
      fromTweakedSettings(solrUrlSvc, fieldSpecSvc, settings);

      expect(settings.startUrl).toContain('blah');
      expect(settings.startUrl).not.toContain('fl');
    });

    it('includes fl in start URL when fieldSpec has explicit subs', () => {
      var settings = stubSettings();
      settings.searchUrl = 'http://localhost:8983/solr/example';
      settings.fieldSpecStr = 'title sub1 sub2';
      settings.searchArgsStr = 'q=*:*';
      fromTweakedSettings(solrUrlSvc, fieldSpecSvc, settings);

      expect(settings.startUrl).toContain('fl=title sub1 sub2');
    });
  });

  describe('deep clone safety', () => {
    it('does not mutate the original parsedUrl.solrArgs', () => {
      var settings = stubSettings();
      var spy = vi.spyOn(solrUrlSvc, 'parseSolrUrl');
      var fakeArgs = { q: ['*:*'], wt: ['json'] };
      spy.mockReturnValue({
        solrEndpoint: function () {
          return 'http://localhost:8983/solr/example';
        },
        solrArgs: fakeArgs,
      });

      fromStartUrl(solrUrlSvc, fieldSpecSvc, 'http://fake?ignored', settings);

      // removeUnsupported deletes wt from the clone, but original should be untouched
      expect(fakeArgs.wt).toEqual(['json']);
    });
  });
});
