/**
 * docRow island — renders a single search result (title, snippets,
 * thumbnail, stacked chart). All HTML from splainer-search is sanitized
 * via DOMPurify; XSS regression specs are the merge gate.
 */
import { render } from 'preact';
import DOMPurify from 'dompurify';
import { StackedChart } from './stackedChart.jsx';

function sanitize(html) {
  return DOMPurify.sanitize(html || '');
}

// Two named wrappers instead of one polymorphic <SanitizedHtml tag={...}>:
// a string-typed tag prop is an injection footgun if a future caller wires
// it to user input.
 
function SanitizedSpan({ html, ...rest }) {
  return <span {...rest} dangerouslySetInnerHTML={{ __html: sanitize(html) }} />;
}
 
function SanitizedAnchor({ html, ...rest }) {
  return <a {...rest} dangerouslySetInnerHTML={{ __html: sanitize(html) }} />;
}

function buildSnippets(doc) {
  // splainer-search returns fieldName -> string | string[]; arrays get
  // joined with ", " for display, matching the old controller.
  const raw = doc.subSnippets('<em>', '</em>');
  const out = {};
  Object.keys(raw).forEach((k) => {
    out[k] = Array.isArray(raw[k]) ? raw[k].join(', ') : raw[k];
  });
  return out;
}

export function DocRow({ doc, maxScore, onShowDoc, onShowDetailed }) {
  const title = doc.getHighlightedTitle('<em>', '</em>');
  const snippets = buildSnippets(doc);
  const snippetEntries = Object.keys(snippets);

  function handleTitleClick(e) {
    e.preventDefault();
    if (onShowDoc) onShowDoc(doc);
  }

  return (
    <div class="row docRow" data-testid="doc-row">
      <div class="col-md-4">
        <h4>{doc.score()}</h4>
        <StackedChart doc={doc} maxScore={maxScore} onDetailed={onShowDetailed} />
      </div>

      <div class="col-md-8">
        <h4>
          <SanitizedAnchor href="" onClick={handleTitleClick} html={title} />
        </h4>
        {doc.hasThumb() && (
          <div>
            <img style={{ maxHeight: '200px' }} src={doc.thumb} alt="" />
          </div>
        )}
        {doc.hasImage() && (
          <div>
            <img style={{ maxHeight: '450px' }} src={doc.image} alt="" />
          </div>
        )}
        {snippetEntries.map((fieldName) => (
          <div key={fieldName}>
            <label class="fieldLabel">{fieldName}: </label>
            <SanitizedSpan html={snippets[fieldName]} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function mount(rootEl, doc, props = {}) {
  if (!rootEl) throw new Error('docRow island: rootEl is required');
  render(<DocRow doc={doc} {...props} />, rootEl);
}

export function unmount(rootEl) {
  render(null, rootEl);
}
