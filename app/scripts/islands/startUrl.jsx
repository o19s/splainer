/**
 * startUrl island — landing form (NO_SEARCH state) with three tabs
 * (Solr / Elasticsearch / OpenSearch). Each tab has a start URL input and a
 * "Splain This!" button.
 *
 * Solr tab: editor for `settings.solr.searchArgsStr` only (Solr query parameters —
 * not the start URL line). Uses plain CodeMirror in real browsers and a textarea
 * under jsdom. No custom headers block (legacy parity with Angular).
 *
 * Elasticsearch / OpenSearch tabs: "Advanced Settings" reveals custom headers,
 * then a JSON-highlighted editor for `searchArgsStr`, then an "Indent JSON" button.
 *
 * Props:
 *   - settings:  the {whichEngine, solr, es, os} object (mutated in place)
 *   - onSearch:  (engine: 'solr' | 'es' | 'os') => void
 */
import { render } from 'preact';
import { useState } from 'preact/hooks';

import { CustomHeaders } from './customHeaders.jsx';
import { formatJson } from './formatJson.js';
import { searchArgsAriaLabel } from './searchArgsAriaLabel.js';
import { useCodeMirror } from './useCodeMirror.js';

// Stryker disable all: jsdom path; e2e covers real browser.
const CM6_AVAILABLE =
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  !/jsdom/i.test(navigator.userAgent || '');
// Stryker restore all

// Default start URLs when empty (idempotent).
const DEFAULT_URLS = {
  solr: 'http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=*:*',
  es: 'http://quepid-elasticsearch.dev.o19s.com:9206/tmdb/_search',
  os: 'https://reader:reader@quepid-opensearch.dev.o19s.com:9000/tmdb/_search',
};

const TAB_HASH_RE = /^#\/(solr|es|os)_$/;

function parseTabHash() {
  if (typeof window === 'undefined') return null;
  const m = TAB_HASH_RE.exec(window.location.hash || '');
  return m ? m[1] : null;
}

function writeTabHash(tab) {
  if (typeof window === 'undefined') return;
  // replaceState rather than assigning to location.hash: the latter
  // creates a history entry per tab click, so the back button would
  // have to step through every tab the user touched before leaving
  // the page. replaceState keeps the URL updated without the bloat.
  window.history.replaceState(null, '', `#/${tab}_`);
}

function CodeMirrorArgsEditor({ value, onChange, engine }) {
  const language = engine === 'solr' ? 'plain' : 'json';
  const containerRef = useCodeMirror(value, onChange, {
    useWrapMode: false,
    tabSize: 2,
    language,
    ariaLabel: searchArgsAriaLabel(engine),
  });
  return (
    <div
      ref={containerRef}
      data-role={`${engine}-search-args-editor`}
      style={{ height: '300px', marginTop: '20px' }}
    />
  );
}

 
function TextareaArgsFallback({ value, onChange, engine }) {
  return (
    <textarea
      data-role={`${engine}-search-args-editor`}
      class="form-control"
      rows={10}
      style={{ marginTop: '20px' }}
      value={value || ''}
      aria-label={searchArgsAriaLabel(engine)}
      onInput={(e) => onChange(e.target.value)}
    />
  );
}

 
function SolrSearchArgsOnly({ settings, onRerender }) {
  const ws = settings.solr;
  return CM6_AVAILABLE ? (
    <CodeMirrorArgsEditor
      value={ws.searchArgsStr}
      onChange={(v) => {
        ws.searchArgsStr = v;
        onRerender();
      }}
      engine="solr"
    />
  ) : (
    <TextareaArgsFallback
      value={ws.searchArgsStr}
      onChange={(v) => {
        ws.searchArgsStr = v;
        onRerender();
      }}
      engine="solr"
    />
  );
}

function EngineAdvancedEsOs({ engine, settings, onRerender }) {
  const ws = settings[engine];
  const [headersOpen, setHeadersOpen] = useState(false);
  return (
    <>
      <p>
        <button
          type="button"
          class="btn btn-sm btn-default"
          data-role={`${engine}-advanced-toggle`}
          onClick={() => setHeadersOpen((v) => !v)}
        >
          Advanced Settings
        </button>
      </p>
      {headersOpen && (
        <div>
          <CustomHeaders
            settings={ws}
            onChange={(next) => {
              ws.headerType = next.headerType;
              ws.customHeaders = next.customHeaders;
              onRerender();
            }}
          />
        </div>
      )}
      {CM6_AVAILABLE ? (
        <CodeMirrorArgsEditor
          value={ws.searchArgsStr}
          onChange={(v) => {
            ws.searchArgsStr = v;
            onRerender();
          }}
          engine={engine}
        />
      ) : (
        <TextareaArgsFallback
          value={ws.searchArgsStr}
          onChange={(v) => {
            ws.searchArgsStr = v;
            onRerender();
          }}
          engine={engine}
        />
      )}
      <button
        type="button"
        class="btn btn-default btn-xs pull-right"
        data-role={`${engine}-indent-json`}
        onClick={() => {
          ws.searchArgsStr = formatJson(ws.searchArgsStr);
          onRerender();
        }}
      >
        Indent JSON
      </button>
    </>
  );
}

