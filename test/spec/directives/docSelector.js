'use strict';

// Unit test for the docSelector Angular directive shim
// (app/scripts/directives/docSelector.js). The shim is where PR 8 relocated
// the entire body of the old DocSelectorCtrl.explainOther — searcher
// construction, engine-specific arg parsing, extractor dispatch, maxScore
// ratcheting. The Preact island itself is covered by Vitest in
// app/scripts/islands/docSelector.spec.js, and there is no Playwright test
// for this flow yet, so this spec is the only unit coverage of the shim's
// Angular-service wiring. Without it, a typo in the engine branch or a
// missing $apply would ship silently.
describe('docSelector directive', function () {
  var $compile = null;
  var $rootScope = null;
  var searchSvc = null;
  var fieldSpecSvc = null;
  var solrUrlSvc = null;
  var settingsStoreSvc = null;
  var solrExplainExtractorSvc = null;
  var esExplainExtractorSvc = null;
  var savedIslandsGlobal = null;
  var mountCalls = null;
  var capturedOnExplainOther = null;

  beforeEach(module('splain-app'));

  beforeEach(function () {
    // Stub the SplainerIslands global so the directive's link function
    // finds a usable island without loading the Preact bundle. The mount
    // stub captures the onExplainOther callback so the test can invoke it
    // directly, which is the whole point — we want to exercise the shim's
    // relocated explainOther body, not Preact rendering.
    savedIslandsGlobal = window.SplainerIslands;
    mountCalls = [];
    capturedOnExplainOther = null;
    window.SplainerIslands = {
      docSelector: {
        mount: function (rootEl, props, callbacks) {
          mountCalls.push({ rootEl: rootEl, props: props });
          capturedOnExplainOther = callbacks.onExplainOther;
        },
        unmount: function () {},
      },
    };
  });

  afterEach(function () {
    window.SplainerIslands = savedIslandsGlobal;
  });

  // Override the <doc-row> directive with a no-op stub. Our fake searcher
  // docs are minimal (id + score), and the real DocRowCtrl would explode
  // on doc.getHighlightedTitle(), doc.subSnippets(), etc. Duck-typing the
  // fakes would balloon the test. The thing under test is the shim, not
  // the child directive.
  //
  // WARNING FOR PR 9+ SPECS COPYING THIS: `terminal: true` at priority
  // 10000 short-circuits compilation of every other directive on the
  // element, *including ng-click*. This spec never exercises the ng-click
  // path on <doc-row>; it calls iso.selectDoc(...) directly. If a future
  // spec needs ng-click on the stub to actually fire, drop `terminal: true`
  // (or lower the priority) — otherwise you'll lose an hour wondering why
  // the click handler isn't running.
  beforeEach(module(function ($compileProvider) {
    $compileProvider.directive('docRow', function () {
      return {
        priority: 10000,
        terminal: true,
        restrict: 'E',
        template: '<div data-test-stub-doc-row></div>',
        scope: {},
      };
    });
  }));

  beforeEach(inject(function (
    _$compile_,
    _$rootScope_,
    _searchSvc_,
    _fieldSpecSvc_,
    _solrUrlSvc_,
    _settingsStoreSvc_,
    _solrExplainExtractorSvc_,
    _esExplainExtractorSvc_,
  ) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    searchSvc = _searchSvc_;
    fieldSpecSvc = _fieldSpecSvc_;
    solrUrlSvc = _solrUrlSvc_;
    settingsStoreSvc = _settingsStoreSvc_;
    solrExplainExtractorSvc = _solrExplainExtractorSvc_;
    esExplainExtractorSvc = _esExplainExtractorSvc_;
  }));

  function fakeSearcher(type, docs) {
    // Use a native Promise (not $q) so resolution runs as a microtask
    // outside Angular's digest — matching production, where splainer-search
    // 3.0.0 uses native fetch and its promises resolve outside the digest
    // the shim wraps its writes in $apply for. A $q deferred would resolve
    // synchronously during the test's $apply and collide with the shim's
    // nested scope.$apply inside the .then callback.
    var searcher = {
      type: type,
      docs: docs || [],
      numFound: (docs || []).length,
      othersExplained: {},
    };
    searcher.explainOther = function () {
      return new Promise(function (resolve, reject) {
        searcher._resolve = resolve;
        searcher._reject = reject;
      });
    };
    return searcher;
  }

  // Jasmine's async wait for native-Promise microtasks to drain AND the
  // shim's follow-up scope.$apply to flush. A single setTimeout(0) is
  // enough for both in Chrome Headless.
  function drainMicrotasks(done) {
    setTimeout(done, 0);
  }

  function compileDirective() {
    var scope = $rootScope.$new();
    scope.altDoc = null;
    var el = angular.element('<doc-selector doc-selection="altDoc"></doc-selector>');
    $compile(el)(scope);
    scope.$digest();
    return { el: el, scope: scope };
  }

  it('mounts the island and initializes currSearch on the isolate scope', function () {
    var compiled = compileDirective();
    expect(mountCalls.length).toBeGreaterThan(0);
    // currSearch lives on the directive's isolate scope (not the parent)
    // so the legacy ng-repeat template still works. isolateScope() is the
    // ngMock idiom for reaching into it.
    var iso = compiled.el.isolateScope();
    expect(iso.currSearch).toBeDefined();
    expect(iso.currSearch.maxScore).toBe(0);
    expect(typeof iso.selectDoc).toBe('function');
  });

  it('selectDoc writes through the docSelection two-way binding', function () {
    var compiled = compileDirective();
    var iso = compiled.el.isolateScope();
    iso.selectDoc({ id: 'doc-42' });
    compiled.scope.$digest();
    expect(compiled.scope.altDoc).toEqual({ id: 'doc-42' });
  });

  it('onExplainOther (solr): parses args, calls extractor, writes currSearch.docs', function (done) {
    settingsStoreSvc.settings.whichEngine = 'solr';
    settingsStoreSvc.settings.solr.searchUrl = 'http://solr.test/c/select';
    settingsStoreSvc.settings.solr.searchArgsStr = 'q=*:*&fq=type:book';
    settingsStoreSvc.settings.solr.fieldSpecStr = 'id title';

    var searcher = fakeSearcher('solr', [
      { id: 'd1', score: function () { return 1.5; } },
      { id: 'd2', score: function () { return 0.7; } },
    ]);
    spyOn(searchSvc, 'createSearcher').and.returnValue(searcher);
    spyOn(fieldSpecSvc, 'createFieldSpec').and.callThrough();
    spyOn(solrUrlSvc, 'parseSolrArgs').and.callThrough();
    spyOn(solrExplainExtractorSvc, 'docsWithExplainOther').and.returnValue(searcher.docs);

    var compiled = compileDirective();
    var iso = compiled.el.isolateScope();

    capturedOnExplainOther('title:foo');
    searcher._resolve();
    drainMicrotasks(function () {
      // Guard against the "passed settings.fieldSpecStr instead of
      // settings.fieldSpecStr()" bug class PR 5 warned about: the argument
      // must be the *string* "id title", not the getter function itself.
      expect(fieldSpecSvc.createFieldSpec).toHaveBeenCalledWith('id title');
      expect(solrUrlSvc.parseSolrArgs).toHaveBeenCalledWith('q=*:*&fq=type:book');
      expect(solrExplainExtractorSvc.docsWithExplainOther).toHaveBeenCalled();
      expect(iso.currSearch.docs.length).toBe(2);
      expect(iso.currSearch.lastQuery).toBe('title:foo');
      expect(iso.currSearch.maxScore).toBe(1.5);
      done();
    });
  });

  it('onExplainOther (es): parses JSON args and uses the ES extractor', function (done) {
    settingsStoreSvc.settings.whichEngine = 'es';
    settingsStoreSvc.settings.es.searchUrl = 'http://es.test/_search';
    settingsStoreSvc.settings.es.searchArgsStr = '{"query":{"match_all":{}}}';
    settingsStoreSvc.settings.es.fieldSpecStr = 'title';

    var searcher = fakeSearcher('es', [{ id: 'e1', score: function () { return 2.3; } }]);
    spyOn(searchSvc, 'createSearcher').and.returnValue(searcher);
    spyOn(esExplainExtractorSvc, 'docsWithExplainOther').and.returnValue(searcher.docs);
    spyOn(solrExplainExtractorSvc, 'docsWithExplainOther');

    var compiled = compileDirective();
    var iso = compiled.el.isolateScope();

    capturedOnExplainOther('foo');
    searcher._resolve();
    drainMicrotasks(function () {
      expect(esExplainExtractorSvc.docsWithExplainOther).toHaveBeenCalled();
      expect(solrExplainExtractorSvc.docsWithExplainOther).not.toHaveBeenCalled();
      expect(iso.currSearch.docs.length).toBe(1);
      expect(iso.currSearch.maxScore).toBe(2.3);
      done();
    });
  });

  it('onExplainOther (os): routes through the ES extractor (os reuses es)', function (done) {
    settingsStoreSvc.settings.whichEngine = 'os';
    settingsStoreSvc.settings.os.searchUrl = 'http://os.test/_search';
    settingsStoreSvc.settings.os.searchArgsStr = '{"query":{"match_all":{}}}';
    settingsStoreSvc.settings.os.fieldSpecStr = 'title';

    var searcher = fakeSearcher('os', [{ id: 'o1', score: function () { return 1.0; } }]);
    spyOn(searchSvc, 'createSearcher').and.returnValue(searcher);
    spyOn(esExplainExtractorSvc, 'docsWithExplainOther').and.returnValue(searcher.docs);

    compileDirective();
    capturedOnExplainOther('foo');
    searcher._resolve();
    drainMicrotasks(function () {
      expect(esExplainExtractorSvc.docsWithExplainOther).toHaveBeenCalled();
      done();
    });
  });

  it('resets currSearch.docs before the request fires', function () {
    settingsStoreSvc.settings.whichEngine = 'solr';
    var searcher = fakeSearcher('solr', []);
    spyOn(searchSvc, 'createSearcher').and.returnValue(searcher);

    var compiled = compileDirective();
    var iso = compiled.el.isolateScope();
    iso.currSearch.docs = ['stale1', 'stale2'];

    // The shim's reset is wrapped in scope.$apply and runs *synchronously*
    // inside onExplainOther (before the searcher promise is even returned).
    // So by the time capturedOnExplainOther returns, the reset is already
    // visible on the isolate scope — no extra digest needed here.
    //
    // Intentional: we assert the pre-request reset and deliberately leave
    // the searcher promise unresolved. Native Promises don't need explicit
    // cleanup; the pending promise is GC'd with the searcher.
    capturedOnExplainOther('anything');
    expect(iso.currSearch.docs).toEqual([]);
  });

  it('does not $apply on a destroyed scope when the searcher resolves late', function (done) {
    // Simulates the modal-close-mid-request race: directive is destroyed
    // after the request goes out but before the response comes back.
    // Without the scope.$$destroyed guard in the shim, the follow-up
    // scope.$apply throws and the pageerror spy in the Playwright suite
    // fires on every subsequent test. This is the regression gate.
    settingsStoreSvc.settings.whichEngine = 'solr';
    var searcher = fakeSearcher('solr', [{ id: 'late', score: function () { return 1; } }]);
    spyOn(searchSvc, 'createSearcher').and.returnValue(searcher);
    spyOn(solrExplainExtractorSvc, 'docsWithExplainOther').and.returnValue(searcher.docs);

    var compiled = compileDirective();
    capturedOnExplainOther('anything');
    // Destroy the directive scope while the request is in flight.
    compiled.scope.$destroy();
    // Now resolve. The .then should early-return via the $$destroyed guard
    // and not throw.
    searcher._resolve();
    drainMicrotasks(function () {
      // If we got here without an unhandled exception, the guard worked.
      // The extractor should never have been called (guard returned early).
      expect(solrExplainExtractorSvc.docsWithExplainOther).not.toHaveBeenCalled();
      done();
    });
  });

  it('onExplainOther rejects when the searcher rejects — propagates to the island', function (done) {
    settingsStoreSvc.settings.whichEngine = 'solr';
    var searcher = fakeSearcher('solr', []);
    spyOn(searchSvc, 'createSearcher').and.returnValue(searcher);

    compileDirective();
    var outcome = { rejected: false, message: null };
    capturedOnExplainOther('anything').then(
      function () {},
      function (err) {
        outcome.rejected = true;
        outcome.message = err && err.message;
      },
    );
    searcher._reject(new Error('backend boom'));
    drainMicrotasks(function () {
      expect(outcome.rejected).toBe(true);
      expect(outcome.message).toBe('backend boom');
      done();
    });
  });
});
