'use strict';

// Unit test for the docRow Angular directive shim
// (app/scripts/directives/docRow.js). The Preact island itself is covered
// by Vitest in app/scripts/islands/docRow.spec.js, and the chart-click +
// modal-open path is covered end-to-end by the PR 8.5 Playwright test.
// This spec covers the *shim* — the cross-framework glue layer that owns:
//
//   - the doc.showDetailed mutation (preserved for the existing
//     Playwright tests that call it programmatically — removed in 9d)
//   - the two $uibModal.open call sites (Detailed explain modal and
//     show-doc modal — both move to native <dialog> in 9c/9d)
//   - the $watch lifecycle (deep on doc, shallow on maxScore)
//   - the destroy hook (island unmount)
//
// **PR 9b changes:** the chart-host plumbing tests from 9a are gone —
// the inversion bridge they validated no longer exists. <stacked-chart>
// is now a Preact island rendered directly inside the docRow island as
// a JSX child; there is no more $compile-into-host path to test. The
// shim no longer injects $compile and no longer has a registerChartHost
// callback.
describe('docRow directive', function () {
  var $compile = null;
  var $rootScope = null;
  var $uibModal = null;
  var settingsStoreSvc = null;
  var savedIslandsGlobal = null;
  var mountCalls = null;
  var unmountCalls = null;
  var capturedProps = null;

  beforeEach(module('splain-app'));

  beforeEach(function () {
    // Stub the SplainerIslands global so the shim's link function finds
    // a usable island without loading the Preact bundle. The mount stub
    // captures the props the shim passes (maxScore, onShowDoc,
    // onShowDetailed) so the test can invoke them directly. Same
    // pattern as test/spec/directives/docSelector.js — see PR 8 spec
    // for the rationale.
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
      // 9c: openShowDoc now routes through the modal registry instead of
      // $uibModal. Stub it the same way the docRow island stub is stubbed.
      openDocModal: jasmine.createSpy('openDocModal').and.returnValue({ close: function () {} }),
    };
  });

  afterEach(function () {
    window.SplainerIslands = savedIslandsGlobal;
  });

  beforeEach(inject(function (
    _$compile_,
    _$rootScope_,
    _$uibModal_,
    _settingsStoreSvc_,
  ) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    $uibModal = _$uibModal_;
    settingsStoreSvc = _settingsStoreSvc_;
  }));

  // Build a minimal doc that satisfies the shim. The shim only reads
  // doc.showDetailed (after assigning it) and passes the doc through to
  // the island stub. It doesn't call any of splainer-search's doc methods
  // directly — those run inside the Preact island, which is stubbed here.
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

  // ─── doc.showDetailed mutation (preserved until 9d) ─────────────────────

  it('attaches doc.showDetailed for programmatic test access', function () {
    // Existing Playwright tests call scope.doc.showDetailed() directly
    // to open the explain modal. Until 9d removes the doc-mutation
    // pattern entirely, the shim must continue attaching this handle.
    var compiled = compileDirective();
    expect(typeof compiled.scope.doc.showDetailed).toBe('function');
  });

  it('preserves doc.showDetailed across a doc mutation', function () {
    // When the deep $watch fires (e.g. splainer-search mutates the doc
    // object), the shim re-runs rerender, which re-attaches showDetailed.
    var compiled = compileDirective();
    var firstShowDetailed = compiled.scope.doc.showDetailed;
    expect(typeof firstShowDetailed).toBe('function');

    compiled.scope.doc.someNewField = 'updated';
    compiled.scope.$digest();

    expect(typeof compiled.scope.doc.showDetailed).toBe('function');
  });

  // ─── Modal openers ──────────────────────────────────────────────────────

  it('doc.showDetailed opens the explain modal with the correct resolve', function () {
    spyOn($uibModal, 'open').and.returnValue({});
    settingsStoreSvc.settings.whichEngine = 'solr';

    var compiled = compileDirective();
    compiled.scope.doc.showDetailed();

    expect($uibModal.open).toHaveBeenCalled();
    var args = $uibModal.open.calls.mostRecent().args[0];
    expect(args.templateUrl).toBe('views/detailedExplain.html');
    expect(args.controller).toBe('DocExplainCtrl');
    expect(args.size).toBe('lg');
    expect(args.resolve.doc()).toBe(compiled.scope.doc);
    expect(args.resolve.canExplainOther()).toBe(true);
  });

  it('onShowDetailed (the island prop) also opens the explain modal', function () {
    // The island calls props.onShowDetailed when the StackedChart
    // Detailed link is clicked. This is the post-9b call path; the
    // doc.showDetailed mutation above is the legacy path. Both must
    // open the same modal.
    spyOn($uibModal, 'open').and.returnValue({});
    settingsStoreSvc.settings.whichEngine = 'solr';

    compileDirective();
    capturedProps.onShowDetailed();

    expect($uibModal.open).toHaveBeenCalled();
    var args = $uibModal.open.calls.mostRecent().args[0];
    expect(args.templateUrl).toBe('views/detailedExplain.html');
  });

  it('canExplainOther returns false for an unsupported engine', function () {
    spyOn($uibModal, 'open').and.returnValue({});
    settingsStoreSvc.settings.whichEngine = 'something-weird';

    var compiled = compileDirective();
    compiled.scope.doc.showDetailed();
    var args = $uibModal.open.calls.mostRecent().args[0];
    expect(args.resolve.canExplainOther()).toBe(false);
  });

  it('canExplainOther returns true for es and os', function () {
    spyOn($uibModal, 'open').and.returnValue({});

    settingsStoreSvc.settings.whichEngine = 'es';
    var compiledEs = compileDirective($rootScope.$new());
    compiledEs.scope.doc.showDetailed();
    expect($uibModal.open.calls.mostRecent().args[0].resolve.canExplainOther()).toBe(true);

    settingsStoreSvc.settings.whichEngine = 'os';
    var compiledOs = compileDirective($rootScope.$new());
    compiledOs.scope.doc.showDetailed();
    expect($uibModal.open.calls.mostRecent().args[0].resolve.canExplainOther()).toBe(true);
  });

  it('onShowDoc opens the show-doc modal via the modal registry', function () {
    // PR 9c: the show-doc path no longer uses $uibModal. The shim calls
    // window.SplainerIslands.openDocModal('detailedDoc', doc, {}) which
    // mounts the Preact island into #splainer-modal-root. PR 8.5 /
    // Playwright still covers the Detailed (explain) modal path; the
    // show-doc modal's only direct coverage is this stub assertion plus
    // the existing Playwright test that asserts the dialog content.
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
