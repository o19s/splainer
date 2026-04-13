/**
 * Custom HTTP headers: preset `<select>` + JSON body. (CM 6 in the browser; textarea under jsdom.
 * `<fieldset>`/`<legend>` name the group without unique `id`s when multiple instances mount.
 */
import { render } from 'preact';
import { useCodeMirror } from './useCodeMirror.js';

const HEADER_TEMPLATES = {
  None: '',
  Custom: '{\n "KEY": "VALUE"\n}',
  'API Key': '{\n  "Authorization": "ApiKey XXX"\n}',
};

// Stryker disable all: jsdom path; e2e covers real browser.
const CM6_AVAILABLE =
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  !/jsdom/i.test(navigator.userAgent || '');
// Stryker restore all

function CodeMirrorEditor({ value, readOnly, onChange }) {
  const containerRef = useCodeMirror(value, onChange, {
    readOnly,
    ariaLabel: 'Custom HTTP headers (JSON object)',
  });
  return <div ref={containerRef} data-role="header-editor" style={{ height: '150px' }} />;
}

function TextareaFallback({ value, readOnly, onChange }) {
  return (
    <textarea
      data-role="header-editor"
      class="form-control"
      style={{ height: '150px', fontFamily: 'monospace' }}
      value={value || ''}
      readOnly={!!readOnly}
      aria-label="Custom HTTP headers (JSON object)"
      onInput={(e) => onChange(e.target.value)}
    />
  );
}

export function CustomHeaders({ settings, onChange }) {
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
      class="well well-sm"
      style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}
    >
      <legend
        class="control-label"
        style={{
          border: 'none',
          width: 'auto',
          marginBottom: '10px',
          padding: 0,
          display: 'block',
        }}
      >
        Custom Headers
      </legend>
      <div class="col-sm-12 clearfix">
        <p class="help-block">
          If you need to send headers to authenticate with your search engine you can specify them
          here.
          <br />
          Pick "API Key" from drop down to be prompted for the format for putting in an API Key.
        </p>
      </div>
      <div class="form-group clearfix">
        <div class="col-sm-12">
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

export function mount(rootEl, settings, onChange) {
  if (!rootEl) throw new Error('customHeaders island: rootEl is required');
  render(<CustomHeaders settings={settings} onChange={onChange} />, rootEl);
}

export function unmount(rootEl) {
  render(null, rootEl);
}