export function StartUrl({ settings, onSearch }) {
  // Sync default URLs before paint (not useEffect) so first paint and tests see values.
  if (!settings.solr.startUrl) settings.solr.startUrl = DEFAULT_URLS.solr;
  if (!settings.es.startUrl) settings.es.startUrl = DEFAULT_URLS.es;
  if (!settings.os.startUrl) settings.os.startUrl = DEFAULT_URLS.os;

  // Active tab: URL hash overrides `settings.whichEngine`, else solr default.
  const hashTab = parseTabHash();
  const initialTab =
    hashTab ||
    (settings.whichEngine === 'es' ? 'es' : settings.whichEngine === 'os' ? 'os' : 'solr');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [, setTick] = useState(0); // bump after mutating settings in place
  const rerender = () => setTick((t) => t + 1);

  function updateStartUrl(engine, value) {
    settings[engine].startUrl = value;
    rerender();
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    onSearch(activeTab);
  }

  const tabs = [
    { key: 'solr', label: 'Solr' },
    { key: 'es', label: 'Elasticsearch' },
    { key: 'os', label: 'OpenSearch' },
  ];

  return (
    <form onSubmit={handleFormSubmit}>
      <fieldset>
        <label>Splainer is the Search Sandbox that helps you understand why!</label>
        <div>
          <div class="tabbable tabs-below">
            <ul class="nav nav-tabs">
              {tabs.map((t) => (
                <li key={t.key} class={activeTab === t.key ? 'active' : ''}>
                  <a
                    href={`#${t.key}_`}
                    data-role={`tab-${t.key}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab(t.key);
                      writeTabHash(t.key);
                    }}
                  >
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>

            <div class="tab-content">
              {tabs.map((t) => (
                <div
                  key={t.key}
                  class={`tab-pane ${activeTab === t.key ? 'active' : ''}`}
                  id={`${t.key}_`}
                >
                  <div class="input-group">
                    <input
                      type="text"
                      class="form-control"
                      data-role={`${t.key}-start-url`}
                      value={settings[t.key].startUrl || ''}
                      onInput={(e) => updateStartUrl(t.key, e.target.value)}
                    />
                    <span class="input-group-btn">
                      <button
                        class="btn btn-primary"
                        type="submit"
                        data-role={`${t.key}-submit`}
                      >
                        Splain This!
                      </button>
                    </span>
                  </div>
                  {t.key === 'solr' ? (
                    <SolrSearchArgsOnly settings={settings} onRerender={rerender} />
                  ) : (
                    <EngineAdvancedEsOs engine={t.key} settings={settings} onRerender={rerender} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <p class="pull-right text-muted">
          ... or take a <a href="help.html">tour</a>
        </p>
        <br />
        <br />
        <hr />
        <div class="row">
          <div class="col-md-4">
            <h4>Understand</h4>
            <p class="text-muted">
              Copy your Solr, Elasticsearch, or OpenSearch URL from your browser window and paste
              it here. We'll highlight the matches driving your results and explain to you "why"
              in human-understandable terms.
            </p>
          </div>
          <div class="col-md-4">
            <h4>Act</h4>
            <p class="text-muted">
              Once you know why search isn't meeting up to your expectations, Act! Use Splainer as
              a sandbox to begin tweaking query parameters to get your query to match up to
              expectations.
            </p>
          </div>
          <div class="col-md-4">
            <h4>Evolve</h4>
            <p class="text-muted">
              Now you're in the business of tuning{' '}
              <a href="http://www.opensourceconnections.com/blog/2014/06/10/what-is-search-relevancy">
                Search Relevancy
              </a>
              . Use <a href="http://quepid.com">Quepid</a> to upgrade your Splainer
              experience--tune multiple queries simultaneously, measure against user feedback, and
              track search tuning progress over time.
            </p>
          </div>
        </div>
      </fieldset>
    </form>
  );
}

export function mount(rootEl, props, callbacks) {
  if (!rootEl) throw new Error('startUrl island: rootEl is required');
  render(<StartUrl settings={props.settings} onSearch={callbacks.onSearch} />, rootEl);
}

export function unmount(rootEl) {
  render(null, rootEl);
}
