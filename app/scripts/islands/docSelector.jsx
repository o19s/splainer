/**
 * docSelector island — Preact replacement for the form portion of
 * app/scripts/controllers/docSelector.js and app/views/docSelect.html (PR 8).
 *
 * Scope of this island: just the altQuery form + the error banner. The
 * result list (ng-repeat over currSearch.docs rendering <doc-row>) stays
 * in the Angular directive template until PR 9 migrates <doc-row> to a
 * Preact island. See PR8_DOCSELECTOR_ISLAND.md for why Option A (split
 * form/list across frameworks) beat the alternatives.
 *
 * All the Angular-service glue that the old controller carried — building
 * a fieldSpec, constructing a searcher, dispatching to the right extractor,
 * tracking maxScore — has moved into the directive shim's onExplainOther
 * callback, not the island. The island's only outbound channel is
 * onExplainOther(altQuery) returning a promise. On rejection, the island
 * shows the rejection's .message.
 */
import { render } from 'preact';
import { useState } from 'preact/hooks';

export function DocSelectorIsland({ onExplainOther }) {
  const [altQuery, setAltQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [pending, setPending] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    // No `if (pending) return` guard — the disabled attribute on the submit
    // button already prevents re-entry from user clicks.
    setPending(true);
    setErrorMsg(null);
    // onExplainOther is provided by the directive shim. It contains the
    // relocated body of the old controller's explainOther: build fieldSpec,
    // create searcher, call searcher.explainOther(), dispatch to extractor,
    // write results onto scope.currSearch under $apply. It returns a
    // promise that rejects with an Error on failure (see PR 5's .catch
    // on splainer-search 3.0.0's new rejection contract).
    onExplainOther(altQuery)
      .then(() => {
        setPending(false);
      })
      .catch((err) => {
        setErrorMsg((err && err.message) || String(err));
        setPending(false);
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
              id="altQuery"
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
            {/* Text interpolation — Preact escapes by default, so an error
                body containing "<script>..." renders as literal text. The
                Vitest spec asserts this. */}
            <div class="alert alert-danger" data-role="alt-query-error">
              {errorMsg}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Public API consumed by the Angular directive shim
// (app/scripts/directives/docSelector.js).
export function mount(rootEl, props, callbacks) {
  if (!rootEl) throw new Error('docSelector island: rootEl is required');
  render(<DocSelectorIsland onExplainOther={callbacks.onExplainOther} />, rootEl);
}

export function unmount(rootEl) {
  render(null, rootEl);
}

if (typeof globalThis !== 'undefined') {
  globalThis.SplainerIslands = globalThis.SplainerIslands || {};
  globalThis.SplainerIslands.docSelector = { mount, unmount };
}
