// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from 'preact';

import { JsonTree, normalizeJsonTreeInput, pathKey } from '@app/islands/jsonTree.jsx';

describe('JsonTree', () => {
  it('renders invalid JSON strings as literal pre text', () => {
    const el = document.createElement('div');
    render(<JsonTree value={'not json {'} />, el);
    const pre = el.querySelector('pre.json-tree-fallback');
    expect(pre).toBeTruthy();
    expect(pre.textContent).toBe('not json {');
  });

  it('parses JSON strings and renders keys', () => {
    const el = document.createElement('div');
    render(<JsonTree value='{"a":1}' />, el);
    expect(el.textContent).toContain('"a"');
    expect(el.textContent).toContain('1');
  });

  it('toggle collapses and hides nested keys', async () => {
    const el = document.createElement('div');
    render(<JsonTree value={{ outer: { inner: 1 } }} />, el);
    expect(el.textContent).toContain('inner');

    const btn = el.querySelector('button.json-tree-toggle');
    expect(btn).toBeTruthy();
    btn.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(el.textContent).not.toContain('inner');
    expect(el.textContent).toMatch(/1 keys/);
  });

  it('normalizeJsonTreeInput handles undefined and objects', () => {
    expect(normalizeJsonTreeInput(undefined).mode).toBe('empty');
    expect(normalizeJsonTreeInput({ a: 1 }).mode).toBe('json');
    expect(normalizeJsonTreeInput({ a: 1 }).data).toEqual({ a: 1 });
  });

  it('pathKey is stable for nested paths', () => {
    expect(pathKey(['a', 0, 'b'])).toBe(JSON.stringify(['a', 0, 'b']));
  });

  it('empty [] and {} render without a toggle (nothing to expand)', () => {
    const el = document.createElement('div');
    render(<JsonTree value={[]} />, el);
    expect(el.textContent).toContain('[]');
    expect(el.querySelector('button.json-tree-toggle')).toBeNull();

    const el2 = document.createElement('div');
    render(<JsonTree value={{}} />, el2);
    expect(el2.textContent).toContain('{}');
    expect(el2.querySelector('button.json-tree-toggle')).toBeNull();
  });
});
