// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { mount, unmount } from '@app/islands/settings.jsx';
import { makeRoot } from '@test/factories.js';

// Search args: CodeMirror in real browsers for every engine; textarea under jsdom. Custom headers: Elasticsearch/OpenSearch only.

// Preact flushes hook state updates on a microtask, so any test that
// asserts on DOM produced by a state change (toggle click → conditional
// render) must wait for the next microtask first.
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function defaultSettings() {
  return {
    whichEngine: 'solr',
    solr: {
      searchUrl: 'http://localhost:8983/solr/c/select',
      fieldSpecStr: 'id title',
      searchArgsStr: 'q=*:*',
    },
    es: {
      searchUrl: 'http://localhost:9200/idx/_search',
      fieldSpecStr: 'title',
      searchArgsStr: '{"query":{"match_all":{}}}',
      headerType: 'Custom',
      customHeaders: '{"X-Foo":"bar"}',
    },
    os: {
      searchUrl: 'http://localhost:9201/idx/_search',
      fieldSpecStr: 'title',
      searchArgsStr: '{}',
      headerType: 'None',
      customHeaders: '',
    },
  };
}

describe('settings island', () => {
  it('renders the Solr URL/fields/args fields by default', () => {
    const el = makeRoot();
    mount(el, { settings: defaultSettings(), currSearch: null }, () => {});
    expect(el.querySelector('[data-role="search-url"]').value).toBe(
      'http://localhost:8983/solr/c/select',
    );
    expect(el.querySelector('[data-role="field-spec"]').value).toBe('id title');
    expect(el.querySelector('[data-role="search-args-editor"]').value).toBe('q=*:*');
  });

  it('hides Custom Headers section for solr, shows it for es/os', async () => {
    const el = makeRoot();
    const settings = defaultSettings();
    mount(el, { settings, currSearch: null }, () => {});
    // Engine selector is collapsed by default — open it to switch.
    el.querySelector('.dev-header').click();
    await flush();
    const esRadio = Array.from(el.querySelectorAll('input[type="radio"]')).find(
      (r) => r.value === 'es',
    );
    esRadio.click();
    await flush();
    // Now expand the Custom Headers section (last collapsible header).
    const headers = Array.from(el.querySelectorAll('.dev-header')).find(
      (h) => h.textContent.trim().indexOf('Custom Headers') === 0,
    );
    expect(headers).toBeTruthy();
    headers.click();
    await flush();
    expect(el.querySelector('[data-role="custom-headers-section"]')).not.toBeNull();
  });

  it("switching engines preserves each engine's unsaved tweaks (round-trip)", async () => {
    const el = makeRoot();
    const settings = defaultSettings();
    mount(el, { settings, currSearch: null }, () => {});

    // Type a unique value in the Solr URL field.
    const solrInput = el.querySelector('[data-role="search-url"]');
    solrInput.value = 'http://localhost:8983/solr/UNIQUE_SOLR/select';
    solrInput.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();

    // Switch to ES.
    el.querySelector('.dev-header').click(); // open engine selector
    await flush();
    const esRadio = Array.from(el.querySelectorAll('input[type="radio"]')).find(
      (r) => r.value === 'es',
    );
    esRadio.click();
    await flush();

    // ES URL is now visible — type a unique ES value.
    const esInput = el.querySelector('[data-role="search-url"]');
    expect(esInput.value).toBe('http://localhost:9200/idx/_search');
    esInput.value = 'http://localhost:9200/UNIQUE_ES/_search';
    esInput.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();

    // Switch back to Solr — the original solr tweak must still be there.
    const solrRadio = Array.from(el.querySelectorAll('input[type="radio"]')).find(
      (r) => r.value === 'solr',
    );
    solrRadio.click();
    await flush();
    const solrInputAgain = el.querySelector('[data-role="search-url"]');
    expect(solrInputAgain.value).toBe('http://localhost:8983/solr/UNIQUE_SOLR/select');

    // And settings.es.searchUrl was mutated in place too.
    expect(settings.es.searchUrl).toBe('http://localhost:9200/UNIQUE_ES/_search');
    expect(settings.solr.searchUrl).toBe('http://localhost:8983/solr/UNIQUE_SOLR/select');
  });

  it('round-trip also preserves os unsaved tweaks across engine switches', async () => {
    // OS has different defaults ('None' vs es's 'Custom') — needs its own test.
    const el = makeRoot();
    const settings = defaultSettings();
    mount(el, { settings, currSearch: null }, () => {});

    // Switch to OS.
    el.querySelector('.dev-header').click();
    await flush();
    const osRadio = Array.from(el.querySelectorAll('input[type="radio"]')).find(
      (r) => r.value === 'os',
    );
    osRadio.click();
    await flush();

    // Type a unique OS URL.
    const osInput = el.querySelector('[data-role="search-url"]');
    expect(osInput.value).toBe('http://localhost:9201/idx/_search');
    osInput.value = 'http://localhost:9201/UNIQUE_OS/_search';
    osInput.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();

    // Switch to ES and back to OS — the OS tweak must survive.
    const esRadio = Array.from(el.querySelectorAll('input[type="radio"]')).find(
      (r) => r.value === 'es',
    );
    esRadio.click();
    await flush();
    const osRadioAgain = Array.from(el.querySelectorAll('input[type="radio"]')).find(
      (r) => r.value === 'os',
    );
    osRadioAgain.click();
    await flush();

    expect(el.querySelector('[data-role="search-url"]').value).toBe(
      'http://localhost:9201/UNIQUE_OS/_search',
    );
    expect(settings.os.searchUrl).toBe('http://localhost:9201/UNIQUE_OS/_search');
  });

  it('submit dispatches onPublish with engine=os when os is selected', async () => {
    const el = makeRoot();
    const settings = defaultSettings();
    const onPublish = vi.fn();
    mount(el, { settings, currSearch: null }, onPublish);

    el.querySelector('.dev-header').click();
    await flush();
    const osRadio = Array.from(el.querySelectorAll('input[type="radio"]')).find(
      (r) => r.value === 'os',
    );
    osRadio.click();
    await flush();

    el.querySelector('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    expect(onPublish).toHaveBeenCalled();
    const lastCall = onPublish.mock.calls[onPublish.mock.calls.length - 1];
    expect(lastCall[0]).toBe('os');
    // Value-based assertion rather than identity (`toBe(settings.os)`) so a
    // future refactor that hands a defensive copy to onPublish doesn't flip
    // this test from a behavior check into a regression blocker. The shim
    // only reads searchUrl/fieldSpecStr/searchArgsStr/customHeaders off the
    // working settings, which is what we care about preserving.
    expect(lastCall[1].searchUrl).toBe(settings.os.searchUrl);
    expect(lastCall[1].fieldSpecStr).toBe(settings.os.fieldSpecStr);
    expect(lastCall[1].searchArgsStr).toBe(settings.os.searchArgsStr);
  });

  it('submit calls onPublish with (whichEngine, workingSettings)', () => {
    const el = makeRoot();
    const settings = defaultSettings();
    const onPublish = vi.fn();
    mount(el, { settings, currSearch: null }, onPublish);

    el.querySelector('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onPublish.mock.calls[0][0]).toBe('solr');
    expect(onPublish.mock.calls[0][1]).toBe(settings.solr);
  });

  it('Indent JSON pretty-prints es searchArgsStr; not present for solr', async () => {
    const el = makeRoot();
    const settings = defaultSettings();
    settings.es.searchArgsStr = '{"query":{"match_all":{}}}';
    mount(el, { settings, currSearch: null }, () => {});

    // Solr first: no Indent JSON control.
    expect(el.querySelector('[data-role="indent-json"]')).toBeNull();

    // Switch to ES.
    el.querySelector('.dev-header').click();
    await flush();
    const esRadio = Array.from(el.querySelectorAll('input[type="radio"]')).find(
      (r) => r.value === 'es',
    );
    esRadio.click();
    await flush();

    const indent = el.querySelector('[data-role="indent-json"]');
    expect(indent).not.toBeNull();
    indent.click();
    await flush();

    // searchArgsStr is now indented.
    expect(settings.es.searchArgsStr).toBe('{\n  "query": {\n    "match_all": {}\n  }\n}');
  });

  it('Indent JSON pretty-prints os searchArgsStr too', async () => {
    // The autoIndent handler at settings.jsx is gated on `engine === 'es' ||
    // engine === 'os'`. ES is covered above; this case symmetrically locks
    // the OS branch so a future tweak to the gate (e.g. switch on engine)
    // can't silently drop OS support.
    const el = makeRoot();
    const settings = defaultSettings();
    settings.os.searchArgsStr = '{"query":{"match_all":{}}}';
    mount(el, { settings, currSearch: null }, () => {});

    el.querySelector('.dev-header').click();
    await flush();
    const osRadio = Array.from(el.querySelectorAll('input[type="radio"]')).find(
      (r) => r.value === 'os',
    );
    osRadio.click();
    await flush();

    const indent = el.querySelector('[data-role="indent-json"]');
    expect(indent).not.toBeNull();
    indent.click();
    await flush();

    expect(settings.os.searchArgsStr).toBe('{\n  "query": {\n    "match_all": {}\n  }\n}');
  });

  it('field-spec input is hidden when currSearch.searcher.isTemplateCall() is true', () => {
    const el = makeRoot();
    const currSearch = { searcher: { isTemplateCall: () => true } };
    mount(el, { settings: defaultSettings(), currSearch }, () => {});
    expect(el.querySelector('[data-role="field-spec"]')).toBeNull();
    // The substitute "use _source" message is rendered.
    expect(el.textContent).toContain('_source');
  });

  it('Custom Headers child renders only for es/os, never for solr', () => {
    const el = makeRoot();
    mount(el, { settings: defaultSettings(), currSearch: null }, () => {});
    // No Custom Headers header at all under solr.
    const headerLabels = Array.from(el.querySelectorAll('.dev-header')).map((h) =>
      h.textContent.trim(),
    );
    expect(headerLabels.some((t) => t.indexOf('Custom Headers') === 0)).toBe(false);
  });

  it('re-syncs workingWhichEngine when settings.whichEngine changes externally', async () => {
    // Regression: workingWhichEngine must follow external mutations to
    // settings.whichEngine (e.g. StartUrl's Splain This! flipping to ES).
    const el = makeRoot();
    const settings = defaultSettings(); // whichEngine: 'solr'
    mount(el, { settings, currSearch: null }, () => {});

    // Initially solr — the search-url field reflects the solr URL.
    expect(el.querySelector('[data-role="search-url"]').value).toBe(
      'http://localhost:8983/solr/c/select',
    );

    // External code mutates whichEngine; re-mount simulates renderAll().
    settings.whichEngine = 'es';
    mount(el, { settings, currSearch: null }, () => {});
    await flush();

    // The search-url field now reflects the es URL — the island synced.
    expect(el.querySelector('[data-role="search-url"]').value).toBe(
      'http://localhost:9200/idx/_search',
    );
  });

  it('unmount tears down the rendered DOM', () => {
    const el = makeRoot();
    mount(el, { settings: defaultSettings(), currSearch: null }, () => {});
    expect(el.querySelector('form')).not.toBeNull();
    unmount(el);
    expect(el.querySelector('form')).toBeNull();
  });

  describe('engine radio checked state', () => {
    // The existing round-trip tests click radios and observe side effects
    // on other form fields; they don't verify that the `checked` attribute
    // itself tracks workingWhichEngine. Pins the
    // `checked={workingWhichEngine === '<x>'}` contract on all three radios.

    async function openEngineSectionAndGetRadios(whichEngine) {
      const el = makeRoot();
      const settings = defaultSettings();
      settings.whichEngine = whichEngine;
      mount(el, { settings, currSearch: null }, () => {});
      // First dev-header is the Search Engine selector (collapsed by default).
      el.querySelector('.dev-header').click();
      await flush();
      const radios = {};
      Array.from(el.querySelectorAll('input[type="radio"]')).forEach((r) => {
        radios[r.value] = r;
      });
      return radios;
    }

    it('marks only the solr radio checked when whichEngine is solr', async () => {
      const r = await openEngineSectionAndGetRadios('solr');
      expect(r.solr.checked).toBe(true);
      expect(r.es.checked).toBe(false);
      expect(r.os.checked).toBe(false);
    });

    it('marks only the es radio checked when whichEngine is es', async () => {
      const r = await openEngineSectionAndGetRadios('es');
      expect(r.solr.checked).toBe(false);
      expect(r.es.checked).toBe(true);
      expect(r.os.checked).toBe(false);
    });

    it('marks only the os radio checked when whichEngine is os', async () => {
      const r = await openEngineSectionAndGetRadios('os');
      expect(r.solr.checked).toBe(false);
      expect(r.es.checked).toBe(false);
      expect(r.os.checked).toBe(true);
    });

    it('clicking a different radio flips the checked state', async () => {
      const el = makeRoot();
      mount(el, { settings: defaultSettings(), currSearch: null }, () => {});
      el.querySelector('.dev-header').click();
      await flush();
      const radios = () => {
        const out = {};
        Array.from(el.querySelectorAll('input[type="radio"]')).forEach((r) => {
          out[r.value] = r;
        });
        return out;
      };
      expect(radios().solr.checked).toBe(true);
      radios().es.click();
      await flush();
      expect(radios().solr.checked).toBe(false);
      expect(radios().es.checked).toBe(true);
    });
  });
});
