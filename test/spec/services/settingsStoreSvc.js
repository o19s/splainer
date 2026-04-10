'use strict';

/**
 * Karma integration tests for the settingsStoreSvc Angular wrapper.
 *
 * Phase 11c: the real logic is tested by Vitest (settingsStore.spec.js).
 * These tests verify that the Angular wrapper correctly delegates to the
 * globalThis.SplainerServices.settingsStore singleton, and that the
 * subscribe() method is exposed for directive shims.
 */
describe('Service: settingsStoreSvc (wrapper)', function () {
  beforeEach(module('splain-app'));

  var settingsStoreSvc;

  beforeEach(inject(function (_settingsStoreSvc_) {
    settingsStoreSvc = _settingsStoreSvc_;
  }));

  it('exposes settings from the global store', function () {
    expect(settingsStoreSvc.settings).toBeDefined();
    expect(settingsStoreSvc.settings).toBe(
      globalThis.SplainerServices.settingsStore.settings,
    );
  });

  it('exposes ENGINES constant', function () {
    expect(settingsStoreSvc.ENGINES).toBeDefined();
    expect(settingsStoreSvc.ENGINES.SOLR).toBe('solr');
    expect(settingsStoreSvc.ENGINES.ELASTICSEARCH).toBe('es');
    expect(settingsStoreSvc.ENGINES.OPENSEARCH).toBe('os');
  });

  it('exposes save() that delegates to the global store', function () {
    expect(typeof settingsStoreSvc.save).toBe('function');
    // save() should not throw
    settingsStoreSvc.save();
  });

  it('exposes subscribe() that returns an unsubscribe function', function () {
    expect(typeof settingsStoreSvc.subscribe).toBe('function');
    var unsub = settingsStoreSvc.subscribe(function () {});
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('settings has the expected shape (solr/es/os sub-objects)', function () {
    var s = settingsStoreSvc.settings;
    expect(s.solr).toBeDefined();
    expect(s.es).toBeDefined();
    expect(s.os).toBeDefined();
    expect(typeof s.whichEngine).toBe('string');
    expect(typeof s.searchUrl).toBe('function');
    expect(typeof s.fieldSpecStr).toBe('function');
    expect(typeof s.searchArgsStr).toBe('function');
  });

  it('subscribe callback fires when save() is called', function () {
    var calls = 0;
    var unsub = settingsStoreSvc.subscribe(function () {
      calls++;
    });
    settingsStoreSvc.save();
    expect(calls).toBe(1);
    unsub();
  });
});
