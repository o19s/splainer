'use strict';

/**
 * Angular shim for the pure settingsStore module (settingsStore.js).
 *
 * Phase 11c: the real logic lives in globalThis.SplainerServices.settingsStore
 * (built from settingsStore.js by vite.islands.config.js). This file
 * registers the same API as an Angular service so existing directive
 * shims that inject 'settingsStoreSvc' keep working unchanged.
 *
 * Deleted in Phase 12 when the directive shims are removed.
 */
angular.module('splain-app').service('settingsStoreSvc', [
  function () {
    var store =
      globalThis.SplainerServices && globalThis.SplainerServices.settingsStore;
    if (!store) {
      throw new Error(
        'settingsStoreSvc: SplainerServices.settingsStore global is missing — ' +
          'check that scripts/services/dist/settingsStore.js is loaded before this script.',
      );
    }
    this.ENGINES = store.ENGINES;
    this.settings = store.settings;
    this.save = function () {
      store.save();
    };
    this.subscribe = store.subscribe;
  },
]);
