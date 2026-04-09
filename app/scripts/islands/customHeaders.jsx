/**
 * customHeaders island — first Preact JSX replacement for an Angular view.
 *
 * Built via vite.islands.config.js into app/scripts/islands/dist/customHeaders.js
 * (an IIFE that references window.preact.* as externals). The Angular
 * customHeaders directive (app/scripts/directives/customHeaders.js) is now
 * a thin shim that mounts this component on every $watch tick.
 *
 * Ace editor lifecycle uses useEffect + useRef — the canonical Preact
 * pattern for wrapping imperative third-party libraries. The fallback to
 * a textarea (when window.ace is missing) keeps the spec runnable under
 * jsdom without loading Ace.
 *
 * JSX uses Preact automatic runtime (see vite.islands.config.js); no `h` import.
 */
import { render } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

const HEADER_TEMPLATES = {
  None: '',
  Custom: '{\n "KEY": "VALUE"\n}',
  'API Key': '{\n  "Authorization": "ApiKey XXX"\n}',
};

function AceEditor({ value, readOnly, onChange }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  // Two refs make this work with Ace's imperative event model:
  //   - onChangeRef so the change handler always calls the *latest* prop
  //     (Preact passes a fresh onChange on every $watch tick from the
  //     directive shim; the one-shot useEffect closure would otherwise
  //     capture only the first one).
  //   - suppressRef to break the echo loop: when our value-sync useEffect
  //     calls editor.setValue(), Ace fires its 'change' event, which would
  //     re-enter onChange and re-trigger the digest. We set suppressRef
  //     during programmatic writes so the handler short-circuits.
  const onChangeRef = useRef(onChange);
  const suppressRef = useRef(false);

  // Keep onChangeRef pointed at the latest prop. Done in an effect (not as
  // a side effect during render) so this stays compatible with strict /
  // concurrent rendering — the React anti-pattern docs warn about exactly
  // this. useEffect (post-paint) is sufficient because the ref is consumed
  // by an Ace event listener, not by a child effect that needs the value
  // before paint.
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Instantiate Ace once after the container is in the DOM.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ace || !containerRef.current) return;
    const editor = window.ace.edit(containerRef.current);
    editor.setTheme('ace/theme/chrome');
    editor.session.setMode('ace/mode/json');
    editor.session.setUseWrapMode(false);
    // try/finally so a setValue throw can't leave suppressRef stuck true —
    // a stuck suppressRef silently drops every subsequent user keystroke,
    // which is the worst possible failure mode (no error, just dead input).
    suppressRef.current = true;
    try {
      editor.setValue(value || '', -1);
    } finally {
      suppressRef.current = false;
    }
    editor.setReadOnly(!!readOnly);
    const handler = () => {
      if (suppressRef.current) return;
      onChangeRef.current(editor.getValue());
    };
    editor.session.on('change', handler);
    editorRef.current = editor;
    return () => {
      editor.session.off('change', handler);
      editor.destroy();
      editorRef.current = null;
    };
    // Intentionally one-shot: we own the editor instance and sync prop
    // changes via the separate effect below. Re-running this effect on
    // every render would destroy and recreate Ace on every keystroke.
  }, []);

  // Sync external value/readOnly changes into the live editor without
  // tearing it down. Wrapped in suppressRef (with try/finally — see the
  // first useEffect) so the resulting Ace 'change' event doesn't echo
  // back through onChange and re-enter the digest.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== (value || '')) {
      suppressRef.current = true;
      try {
        editor.setValue(value || '', -1);
      } finally {
        suppressRef.current = false;
      }
    }
    editor.setReadOnly(!!readOnly);
  }, [value, readOnly]);

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
  // eslint-disable-next-line no-unused-vars -- dynamic component (Ace vs textarea)
  const Editor = hasAce ? AceEditor : TextareaFallback;

  function setHeaderType(e) {
    const next = e.target.value;
    onChange({
      headerType: next,
      // Replicate the original Angular controller's updateHeaders side
      // effect: changing the type resets the body to a template.
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

// Public API consumed by the Angular directive shim
// (app/scripts/directives/customHeaders.js). The Vite library build wraps
// this whole module in an IIFE; the side-effect attachment runs once at
// load time and survives the re-renders triggered by the directive's
// $watch loop.
export function mount(rootEl, settings, onChange) {
  if (!rootEl) throw new Error('customHeaders island: rootEl is required');
  render(<CustomHeaders settings={settings} onChange={onChange} />, rootEl);
}

export function unmount(rootEl) {
  render(null, rootEl);
}

if (typeof globalThis !== 'undefined') {
  globalThis.SplainerIslands = globalThis.SplainerIslands || {};
  globalThis.SplainerIslands.customHeaders = { mount, unmount };
}
