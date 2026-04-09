/**
 * useAceEditor — Preact hook that wraps an Ace editor instance with the
 * three-ref pattern PR 6 established for imperative third-party libraries:
 *
 *   1. instanceRef  — the live Ace editor, owned by the hook
 *   2. onChangeRef  — always points at the *latest* onChange prop, so the
 *                     Ace 'change' handler doesn't capture a stale closure
 *                     across re-renders (the directive shim passes a fresh
 *                     onChange on every $watch tick)
 *   3. suppressRef  — breaks the echo loop: when the value-sync effect calls
 *                     editor.setValue(), Ace fires its 'change' event
 *                     synchronously; without suppression that re-enters
 *                     onChange and re-triggers the digest. Wrapped in
 *                     try/finally so a setValue throw can't strand the flag
 *                     in the suppressed state and silently drop user input.
 *
 * Skip any of the three and you get one of: stale-closure bugs, infinite
 * loops, or silently dropped input. PR 6's third audit round caught all
 * three failure modes; this hook is the canonical encapsulation.
 *
 * Caller still owns the Ace-vs-textarea-fallback decision (jsdom has no
 * window.ace, so specs render a <textarea> instead of calling this hook).
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
