/**
 * settings island — Preact replacement for app/scripts/controllers/settings.js
 * and the inline form previously at app/index.html:115-255 (PR 7).
 *
 * The island is mounted by app/scripts/directives/settings.js. The directive
 * shim is the integration boundary: it injects the 4 Angular settings
 * services + currSearch + the parent's `search` callback, and proxies them
 * into the island via props.
 *
 * Props (the entire integration surface — the island knows nothing about
 * Angular, $scope, or settingsStoreSvc):
 *   - settings:    settingsStoreSvc.settings (the whole {whichEngine, solr, es, os} object)
 *   - currSearch:  for currSearch.searcher.isTemplateCall() — gates fieldSpec input
 *   - onPublish:   (whichEngine, workingSettings) => void
 *                  shim dispatches to {solr,es,os}SettingsSvc.fromTweakedSettings,
 *                  then triggers $scope.search.search().then(save)
 *
 * Form-state mutation strategy: the original Angular controller mutated
 * settings[engine] in place on every keystroke (Angular two-way binding
 * via ng-model). We preserve that semantics — switching engines mid-typing
 * without submitting must not lose unsaved tweaks to the other engine.
 * Implementation: a `tick` counter forces re-renders after in-place
 * mutation of the prop object. This keeps prop *identity* stable, which
 * the directive shim's deep $watch relies on, while still triggering
 * Preact reconciliation for the visible form fields.
 *
 * The Ace editor for the es/os Search Args case is a sub-component because
 * useAceEditor is a hook — it can only be called at the top of a component,
 * not conditionally inside a render branch. Same pattern as customHeaders.jsx.
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
  // Local state mirrors the original $scope state. Only the engine selector
  // and the section toggles are useState; the form fields read straight off
  // the settings prop (mutated in place + tick re-render).
  const [workingWhichEngine, setWorkingWhichEngine] = useState(settings.whichEngine || 'solr');
  // Re-render trigger after in-place mutation of `ws` (which is a prop
  // object, mutated to preserve identity for the directive shim's deep
  // $watch). The value is unused; only setTick matters.
  const [, setTick] = useState(0);

  // Sync workingWhichEngine from the store when external code mutates
  // settings.whichEngine (e.g. the StartUrl ES tab's Splain This! button
  // which kicks settingsStoreSvc.settings.whichEngine to 'es' before the
  // dev sidebar gets focus). Mirrors the original Angular controller's
  // `$scope.$watch('settings.whichEngine', ...)` which did the same thing.
  // The user's radio click goes through setWorkingWhichEngine but does NOT
  // touch settings.whichEngine until submit, so this effect won't overwrite
  // an in-progress edit.
  useEffect(() => {
    if (settings.whichEngine && settings.whichEngine !== workingWhichEngine) {
      setWorkingWhichEngine(settings.whichEngine);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.whichEngine]);

  // Section toggle defaults match the original ng-show conventions:
  //   Search Engine: collapsed (ng-show="...toggle")
  //   URL / Fields / Args: expanded (ng-show="!...toggle")
  //   Headers: collapsed (ng-show="...toggle")
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

  // ng-show="!currSearch.searcher.isTemplateCall()" — show fieldSpec only
  // when the searcher is not a template call. Defensive about undefineds:
  // currSearch may be undefined before the first search runs.
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

      {/* Custom Headers — es/os only, collapsed by default. JSX child of the
          existing CustomHeaders island, NOT a remount via Angular.
          NOTE: data-role="header-type" / "header-editor" inside CustomHeaders
          is no longer unique on the page — there's now one mount in the
          dev sidebar (here) and one in startUrl.html for each of ES/OS.
          Scope your selectors (e.g. `#es_ [data-role="header-type"]`) when
          writing tests; an unscoped query returns the first match. */}
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

// Public API consumed by the Angular directive shim.
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

if (typeof globalThis !== 'undefined') {
  globalThis.SplainerIslands = globalThis.SplainerIslands || {};
  globalThis.SplainerIslands.settings = { mount, unmount };
}
