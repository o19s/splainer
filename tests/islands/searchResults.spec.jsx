// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';

// Mock modalRegistry before importing searchResults (which imports it).
vi.mock('@app/islands/modalRegistry.js', () => ({
  openDocModal: vi.fn(),
}));
import { openDocModal } from '@app/islands/modalRegistry.js';

import { SearchResults, mount, unmount } from '@app/islands/searchResults.jsx';
import { makeRoot as _makeRoot, makeSearchDoc } from '@test/factories.js';

const roots = [];
function makeRoot() {
  const el = _makeRoot();
  roots.push(el);
  return el;
}
afterEach(() => {
  roots.forEach((el) => {
    render(null, el);
    el.remove();
  });
  roots.length = 0;
});

// State constants matching splSearchSvc.states
const STATES = {
  NO_SEARCH: 0,
  DID_SEARCH: 1,
  WAITING_FOR_SEARCH: 2,
  IN_ERROR: 3,
};

function makeDoc(overrides = {}) {
  return makeSearchDoc(overrides);
}

function makeCurrSearch(overrides = {}) {
  const docs = overrides.docs || [makeDoc()];
  return {
    state: overrides.state ?? STATES.DID_SEARCH,
    NO_SEARCH: STATES.NO_SEARCH,
    DID_SEARCH: STATES.DID_SEARCH,
    WAITING_FOR_SEARCH: STATES.WAITING_FOR_SEARCH,
    IN_ERROR: STATES.IN_ERROR,
    docs: docs,
    grouped: overrides.grouped || {},
    hasGroup: () => Object.keys(overrides.grouped || {}).length > 0,
    maxScore: overrides.maxScore || 1.0,
    numFound: overrides.numFound ?? docs.length,
    linkUrl: overrides.linkUrl ?? 'http://fake-solr.test/select?q=*:*',
    errorMsg: overrides.errorMsg ?? '',
    engine: overrides.engine || 'solr',
    searcher: overrides.searcher || {
      queryDetails: { q: '*:*' },
      parsedQueryDetails: { parsedquery: 'MatchAllDocsQuery' },
    },
    settings: {
      searchArgsStr: () => 'q=*:*',
    },
    paging: overrides.paging ?? false,
    moreResults: () => overrides.moreResults ?? false,
    page: vi.fn(),
  };
}

// Stub solrUrlSvc with the methods SolrSettingsWarning calls
function makeSolrUrlSvc() {
  return {
    parseSolrArgs: vi.fn().mockReturnValue({}),
    removeUnsupported: vi.fn().mockReturnValue({}),
  };
}

// Reset the openDocModal mock between tests
beforeEach(() => {
  openDocModal.mockClear();
});

