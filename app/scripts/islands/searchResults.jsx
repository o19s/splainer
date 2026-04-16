/**
 * searchResults island — renders search states, doc rows, query details,
 * and pagination.
 *
 * List keys use `docRowListKey` (docListKeys.js) plus a per-search epoch when `doc.id` is
 * empty, matching Angular ng-repeat tolerance for missing ids.
 *
 * Props: currSearch, explainOther, solrUrlSvc, onPage.
 */
import { render } from 'preact';
import { useState, useRef } from 'preact/hooks';

import { DocRow } from './docRow.jsx';
import { docRowListKey } from './docListKeys.js';

import { SolrSettingsWarning } from './solrSettingsWarning.jsx';
import { openDocModal } from './modalRegistry.js';
import { JsonTree } from './jsonTree.jsx';

function currentArgsStr(currSearch) {
  try {
    return currSearch.settings.searchArgsStr();
  } catch (_e) {
    return '';
  }
}

function JsonDetailLink({ label, onToggle }) {
  return (
    <a href="" onClick={(e) => { e.preventDefault(); onToggle(); }}>{label}</a>
  );
}

/** Bordered panel for Solr query / parsed-query JSON; styles in `main.css` (`.query-json-panel`). */
function JsonDetailData({ data, show }) {
  if (!show) return null;
  return (
    <div class="query-json-panel" data-role="json-detail-json">
      <JsonTree value={data} maxHeight="400px" />
    </div>
  );
}

export function SearchResults({ currSearch, explainOther, solrUrlSvc, onPage }) {
  const [showQueryDetails, setShowQueryDetails] = useState(false);
  const [showParsedQueryDetails, setShowParsedQueryDetails] = useState(false);

  // Reset toggle state when a new search starts, matching the original
  // SearchResultsCtrl which set both to false in search() and reset().
  // Detect via searcher identity — a new reference means a new search.
  const prevSearcherRef = useRef(null);
  const listEpochRef = useRef(0);
  const currentSearcher = currSearch && currSearch.searcher;
  if (currentSearcher !== prevSearcherRef.current) {
    prevSearcherRef.current = currentSearcher;
    if (currSearch.state === currSearch.DID_SEARCH && currentSearcher) {
      listEpochRef.current += 1;
    }
    if (showQueryDetails) setShowQueryDetails(false);
    if (showParsedQueryDetails) setShowParsedQueryDetails(false);
  }

  if (!currSearch) return null;

  // --- WAITING_FOR_SEARCH ---
  if (currSearch.state === currSearch.WAITING_FOR_SEARCH) {
    return (
      <div style={{ textAlign: 'center' }}>
        <img src="images/ajax-loader.gif" />
      </div>
    );
  }

  // --- IN_ERROR ---
  if (currSearch.state === currSearch.IN_ERROR) {
    return (
      <div class="alert alert-error">
        Error with your query. Double check that the URL is correct.
        {currSearch.engine === 'solr' && (
          <div>
            Try accessing{' '}
            <a target="_blank" rel="noopener" href={currSearch.linkUrl}>Solr</a>{' '}
            to troubleshoot the error.
          </div>
        )}
        {currSearch.errorMsg && currSearch.errorMsg.length > 0 && (
          <pre>{currSearch.errorMsg}</pre>
        )}
      </div>
    );
  }

  // --- DID_SEARCH ---
  if (currSearch.state !== currSearch.DID_SEARCH) return null;

  function makeDocCallbacks(doc) {
    return {
      onShowDoc: (d) => {
        openDocModal('detailedDoc', d, {});
      },
      onShowDetailed: () => {
        openDocModal('detailedExplain', doc, {
          canExplainOther: true,
          explainOther: explainOther,
          maxScore: currSearch.maxScore,
        });
      },
    };
  }

  return (
    <div>
      <SolrSettingsWarning argsStr={currentArgsStr(currSearch)} solrUrlSvc={solrUrlSvc} />

      <small>
        {currSearch.linkUrl && currSearch.linkUrl.length > 0 ? (
          <a href={currSearch.linkUrl} target="_blank" rel="noopener">
            {currSearch.numFound} Total Results
          </a>
        ) : (
          <span> {currSearch.numFound} Total Results </span>
        )}
      </small>

      {currSearch.engine === 'solr' && (
        <span>
          {' | '}
          <small>
            <JsonDetailLink
              label="Query Details"
              onToggle={() => setShowQueryDetails((v) => !v)}
            />
          </small>
        </span>
      )}
      {' | '}
      <small>
        <JsonDetailLink
          label="Parsed Query Details"
          onToggle={() => setShowParsedQueryDetails((v) => !v)}
        />
      </small>

      <JsonDetailData
        data={currSearch.searcher && currSearch.searcher.queryDetails}
        show={showQueryDetails}
      />
      <JsonDetailData
        data={currSearch.searcher && currSearch.searcher.parsedQueryDetails}
        show={showParsedQueryDetails}
      />

      <hr style={{ marginTop: '5px' }} />

      {!currSearch.hasGroup() &&
        currSearch.docs.map((doc, rowIndex) => {
          const cbs = makeDocCallbacks(doc);
          return (
            <div key={docRowListKey(doc, rowIndex, listEpochRef.current)}>
              <DocRow
                doc={doc}
                maxScore={currSearch.maxScore}
                onShowDoc={cbs.onShowDoc}
                onShowDetailed={cbs.onShowDetailed}
              />
              <hr />
            </div>
          );
        })}

      {currSearch.hasGroup() &&
        Object.entries(currSearch.grouped).map(([group, groupedBy]) => (
          <div class="grouped" key={group}>
            <h4>Grouped by: {group}</h4>
            {groupedBy.map((grouped) => (
              <div key={`${group}-${grouped.value}`}>
                <h4 style={{ marginLeft: '10px' }} title={`Group: ${group}, ${grouped.value}`}>
                  Value: <em>{grouped.value}</em>
                </h4>
                {grouped.docs.map((doc, gi) => {
                  const cbs = makeDocCallbacks(doc);
                  return (
                    <DocRow
                      key={docRowListKey(doc, gi, listEpochRef.current)}
                      doc={doc}
                      maxScore={currSearch.maxScore}
                      onShowDoc={cbs.onShowDoc}
                      onShowDetailed={cbs.onShowDetailed}
                    />
                  );
                })}
                <hr />
              </div>
            ))}
          </div>
        ))}

      <div class="row">
        {!currSearch.paging && currSearch.moreResults() && (
          <div id="pager" class="col-md-2 col-md-offset-5">
            <a
              href=""
              onClick={(e) => {
                e.preventDefault();
                if (onPage) onPage();
              }}
            >
              Show More Results
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export function mount(rootEl, props) {
  if (!rootEl) throw new Error('searchResults island: rootEl is required');
  render(
    <SearchResults
      currSearch={props.currSearch}
      explainOther={props.explainOther}
      solrUrlSvc={props.solrUrlSvc}
      onPage={props.onPage}
    />,
    rootEl,
  );
}

export function unmount(rootEl) {
  render(null, rootEl);
}
