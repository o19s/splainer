// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseUrl, createJsonEngineSettings } from '@app/services/jsonEngineSettings.js';

// --- parseUrl -----------------------------------------------------------------

describe('parseUrl', () => {
  it('extracts protocol, host, and pathname', () => {
    const result = parseUrl('http://localhost:9200/my-index/_search');
    expect(result.url).toBe('http://localhost:9200/my-index/_search');
  });

  it('extracts query-string parameters', () => {
    const result = parseUrl('http://localhost:9200/idx/_search?stored_fields=title&pretty=true');
    expect(result.url).toBe('http://localhost:9200/idx/_search');
    expect(result.stored_fields).toBe('title');
    expect(result.pretty).toBe('true');
  });

  it('decodes percent-encoded query values', () => {
    const result = parseUrl('http://host/idx/_search?stored_fields=title%2C%20body');
    expect(result.stored_fields).toBe('title, body');
  });

  it('handles URLs with no query string', () => {
    const result = parseUrl('https://es.example.com/idx/_search');
    expect(result.url).toBe('https://es.example.com/idx/_search');
    // No extra keys besides url
    expect(Object.keys(result)).toEqual(['url']);
  });
});

// --- createJsonEngineSettings ------------------------------------------------

describe('createJsonEngineSettings', () => {
  describe('fromStartUrl', () => {
    it('sets whichEngine to the provided engine', () => {
      const { fromStartUrl } = createJsonEngineSettings('es');
      const settings = { startUrl: 'http://host/idx/_search', searchArgsStr: '', fieldSpecStr: '' };
      fromStartUrl(settings);
      expect(settings.whichEngine).toBe('es');
    });

    it('extracts searchUrl from the URL (without query string)', () => {
      const { fromStartUrl } = createJsonEngineSettings('os');
      const settings = {
        startUrl: 'http://host/idx/_search?stored_fields=title',
        searchArgsStr: '',
        fieldSpecStr: '',
      };
      fromStartUrl(settings);
      expect(settings.searchUrl).toBe('http://host/idx/_search');
    });

    it('defaults searchArgsStr to match_all when empty', () => {
      const { fromStartUrl } = createJsonEngineSettings('es');
      const settings = { startUrl: 'http://host/idx/_search', searchArgsStr: '', fieldSpecStr: '' };
      fromStartUrl(settings);
      expect(settings.searchArgsStr).toBe('{ "match_all": {} }');
    });

    it('preserves non-empty searchArgsStr', () => {
      const { fromStartUrl } = createJsonEngineSettings('es');
      const settings = {
        startUrl: 'http://host/idx/_search',
        searchArgsStr: '{"query":{"term":{"status":"active"}}}',
        fieldSpecStr: '',
      };
      fromStartUrl(settings);
      expect(settings.searchArgsStr).toBe('{"query":{"term":{"status":"active"}}}');
    });

    it('extracts fieldSpecStr from stored_fields query param', () => {
      const { fromStartUrl } = createJsonEngineSettings('es');
      const settings = {
        startUrl: 'http://host/idx/_search?stored_fields=title%2C%20body',
        searchArgsStr: '',
        fieldSpecStr: '',
      };
      fromStartUrl(settings);
      expect(settings.fieldSpecStr).toBe('title, body');
    });

    it('defaults fieldSpecStr to "title, *" when no stored_fields', () => {
      const { fromStartUrl } = createJsonEngineSettings('es');
      const settings = {
        startUrl: 'http://host/idx/_search',
        searchArgsStr: '',
        fieldSpecStr: '',
      };
      fromStartUrl(settings);
      expect(settings.fieldSpecStr).toBe('title, *');
    });

    it('appends stored_fields to startUrl when not present', () => {
      const { fromStartUrl } = createJsonEngineSettings('es');
      const settings = {
        startUrl: 'http://host/idx/_search',
        searchArgsStr: '',
        fieldSpecStr: '',
      };
      fromStartUrl(settings);
      expect(settings.startUrl).toContain('?stored_fields=');
    });

    it('preserves existing fieldSpecStr over stored_fields param', () => {
      const { fromStartUrl } = createJsonEngineSettings('es');
      const settings = {
        startUrl: 'http://host/idx/_search?stored_fields=ignored',
        searchArgsStr: '',
        fieldSpecStr: 'my_field',
      };
      fromStartUrl(settings);
      expect(settings.fieldSpecStr).toBe('my_field');
    });
  });

  describe('fromTweakedSettings', () => {
    it('reconstructs startUrl from searchUrl', () => {
      const { fromTweakedSettings } = createJsonEngineSettings('es');
      const settings = { searchUrl: 'http://host/idx/_search', fieldSpecStr: '' };
      fromTweakedSettings(settings);
      expect(settings.startUrl).toBe('http://host/idx/_search');
    });

    it('appends stored_fields when fieldSpecStr is non-empty', () => {
      const { fromTweakedSettings } = createJsonEngineSettings('os');
      const settings = { searchUrl: 'http://host/idx/_search', fieldSpecStr: 'title, body' };
      fromTweakedSettings(settings);
      expect(settings.startUrl).toBe('http://host/idx/_search?stored_fields=title, body');
    });

    it('omits stored_fields when fieldSpecStr is empty', () => {
      const { fromTweakedSettings } = createJsonEngineSettings('es');
      const settings = { searchUrl: 'http://host/idx/_search', fieldSpecStr: '' };
      fromTweakedSettings(settings);
      expect(settings.startUrl).toBe('http://host/idx/_search');
    });
  });
});
