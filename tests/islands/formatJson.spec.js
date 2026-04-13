import { describe, it, expect } from 'vitest';
import { formatJson } from '@app/islands/formatJson.js';

describe('formatJson', () => {
  it('pretty-prints valid JSON with 2-space indent', () => {
    expect(formatJson('{"a":1,"b":[2,3]}')).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
  });

  it('returns the original string when JSON is invalid', () => {
    expect(formatJson('not json {')).toBe('not json {');
  });

  it('returns an empty string unchanged', () => {
    expect(formatJson('')).toBe('');
  });

  it('handles null and nested objects', () => {
    expect(formatJson('{"a":null,"b":{"c":1}}')).toBe(
      '{\n  "a": null,\n  "b": {\n    "c": 1\n  }\n}',
    );
  });
});
