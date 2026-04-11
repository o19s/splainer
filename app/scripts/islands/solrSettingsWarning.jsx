/**
 * solrSettingsWarning island — shows warnings for Solr args that
 * splainer-search's removeUnsupported() stripped from the query.
 *
 * Props: argsStr, solrUrlSvc.
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
