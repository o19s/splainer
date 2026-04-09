/**
 * startUrl island — Preact replacement for
 * app/scripts/controllers/startUrl.js + app/views/startUrl.html (PR 8).
 *
 * This is the landing form shown in the NO_SEARCH state: three tabs
 * (Solr / Elasticsearch / OpenSearch), each with a start URL input, a
 * "Splain This!" button, and — for ES/OS — advanced settings (custom
 * headers + an Ace JSON search-args editor).
 *
 * Integration surface (props from the directive shim):
 *   - settings:  settingsStoreSvc.settings (the full {whichEngine, solr, es, os} object).
 *                Mutated in place, like settings.jsx, so the deep $watch in the
 *                shim sees changes without breaking prop identity.
 *   - onSearch:  (engine: 'solr' | 'es' | 'os') => void
 *                The shim calls the matching {solr,es,os}SettingsSvc.fromStartUrl
 *                with the current settings and kicks the parent's search().
 *
 * The $location.search() hash-URL handling (`?solr=...` / `?esUrl=...` /
 * `?osUrl=...` for shared-link bookmarks) stays in the directive shim — it
 * depends on Angular's $location and must run before the first mount so the
 * parent's ng-show="NO_SEARCH" gate can swallow this entire island on a
 * bookmarked-URL load.
 *
 * Tabs: the original template used Bootstrap jQuery tabs via
 * data-toggle="tab". Preact reconciliation would fight Bootstrap's in-place
 * class mutations, so the island owns tab state in Preact and skips
 * data-toggle. Markup classes (nav-tabs, tab-pane, active) are preserved
 * so the existing CSS still applies.
 */
import { render } from 'preact';
import { useState } from 'preact/hooks';
// eslint-disable-next-line no-unused-vars -- JSX usage
import { CustomHeaders } from './customHeaders.jsx';
import { useAceEditor } from './useAceEditor.js';

// Default start URLs — match the original ng-init values in startUrl.html.
// These are written into the settings object on first mount only when the
// corresponding startUrl is empty.
//
// INTENTIONAL DIVERGENCE from legacy behavior: the original `ng-init` on the
// <input> elements unconditionally overwrote startUrl on every link, which
// in practice meant every page load wiped any URL that settingsStoreSvc
// had rehydrated from localStorage — returning users always saw the demo
// URL, never the one they last used. That is a latent UX bug, not a load-
// bearing contract, and this island preserves user state instead. If any
// downstream behavior turns out to rely on the reset, switch the guards
// below to unconditional assignments and revisit.
const DEFAULT_URLS = {
  solr: 'http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=*:*',
  es: 'http://quepid-elasticsearch.dev.o19s.com:9206/tmdb/_search',
  os: 'https://reader:reader@quepid-opensearch.dev.o19s.com:9000/tmdb/_search',
};

// eslint-disable-next-line no-unused-vars -- JSX usage
function AceArgsEditor({ value, onChange, engine }) {
  const containerRef = useAceEditor(value, onChange, {
    mode: 'ace/mode/json',
    useWrapMode: false,
    tabSize: 2,
  });
  return (
    <div
      ref={containerRef}
      data-role={`${engine}-search-args-editor`}
      style={{ height: '300px', marginTop: '20px' }}
    />
  );
}

// eslint-disable-next-line no-unused-vars -- JSX usage
function TextareaArgsFallback({ value, onChange, engine }) {
  return (
    <textarea
      data-role={`${engine}-search-args-editor`}
      class="form-control"
      rows={10}
      style={{ marginTop: '20px' }}
      value={value || ''}
      onInput={(e) => onChange(e.target.value)}
    />
  );
}

// eslint-disable-next-line no-unused-vars -- JSX usage
function EngineAdvanced({ engine, settings, onRerender }) {
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
      {typeof window !== 'undefined' && window.ace ? (
        <AceArgsEditor
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
      <a
        href=""
        class="label label-default"
        data-role={`${engine}-indent-json`}
        onClick={(e) => {
          e.preventDefault();
          try {
            ws.searchArgsStr = JSON.stringify(JSON.parse(ws.searchArgsStr), null, 2);
            onRerender();
          } catch (_err) {
            // Swallow malformed JSON like the original Angular controller:
            // the user clicked "Indent JSON" on unparseable input, a thrown
            // exception would be worse UX than a no-op.
          }
        }}
      >
        Indent JSON
      </a>
    </>
  );
}

export function StartUrl({ settings, onSearch }) {
  // Seed default URLs synchronously before first render when unset. Done
  // here (not in useEffect) so the first paint already shows the defaults
  // — no flash of empty inputs — and so the mutation is observable
  // immediately by tests that check the props object after mount().
  // Idempotent: subsequent renders see populated values and short-circuit.
  if (!settings.solr.startUrl) settings.solr.startUrl = DEFAULT_URLS.solr;
  if (!settings.es.startUrl) settings.es.startUrl = DEFAULT_URLS.es;
  if (!settings.os.startUrl) settings.os.startUrl = DEFAULT_URLS.os;

  const initialTab =
    settings.whichEngine === 'es' ? 'es' : settings.whichEngine === 'os' ? 'os' : 'solr';
  const [activeTab, setActiveTab] = useState(initialTab);
  // Re-render trigger after in-place mutation of settings — same pattern
  // as settings.jsx. Prop identity stays stable for the shim's deep $watch.
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);

  function updateStartUrl(engine, value) {
    settings[engine].startUrl = value;
    rerender();
  }

  // Single submit path — fired by both button clicks (type="submit") and
  // Enter-in-input. Angular's form directive auto-prevented default
  // submission in the original; Preact does not, so without this
  // handler an Enter keypress in any URL input would reload the page.
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
                  {(t.key === 'es' || t.key === 'os') && (
                    <EngineAdvanced
                      engine={t.key}
                      settings={settings}
                      onRerender={rerender}
                    />
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

if (typeof globalThis !== 'undefined') {
  globalThis.SplainerIslands = globalThis.SplainerIslands || {};
  globalThis.SplainerIslands.startUrl = { mount, unmount };
}