describe('SearchResults island', () => {
  it('renders nothing for null currSearch', () => {
    const root = makeRoot();
    render(<SearchResults currSearch={null} />, root);
    expect(root.innerHTML).toBe('');
  });

  it('renders nothing for NO_SEARCH state', () => {
    const root = makeRoot();
    const cs = makeCurrSearch({ state: STATES.NO_SEARCH });
    render(<SearchResults currSearch={cs} solrUrlSvc={makeSolrUrlSvc()} />, root);
    expect(root.innerHTML).toBe('');
  });

  it('renders loading spinner for WAITING_FOR_SEARCH', () => {
    const root = makeRoot();
    const cs = makeCurrSearch({ state: STATES.WAITING_FOR_SEARCH });
    render(<SearchResults currSearch={cs} />, root);
    expect(root.querySelector('img[src*="ajax-loader"]')).toBeTruthy();
  });

  it('renders error message for IN_ERROR state', () => {
    const root = makeRoot();
    const cs = makeCurrSearch({
      state: STATES.IN_ERROR,
      errorMsg: 'Connection refused',
      engine: 'solr',
    });
    render(<SearchResults currSearch={cs} />, root);
    expect(root.textContent).toContain('Error with your query');
    expect(root.textContent).toContain('Connection refused');
    expect(root.querySelector('a[href]').textContent).toContain('Solr');
  });

  it('renders error without Solr link for ES engine', () => {
    const root = makeRoot();
    const cs = makeCurrSearch({
      state: STATES.IN_ERROR,
      errorMsg: 'Bad request',
      engine: 'es',
    });
    render(<SearchResults currSearch={cs} />, root);
    expect(root.textContent).toContain('Error with your query');
    expect(root.querySelector('a[target="_blank"]')).toBeNull();
  });

  it('renders error alert without pre tag when errorMsg is empty', () => {
    const root = makeRoot();
    const cs = makeCurrSearch({ state: STATES.IN_ERROR, errorMsg: '' });
    render(<SearchResults currSearch={cs} />, root);
    expect(root.textContent).toContain('Error with your query');
    expect(root.querySelector('pre')).toBeNull();
  });

  it('doc title click calls openDocModal with correct arguments', async () => {
    const root = makeRoot();
    const doc = makeDoc({ id: 'modal-test', title: 'Test Doc' });
    const cs = makeCurrSearch({ docs: [doc] });
    const explainOther = vi.fn();
    render(
      <SearchResults currSearch={cs} solrUrlSvc={makeSolrUrlSvc()} explainOther={explainOther} />,
      root,
    );

    // Click the doc title link
    const titleLink = root.querySelector('[data-role="doc-row"] h4 a');
    titleLink.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(openDocModal).toHaveBeenCalledWith('detailedDoc', doc, {});
  });

  it('renders doc rows for DID_SEARCH state', () => {
    const root = makeRoot();
    const docs = [makeDoc({ id: 'd1', title: 'First' }), makeDoc({ id: 'd2', title: 'Second' })];
    const cs = makeCurrSearch({ docs, numFound: 2 });
    render(<SearchResults currSearch={cs} solrUrlSvc={makeSolrUrlSvc()} />, root);

    const docRows = root.querySelectorAll('[data-role="doc-row"]');
    expect(docRows.length).toBe(2);
    expect(root.textContent).toContain('2 Total Results');
  });

  it('renders total results as a link when linkUrl is present', () => {
    const root = makeRoot();
    const cs = makeCurrSearch({ linkUrl: 'http://example.com/select' });
    render(<SearchResults currSearch={cs} solrUrlSvc={makeSolrUrlSvc()} />, root);

    const link = root.querySelector('a[target="_blank"]');
    expect(link).toBeTruthy();
    expect(link.href).toContain('example.com');
    expect(link.textContent).toContain('Total Results');
  });

  it('renders total results as plain text when linkUrl is empty', () => {
    const root = makeRoot();
    const cs = makeCurrSearch({ linkUrl: '' });
    render(<SearchResults currSearch={cs} solrUrlSvc={makeSolrUrlSvc()} />, root);

    expect(root.textContent).toContain('Total Results');
    // No link wrapping the total results text
    const totalLink = [...root.querySelectorAll('a')].find((a) =>
      a.textContent.includes('Total Results'),
    );
    expect(totalLink).toBeFalsy();
  });

  it('shows Query Details link for Solr engine', () => {
    const root = makeRoot();
    const cs = makeCurrSearch({ engine: 'solr' });
    render(<SearchResults currSearch={cs} solrUrlSvc={makeSolrUrlSvc()} />, root);
    const links = [...root.querySelectorAll('a')].map((a) => a.textContent);
    expect(links).toContain('Query Details');
  });

  it('hides Query Details link for ES engine', () => {
    const root = makeRoot();
    const cs = makeCurrSearch({ engine: 'es' });
    render(<SearchResults currSearch={cs} solrUrlSvc={makeSolrUrlSvc()} />, root);
    // Parsed Query Details should still appear
    expect(root.textContent).toContain('Parsed Query Details');
    // But "Query Details" as a standalone link should not (it's the Solr-specific one)
    const links = [...root.querySelectorAll('a')].map((a) => a.textContent);
    expect(links).not.toContain('Query Details');
  });

  it('toggles query details on click', async () => {
    const root = makeRoot();
    const cs = makeCurrSearch({
      engine: 'solr',
      searcher: {
        queryDetails: { q: 'test_query' },
        parsedQueryDetails: {},
      },
    });
    render(<SearchResults currSearch={cs} solrUrlSvc={makeSolrUrlSvc()} />, root);

    // Initially no <pre>
    expect(root.querySelector('pre')).toBeNull();

    // Click "Query Details"
    const detailLink = [...root.querySelectorAll('a')].find(
      (a) => a.textContent === 'Query Details',
    );
    detailLink.click();
    await new Promise((r) => setTimeout(r, 0));

    const pre = root.querySelector('pre');
    expect(pre).toBeTruthy();
    expect(pre.textContent).toContain('test_query');
  });

  it('resets query details toggle when searcher changes', async () => {
    const root = makeRoot();
    const cs = makeCurrSearch({
      engine: 'solr',
      searcher: { queryDetails: { q: 'first' }, parsedQueryDetails: {} },
    });
    render(<SearchResults currSearch={cs} solrUrlSvc={makeSolrUrlSvc()} />, root);

    // Open query details
    const detailLink = [...root.querySelectorAll('a')].find(
      (a) => a.textContent === 'Query Details',
    );
    detailLink.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(root.querySelector('pre')).toBeTruthy();

    // Simulate a new search — new searcher reference
    const cs2 = makeCurrSearch({
      engine: 'solr',
      searcher: { queryDetails: { q: 'second' }, parsedQueryDetails: {} },
    });
    render(<SearchResults currSearch={cs2} solrUrlSvc={makeSolrUrlSvc()} />, root);
    await new Promise((r) => setTimeout(r, 0));

    // Query details should be collapsed again
    expect(root.querySelector('pre')).toBeNull();
  });

  it('renders grouped results when hasGroup is true', () => {
    const root = makeRoot();
    const groupDoc = makeDoc({ id: 'g1', title: 'Grouped Doc' });
    const cs = makeCurrSearch({
      docs: [],
      grouped: {
        category: [{ value: 'Action', docs: [groupDoc] }],
      },
    });
    render(<SearchResults currSearch={cs} solrUrlSvc={makeSolrUrlSvc()} />, root);

    expect(root.textContent).toContain('Grouped by: category');
    expect(root.textContent).toContain('Action');
    expect(root.querySelectorAll('[data-role="doc-row"]').length).toBe(1);
  });

  it('renders pagination when moreResults is true', () => {
    const root = makeRoot();
    const cs = makeCurrSearch({ moreResults: true });
    render(<SearchResults currSearch={cs} solrUrlSvc={makeSolrUrlSvc()} />, root);

    const pager = root.querySelector('#pager a');
    expect(pager).toBeTruthy();
    expect(pager.textContent).toContain('Show More Results');
  });

  it('hides pagination when paging is true', () => {
    const root = makeRoot();
    const cs = makeCurrSearch({ moreResults: true, paging: true });
    render(<SearchResults currSearch={cs} solrUrlSvc={makeSolrUrlSvc()} />, root);
    expect(root.querySelector('#pager')).toBeNull();
  });

  it('calls onPage when pagination link is clicked', async () => {
    const root = makeRoot();
    const onPage = vi.fn();
    const cs = makeCurrSearch({ moreResults: true });
    render(<SearchResults currSearch={cs} solrUrlSvc={makeSolrUrlSvc()} onPage={onPage} />, root);

    const pagerLink = root.querySelector('#pager a');
    expect(pagerLink).toBeTruthy();
    pagerLink.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(onPage).toHaveBeenCalledOnce();
  });

  it('mount/unmount lifecycle works', () => {
    const root = makeRoot();
    const cs = makeCurrSearch();
    mount(root, { currSearch: cs, solrUrlSvc: makeSolrUrlSvc() });
    expect(root.querySelectorAll('[data-role="doc-row"]').length).toBe(1);

    unmount(root);
    expect(root.innerHTML).toBe('');
  });
});
