// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, unmount } from '@app/islands/startUrl.jsx';
import { makeRoot } from '@test/factories.js';

// Preact batches state updates and defers useEffect to a microtask. Two
// flushes cover both: one for the effect queue, one for any follow-up
// state update the effect itself scheduled (e.g. the defaults-seeding
// effect calls rerender()).
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

// Under jsdom, `CM6_AVAILABLE` is false, so every tab uses a textarea for search args
// (same `data-role` as the CodeMirror container in real browsers).

function makeSettings(overrides = {}) {
  return {
    whichEngine: 'solr',
    solr: { startUrl: '', searchArgsStr: '', fieldSpecStr: '' },
    es: {
      startUrl: '',
      searchArgsStr: '',
      fieldSpecStr: '',
      headerType: 'Custom',
      customHeaders: '',
    },
    os: {
      startUrl: '',
      searchArgsStr: '',
      fieldSpecStr: '',
      headerType: 'None',
      customHeaders: '',
    },
    ...overrides,
  };
}

describe('startUrl island', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // Reset window.location.hash between tests. startUrl.jsx now writes
    // `#/<tab>_` via history.replaceState when a tab is clicked, and jsdom
    // shares one window across tests in the same file — without this
    // reset, a later test would pick up the hash written by an earlier
    // test and initialize its activeTab from the leaked state.
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  });

  it('seeds default start URLs on mount when unset', async () => {
    const el = makeRoot();
    const settings = makeSettings();
    mount(el, { settings }, { onSearch: () => {} });
    await flush();
    // Default URLs are seeded on first mount.
    expect(settings.solr.startUrl).toContain('quepid-solr.dev.o19s.com');
    expect(settings.es.startUrl).toContain('quepid-elasticsearch.dev.o19s.com');
    expect(settings.os.startUrl).toContain('quepid-opensearch.dev.o19s.com');
  });

  it('does not overwrite an existing startUrl on mount', async () => {
    const el = makeRoot();
    const settings = makeSettings({
      solr: {
        startUrl: 'http://user-chose:8983/solr/x/select?q=foo',
        searchArgsStr: '',
        fieldSpecStr: '',
      },
    });
    mount(el, { settings }, { onSearch: () => {} });
    await flush();
    expect(settings.solr.startUrl).toBe('http://user-chose:8983/solr/x/select?q=foo');
  });

  it('defaults the active tab to solr when whichEngine is solr', () => {
    const el = makeRoot();
    mount(el, { settings: makeSettings() }, { onSearch: () => {} });
    const solrPane = el.querySelector('#solr_');
    expect(solrPane.className).toContain('active');
    expect(el.querySelector('#es_').className).not.toContain('active');
    expect(el.querySelector('#os_').className).not.toContain('active');
  });

  it('defaults the active tab to es when whichEngine is es', () => {
    const el = makeRoot();
    mount(el, { settings: makeSettings({ whichEngine: 'es' }) }, { onSearch: () => {} });
    expect(el.querySelector('#es_').className).toContain('active');
    expect(el.querySelector('#solr_').className).not.toContain('active');
  });

  it('switching tabs via the nav updates the active pane', async () => {
    const el = makeRoot();
    mount(el, { settings: makeSettings() }, { onSearch: () => {} });
    await flush();
    const esTab = el.querySelector('[data-role="tab-es"]');
    esTab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await flush();
    expect(el.querySelector('#es_').className).toContain('active');
    expect(el.querySelector('#solr_').className).not.toContain('active');
  });

  it('writes #/<tab>_ to window.location.hash when a tab is clicked (parity with 2024 Angular build)', async () => {
    // Regression guard for the bookmarkable-tab-state parity fix.
    // Matches the exact hash shape the 2024 splainer.io emits — the
    // audit's es-custom-headers-panel scenario asserts on this.
    const el = makeRoot();
    mount(el, { settings: makeSettings() }, { onSearch: () => {} });
    await flush();
    expect(window.location.hash).toBe('');
    el.querySelector('[data-role="tab-es"]').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    await flush();
    expect(window.location.hash).toBe('#/es_');
    el.querySelector('[data-role="tab-os"]').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    await flush();
    expect(window.location.hash).toBe('#/os_');
  });

  it('initializes the active tab from #/<tab>_ in the URL on mount', async () => {
    // Reverse direction of the test above: a user navigating to a
    // bookmarked URL with #/es_ should land on the ES tab regardless
    // of what whichEngine says in settings.
    window.history.replaceState(null, '', '#/os_');
    const el = makeRoot();
    // whichEngine is 'solr', but the hash wins.
    mount(el, { settings: makeSettings() }, { onSearch: () => {} });
    await flush();
    expect(el.querySelector('#os_').className).toContain('active');
    expect(el.querySelector('#solr_').className).not.toContain('active');
    expect(el.querySelector('#es_').className).not.toContain('active');
  });

  it('typing in the Solr URL input mutates settings.solr.startUrl', () => {
    const el = makeRoot();
    const settings = makeSettings();
    mount(el, { settings }, { onSearch: () => {} });
    const input = el.querySelector('[data-role="solr-start-url"]');
    input.value = 'http://example:8983/solr/t/select?q=x';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(settings.solr.startUrl).toBe('http://example:8983/solr/t/select?q=x');
  });

  it('clicking Splain This! on the Solr tab fires onSearch("solr")', () => {
    const el = makeRoot();
    const onSearch = vi.fn();
    mount(el, { settings: makeSettings() }, { onSearch });
    const btn = el.querySelector('[data-role="solr-submit"]');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch.mock.calls[0][0]).toBe('solr');
  });

  it('Enter-key form submission fires onSearch(activeTab) with preventDefault', async () => {
    // Without handleFormSubmit, pressing Enter in a URL input would reload
    // the page. We dispatch a raw 'submit' event on the form (jsdom's
    // equivalent of the browser's implicit submit on Enter-in-input) and
    // verify (a) preventDefault was called (dispatchEvent returns false)
    // and (b) onSearch was invoked with the active tab.
    const el = makeRoot();
    const onSearch = vi.fn();
    mount(el, { settings: makeSettings({ whichEngine: 'es' }) }, { onSearch });
    await flush();
    const form = el.querySelector('form');
    const evt = new Event('submit', { bubbles: true, cancelable: true });
    const notCancelled = form.dispatchEvent(evt);
    expect(notCancelled).toBe(false); // onSubmit called preventDefault
    expect(onSearch).toHaveBeenCalledWith('es');
  });

  it('clicking Splain This! on the ES tab fires onSearch("es")', () => {
    const el = makeRoot();
    const onSearch = vi.fn();
    mount(el, { settings: makeSettings({ whichEngine: 'es' }) }, { onSearch });
    const btn = el.querySelector('[data-role="es-submit"]');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onSearch).toHaveBeenCalledWith('es');
  });

  it('Indent JSON pretty-prints settings.es.searchArgsStr', () => {
    const el = makeRoot();
    const settings = makeSettings({
      whichEngine: 'es',
      es: {
        startUrl: '',
        searchArgsStr: '{"query":{"match":{"title":"foo"}}}',
        fieldSpecStr: '',
        headerType: 'Custom',
        customHeaders: '',
      },
    });
    mount(el, { settings }, { onSearch: () => {} });
    const indent = el.querySelector('[data-role="es-indent-json"]');
    indent.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    // Pretty-printed output contains newlines and indentation.
    expect(settings.es.searchArgsStr).toContain('\n');
    expect(settings.es.searchArgsStr).toContain('  "query"');
  });

  it('Indent JSON is a no-op on malformed JSON (swallows the throw)', () => {
    const el = makeRoot();
    const settings = makeSettings({
      whichEngine: 'es',
      es: {
        startUrl: '',
        searchArgsStr: 'not json',
        fieldSpecStr: '',
        headerType: 'Custom',
        customHeaders: '',
      },
    });
    mount(el, { settings }, { onSearch: () => {} });
    const indent = el.querySelector('[data-role="es-indent-json"]');
    expect(() => {
      indent.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }).not.toThrow();
    expect(settings.es.searchArgsStr).toBe('not json');
  });

  it('unmount tears down the rendered DOM', () => {
    const el = makeRoot();
    mount(el, { settings: makeSettings() }, { onSearch: () => {} });
    expect(el.querySelector('[data-role="solr-submit"]')).not.toBeNull();
    unmount(el);
    expect(el.querySelector('[data-role="solr-submit"]')).toBeNull();
  });

  describe('nav tab active class', () => {
    // Existing tests verify the *pane* class (#solr_, #es_, #os_) reflects
    // activeTab, but not the nav *li* — which is where Bootstrap's tab
    // highlight lives. Pins `class={activeTab === t.key ? 'active' : ''}`
    // on the <li> wrapping each <a data-role="tab-*">.

    function navLi(el, key) {
      return el.querySelector(`[data-role="tab-${key}"]`).closest('li');
    }

    it('marks only the matching nav <li> active for each whichEngine', () => {
      for (const engine of ['solr', 'es', 'os']) {
        const el = makeRoot();
        mount(el, { settings: makeSettings({ whichEngine: engine }) }, { onSearch: () => {} });
        expect(navLi(el, engine).className).toBe('active');
        ['solr', 'es', 'os']
          .filter((k) => k !== engine)
          .forEach((k) => expect(navLi(el, k).className).toBe(''));
        document.body.innerHTML = '';
      }
    });

    it('clicking a nav anchor updates which <li> has the active class', async () => {
      const el = makeRoot();
      mount(el, { settings: makeSettings() }, { onSearch: () => {} });
      await flush();
      expect(navLi(el, 'solr').className).toBe('active');
      el.querySelector('[data-role="tab-os"]').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
      await flush();
      expect(navLi(el, 'solr').className).toBe('');
      expect(navLi(el, 'es').className).toBe('');
      expect(navLi(el, 'os').className).toBe('active');
    });
  });

  describe('empty / missing searchArgsStr', () => {
    // Pins `value={value || ''}` in TextareaArgsFallback. Without this test
    // the `|| ''` fallback is unreachable (every existing test passes a
    // string) and mutation to "" survives.

    it('renders an empty textarea when searchArgsStr is undefined', () => {
      const el = makeRoot();
      const settings = makeSettings({
        whichEngine: 'es',
        es: {
          startUrl: '',
          // undefined, not ''
          searchArgsStr: undefined,
          fieldSpecStr: '',
          headerType: 'Custom',
          customHeaders: '',
        },
      });
      expect(() => {
        mount(el, { settings }, { onSearch: () => {} });
      }).not.toThrow();
      const textarea = el.querySelector('[data-role="es-search-args-editor"]');
      // The `|| ''` fallback yields the empty string — no "undefined"
      // leaks to the DOM and jsdom reports value === ''.
      expect(textarea.value).toBe('');
    });
  });

  describe('search args and Advanced Settings per engine', () => {
    // Solr: plain search-args editor only (legacy parity — no custom headers UI).
    // ES/OS: Advanced Settings button, headers island, JSON args editor, Indent JSON.

    it('Solr pane has search-args editor only (no Advanced Settings / headers)', () => {
      const el = makeRoot();
      mount(el, { settings: makeSettings() }, { onSearch: () => {} });
      const solrPane = el.querySelector('#solr_');
      expect(solrPane.querySelector('[data-role="solr-search-args-editor"]')).not.toBeNull();
      expect(solrPane.querySelector('[data-role="solr-advanced-toggle"]')).toBeNull();
      expect(solrPane.querySelector('[data-role="solr-indent-json"]')).toBeNull();
    });

    it('renders full Advanced block inside the es pane', () => {
      const el = makeRoot();
      mount(el, { settings: makeSettings({ whichEngine: 'es' }) }, { onSearch: () => {} });
      const esPane = el.querySelector('#es_');
      expect(esPane.querySelector('[data-role="es-advanced-toggle"]')).not.toBeNull();
    });

    it('renders full Advanced block inside the os pane', () => {
      const el = makeRoot();
      mount(el, { settings: makeSettings({ whichEngine: 'os' }) }, { onSearch: () => {} });
      const osPane = el.querySelector('#os_');
      expect(osPane.querySelector('[data-role="os-advanced-toggle"]')).not.toBeNull();
    });
  });
});
