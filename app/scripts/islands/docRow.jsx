/**
 * docRow island — PR 9a.
 *
 * Replaces app/scripts/controllers/docRow.js + the rendering half of
 * app/views/docRow.html. The Angular directive shim
 * (app/scripts/directives/docRow.js) mounts this and also handles two
 * things the island deliberately does NOT own:
 *
 *   1. Opening the "Detailed" explain modal via $uibModal — survives
 *      until PR 9bc rewrites the modal pattern to native <dialog>.
 *   2. $compile-ing the still-Angular <stacked-chart> child into the
 *      `chartHost` slot the island provides. The island renders an empty
 *      <div ref={chartHost}> and the shim fills it. This is an inversion
 *      of PR 8's pattern (Preact-parent / Angular-child instead of the
 *      other way around) and is bounded to a single PR — stackedChart
 *      becomes its own island in 9bc.
 *
 * The two ng-bind-html sites in the old template (doc.title and field
 * snippets) are routed through SanitizedHtml, which wraps DOMPurify. The
 * old templates relied on Angular's $sce / ngSanitize implicit sanitizer;
 * Preact's dangerouslySetInnerHTML has no implicit sanitizer at all, so
 * skipping this would have shipped a strictly worse XSS posture than the
 * Angular version. DOMPurify is the round-table's "Security" merge gate.
 */
import { render } from 'preact';
import { useRef, useLayoutEffect } from 'preact/hooks';
import DOMPurify from 'dompurify';

// Sanitization wrappers. Every former ng-bind-html site goes through
// one of these — there must be NO raw dangerouslySetInnerHTML anywhere
// else in the islands. Grep enforces this in the PR review.
//
// Two named components instead of a single one with a dynamic `tag`
// prop: a polymorphic tag prop is a footgun because <Tag> resolves
// from a string at render time, and a future contributor passing
// user-controlled input as `tag` could inject <script> — at which point
// sanitizing the *inner* HTML doesn't help, because the *tag itself*
// is the attack vector. Two fixed components remove the footgun.
//
// DOMPurify defaults strip <script>, on*= attributes, javascript: URLs,
// SVG XSS vectors, and similar. The defaults are appropriate for
// splainer's use case (rendering highlighted Solr/ES field values that
// contain only <em>...</em> markers from splainer-search).
function sanitize(html) {
  return DOMPurify.sanitize(html || '');
}

// eslint-disable-next-line no-unused-vars -- referenced via JSX below
function SanitizedSpan({ html, ...rest }) {
  return <span {...rest} dangerouslySetInnerHTML={{ __html: sanitize(html) }} />;
}

// eslint-disable-next-line no-unused-vars -- referenced via JSX below
function SanitizedAnchor({ html, ...rest }) {
  return <a {...rest} dangerouslySetInnerHTML={{ __html: sanitize(html) }} />;
}

function buildSnippets(doc) {
  // Same shape the old controller produced. splainer-search returns an
  // object map of fieldName -> string OR string[]; arrays get joined with
  // ", " for display. Computed once per render rather than memoized in a
  // ref because the doc identity is stable across re-renders within a
  // single search result list.
  const raw = doc.subSnippets('<em>', '</em>');
  const out = {};
  Object.keys(raw).forEach((k) => {
    out[k] = Array.isArray(raw[k]) ? raw[k].join(', ') : raw[k];
  });
  return out;
}

export function DocRow({ doc, onShowDoc, registerChartHost }) {
  // The chart host is a slot the directive shim fills with the still-
  // Angular <stacked-chart> via $compile. The island just provides a
  // stable element and reports it back to the shim. registerChartHost
  // is called on every render so the shim's most recent reference always
  // points at the live DOM node — no stale-ref bugs across re-mounts.
  //
  // useLayoutEffect (not useEffect): the shim needs to $compile
  // <stacked-chart> into the host *before* paint, not after a microtask.
  // useEffect would defer the call, leaving an empty chart-host slot
  // visible for one frame. useLayoutEffect runs synchronously after the
  // commit phase, before the browser paints.
  //
  // No deps array — INTENTIONAL, do not "optimize" this to
  // [registerChartHost]. The effect must re-fire on every render so the
  // shim sees any DOM-node swap (unlikely in practice but possible with
  // component remounts or key changes). With a [registerChartHost] deps
  // array the effect would only run on mount, and a swapped chart-host
  // node would never reach the shim — chart would compile into the old
  // detached element. Correctness over the wasted no-op call.
  const chartHostRef = useRef(null);
  useLayoutEffect(() => {
    if (registerChartHost) registerChartHost(chartHostRef.current);
  });

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
        {/* The Angular <stacked-chart> directive is $compile-d into here
            by the shim on every digest. Empty in jsdom (specs do not
            load Angular). Removed in PR 9bc when stackedChart becomes
            an island. */}
        <div ref={chartHostRef} data-role="chart-host" />
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

// Public API consumed by the Angular directive shim
// (app/scripts/directives/docRow.js).
export function mount(rootEl, doc, callbacks) {
  if (!rootEl) throw new Error('docRow island: rootEl is required');
  render(
    <DocRow
      doc={doc}
      onShowDoc={callbacks && callbacks.onShowDoc}
      registerChartHost={callbacks && callbacks.registerChartHost}
    />,
    rootEl,
  );
}

export function unmount(rootEl) {
  render(null, rootEl);
}

if (typeof globalThis !== 'undefined') {
  globalThis.SplainerIslands = globalThis.SplainerIslands || {};
  globalThis.SplainerIslands.docRow = { mount, unmount };
}
