import { describe, it, expect } from 'vitest';
import { fromStartUrl, fromTweakedSettings } from '@app/services/osSettings.js';

function stubSettings() {
  return {
    startUrl: '',
    whichEngine: '',
    searchUrl: '',
    fieldSpecStr: '',
    searchArgsStr: '',
  };
}

describe('osSettings', () => {
  describe('fromStartUrl', () => {
    it('sets whichEngine to os', () => {
      var settings = stubSettings();
      settings.startUrl = 'http://localhost:9200/idx/_search';
      fromStartUrl(settings);

      expect(settings.whichEngine).toBe('os');
    });

    it('parses start URL into searchUrl + fieldSpecStr', () => {
      var settings = stubSettings();
      settings.startUrl =
        'http://localhost:9200/statedecoded/_search?stored_fields=title catch_line';
      fromStartUrl(settings);

      expect(settings.searchUrl).toBe('http://localhost:9200/statedecoded/_search');
      expect(settings.fieldSpecStr).toBe('title catch_line');
      expect(settings.searchArgsStr).toBe('{ "match_all": {} }');
    });

    it('uses default fieldspec when no fields specified', () => {
      var settings = stubSettings();
      settings.startUrl = 'http://localhost:9200/statedecoded/_search';
      fromStartUrl(settings);

      expect(settings.fieldSpecStr).toBe('title, *');
    });

    it('preserves an existing args string', () => {
      var settings = stubSettings();
      settings.startUrl = 'http://localhost:9200/statedecoded/_search';
      settings.searchArgsStr = '{ "query": { "match_all": {} } }';
      fromStartUrl(settings);

      expect(settings.searchArgsStr).toBe('{ "query": { "match_all": {} } }');
    });

    it('preserves credentials in the URL', () => {
      var settings = stubSettings();
      settings.startUrl = 'http://admin:secret@localhost:9200/idx/_search?stored_fields=title';
      fromStartUrl(settings);

      expect(settings.searchUrl).toContain('admin:secret@');
    });

    it('parses multiple query params', () => {
      var settings = stubSettings();
      settings.startUrl = 'http://localhost:9200/idx/_search?stored_fields=title&routing=user123';
      fromStartUrl(settings);

      expect(settings.fieldSpecStr).toBe('title');
    });
  });

  describe('fromTweakedSettings', () => {
    it('reconstructs startUrl from searchUrl + fieldSpecStr', () => {
      var settings = stubSettings();
      settings.searchUrl = 'http://localhost:9200/idx/_search';
      settings.fieldSpecStr = 'title';
      fromTweakedSettings(settings);

      expect(settings.startUrl).toBe('http://localhost:9200/idx/_search?stored_fields=title');
    });

    it('omits stored_fields when fieldSpecStr is empty', () => {
      var settings = stubSettings();
      settings.searchUrl = 'http://localhost:9200/idx/_search';
      settings.fieldSpecStr = '';
      fromTweakedSettings(settings);

      expect(settings.startUrl).toBe('http://localhost:9200/idx/_search');
    });

    it('round-trips: fromStartUrl → tweak fieldSpec → fromTweakedSettings', () => {
      var settings = stubSettings();
      settings.startUrl =
        'http://localhost:9200/statedecoded/_search?stored_fields=title catch_line';
      fromStartUrl(settings);

      settings.fieldSpecStr = 'catch_line';
      fromTweakedSettings(settings);

      expect(settings.startUrl).not.toContain('title');
      expect(settings.startUrl).toContain('catch_line');
    });
  });
});
