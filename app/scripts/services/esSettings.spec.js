import { describe, it, expect } from 'vitest';
import { fromStartUrl, fromTweakedSettings } from './esSettings.js';

function stubSettings() {
  return {
    startUrl: '',
    whichEngine: '',
    searchUrl: '',
    fieldSpecStr: '',
    searchArgsStr: '',
  };
}

describe('esSettings', () => {
  describe('fromStartUrl', () => {
    it('parses start URL into searchUrl + fieldSpecStr', () => {
      var settings = stubSettings();
      settings.startUrl =
        'http://localhost:9200/statedecoded/_search?stored_fields=title catch_line';
      fromStartUrl(settings);

      expect(settings.searchUrl).toBe('http://localhost:9200/statedecoded/_search');
      expect(settings.fieldSpecStr).toBe('title catch_line');
      expect(settings.searchArgsStr).toBe('{ "match_all": {} }');
      expect(settings.whichEngine).toBe('es');
    });

    it('uses default fieldspec when no fields specified', () => {
      var settings = stubSettings();
      settings.startUrl = 'http://localhost:9200/statedecoded/_search';
      fromStartUrl(settings);

      expect(settings.searchUrl).toBe('http://localhost:9200/statedecoded/_search');
      expect(settings.fieldSpecStr).toBe('title, *');
      expect(settings.searchArgsStr).toBe('{ "match_all": {} }');
      expect(settings.whichEngine).toBe('es');
    });

    it('preserves an existing args string', () => {
      var settings = stubSettings();
      settings.startUrl = 'http://localhost:9200/statedecoded/_search';
      settings.searchArgsStr = '{ "query": { "match": { "_all": "deer" } } }';
      fromStartUrl(settings);

      expect(settings.searchUrl).toBe('http://localhost:9200/statedecoded/_search');
      expect(settings.fieldSpecStr).toBe('title, *');
      expect(settings.searchArgsStr).toBe('{ "query": { "match": { "_all": "deer" } } }');
      expect(settings.whichEngine).toBe('es');
    });

    it('preserves a user-provided fieldSpecStr over URL stored_fields', () => {
      var settings = stubSettings();
      settings.startUrl =
        'http://localhost:9200/statedecoded/_search?stored_fields=title catch_line';
      settings.fieldSpecStr = 'my_field';
      fromStartUrl(settings);

      expect(settings.fieldSpecStr).toBe('my_field');
    });

    it('appends stored_fields to startUrl when URL has none', () => {
      var settings = stubSettings();
      settings.startUrl = 'http://localhost:9200/statedecoded/_search';
      fromStartUrl(settings);

      expect(settings.startUrl).toContain('?stored_fields=');
    });

    it('preserves credentials in the URL', () => {
      var settings = stubSettings();
      settings.startUrl =
        'http://admin:secret@localhost:9200/idx/_search?stored_fields=title';
      fromStartUrl(settings);

      expect(settings.searchUrl).toContain('admin:secret@');
    });

    it('parses multiple query params', () => {
      var settings = stubSettings();
      settings.startUrl =
        'http://localhost:9200/idx/_search?stored_fields=title&routing=user123';
      fromStartUrl(settings);

      expect(settings.fieldSpecStr).toBe('title');
    });
  });

  describe('fromTweakedSettings', () => {
    it('updates startUrl from searchUrl + fieldSpecStr', () => {
      var settings = stubSettings();
      settings.startUrl =
        'http://localhost:9200/statedecoded/_search?stored_fields=title catch_line';
      fromStartUrl(settings);

      settings.fieldSpecStr = 'catch_line';
      fromTweakedSettings(settings);

      expect(settings.startUrl).not.toContain('title');
      expect(settings.startUrl).toContain('catch_line');
    });

    it('omits stored_fields when fieldSpecStr is empty', () => {
      var settings = stubSettings();
      settings.searchUrl = 'http://localhost:9200/idx/_search';
      settings.fieldSpecStr = '';
      fromTweakedSettings(settings);

      expect(settings.startUrl).toBe('http://localhost:9200/idx/_search');
    });
  });
});
