/**
 * customHeaders island — Preact component for editing custom HTTP headers.
 *
 * CodeMirror 6 editor lifecycle uses useEffect + useRef — the canonical
 * Preact pattern for wrapping imperative third-party libraries. The
 * textarea fallback keeps the spec runnable under jsdom (where CM6's
 * layout measurements don't work reliably).
 */
import { render } from 'preact';
import { useCodeMirror } from './useCodeMirror.js';

const HEADER_TEMPLATES = {
  None: '',
  Custom: '{\n "KEY": "VALUE"\n}',
  'API Key': '{\n  "Authorization": "ApiKey XXX"\n}',
};

// jsdom detect: Vitest's jsdom env sets navigator.userAgent to include "jsdom".
const CM6_AVAILABLE =
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  !/jsdom/i.test(navigator.userAgent || '');

function CodeMirrorEditor({ value, readOnly, onChange }) {
  const containerRef = useCodeMirror(value, onChange, { readOnly });
  return <div ref={containerRef} data-role="header-editor" style={{ height: '150px' }} />;
}

function TextareaFallback({ value, readOnly, onChange }) {
  // Used under jsdom (CM6 layout measurements don't work reliably there).
  // Same data-role attribute so specs can target it identically to the
  // CodeMirror path.
  return (
    <textarea
      data-role="header-editor"
      class="form-control"
      style={{ height: '150px', fontFamily: 'monospace' }}
      value={value || ''}
      readOnly={!!readOnly}
      onInput={(e) => onChange(e.target.value)}
    />
  );
}

export function CustomHeaders({ settings, onChange }) {
  const headerType = settings.headerType || 'None';
  const isReadOnly = headerType === 'None';
  // Used as <Editor /> below; core no-unused-vars does not treat JSX tags as references.

  const Editor = CM6_AVAILABLE ? CodeMirrorEditor : TextareaFallback;

  function setHeaderType(e) {
    const next = e.target.value;
    onChange({
      headerType: next,
      // Changing the type resets the body to the matching template.
      customHeaders: HEADER_TEMPLATES[next],
    });
  }

  function setBody(body) {
    onChange({ headerType, customHeaders: body });
  }

  return (
    <div class="well well-sm">
      <div class="col-sm-12 clearfix">
        <label class="control-label">Custom Headers</label>
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
    </div>
  );
}

export function mount(rootEl, settings, onChange) {
  if (!rootEl) throw new Error('customHeaders island: rootEl is required');
  render(<CustomHeaders settings={settings} onChange={onChange} />, rootEl);
}

export function unmount(rootEl) {
  render(null, rootEl);
}
