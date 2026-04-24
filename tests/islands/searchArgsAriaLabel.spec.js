import { describe, it, expect } from 'vitest';
import { searchArgsAriaLabel } from '@app/islands/searchArgsAriaLabel.js';

describe('searchArgsAriaLabel', () => {
  it('returns engine-specific copy', () => {
    expect(searchArgsAriaLabel('solr')).toBe('Solr query parameters');
    expect(searchArgsAriaLabel('es')).toBe('Elasticsearch query JSON body');
    expect(searchArgsAriaLabel('os')).toBe('OpenSearch query JSON body');
  });

  it('falls back for unknown engine keys', () => {
    expect(searchArgsAriaLabel('unknown')).toBe('Search arguments');
  });
});
