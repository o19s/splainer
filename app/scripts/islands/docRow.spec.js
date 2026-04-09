// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, unmount } from './docRow.jsx';

// Helpers ────────────────────────────────────────────────────────────────────
function makeRoot() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

// Minimal doc fake matching the splainer-search doc shape that
// app/views/docRow.html relies on. The island calls these methods at
// render time; the fake just returns whatever the test wants to display.
function makeDoc(overrides = {}) {
  return {
    score: () => 1.5,
    getHighlightedTitle: (open, close) => `${open}canned${close} title`,
    subSnippets: () => ({ body: 'matched <em>term</em>' }),
    hasThumb: () => false,
    hasImage: () => false,
    thumb: null,
    image: null,
    ...overrides,
  };
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
    mount(el, makeDoc(), {});
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
      {},
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
      {},
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
      {},
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
    mount(el, doc, { onShowDoc });
    const link = el.querySelector('a');
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onShowDoc).toHaveBeenCalledTimes(1);
    expect(onShowDoc).toHaveBeenCalledWith(doc);
  });

  it('reports the chart-host element to registerChartHost', () => {
    // The directive shim needs a stable reference to the chart slot so it
    // can $compile <stacked-chart> into it. registerChartHost is called
    // on every render with the live DOM node; the shim takes the most
    // recent one. This test asserts the wiring exists.
    const el = makeRoot();
    const registerChartHost = vi.fn();
    mount(el, makeDoc(), { registerChartHost });
    expect(registerChartHost).toHaveBeenCalled();
    const arg = registerChartHost.mock.calls[0][0];
    expect(arg).not.toBeNull();
    expect(arg.getAttribute('data-role')).toBe('chart-host');
  });

  it('preserves DOM children injected externally into the chart-host across re-renders', () => {
    // **The actual load-bearing test for the PR 9a chart-host pattern.**
    //
    // The directive shim $compile's <stacked-chart> into the chart-host
    // <div> via Angular, *outside* Preact's vtree. The pattern only
    // works if Preact's reconciler does not see — and therefore does
    // not remove — children that Preact didn't add itself. Preact
    // tracks its own children via vnode metadata, not by querying the
    // real DOM, so externally-injected children survive re-renders.
    //
    // The previous test (chart-host element identity) only proves the
    // host <div> is reused. This test directly verifies the property
    // the pattern depends on: inject a sentinel child, re-mount with
    // new props, assert the sentinel is still there.
    //
    // If a future Preact upgrade ever changes this behavior (gains
    // "remove unknown children" semantics), this test fires
    // immediately and points at the right area, instead of showing up
    // as "the chart vanishes after the first digest tick" in a
    // browser session.
    const el = makeRoot();
    const registerChartHost = vi.fn();
    mount(el, makeDoc(), { registerChartHost });
    const host = registerChartHost.mock.calls[0][0];

    // Simulate Angular's $compile injecting a child element.
    const sentinel = document.createElement('span');
    sentinel.setAttribute('data-sentinel', 'angular-injected');
    sentinel.textContent = 'I am injected by Angular';
    host.appendChild(sentinel);
    expect(host.contains(sentinel)).toBe(true);

    // Re-mount with new props, simulating the directive shim's $watch
    // firing rerender after a doc mutation.
    mount(el, makeDoc({ score: () => 99 }), { registerChartHost });

    // The sentinel must still be in place. If Preact wiped it, this
    // assertion fails and the chart-host pattern is broken.
    expect(host.contains(sentinel)).toBe(true);
    expect(host.querySelector('[data-sentinel="angular-injected"]')).not.toBeNull();
  });

  it('re-mounts cleanly after an unmount', () => {
    // ng-repeat with track by changes, modal close-and-reopen, and
    // similar Angular lifecycles can destroy then re-link the same
    // directive instance. The shim's $on('$destroy') unmounts the
    // island; the next link() call will mount() into the (now empty)
    // root again. Verify the second mount produces a fresh, valid
    // tree — not a stale-state ghost from the first mount.
    const el = makeRoot();
    mount(el, makeDoc(), {});
    expect(el.querySelector('[data-testid="doc-row"]')).not.toBeNull();
    unmount(el);
    expect(el.querySelector('[data-testid="doc-row"]')).toBeNull();
    mount(el, makeDoc({ score: () => 7 }), {});
    expect(el.querySelector('[data-testid="doc-row"]')).not.toBeNull();
    expect(el.textContent).toContain('7');
  });

  it('reports the SAME chart-host element across re-renders', () => {
    // Load-bearing property: Preact reuses the same DOM node for the
    // chart-host <div> across re-renders. The directive shim's
    // registerChartHost early-returns on identity equality and assumes
    // it never has to recompile <stacked-chart> after first mount. If
    // Preact ever swapped the underlying node, the shim's old chart
    // would dangle on a detached element and the new node would render
    // empty. This test locks the property in.
    //
    // Also a regression check for "Preact wipes Angular-injected
    // children on re-render" — if that happened, the chart would vanish
    // mid-session in production. Preact does NOT do that (it tracks its
    // own children via vnode metadata, not by querying real DOM), and
    // this test enforces the assumption from the only direction Vitest
    // can: by asserting the host element identity is stable.
    const el = makeRoot();
    const registerChartHost = vi.fn();
    const doc1 = makeDoc({ score: () => 1.5 });
    const doc2 = makeDoc({ score: () => 2.5 });
    mount(el, doc1, { registerChartHost });
    const firstHost = registerChartHost.mock.calls[0][0];
    // Re-mount with a different doc (simulating the directive shim's
    // $watch firing rerender after a doc mutation).
    mount(el, doc2, { registerChartHost });
    const lastHost = registerChartHost.mock.calls[registerChartHost.mock.calls.length - 1][0];
    expect(lastHost).toBe(firstHost);
    // And the host element must still be in the DOM — not detached.
    expect(el.contains(lastHost)).toBe(true);
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
      {},
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
      {},
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
      {},
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
    mount(el, makeDoc(), {});
    expect(el.querySelector('[data-testid="doc-row"]')).not.toBeNull();
    unmount(el);
    expect(el.querySelector('[data-testid="doc-row"]')).toBeNull();
  });
});
