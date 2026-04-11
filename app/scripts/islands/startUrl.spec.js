// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, unmount } from './startUrl.jsx';
import { makeRoot } from '../test-helpers/factories.js';

// Preact batches state updates and defers useEffect to a microtask. Two
// flushes cover both: one for the effect queue, one for any follow-up
// state update the effect itself scheduled (e.g. the defaults-seeding
// effect calls rerender()).
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

// jsdom has no window.ace, so the ES/OS tabs fall back to the textarea
// renderer (matches the fallback path in startUrl.jsx). The data-role
// attributes are shared between the Ace and textarea paths, so these
// specs exercise the same locators browser code sees.

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
      solr: { startUrl: 'http://user-chose:8983/solr/x/select?q=foo', searchArgsStr: '', fieldSpecStr: '' },
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
});
