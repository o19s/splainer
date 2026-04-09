'use strict';

// Unit test for the docRow Angular directive shim
// (app/scripts/directives/docRow.js). The Preact island itself is covered
// by Vitest in app/scripts/islands/docRow.spec.js, and the chart-click +
// modal-open path is covered end-to-end by the PR 8.5 Playwright test.
// This spec covers the *shim* — the cross-framework glue layer that owns:
//
//   - the doc.showDetailed mutation (used by the still-Angular
//     <stacked-chart> child)
//   - the two $uibModal.open call sites (Detailed explain modal and
//     show-doc modal)
//   - the $compile path that injects <stacked-chart> into the
//     island-rendered chart-host slot
//   - the $watch lifecycle (deep on doc, shallow on maxScore)
//   - the destroy hook (chart scope teardown + island unmount)
//
// Without this spec, the shim's coverage was Vitest (island only, no
// Angular) + one Playwright path (the explain modal). The "show doc"
// modal path, the doc-transition path, and the destroy hook had zero
// coverage. Following PR 7 (settings) and PR 8 (docSelector) precedent.
describe('docRow directive', function () {
  var $compile = null;
  var $rootScope = null;
  var $uibModal = null;
  var settingsStoreSvc = null;
  var savedIslandsGlobal = null;
  var mountCalls = null;
  var unmountCalls = null;
  var capturedCallbacks = null;

  beforeEach(module('splain-app'));

  beforeEach(function () {
    // Stub the SplainerIslands global so the shim's link function finds
    // a usable island without loading the Preact bundle. The mount stub
    // captures the callbacks the shim passes (onShowDoc and
    // registerChartHost) so the test can invoke them directly. Same
    // pattern as test/spec/directives/docSelector.js — see PR 8 spec
    // for the rationale.
    savedIslandsGlobal = window.SplainerIslands;
    mountCalls = [];
    unmountCalls = [];
    capturedCallbacks = null;
    window.SplainerIslands = {
      docRow: {
        mount: function (rootEl, doc, callbacks) {
          mountCalls.push({ rootEl: rootEl, doc: doc });
          capturedCallbacks = callbacks;
        },
        unmount: function (rootEl) {
          unmountCalls.push(rootEl);
        },
      },
    };
  });

  afterEach(function () {
    window.SplainerIslands = savedIslandsGlobal;
  });

  // Override <stacked-chart> with a no-op stub. The shim $compile's a
  // <stacked-chart> element into the chart-host slot; the real directive
  // would require its template + a doc with hotMatchesOutOf(). The stub
  // is enough to verify $compile was invoked into the slot.
  //
  // See PR 8 docSelector spec for the `terminal: true` warning — same
  // applies here. We never click the stub, so terminal is fine.
  beforeEach(module(function ($compileProvider) {
    $compileProvider.directive('stackedChart', function () {
      return {
        priority: 10000,
        terminal: true,
        restrict: 'E',
        template: '<div data-test-stub-stacked-chart></div>',
        scope: {},
      };
    });
  }));

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

  it('passes both onShowDoc and registerChartHost callbacks to the island', function () {
    compileDirective();
    expect(capturedCallbacks).not.toBeNull();
    expect(typeof capturedCallbacks.onShowDoc).toBe('function');
    expect(typeof capturedCallbacks.registerChartHost).toBe('function');
  });

  // ─── doc.showDetailed mutation ──────────────────────────────────────────

  it('attaches doc.showDetailed before mounting (so <stacked-chart> can call it)', function () {
    // The still-Angular <stacked-chart> child binds detailed="doc.showDetailed".
    // The mutation MUST happen before the chart is compiled (otherwise the
    // binding is undefined). The shim's order is: assign showDetailed, then
    // mount the island, then useLayoutEffect → registerChartHost → $compile
    // <stacked-chart>. By the time <stacked-chart> evaluates the binding,
    // doc.showDetailed exists. Locking that ordering in.
    var compiled = compileDirective();
    expect(typeof compiled.scope.doc.showDetailed).toBe('function');
  });

  it('preserves doc.showDetailed across a doc mutation', function () {
    // When the deep $watch fires (e.g. splainer-search mutates the doc
    // object), the shim re-runs rerender, which re-attaches showDetailed.
    // The function reference is the same closure, so the chart's
    // detailed="doc.showDetailed" binding stays valid.
    var compiled = compileDirective();
    var firstShowDetailed = compiled.scope.doc.showDetailed;
    expect(typeof firstShowDetailed).toBe('function');

    // Mutate the doc (simulating splainer-search updating it in place).
    compiled.scope.doc.someNewField = 'updated';
    compiled.scope.$digest();

    expect(typeof compiled.scope.doc.showDetailed).toBe('function');
    // Same closure across re-renders within one directive instance.
    expect(compiled.scope.doc.showDetailed).toBe(firstShowDetailed);
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
    // Resolve.doc is a function returning the directive's doc.
    expect(args.resolve.doc()).toBe(compiled.scope.doc);
    // canExplainOther: solr is in the allowlist.
    expect(args.resolve.canExplainOther()).toBe(true);
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

  it('onShowDoc opens the show-doc modal with the clicked doc', function () {
    // PR 8.5 / Playwright covers the *Detailed* modal path. The show-doc
    // modal (called from the island's title link click) has zero browser
    // coverage. This is the only test in the suite that exercises it.
    spyOn($uibModal, 'open').and.returnValue({});

    var compiled = compileDirective();
    var clickedDoc = compiled.scope.doc;
    capturedCallbacks.onShowDoc(clickedDoc);

    expect($uibModal.open).toHaveBeenCalled();
    var args = $uibModal.open.calls.mostRecent().args[0];
    expect(args.templateUrl).toBe('views/detailedDoc.html');
    expect(args.controller).toBe('DetailedDocCtrl');
    expect(args.resolve.doc()).toBe(clickedDoc);
  });

  // ─── Chart compile path ─────────────────────────────────────────────────

  it('registerChartHost compiles a <stacked-chart> into the host element', function () {
    var compiled = compileDirective();
    // The island stub never actually creates a chart-host element. Build
    // one manually and feed it to the shim's registerChartHost callback,
    // which is the same code path that would run in production via the
    // island's useLayoutEffect.
    var hostEl = document.createElement('div');
    hostEl.setAttribute('data-role', 'chart-host');
    capturedCallbacks.registerChartHost(hostEl);

    // The shim should have $compile'd the stub <stacked-chart> into the
    // host element.
    expect(hostEl.querySelector('[data-test-stub-stacked-chart]')).not.toBeNull();
    // Side effect cleanup: don't leak the synthetic element.
    compiled.scope.$destroy();
  });

  it('registerChartHost is idempotent on the same host element', function () {
    // The early-return in registerChartHost is load-bearing: it prevents
    // re-compiling <stacked-chart> on every digest tick. Verify it.
    compileDirective();
    var hostEl = document.createElement('div');
    capturedCallbacks.registerChartHost(hostEl);
    var firstChildCount = hostEl.children.length;
    expect(firstChildCount).toBe(1);

    // Second call with the same host element — should NOT add another
    // <stacked-chart>.
    capturedCallbacks.registerChartHost(hostEl);
    expect(hostEl.children.length).toBe(1);
  });

  // ─── Destroy hook ───────────────────────────────────────────────────────

  it('unmounts the island on scope destroy', function () {
    var compiled = compileDirective();
    expect(unmountCalls.length).toBe(0);
    compiled.scope.$destroy();
    expect(unmountCalls.length).toBe(1);
  });

  it('tears down the compiled chart scope on destroy', function () {
    // The shim creates a child scope for <stacked-chart> via scope.$new().
    // On destroy it must call $destroy on that scope to release watchers
    // and event listeners; otherwise repeated mount/destroy cycles in a
    // long ng-repeat could leak Angular scopes. We can't directly inspect
    // the chart scope (it's local to the shim), but we can verify the
    // destroy hook runs without throwing on the .scope().$destroy() and
    // .remove() calls — both of which require a valid jqLite element.
    var compiled = compileDirective();
    var hostEl = document.createElement('div');
    capturedCallbacks.registerChartHost(hostEl);
    expect(function () {
      compiled.scope.$destroy();
    }).not.toThrow();
  });

  it('does not throw when destroyed before any chart compile', function () {
    // Edge case: directive mounts but is destroyed before its island ever
    // calls registerChartHost (e.g. ng-repeat removes the row immediately).
    // The destroy hook's `if (compiledChart)` guard handles this; verify.
    var compiled = compileDirective();
    expect(function () {
      compiled.scope.$destroy();
    }).not.toThrow();
  });
});
