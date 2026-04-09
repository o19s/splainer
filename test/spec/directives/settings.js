'use strict';

// Unit test for the settingsIsland Angular directive shim
// (app/scripts/directives/settings.js). The shim is the only piece of code
// that still knows about Angular DI in the PR 7+ settings flow; the Preact
// island itself has no Angular knowledge and is covered by Vitest in
// app/scripts/islands/settings.spec.js. The e2e merge-gate test exercises
// only the ES branch end-to-end, so without this unit test the solr and os
// branches of onPublish would go uncovered — a typo in the `else if` chain
// at directives/settings.js:56-62 would ship silently.
describe('settingsIsland directive', function () {
  var $compile = null;
  var $rootScope = null;
  var settingsStoreSvc = null;
  var solrSettingsSvc = null;
  var esSettingsSvc = null;
  var osSettingsSvc = null;
  var savedIslandsGlobal = null;
  var mountCalls = null;
  var capturedOnPublish = null;

  beforeEach(module('splain-app'));

  beforeEach(function () {
    // Stub the SplainerIslands global so the directive's link function
    // finds a usable island without loading the real Preact bundle. The
    // mount() stub captures the onPublish callback so the test can invoke
    // it directly, which is the whole point of the test — we want to
    // exercise the shim's dispatch, not Preact.
    savedIslandsGlobal = window.SplainerIslands;
    mountCalls = [];
    capturedOnPublish = null;
    window.SplainerIslands = {
      settings: {
        mount: function (rootEl, props, onPublish) {
          mountCalls.push({ rootEl: rootEl, props: props });
          capturedOnPublish = onPublish;
        },
        unmount: function () {},
      },
    };
  });

  afterEach(function () {
    window.SplainerIslands = savedIslandsGlobal;
  });

  beforeEach(inject(function (
    _$compile_,
    _$rootScope_,
    _settingsStoreSvc_,
    _solrSettingsSvc_,
    _esSettingsSvc_,
    _osSettingsSvc_,
  ) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    settingsStoreSvc = _settingsStoreSvc_;
    solrSettingsSvc = _solrSettingsSvc_;
    esSettingsSvc = _esSettingsSvc_;
    osSettingsSvc = _osSettingsSvc_;

    spyOn(solrSettingsSvc, 'fromTweakedSettings');
    spyOn(esSettingsSvc, 'fromTweakedSettings');
    spyOn(osSettingsSvc, 'fromTweakedSettings');
    spyOn(settingsStoreSvc, 'save');
  }));

  function compileDirective() {
    var scope = $rootScope.$new();
    scope.currSearch = { searcher: null };
    scope.search = {
      search: function () {
        return {
          then: function (cb) {
            cb();
            return { then: function () {} };
          },
        };
      },
    };
    var el = angular.element(
      '<settings-island curr-search="currSearch" search="search"></settings-island>',
    );
    $compile(el)(scope);
    scope.$digest();
    return { el: el, scope: scope };
  }

  it('mounts the island with the store settings and currSearch', function () {
    // Mutate the store BEFORE compiling so the assertion proves the shim
    // reads from settingsStoreSvc rather than just echoing whatever object
    // the test handed it. (An earlier version asserted `props.settings ===
    // settingsStoreSvc.settings` which was a tautology: the stub captures
    // props by reference, so the identity check held regardless of source.)
    settingsStoreSvc.settings.whichEngine = 'es';
    settingsStoreSvc.settings.es.searchUrl = 'http://es.test/mounted_from_store';
    compileDirective();
    expect(mountCalls.length).toBeGreaterThan(0);
    var lastProps = mountCalls[mountCalls.length - 1].props;
    expect(lastProps.settings.whichEngine).toBe('es');
    expect(lastProps.settings.es.searchUrl).toBe('http://es.test/mounted_from_store');
    expect(lastProps.currSearch).toBeDefined();
  });

  it('onPublish(solr, workingSettings) dispatches to solrSettingsSvc only', function () {
    compileDirective();
    var working = { searchUrl: 'http://solr.test/select' };
    capturedOnPublish('solr', working);
    expect(settingsStoreSvc.settings.whichEngine).toBe('solr');
    expect(solrSettingsSvc.fromTweakedSettings).toHaveBeenCalledWith(working);
    expect(esSettingsSvc.fromTweakedSettings).not.toHaveBeenCalled();
    expect(osSettingsSvc.fromTweakedSettings).not.toHaveBeenCalled();
    expect(settingsStoreSvc.save).toHaveBeenCalled();
  });

  it('onPublish(es, workingSettings) dispatches to esSettingsSvc only', function () {
    compileDirective();
    var working = { searchUrl: 'http://es.test/_search' };
    capturedOnPublish('es', working);
    expect(settingsStoreSvc.settings.whichEngine).toBe('es');
    expect(esSettingsSvc.fromTweakedSettings).toHaveBeenCalledWith(working);
    expect(solrSettingsSvc.fromTweakedSettings).not.toHaveBeenCalled();
    expect(osSettingsSvc.fromTweakedSettings).not.toHaveBeenCalled();
    expect(settingsStoreSvc.save).toHaveBeenCalled();
  });

  it('onPublish(os, workingSettings) dispatches to osSettingsSvc only', function () {
    compileDirective();
    var working = { searchUrl: 'http://os.test/_search' };
    capturedOnPublish('os', working);
    expect(settingsStoreSvc.settings.whichEngine).toBe('os');
    expect(osSettingsSvc.fromTweakedSettings).toHaveBeenCalledWith(working);
    expect(solrSettingsSvc.fromTweakedSettings).not.toHaveBeenCalled();
    expect(esSettingsSvc.fromTweakedSettings).not.toHaveBeenCalled();
    expect(settingsStoreSvc.save).toHaveBeenCalled();
  });

  // Intentionally NOT asserting that a leaf mutation of settingsStoreSvc.settings
  // triggers a re-render. The shim currently uses a deep $watch at
  // app/scripts/directives/settings.js:87-93 to catch nested changes, but that
  // path is O(N) in the settings tree on every digest — locking it in with a
  // test would make it harder to narrow the watch to specific leaves (or move
  // to an event-driven settingsStoreSvc.on('change', ...) model) in a later PR.
  // The correct invariant to test is "the island re-renders when the data it
  // reads changes", not "the shim uses a deep watch to accomplish that".
});
