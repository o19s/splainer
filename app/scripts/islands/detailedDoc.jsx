/**
 * detailedDoc island. Replaces views/detailedDoc.html + DetailedDocCtrl.
 * Pure text interpolation — old template used {{}}, no DOMPurify needed.
 */
import { render } from 'preact';
import { useDialogModal } from './useDialogModal.js';

export function DetailedDoc({ doc, onClose }) {
  const { ref } = useDialogModal(onClose);
  const subs = (doc && doc.subs) || {};

  return (
    <dialog ref={ref} class="detailed-doc-dialog">
      <div style={{ margin: '20px' }}>
        <h3>Detailed Document View of doc: {doc && doc.id}</h3>
        <h4>{doc && doc.title}</h4>
        {Object.keys(subs).map((subName) => (
          <div key={subName} class="row" style={{ marginBottom: '10px' }}>
            <div class="col-md-4">{subName}</div>
            <div class="col-md-8">{subs[subName]}</div>
          </div>
        ))}
      </div>
    </dialog>
  );
}

export function renderInto(rootEl, doc, opts = {}) {
  if (!rootEl) throw new Error('detailedDoc island: rootEl is required');
  render(<DetailedDoc doc={doc} onClose={opts.onClose} />, rootEl);
}

export function unmount(rootEl) {
  render(null, rootEl);
}

if (typeof globalThis !== 'undefined') {
  globalThis.SplainerIslands = globalThis.SplainerIslands || {};
  globalThis.SplainerIslands.detailedDoc = { renderInto, unmount };
}
