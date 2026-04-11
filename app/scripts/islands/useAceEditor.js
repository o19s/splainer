/**
 * useAceEditor — Preact hook wrapping an Ace editor instance.
 *
 * Three-ref pattern for imperative third-party libraries:
 *   1. instanceRef  — the live Ace editor
 *   2. onChangeRef  — latest onChange prop (avoids stale-closure bugs)
 *   3. suppressRef  — breaks the echo loop when setValue() fires 'change'
 *
 * Caller owns the Ace-vs-textarea-fallback decision (jsdom has no
 * window.ace, so specs render a <textarea> instead).
 * The hook does one thing — wrap Ace — and trusts the caller to gate it
 * on `typeof window.ace !== 'undefined'`.
 */
import { useEffect, useRef } from 'preact/hooks';

export function useAceEditor(value, onChange, options = {}) {
  const { mode = 'ace/mode/json', readOnly = false, tabSize = 2, useWrapMode = false } = options;

  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const suppressRef = useRef(false);

  // Keep onChangeRef pointed at the latest prop. Effect (not render-time
  // side effect) so this stays compatible with strict / concurrent rendering.
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // One-shot: instantiate Ace once after the container is in the DOM.
  // Re-running this effect on every render would destroy and recreate Ace
  // on every keystroke. Subsequent value/readOnly changes are handled by
  // the second effect below.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ace || !containerRef.current) return;
    const editor = window.ace.edit(containerRef.current);
    editor.setTheme('ace/theme/chrome');
    editor.session.setMode(mode);
    editor.session.setUseWrapMode(useWrapMode);
    editor.session.setTabSize(tabSize);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value/readOnly changes into the live editor without
  // tearing it down. suppressRef + try/finally guards the echo loop.
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

  return containerRef;
}
