'use strict';

// Unit test for the docRow Angular directive shim. Covers the shim's
// modal openers (openDocModal), $watch lifecycle, and destroy hook.
// The Preact island is covered by Vitest; the modal-open path is
// covered end-to-end by the Playwright suite.
describe('docRow directive', function () {
  var $compile = null;
  var $rootScope = null;
  var $q = null;
  var settingsStoreSvc = null;
  var savedIslandsGlobal = null;
  var mountCalls = null;
  var unmountCalls = null;
  var capturedProps = null;

  beforeEach(module('splain-app'));

  beforeEach(function () {
    // Stub the SplainerIslands global so the shim's link function finds
    // a usable island without loading the Preact bundle.
    savedIslandsGlobal = window.SplainerIslands;
    mountCalls = [];
    unmountCalls = [];
    capturedProps = null;
    window.SplainerIslands = {
      docRow: {
        mount: function (rootEl, doc, props) {
          mountCalls.push({ rootEl: rootEl, doc: doc });
          capturedProps = props;
        },
        unmount: function (rootEl) {
          unmountCalls.push(rootEl);
        },
      },
      openDocModal: jasmine.createSpy('openDocModal').and.returnValue({ close: function () {} }),
    };
  });

  afterEach(function () {
    window.SplainerIslands = savedIslandsGlobal;
  });

  beforeEach(module(function ($provide) {
    // Stub splainer-search services for the explainOther closure.
    // The closure itself is tested end-to-end by the Playwright
    // "altQuery reaches the backend on the wire" test; unit-level
    // coverage here just verifies openDetailed passes a callable
    // explainOther through to openDocModal.
    $provide.value('searchSvc', {
      createSearcher: function () {
        return {
          type: 'solr',
          docs: [],
          othersExplained: {},
          explainOther: function () {
            return { then: function (cb) { cb(); return { then: function () {} }; } };
          },
        };
      },
    });
    $provide.value('solrUrlSvc', { parseSolrArgs: function () { return {}; } });
    $provide.value('fieldSpecSvc', { createFieldSpec: function () { return {}; } });
    $provide.value('solrExplainExtractorSvc', { docsWithExplainOther: function () { return []; } });
    $provide.value('esExplainExtractorSvc', { docsWithExplainOther: function () { return []; } });
  }));

  beforeEach(inject(function (
    _$compile_,
    _$rootScope_,
    _$q_,
    _settingsStoreSvc_,
  ) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    $q = _$q_;
    settingsStoreSvc = _settingsStoreSvc_;
  }));

  // Minimal doc — the shim passes it through to the island stub without
  // calling any splainer-search doc methods directly.
  function makeDoc(overrides) {
    return Object.assign(
      {
        id: 'doc-1',
      },
      overrides || {},
    );
  }

  function compileDirective(parentScope) {
    var scope = parentScope || $rootScope.$new();
    scope.doc = scope.doc || makeDoc();
    scope.maxScore = scope.maxScore || 1;
    var el = angular.element('<doc-row doc="doc" max-score="maxScore"></doc-row>');
    $compile(el)(scope);
    scope.$digest();
    return { el: el, scope: scope };
  }

  // ─── Mount + island wiring ──────────────────────────────────────────────

  it('mounts the island on first link', function () {
    compileDirective();
    expect(mountCalls.length).toBeGreaterThan(0);
    var first = mountCalls[0];
    expect(first.doc).toBeDefined();
    expect(first.doc.id).toBe('doc-1');
  });

  it('passes maxScore, onShowDoc, and onShowDetailed to the island', function () {
    compileDirective();
    expect(capturedProps).not.toBeNull();
    expect(capturedProps.maxScore).toBe(1);
    expect(typeof capturedProps.onShowDoc).toBe('function');
    expect(typeof capturedProps.onShowDetailed).toBe('function');
  });

  // ─── Modal openers ──────────────────────────────────────────────────────

  it('onShowDetailed opens the explain modal via openDocModal', function () {
    settingsStoreSvc.settings.whichEngine = 'solr';

    compileDirective();
    capturedProps.onShowDetailed();

    expect(window.SplainerIslands.openDocModal).toHaveBeenCalled();
    var args = window.SplainerIslands.openDocModal.calls.mostRecent().args;
    expect(args[0]).toBe('detailedExplain');
    expect(args[2].canExplainOther).toBe(true);
    expect(typeof args[2].explainOther).toBe('function');
    expect(args[2].maxScore).toBe(1);
  });

  it('canExplainOther is false for an unsupported engine', function () {
    settingsStoreSvc.settings.whichEngine = 'something-weird';

    compileDirective();
    capturedProps.onShowDetailed();
    var args = window.SplainerIslands.openDocModal.calls.mostRecent().args;
    expect(args[2].canExplainOther).toBe(false);
  });

  it('canExplainOther is true for es and os', function () {
    settingsStoreSvc.settings.whichEngine = 'es';
    compileDirective($rootScope.$new());
    capturedProps.onShowDetailed();
    expect(
      window.SplainerIslands.openDocModal.calls.mostRecent().args[2].canExplainOther,
    ).toBe(true);

    settingsStoreSvc.settings.whichEngine = 'os';
    compileDirective($rootScope.$new());
    capturedProps.onShowDetailed();
    expect(
      window.SplainerIslands.openDocModal.calls.mostRecent().args[2].canExplainOther,
    ).toBe(true);
  });

  it('onShowDoc opens the show-doc modal via the modal registry', function () {
    var compiled = compileDirective();
    var clickedDoc = compiled.scope.doc;
    capturedProps.onShowDoc(clickedDoc);

    expect(window.SplainerIslands.openDocModal).toHaveBeenCalled();
    var args = window.SplainerIslands.openDocModal.calls.mostRecent().args;
    expect(args[0]).toBe('detailedDoc');
    expect(args[1]).toBe(clickedDoc);
  });

  // ─── Destroy hook ───────────────────────────────────────────────────────

  it('unmounts the island on scope destroy', function () {
    var compiled = compileDirective();
    expect(unmountCalls.length).toBe(0);
    compiled.scope.$destroy();
    expect(unmountCalls.length).toBe(1);
  });
});
