// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { DocExplain, renderInto, unmount } from './docExplain.jsx';

// Dialog polyfill (showModal/close) loaded via vitest setupFiles.
import { makeRoot, makeSearchDoc as makeDoc } from '../test-helpers/factories.js';

describe('docExplain island', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the heading with doc.title interpolated', () => {
    const el = makeRoot();
    render(
      <DocExplain doc={makeDoc({ title: 'the canned title' })} onClose={() => {}} />,
      el,
    );
    const header = el.querySelector('[data-role="detailed-explain-modal"]');
    expect(header.textContent).toContain('Explain for:');
    expect(header.textContent).toContain('the canned title');
  });

  it('renders the Summarized tab content from doc.explain().toStr()', () => {
    const el = makeRoot();
    render(
      <DocExplain
        doc={makeDoc({ explainToStr: 'SUMMARIZED_MARKER weight(...)' })}
        onClose={() => {}}
      />,
      el,
    );
    expect(el.textContent).toContain('SUMMARIZED_MARKER');
  });

  it('renders the Hot Matches tab content into the DOM', () => {
    // All three tabs are in DOM simultaneously (CSS-hidden when inactive);
    // Playwright greps across tabs so conditional rendering would fail.
    const el = makeRoot();
    render(
      <DocExplain doc={makeDoc({ hotStr: 'HOT_MARKER foo' })} onClose={() => {}} />,
      el,
    );
    expect(el.textContent).toContain('HOT_MARKER');
  });

  it('renders pretty-printed JSON in the Full Explain tab', () => {
    const el = makeRoot();
    render(
      <DocExplain
        doc={makeDoc({ explainRaw: { description: 'FULL_MARKER', value: 3 } })}
        onClose={() => {}}
      />,
      el,
    );
    // Pretty-printed: has a newline + two-space indent
    expect(el.textContent).toContain('FULL_MARKER');
    expect(el.textContent).toMatch(/\n {2}"description"/);
  });

  it('canExplainOther=false hides the alt-query form', () => {
    const el = makeRoot();
    render(<DocExplain doc={makeDoc()} canExplainOther={false} onClose={() => {}} />, el);
    expect(el.querySelector('[data-role="alt-query"]')).toBeNull();
  });

  it('canExplainOther=true renders the alt-query form', () => {
    const el = makeRoot();
    render(
      <DocExplain
        doc={makeDoc()}
        canExplainOther={true}
        explainOther={() => Promise.resolve({ docs: [], maxScore: 0 })}
        onClose={() => {}}
      />,
      el,
    );
    expect(el.querySelector('[data-role="alt-query"]')).not.toBeNull();
    expect(el.querySelector('[data-role="find-others"]')).not.toBeNull();
  });

  it('submitting alt-query calls explainOther with the typed string', async () => {
    const el = makeRoot();
    const explainOther = vi.fn().mockResolvedValue({ docs: [], maxScore: 0 });
    render(
      <DocExplain
        doc={makeDoc()}
        canExplainOther={true}
        explainOther={explainOther}
        onClose={() => {}}
      />,
      el,
    );
    const input = el.querySelector('[data-role="alt-query"]');
    input.value = 'my query';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // Flush Preact's batched state update before submitting.
    await new Promise((r) => setTimeout(r, 0));
    const form = input.closest('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(explainOther).toHaveBeenCalledWith('my query');
  });

  it('renders nested DocRow children for explainOther results and tracks altDoc selection', async () => {
    const el = makeRoot();
    const altDocFixture = makeDoc({ id: 'alt-doc-1', title: 'ALT_DOC_TITLE' });
    const explainOther = vi
      .fn()
      .mockResolvedValue({ docs: [altDocFixture], maxScore: 2.5 });
    render(
      <DocExplain
        doc={makeDoc({ title: 'PRIMARY' })}
        canExplainOther={true}
        explainOther={explainOther}
        onClose={() => {}}
      />,
      el,
    );

    // Header initially shows only the primary doc.
    const header = el.querySelector('[data-role="detailed-explain-modal"]');
    expect(header.textContent).toContain('PRIMARY');
    expect(header.textContent).not.toContain('ALT_DOC_TITLE');

    // Submit the form. AltQueryForm allows empty altQuery; the resolved
    // value drives the rendering.
    el.querySelector('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 0));

    // The nested DocRow should be in the DOM (data-role is preserved
    // by docRow.jsx).
    const nestedRows = el.querySelectorAll('[data-role="doc-row"]');
    expect(nestedRows.length).toBe(1);

    // Click the nested row's wrapper — sets altDoc and adds the compare
    // pane + "vs ALT_DOC_TITLE" to the header.
    nestedRows[0].parentElement.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(header.textContent).toContain('ALT_DOC_TITLE');
  });

  it('surfaces explainOther rejection as an error banner', async () => {
    const el = makeRoot();
    const explainOther = vi.fn().mockRejectedValue(new Error('boom'));
    render(
      <DocExplain
        doc={makeDoc()}
        canExplainOther={true}
        explainOther={explainOther}
        onClose={() => {}}
      />,
      el,
    );
    const form = el.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    // microtask + rerender
    await new Promise((r) => setTimeout(r, 0));
    const banner = el.querySelector('[data-role="alt-query-error"]');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('boom');
  });

  it('XSS regression: explain description is text-interpolated, not HTML', () => {
    // Security merge gate. An explain description containing
    // <img src=x onerror=window.__xss=1> must render as literal text —
    // no <img> element, no onerror execution. Preact text interpolation
    // handles this for free; the test is the load-bearing assertion
    // that the safe pattern does not drift.
    delete window.__xss;
    const el = makeRoot();
    render(
      <DocExplain
        doc={makeDoc({
          explainToStr: '1.0 <img src=x onerror="window.__xss=1">',
        })}
        onClose={() => {}}
      />,
      el,
    );
    expect(el.querySelector('img')).toBeNull();
    expect(window.__xss).toBeUndefined();
    // The raw text appears verbatim inside the pre.
    expect(el.textContent).toContain('<img src=x onerror=');
  });

  it('ESC (cancel event) fires onClose', () => {
    const el = makeRoot();
    const onClose = vi.fn();
    render(<DocExplain doc={makeDoc()} onClose={onClose} />, el);
    const dlg = el.querySelector('dialog');
    dlg.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renderInto / unmount mount and tear down the island', () => {
    const el = makeRoot();
    renderInto(el, makeDoc(), { onClose: () => {} });
    expect(el.querySelector('dialog')).not.toBeNull();
    unmount(el);
    expect(el.querySelector('dialog')).toBeNull();
  });

  describe('tab switching', () => {
    // All three <pre> panes live in the DOM simultaneously; the active tab
    // is selected by toggling inline `display: block|none` rather than by
    // conditional rendering. These tests pin that contract: clicking a tab
    // must (a) show only its own <pre>, and (b) mark only its <li> active.

    function mountWithAllTabs() {
      const el = makeRoot();
      render(
        <DocExplain
          doc={makeDoc({
            explainToStr: 'SUM_PANE',
            hotStr: 'HOT_PANE',
            explainRaw: { description: 'FULL_PANE', value: 1 },
          })}
          onClose={() => {}}
        />,
        el,
      );
      return el;
    }

    function panes(el) {
      // Preact renders TABS in order: [summarized, hot, full]. The three
      // top-level panes inside the primary .explain-view are at .explain-view
      // > div > pre (order-matched to TABS).
      const all = el.querySelectorAll('.explain-view pre');
      return { summarized: all[0], hot: all[1], full: all[2] };
    }

    function navItems(el) {
      return {
        summarized: el.querySelector('[data-role="tab-summarized"]').closest('li'),
        hot: el.querySelector('[data-role="tab-hot"]').closest('li'),
        full: el.querySelector('[data-role="tab-full"]').closest('li'),
      };
    }

    it('defaults to the summarized tab with only its pane visible', () => {
      const el = mountWithAllTabs();
      const p = panes(el);
      expect(p.summarized.style.display).toBe('block');
      expect(p.hot.style.display).toBe('none');
      expect(p.full.style.display).toBe('none');
    });

    it('defaults to the summarized nav item being active', () => {
      const el = mountWithAllTabs();
      const n = navItems(el);
      expect(n.summarized.className).toBe('active');
      expect(n.hot.className).toBe('');
      expect(n.full.className).toBe('');
    });

    it('clicking the Hot Matches tab shows only the hot pane', async () => {
      const el = mountWithAllTabs();
      el.querySelector('[data-role="tab-hot"]').dispatchEvent(
        new Event('click', { bubbles: true, cancelable: true }),
      );
      await new Promise((r) => setTimeout(r, 0));
      const p = panes(el);
      expect(p.summarized.style.display).toBe('none');
      expect(p.hot.style.display).toBe('block');
      expect(p.full.style.display).toBe('none');
      const n = navItems(el);
      expect(n.summarized.className).toBe('');
      expect(n.hot.className).toBe('active');
      expect(n.full.className).toBe('');
    });

    it('clicking the Full Explain tab shows only the full pane', async () => {
      const el = mountWithAllTabs();
      el.querySelector('[data-role="tab-full"]').dispatchEvent(
        new Event('click', { bubbles: true, cancelable: true }),
      );
      await new Promise((r) => setTimeout(r, 0));
      const p = panes(el);
      expect(p.summarized.style.display).toBe('none');
      expect(p.hot.style.display).toBe('none');
      expect(p.full.style.display).toBe('block');
      const n = navItems(el);
      expect(n.full.className).toBe('active');
      expect(n.summarized.className).toBe('');
      expect(n.hot.className).toBe('');
    });

    it('tab-switching click is preventDefault so the page does not scroll', () => {
      const el = mountWithAllTabs();
      const evt = new Event('click', { bubbles: true, cancelable: true });
      el.querySelector('[data-role="tab-hot"]').dispatchEvent(evt);
      expect(evt.defaultPrevented).toBe(true);
    });
  });

  describe('empty / missing data', () => {
    // Pins the defaults inside handleResults:
    //   docs:     (result && result.docs)     || []
    //   maxScore: (result && result.maxScore) || 0
    // and the `doc && doc.title` header guard.

    it('does not crash when mounted without a doc prop', () => {
      const el = makeRoot();
      expect(() => {
        render(<DocExplain doc={null} onClose={() => {}} />, el);
      }).not.toThrow();
      // Header still renders, just with no title text after "Explain for:".
      const header = el.querySelector('[data-role="detailed-explain-modal"]');
      expect(header).not.toBeNull();
    });

    it('handles explainOther resolving with undefined (no docs, no crash)', async () => {
      const el = makeRoot();
      const explainOther = vi.fn().mockResolvedValue(undefined);
      render(
        <DocExplain
          doc={makeDoc()}
          canExplainOther={true}
          explainOther={explainOther}
          onClose={() => {}}
        />,
        el,
      );
      el.querySelector('form').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await new Promise((r) => setTimeout(r, 0));
      // docs falls back to [] — no rows rendered, no error banner.
      expect(el.querySelectorAll('[data-role="doc-row"]')).toHaveLength(0);
      expect(el.querySelector('[data-role="alt-query-error"]')).toBeNull();
    });

    it('handles explainOther resolving with a partial object (missing docs/maxScore)', async () => {
      // `result && result.docs` is falsy → [], and `result && result.maxScore`
      // is falsy → 0. Neither fallback should throw.
      const el = makeRoot();
      const explainOther = vi.fn().mockResolvedValue({});
      render(
        <DocExplain
          doc={makeDoc()}
          canExplainOther={true}
          explainOther={explainOther}
          onClose={() => {}}
        />,
        el,
      );
      el.querySelector('form').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await new Promise((r) => setTimeout(r, 0));
      expect(el.querySelectorAll('[data-role="doc-row"]')).toHaveLength(0);
    });
  });
});
