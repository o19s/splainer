/**
 * settings island — dev sidebar form for tweaking search settings.
 *
 * Props:
 *   - settings:    the {whichEngine, solr, es, os} object (mutated in place)
 *   - currSearch:  for currSearch.searcher.isTemplateCall() — gates fieldSpec input
 *   - onPublish:   (whichEngine, workingSettings) => void
 *
 * Settings are mutated in place so switching engines mid-typing doesn't
 * lose unsaved tweaks. A `tick` counter forces Preact re-renders after
 * in-place mutation.
 */
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
 
import { CustomHeaders } from './customHeaders.jsx';
import { formatJson } from './formatJson.js';
 
function TextareaArgsFallback({ value, onChange }) {
  return (
    <textarea
      data-role="search-args-editor"
      class="form-control"
      rows={10}
      value={value || ''}
      onInput={(e) => onChange(e.target.value)}
    />
  );
}

export function SettingsIsland({ settings, currSearch, onPublish }) {
  const [workingWhichEngine, setWorkingWhichEngine] = useState(settings.whichEngine || 'solr');
  const [, setTick] = useState(0); // force re-render after in-place mutation

  // Sync when external code (e.g. StartUrl's Splain This!) changes the engine.
  useEffect(() => {
    if (settings.whichEngine && settings.whichEngine !== workingWhichEngine) {
      setWorkingWhichEngine(settings.whichEngine);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.whichEngine]);

  // Section toggle defaults: Engine and Headers collapsed, rest expanded.
  const [engineOpen, setEngineOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(true);
  const [fieldsOpen, setFieldsOpen] = useState(true);
  const [argsOpen, setArgsOpen] = useState(true);
  const [headersOpen, setHeadersOpen] = useState(false);

  const ws = settings[workingWhichEngine];

  function forceRerender() {
    setTick((t) => t + 1);
  }

  function updateField(field, value) {
    ws[field] = value;
    forceRerender();
  }

  function changeEngine(next) {
    setWorkingWhichEngine(next);
  }

  function autoIndent() {
    if (workingWhichEngine === 'es' || workingWhichEngine === 'os') {
      ws.searchArgsStr = formatJson(ws.searchArgsStr);
      forceRerender();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    onPublish(workingWhichEngine, ws);
  }

  // Show fieldSpec only when the searcher is not a template call.
  const isTemplateCall =
    currSearch && currSearch.searcher && typeof currSearch.searcher.isTemplateCall === 'function'
      ? currSearch.searcher.isTemplateCall()
      : false;

  return (
    <form
      class="form-horizontal"
      style={{ height: '100%', minHeight: '100%' }}
      id="queryParams"
      role="form"
      onSubmit={handleSubmit}
    >
      {/* Search Engine selector — collapsed by default */}
      <div class="dev-header" onClick={() => setEngineOpen((v) => !v)}>
        Search Engine
        <span
          class={`glyphicon ${engineOpen ? 'glyphicon-minus-sign' : 'glyphicon-plus-sign'}`}
        ></span>
      </div>
      {engineOpen && (
        <div class="dev-section" data-role="engine-section">
          <label>
            <input
              type="radio"
              name="whichEngine"
              value="solr"
              checked={workingWhichEngine === 'solr'}
              onChange={() => changeEngine('solr')}
            />{' '}
            Solr
          </label>
          <label>
            <input
              type="radio"
              name="whichEngine"
              value="es"
              checked={workingWhichEngine === 'es'}
              onChange={() => changeEngine('es')}
            />{' '}
            Elasticsearch
          </label>
          <label>
            <input
              type="radio"
              name="whichEngine"
              value="os"
              checked={workingWhichEngine === 'os'}
              onChange={() => changeEngine('os')}
            />{' '}
            OpenSearch
          </label>
        </div>
      )}

      {/* Search URL — expanded by default */}
      <div class="dev-header" onClick={() => setUrlOpen((v) => !v)}>
        Search URL
        <span
          class={`glyphicon ${urlOpen ? 'glyphicon-minus-sign' : 'glyphicon-plus-sign'}`}
        ></span>
      </div>
      {urlOpen && (
        <div class="dev-section">
          <input
            type="text"
            data-role="search-url"
            value={ws.searchUrl || ''}
            placeholder="Enter URL to your request handler"
            class="form-control"
            onInput={(e) => updateField('searchUrl', e.target.value)}
          />
        </div>
      )}

      {/* Displayed Fields — expanded by default; hidden when isTemplateCall */}
      <div class="dev-header" onClick={() => setFieldsOpen((v) => !v)}>
        Displayed Fields
        <span
          class={`glyphicon ${fieldsOpen ? 'glyphicon-minus-sign' : 'glyphicon-plus-sign'}`}
        ></span>
      </div>
      {fieldsOpen && (
        <div class="dev-section">
          {!isTemplateCall && (
            <input
              id="inputFieldSpec"
              type="text"
              data-role="field-spec"
              value={ws.fieldSpecStr || ''}
              placeholder="Fields you'd like to display"
              class="form-control"
              onInput={(e) => updateField('fieldSpecStr', e.target.value)}
            />
          )}
          {isTemplateCall && (
            <span>
              When using ES Templates, specify fields to view via <code>_source</code> defined in
              the search template.
            </span>
          )}
        </div>
      )}

      {/* Search Args — expanded by default; textarea for solr, Ace for es/os */}
      <div class="dev-header" onClick={() => setArgsOpen((v) => !v)}>
        Search Args
        <span
          class={`glyphicon ${argsOpen ? 'glyphicon-minus-sign' : 'glyphicon-plus-sign'}`}
        ></span>
      </div>
      {argsOpen && (
        <div class="dev-section">
          <TextareaArgsFallback
            value={ws.searchArgsStr}
            onChange={(v) => updateField('searchArgsStr', v)}
          />
          {workingWhichEngine !== 'solr' && (
            <a
              href=""
              class="pull-right label"
              data-role="indent-json"
              onClick={(e) => {
                e.preventDefault();
                autoIndent();
              }}
            >
              Indent JSON
            </a>
          )}
        </div>
      )}

      {/* Custom Headers — es/os only, collapsed by default.
          Test selectors: scope with `#es_` since header-type/header-editor
          appear in both the sidebar and startUrl. */}
      {workingWhichEngine !== 'solr' && (
        <>
          <div class="dev-header" onClick={() => setHeadersOpen((v) => !v)}>
            Custom Headers
            <span
              class={`glyphicon ${headersOpen ? 'glyphicon-minus-sign' : 'glyphicon-plus-sign'}`}
            ></span>
          </div>
          {headersOpen && (
            <div class="dev-section black-label" data-role="custom-headers-section">
              <CustomHeaders
                settings={ws}
                onChange={(next) => {
                  ws.headerType = next.headerType;
                  ws.customHeaders = next.customHeaders;
                  forceRerender();
                }}
              />
            </div>
          )}
        </>
      )}

      <div class="dev-section">
        <button type="submit" class="btn btn-default" data-role="rerun-query">
          Rerun Query
        </button>
      </div>
    </form>
  );
}

export function mount(rootEl, props, onPublish) {
  if (!rootEl) throw new Error('settings island: rootEl is required');
  render(
    <SettingsIsland
      settings={props.settings}
      currSearch={props.currSearch}
      onPublish={onPublish}
    />,
    rootEl,
  );
}

export function unmount(rootEl) {
  render(null, rootEl);
}
