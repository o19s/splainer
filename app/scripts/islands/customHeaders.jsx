/**
 * Custom HTTP headers: preset `<select>` + JSON body. (CM 6 in the browser; textarea under jsdom
 * — see `editorEnvironment.js` / `CM6_AVAILABLE`.)
 * The group is a `<fieldset>` named with `aria-label` (not `<legend>`): browsers give `<legend>`
 * special layout so it straddles the fieldset edge, which looked like the title was “half inside”
 * the well. The visible title is a normal block with `data-role="custom-headers-heading"`.
 * Set `showHeading={false}` when a parent already labels the block (e.g. settings sidebar
 * accordion). The fieldset keeps `aria-label="Custom HTTP headers"` either way.
 * Heading, help text, preset `<select>`, and editor share one inner wrapper with Bootstrap’s
 * 15px horizontal gutter so the title lines up with the controls. Layout, in-well heading
 * typography, and select-to-editor spacing are in `app/styles/main.css` (`.custom-headers-*`).
 */
import { render } from 'preact';
import { CM6_AVAILABLE } from './editorEnvironment.js';
import { useCodeMirror } from './useCodeMirror.js';

const HEADER_TEMPLATES = {
  None: '',
  Custom: '{\n "KEY": "VALUE"\n}',
  'API Key': '{\n  "Authorization": "ApiKey XXX"\n}',
};

function CodeMirrorEditor({ value, readOnly, onChange }) {
  const containerRef = useCodeMirror(value, onChange, {
    readOnly,
    ariaLabel: 'Custom HTTP headers (JSON object)',
  });
  return (
    <div
      ref={containerRef}
      class="custom-headers-editor"
      data-role="header-editor"
    />
  );
}

function TextareaFallback({ value, readOnly, onChange }) {
  return (
    <textarea
      data-role="header-editor"
      class="form-control custom-headers-editor"
      value={value || ''}
      readOnly={!!readOnly}
      aria-label="Custom HTTP headers (JSON object)"
      onInput={(e) => onChange(e.target.value)}
    />
  );
}

export function CustomHeaders({ settings, onChange, showHeading = true }) {
  const headerType = settings.headerType || 'None';
  const isReadOnly = headerType === 'None';
  const Editor = CM6_AVAILABLE ? CodeMirrorEditor : TextareaFallback;

  function setHeaderType(e) {
    const next = e.target.value;
    onChange({
      headerType: next,
      customHeaders: HEADER_TEMPLATES[next],
    });
  }

  function setBody(body) {
    onChange({ headerType, customHeaders: body });
  }

  return (
    <fieldset
      class="well well-sm custom-headers-fieldset"
      aria-label="Custom HTTP headers"
    >
      <div class="clearfix custom-headers-body">
        {showHeading && (
          <div
            class="control-label custom-headers-heading"
            data-role="custom-headers-heading"
          >
            Custom Headers
          </div>
        )}
        <p class="help-block">
          If you need to send headers to authenticate with your search engine you can specify them
          here.
          <br />
          Pick "API Key" from drop down to be prompted for the format for putting in an API Key.
        </p>
        <div class="form-group clearfix">
          <select
            class="form-control"
            data-role="header-type"
            aria-label="Header preset"
            value={headerType}
            onChange={setHeaderType}
          >
            <option>None</option>
            <option>API Key</option>
            <option>Custom</option>
          </select>
          <Editor value={settings.customHeaders} readOnly={isReadOnly} onChange={setBody} />
        </div>
      </div>
    </fieldset>
  );
}

export function mount(rootEl, settings, onChange, options = {}) {
  if (!rootEl) throw new Error('customHeaders island: rootEl is required');
  const { showHeading = true } = options;
  render(
    <CustomHeaders settings={settings} onChange={onChange} showHeading={showHeading} />,
    rootEl,
  );
}

export function unmount(rootEl) {
  render(null, rootEl);
}
