// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, unmount } from './docRow.jsx';

import { makeRoot, makeSearchDoc } from '../test-helpers/factories.js';

// Helpers ────────────────────────────────────────────────────────────────────

// DocRow-specific doc factory — overrides the shared factory with
// a default score of 1.5 and a snippet, matching the original shape.
function makeDoc(overrides = {}) {
  return makeSearchDoc({
    score: 1.5,
    subSnippets: () => ({ body: 'matched <em>term</em>' }),
    ...overrides,
  });
}

// For the chart-aware tests only — adds a single canned hot match.
function makeDocWithChart(overrides = {}) {
  return makeDoc({
    hotMatchesOutOf: () => [{ description: 'title:canned', percentage: 75 }],
    ...overrides,
  });
}

describe('docRow island', () => {
  // Vitest jsdom shares window across tests in the same file. The XSS
  // tests below set sentinel globals (window.__xss, __xss2, __xss3) and
  // assert they remain undefined; without cleanup, a failure in one test
  // could cascade into a *false* failure in a later test using the same
  // sentinel name. Cheap insurance.
  beforeEach(() => {
    delete window.__xss;
    delete window.__xss2;
    delete window.__xss3;
  });

  it('renders the doc score and title', () => {
    const el = makeRoot();
    mount(el, makeDoc(), { maxScore: 1 });
    expect(el.querySelector('[data-testid="doc-row"]')).not.toBeNull();
    expect(el.textContent).toContain('1.5');
    expect(el.textContent).toContain('canned');
    // The <em> highlight tag survives sanitization (it's on DOMPurify's
    // allowlist by default). Confirms the highlighted markup actually
    // renders rather than being escaped to literal "&lt;em&gt;".
    expect(el.querySelector('a em')).not.toBeNull();
  });

  it('renders snippet fields with their labels', () => {
    const el = makeRoot();
    mount(
      el,
      makeDoc({
        subSnippets: () => ({ body: 'foo', title: 'bar' }),
      }),
      { maxScore: 1 },
    );
    const labels = Array.from(el.querySelectorAll('.fieldLabel')).map((l) =>
      l.textContent.trim(),
    );
    expect(labels).toContain('body:');
    expect(labels).toContain('title:');
  });

  it('joins array snippet values with ", "', () => {
    // splainer-search returns array values for multi-valued fields. The
    // old controller joined with ", " for display; preserving that.
    const el = makeRoot();
    mount(
      el,
      makeDoc({
        subSnippets: () => ({ tags: ['alpha', 'beta', 'gamma'] }),
      }),
      { maxScore: 1 },
    );
    expect(el.textContent).toContain('alpha, beta, gamma');
  });

  it('renders thumb and image when present', () => {
    const el = makeRoot();
    mount(
      el,
      makeDoc({
        hasThumb: () => true,
        thumb: 'http://example.com/thumb.png',
        hasImage: () => true,
        image: 'http://example.com/full.png',
      }),
      { maxScore: 1 },
    );
    const imgs = el.querySelectorAll('img');
    expect(imgs.length).toBe(2);
    expect(imgs[0].src).toBe('http://example.com/thumb.png');
    expect(imgs[1].src).toBe('http://example.com/full.png');
  });

  it('calls onShowDoc when the title link is clicked', () => {
    const el = makeRoot();
    const onShowDoc = vi.fn();
    const doc = makeDoc();
    mount(el, doc, { maxScore: 1, onShowDoc });
    const link = el.querySelector('a');
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onShowDoc).toHaveBeenCalledTimes(1);
    expect(onShowDoc).toHaveBeenCalledWith(doc);
  });

  // StackedChart child rendering

  it('renders the StackedChart child with the doc hot matches', () => {
    const el = makeRoot();
    mount(el, makeDocWithChart(), { maxScore: 1, onShowDetailed: () => {} });
    // The chart renders one .graph-explain row per hot match.
    expect(el.querySelectorAll('.graph-explain').length).toBeGreaterThan(0);
    expect(el.textContent).toContain('title:canned');
    // The Detailed link with the load-bearing PR 8.5 testid is present.
    expect(el.querySelector('[data-testid="stacked-chart-detailed"]')).not.toBeNull();
  });

  it('clicking the StackedChart Detailed link fires onShowDetailed', () => {
    const el = makeRoot();
    const onShowDetailed = vi.fn();
    mount(el, makeDocWithChart(), { maxScore: 1, onShowDetailed });
    el.querySelector('[data-testid="stacked-chart-detailed"]').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    expect(onShowDetailed).toHaveBeenCalledTimes(1);
  });

  it('omits the Detailed link in the <=3 branch when no onShowDetailed callback is provided', () => {
    // The <=3 branch omits the Detailed link when no callback is provided.
    // (The >3 branch always renders the Detailed link — see the
    // stackedChart spec for that case.)
    const el = makeRoot();
    mount(el, makeDocWithChart(), { maxScore: 1 });
    expect(el.querySelector('[data-testid="stacked-chart-detailed"]')).toBeNull();
  });

  it('re-mounts cleanly after an unmount', () => {
    // Verify remount after unmount produces a valid tree.
    const el = makeRoot();
    mount(el, makeDoc(), { maxScore: 1 });
    expect(el.querySelector('[data-testid="doc-row"]')).not.toBeNull();
    unmount(el);
    expect(el.querySelector('[data-testid="doc-row"]')).toBeNull();
    mount(el, makeDoc({ score: 7 }), { maxScore: 1 });
    expect(el.querySelector('[data-testid="doc-row"]')).not.toBeNull();
    expect(el.textContent).toContain('7');
  });

  // ───────────────────────────────────────────────────────────────────────
  // SECURITY: malicious-input regression. The whole reason DOMPurify is
  // a hard dep in this PR. If a future contributor swaps SanitizedHtml
  // for raw dangerouslySetInnerHTML, this test fires immediately. The
  // round-table's Security persona called this the merge gate; it is
  // intentionally the most important test in this file.
  // ───────────────────────────────────────────────────────────────────────
  it('strips XSS payloads from a malicious title', () => {
    const el = makeRoot();
    mount(
      el,
      makeDoc({
        getHighlightedTitle: () =>
          'safe text <img src=x onerror="window.__xss=1"> more',
      }),
      { maxScore: 1 },
    );
    // The image tag may survive (it's in DOMPurify's allowlist), but the
    // onerror attribute MUST be stripped.
    const img = el.querySelector('a img');
    if (img) {
      expect(img.getAttribute('onerror')).toBeNull();
    }
    // The "safe text" surrounding content survives.
    expect(el.textContent).toContain('safe text');
    expect(el.textContent).toContain('more');
    // No script execution side effect should land on window.
    expect(window.__xss).toBeUndefined();
  });

  it('strips XSS payloads from a malicious snippet field value', () => {
    const el = makeRoot();
    mount(
      el,
      makeDoc({
        subSnippets: () => ({
          body: 'highlighted <em>term</em> <script>window.__xss2=1</script> trailing',
        }),
      }),
      { maxScore: 1 },
    );
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('highlighted');
    expect(el.textContent).toContain('term');
    expect(el.textContent).toContain('trailing');
    expect(window.__xss2).toBeUndefined();
  });

  it('strips javascript: URLs from a malicious title link', () => {
    // The title is rendered inside an <a> the user can click. If the
    // sanitized HTML contains an <a href="javascript:..."> the click
    // handler the *island* attaches still runs (preventDefault'd), but
    // the embedded malicious anchor must not be a clickable launcher.
    const el = makeRoot();
    mount(
      el,
      makeDoc({
        getHighlightedTitle: () =>
          '<a href="javascript:window.__xss3=1">click</a>',
      }),
      { maxScore: 1 },
    );
    // Strong assertion: the literal "javascript:" must not appear ANYWHERE
    // in the rendered HTML. This catches both possible sanitization
    // outcomes — DOMPurify stripping the inner <a> entirely (the array
    // below is empty, the per-href forEach is vacuous) AND DOMPurify
    // keeping the <a> with the href stripped. Without this assertion,
    // the per-href loop would silently pass even if no sanitization
    // happened at all.
    expect(el.innerHTML.toLowerCase()).not.toContain('javascript:');
    const innerAnchors = el.querySelectorAll('a a');
    innerAnchors.forEach((a) => {
      const href = a.getAttribute('href') || '';
      expect(href.toLowerCase()).not.toContain('javascript:');
    });
    expect(window.__xss3).toBeUndefined();
  });

  it('unmount tears down the rendered DOM', () => {
    const el = makeRoot();
    mount(el, makeDoc(), { maxScore: 1 });
    expect(el.querySelector('[data-testid="doc-row"]')).not.toBeNull();
    unmount(el);
    expect(el.querySelector('[data-testid="doc-row"]')).toBeNull();
  });
});
