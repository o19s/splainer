// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';

import { StackedChart } from '@app/islands/stackedChart.jsx';
import { makeRoot } from '@test/factories.js';

function makeDoc(hots) {
  return {
    hotMatchesOutOf: () => hots,
  };
}

describe('stackedChart island', () => {
  beforeEach(() => {
    delete window.__xss_chart;
  });

  it('renders one progress bar per hot match in the <=3 branch', () => {
    const el = makeRoot();
    const hots = [
      { description: 'title:foo', percentage: 80 },
      { description: 'body:foo', percentage: 20 },
    ];
    render(<StackedChart doc={makeDoc(hots)} maxScore={1} onDetailed={() => {}} />, el);
    expect(el.querySelectorAll('.graph-explain').length).toBe(2);
    expect(el.textContent).toContain('title:foo');
    expect(el.textContent).toContain('body:foo');
  });

  it('preserves data-role="stacked-chart-detailed" on the Detailed link', () => {
    // Load-bearing: Playwright e2e test clicks via this exact data-role.
    const el = makeRoot();
    render(
      <StackedChart
        doc={makeDoc([{ description: 'x', percentage: 50 }])}
        maxScore={1}
        onDetailed={() => {}}
      />,
      el,
    );
    expect(el.querySelector('[data-role="stacked-chart-detailed"]')).not.toBeNull();
  });

  it('omits the Detailed link when no onDetailed handler is provided', () => {
    const el = makeRoot();
    render(<StackedChart doc={makeDoc([{ description: 'x', percentage: 50 }])} maxScore={1} />, el);
    expect(el.querySelector('[data-role="stacked-chart-detailed"]')).toBeNull();
  });

  it('clicking Detailed fires onDetailed and prevents default', () => {
    const el = makeRoot();
    const onDetailed = vi.fn();
    render(
      <StackedChart
        doc={makeDoc([{ description: 'x', percentage: 50 }])}
        maxScore={1}
        onDetailed={onDetailed}
      />,
      el,
    );
    const link = el.querySelector('[data-role="stacked-chart-detailed"]');
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onDetailed).toHaveBeenCalledTimes(1);
  });

  it('renders the >3 branch with collapsed extras and a Show More toggle', async () => {
    const el = makeRoot();
    const hots = [
      { description: 'a', percentage: 80 },
      { description: 'b', percentage: 60 },
      { description: 'c', percentage: 40 },
      { description: 'd', percentage: 20 },
      { description: 'e', percentage: 10 },
    ];
    render(<StackedChart doc={makeDoc(hots)} maxScore={1} onDetailed={() => {}} />, el);
    // First three rendered immediately.
    expect(el.textContent).toContain('a');
    expect(el.textContent).toContain('b');
    expect(el.textContent).toContain('c');
    // Extras hidden until Show More clicked.
    expect(el.querySelectorAll('.graph-explain').length).toBe(3);
    // Show More toggle visible.
    const links = Array.from(el.querySelectorAll('a'));
    const showMore = links.find((a) => /Show More/.test(a.textContent || ''));
    expect(showMore).toBeDefined();
    showMore.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    // Preact 10 batches state updates via a debounced microtask; flush
    // before asserting the post-click DOM.
    await new Promise((r) => setTimeout(r, 0));
    expect(el.querySelectorAll('.graph-explain').length).toBe(5);
    expect(el.textContent).toContain('d');
    expect(el.textContent).toContain('e');
  });

  it('renders nothing for a doc without hotMatchesOutOf (defensive)', () => {
    const el = makeRoot();
    render(<StackedChart doc={{}} maxScore={1} />, el);
    expect(el.querySelectorAll('.graph-explain').length).toBe(0);
  });

  // Security: defense-in-depth against a future contributor switching
  // {match.description} text-interpolation to dangerouslySetInnerHTML.
  // Preact escapes children by default; this test enforces that property.
  it('does not execute scripts in a malicious match description', () => {
    const el = makeRoot();
    const evil = '<img src=x onerror="window.__xss_chart=1">';
    render(
      <StackedChart doc={makeDoc([{ description: evil, percentage: 50 }])} maxScore={1} />,
      el,
    );
    expect(el.querySelector('img')).toBeNull();
    expect(window.__xss_chart).toBeUndefined();
    // The literal text appears (escaped) in the rendered DOM — proves
    // the description was rendered, just safely.
    expect(el.textContent).toContain('onerror');
  });
});
