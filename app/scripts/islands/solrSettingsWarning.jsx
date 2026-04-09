/**
 * solrSettingsWarning island — Preact replacement for
 * app/scripts/controllers/solrSettingsWarning.js (PR 8).
 *
 * Rendered inside app/views/searchResults.html when the current search is
 * in the DID_SEARCH state. Shows an `alert alert-warning` panel listing
 * Solr arguments that splainer-search's `removeUnsupported()` stripped from
 * the query, grouped by the reason they were removed.
 *
 * Props (set by the directive shim):
 *   - argsStr:     the current Solr args string (currSearch.settings.searchArgsStr())
 *   - solrUrlSvc:  parseSolrArgs + removeUnsupported from splainer-search
 *
 * The old controller memoized the last-seen argsStr to avoid re-parsing on
 * every digest. Preact's useMemo gives us the same behavior without the
 * closure-state dance, and the shim's shallow $watch on the string already
 * gates mounts to actual changes.
 */
import { render } from 'preact';
import { useMemo } from 'preact/hooks';

function condenseWarnings(argsStr, solrUrlSvc) {
  if (!argsStr || !solrUrlSvc) return {};
  const parsed = solrUrlSvc.parseSolrArgs(argsStr);
  const perArgument = solrUrlSvc.removeUnsupported(parsed);
  // perArgument: { <argument>: <warning> } → { <warning>: [<argument>...] }
  const condensed = {};
  for (const argument of Object.keys(perArgument)) {
    const warning = perArgument[argument];
    if (Object.prototype.hasOwnProperty.call(condensed, warning)) {
      condensed[warning].push(argument);
    } else {
      condensed[warning] = [argument];
    }
  }
  return condensed;
}

export function SolrSettingsWarning({ argsStr, solrUrlSvc }) {
  const condensed = useMemo(() => condenseWarnings(argsStr, solrUrlSvc), [argsStr, solrUrlSvc]);
  const warningKeys = Object.keys(condensed);
  if (warningKeys.length === 0) return null;

  // Mirror the original template exactly: one <ul> per warning-key, each
  // holding a single <li> that interpolates the removed arguments inline.
  // Odd shape, preserved as-is for visual parity.
  return (
    <div class="alert alert-warning" data-role="solr-settings-warning">
      {warningKeys.map((warning) => (
        <ul key={warning}>
          <li>
            Arguments Removed:
            {condensed[warning].map((argument) => (
              <span key={argument}>
                {' '}
                <em>{argument} </em>
              </span>
            ))}
            {' '}because: {warning}
          </li>
        </ul>
      ))}
    </div>
  );
}

export function mount(rootEl, props) {
  if (!rootEl) throw new Error('solrSettingsWarning island: rootEl is required');
  render(<SolrSettingsWarning argsStr={props.argsStr} solrUrlSvc={props.solrUrlSvc} />, rootEl);
}

export function unmount(rootEl) {
  render(null, rootEl);
}

if (typeof globalThis !== 'undefined') {
  globalThis.SplainerIslands = globalThis.SplainerIslands || {};
  globalThis.SplainerIslands.solrSettingsWarning = { mount, unmount };
}
