/**
 * docExplain island — explain-tree modal with tab view and alt-doc compare.
 *
 * Summarized / Hot tabs use <pre> with text interpolation (Preact escapes by default).
 * Full Explain uses `JsonTree` with `maxHeight="60vh"` so large explains scroll inside the modal
 * (searchResults query details use `400px` instead).
 * The Vitest XSS regression spec is the merge gate.
 */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { useDialogModal } from './useDialogModal.js';
import { DocRow } from './docRow.jsx';
import { docRowListKey } from './docListKeys.js';
import { JsonTree } from './jsonTree.jsx';

const TABS = [
  { id: 'summarized', label: 'Summarized' },
  { id: 'hot', label: 'Hot Matches' },
  { id: 'full', label: 'Full Explain' },
];

function ExplainPane({ doc, tab }) {
  // All three tabs are in the DOM simultaneously (CSS-hidden when inactive).
  // The Playwright suite greps the modal body for content that spans tabs,
  // so conditional rendering would break assertions.
  if (!doc) return null;
  return (
    <div>
      <pre style={{ display: tab === 'summarized' ? 'block' : 'none' }}>
        {doc.explain().toStr()}
      </pre>
      <pre style={{ display: tab === 'hot' ? 'block' : 'none' }}>
        {doc.hotMatches().toStr()}
      </pre>
      <div
        data-role="explain-pane-full"
        style={{ display: tab === 'full' ? 'block' : 'none', maxWidth: '100%' }}
      >
        <JsonTree value={doc.explain().rawStr()} maxHeight="60vh" />
      </div>
    </div>
  );
}

function AltQueryForm({ explainOther, onResults }) {
  const [altQuery, setAltQuery] = useState('');
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    setPending(true);
    setErrorMsg(null);
    explainOther(altQuery)
      .then((result) => {
        setPending(false);
        onResults(result);
      })
      .catch((err) => {
        setPending(false);
        setErrorMsg((err && err.message) || String(err));
      });
  }

  return (
    <div>
      <div class="row">
        <form onSubmit={handleSubmit}>
          <div class="col-md-1"></div>
          <div class="col-md-7">
            <input
              class="form-control"
              data-role="alt-query"
              value={altQuery}
              placeholder="Search For Other Docs To Compare (use Simple Lucene Query syntax)"
              type="text"
              onInput={(e) => setAltQuery(e.target.value)}
            />
          </div>
          <div class="col-md-3">
            <input
              class="btn btn-primary form-control"
              data-role="find-others"
              type="submit"
              value="Find Others"
              disabled={pending}
            />
          </div>
          <div class="col-md-1"></div>
        </form>
      </div>
      {errorMsg && (
        <div class="row">
          <div class="col-md-10 col-md-offset-1">
            <div class="alert alert-danger" data-role="alt-query-error">
              {errorMsg}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DocExplain({
  doc,
  canExplainOther,
  explainOther,
  maxScore,
  onClose,
}) {
  const { ref, close } = useDialogModal(onClose);
  const [tab, setTab] = useState('summarized');
  const [altDoc, setAltDoc] = useState(null);
  const [altResults, setAltResults] = useState({ docs: [], maxScore: maxScore || 0 });
  const [altListEpoch, setAltListEpoch] = useState(0);

  // No mounted-flag guard needed — setAltResults targets local state,
  // which Preact silently drops after unmount.

  function handleResults(result) {
    setAltListEpoch((e) => e + 1);
    setAltResults({
      docs: (result && result.docs) || [],
      maxScore: (result && result.maxScore) || 0,
    });
  }

  const compareCols = altDoc ? 'col-md-6' : 'col-md-12';

  return (
    <dialog ref={ref} class="detailed-explain-dialog">
      <div style={{ margin: '20px', minWidth: '600px' }}>
        <p class="modal-header" data-role="detailed-explain-modal">
          Explain for: <i>{doc && doc.title}</i>
          {altDoc && (
            <span>
              {' '}
              vs <i>{altDoc.title}</i>
            </span>
          )}
          <button
            type="button"
            class="close"
            aria-label="Close"
            style={{ float: 'right' }}
            onClick={close}
          >
            <span aria-hidden="true">×</span>
          </button>
        </p>
        <div class="modal-body" data-role="detailed-explain-body">
          <div class="row">
            <div>
              {/* Bootstrap 3 .nav-tabs targets > li > a specifically;
                  href="#" with preventDefault keeps tab styling intact. */}
              <ul class="nav nav-tabs" role="tablist">
                {TABS.map((t) => (
                  <li
                    key={t.id}
                    role="presentation"
                    class={tab === t.id ? 'active' : ''}
                  >
                    <a
                      href="#"
                      data-role={`tab-${t.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setTab(t.id);
                      }}
                    >
                      {t.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div class="tab-content" style={{ paddingTop: '10px' }}>
                <div class={`explain-view ${compareCols}`}>
                  <ExplainPane doc={doc} tab={tab} />
                </div>
                {altDoc && (
                  <div class={`explain-view ${compareCols}`}>
                    <ExplainPane doc={altDoc} tab={tab} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {canExplainOther && (
          <div class="container">
            <hr />
            <div
              class="row"
              style={{
                marginBottom: '20px',
                maxHeight: '300px',
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              <AltQueryForm explainOther={explainOther} onResults={handleResults} />
              {altResults.docs.map((d, i) => (
                <div
                  key={docRowListKey(d, i, altListEpoch)}
                  class="container"
                  onClick={() => setAltDoc(d)}
                >
                  <DocRow
                    doc={d}
                    maxScore={altResults.maxScore}
                    onShowDetailed={() => setAltDoc(d)}
                    onShowDoc={() => setAltDoc(d)}
                  />
                  <hr />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}

export function renderInto(rootEl, doc, opts = {}) {
  if (!rootEl) throw new Error('docExplain island: rootEl is required');
  render(
    <DocExplain
      doc={doc}
      canExplainOther={!!opts.canExplainOther}
      explainOther={opts.explainOther}
      maxScore={opts.maxScore}
      onClose={opts.onClose}
    />,
    rootEl,
  );
}

export function unmount(rootEl) {
  render(null, rootEl);
}
