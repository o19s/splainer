/**
 * customHeaders island — Preact component for editing custom HTTP headers.
 *
 * Ace editor lifecycle uses useEffect + useRef — the canonical Preact
 * pattern for wrapping imperative third-party libraries. The fallback to
 * a textarea (when window.ace is missing) keeps the spec runnable under
 * jsdom without loading Ace.
 */
import { render } from 'preact';
import { useAceEditor } from './useAceEditor.js';

const HEADER_TEMPLATES = {
  None: '',
  Custom: '{\n "KEY": "VALUE"\n}',
  'API Key': '{\n  "Authorization": "ApiKey XXX"\n}',
};

function AceEditor({ value, readOnly, onChange }) {
  const containerRef = useAceEditor(value, onChange, { readOnly });
  return <div ref={containerRef} data-role="header-editor" style={{ height: '150px' }} />;
}

function TextareaFallback({ value, readOnly, onChange }) {
  // Used under jsdom (no window.ace). Same data-role attribute so specs
  // can target it identically to the Ace path.
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
  const hasAce = typeof window !== 'undefined' && !!window.ace;
  // Used as <Editor /> below; core no-unused-vars does not treat JSX tags as references.
   
  const Editor = hasAce ? AceEditor : TextareaFallback;

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
