/**
 * useCodeMirror — Preact hook wrapping a CodeMirror 6 EditorView.
 *
 * API mirrors the old useAceEditor hook so consumers only have to change
 * one import line: `(value, onChange, { readOnly, tabSize, useWrapMode, language, ariaLabel })`.
 * `language` `'json'` (default) vs `'plain'`; both fixed at mount like `tabSize` — remount with new `key` to change.
 * `ariaLabel` goes on the CM content node (`contentAttributes`), not the host `div`.
 *
 * Three-ref pattern for imperative third-party libraries:
 *   1. viewRef        — the live EditorView
 *   2. onChangeRef    — latest onChange prop (avoids stale-closure bugs)
 *   3. suppressRef    — breaks the echo loop when external value sync
 *                       dispatches a `changes` transaction
 *
 * readOnly changes at runtime via a Compartment reconfigure — CM6's native
 * way to swap extensions on a live view without tearing it down.
 *
 * The EditorView is stashed on the container DOM node as `__cmView` so
 * Playwright e2e tests can read the current doc via
 * `container.__cmView.state.doc.toString()`. Caller owns the CM6-vs-textarea
 * fallback decision (jsdom doesn't implement enough DOM for CM6 layout).
 */
import { useEffect, useRef } from 'preact/hooks';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';

export function useCodeMirror(value, onChange, options = {}) {
  const {
    readOnly = false,
    tabSize = 2,
    useWrapMode = false,
    language = 'json',
    ariaLabel = 'Code editor',
  } = options;

  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const suppressRef = useRef(false);
  const readOnlyCompartmentRef = useRef(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Mount CM once (language/tabSize fixed until remount).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const readOnlyCompartment = new Compartment();
    readOnlyCompartmentRef.current = readOnlyCompartment;

    const extensions = [
      lineNumbers(),
      history(),
      ...(language === 'plain'
        ? []
        : [json(), syntaxHighlighting(defaultHighlightStyle)]),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      EditorState.tabSize.of(tabSize),
      readOnlyCompartment.of([
        EditorState.readOnly.of(!!readOnly),
        EditorView.editable.of(!readOnly),
      ]),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
      }),
      EditorView.contentAttributes.of((view) => {
        const attrs = { 'aria-label': ariaLabel };
        if (view.state.readOnly) attrs['aria-readonly'] = 'true';
        return attrs;
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !suppressRef.current) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
    ];
    if (useWrapMode) extensions.push(EditorView.lineWrapping);

    const state = EditorState.create({ doc: value || '', extensions });
    const view = new EditorView({ state, parent: container });
    viewRef.current = view;
    container.__cmView = view;

    return () => {
      view.destroy();
      viewRef.current = null;
      readOnlyCompartmentRef.current = null;
      if (container) delete container.__cmView;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if ((value || '') === current) return;
    suppressRef.current = true;
    try {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value || '' },
      });
    } finally {
      suppressRef.current = false;
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    const compartment = readOnlyCompartmentRef.current;
    if (!view || !compartment) return;
    view.dispatch({
      effects: compartment.reconfigure([
        EditorState.readOnly.of(!!readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  return containerRef;
}
