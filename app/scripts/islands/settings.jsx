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
import { CM6_AVAILABLE } from './editorEnvironment.js';
import { formatJson } from './formatJson.js';
import { searchArgsAriaLabel } from './searchArgsAriaLabel.js';
import { useCodeMirror } from './useCodeMirror.js';

function TextareaSearchArgs({ value, onChange, engine }) {
  return (
    <textarea
      data-role="search-args-editor"
      class="form-control"
      rows={10}
      value={value || ''}
      aria-label={searchArgsAriaLabel(engine)}
      onInput={(e) => onChange(e.target.value)}
    />
  );
}

/** Search-args CM; `key={engine}` remounts when language (plain vs json) must change. */
function SettingsCodeMirrorSearchArgs({ engine, value, onChange }) {
  const language = engine === 'solr' ? 'plain' : 'json';
  const containerRef = useCodeMirror(value, onChange, {
    useWrapMode: true,
    tabSize: 2,
    language,
    ariaLabel: searchArgsAriaLabel(engine),
  });
  const id =
    engine === 'es'
      ? 'es-query-params-editor'
      : engine === 'os'
        ? 'os-query-params-editor'
        : 'solr-query-params-editor';
  const className =
    engine === 'es'
      ? 'es-query-params'
      : engine === 'os'
        ? 'os-query-params'
        : 'solr-query-params';
  return (
    <div
      ref={containerRef}
      data-role="search-args-editor"
      id={id}
      class={className}
      style={{ height: '250px' }}
    />
  );
}

export function SettingsIsland({ settings, currSearch, onPublish }) {
  const [workingWhichEngine, setWorkingWhichEngine] = useState(settings.whichEngine || 'solr');
  const [, setTick] = useState(0);

  useEffect(() => {
    if (settings.whichEngine && settings.whichEngine !== workingWhichEngine) {
      setWorkingWhichEngine(settings.whichEngine);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.whichEngine]);

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
      <button
        type="button"
        class="dev-header"
        aria-expanded={engineOpen}
        onClick={() => setEngineOpen((v) => !v)}
      >
        Search Engine
        <span
          class={`glyphicon ${engineOpen ? 'glyphicon-minus-sign' : 'glyphicon-plus-sign'}`}
          aria-hidden="true"
        ></span>
      </button>
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
      <button
        type="button"
        class="dev-header"
        aria-expanded={urlOpen}
        onClick={() => setUrlOpen((v) => !v)}
      >
        Search URL
        <span
          class={`glyphicon ${urlOpen ? 'glyphicon-minus-sign' : 'glyphicon-plus-sign'}`}
          aria-hidden="true"
        ></span>
      </button>
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
      <button
        type="button"
        class="dev-header"
        aria-expanded={fieldsOpen}
        onClick={() => setFieldsOpen((v) => !v)}
      >
        Displayed Fields
        <span
          class={`glyphicon ${fieldsOpen ? 'glyphicon-minus-sign' : 'glyphicon-plus-sign'}`}
          aria-hidden="true"
        ></span>
      </button>
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

      {/* Search Args (default open) */}
      <button
        type="button"
        class="dev-header"
        aria-expanded={argsOpen}
        onClick={() => setArgsOpen((v) => !v)}
      >
        Search Args
        <span
          class={`glyphicon ${argsOpen ? 'glyphicon-minus-sign' : 'glyphicon-plus-sign'}`}
          aria-hidden="true"
        ></span>
      </button>
      {argsOpen && (
        <div class="dev-section">
          {CM6_AVAILABLE ? (
            <SettingsCodeMirrorSearchArgs
              key={workingWhichEngine}
              engine={workingWhichEngine}
              value={ws.searchArgsStr}
              onChange={(v) => updateField('searchArgsStr', v)}
            />
          ) : (
            <TextareaSearchArgs
              key={workingWhichEngine}
              engine={workingWhichEngine}
              value={ws.searchArgsStr}
              onChange={(v) => updateField('searchArgsStr', v)}
            />
          )}
          {workingWhichEngine !== 'solr' && (
            <button
              type="button"
              class="btn btn-default btn-xs btn-indent-json"
              data-role="indent-json"
              onClick={() => {
                autoIndent();
              }}
            >
              Indent JSON
            </button>
          )}
        </div>
      )}

      {/* Custom headers: ES/OS only */}
      {workingWhichEngine !== 'solr' && (
        <>
          <button
            type="button"
            class="dev-header"
            aria-expanded={headersOpen}
            onClick={() => setHeadersOpen((v) => !v)}
          >
            Custom Headers
            <span
              class={`glyphicon ${headersOpen ? 'glyphicon-minus-sign' : 'glyphicon-plus-sign'}`}
              aria-hidden="true"
            ></span>
          </button>
          {headersOpen && (
            <div class="dev-section black-label" data-role="custom-headers-section">
              <CustomHeaders
                showHeading={false}
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
