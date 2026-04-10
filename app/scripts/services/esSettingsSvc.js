'use strict';

/**
 * Angular shim for the pure esSettings module (esSettings.js).
 *
 * Phase 11a: the real logic lives in globalThis.SplainerServices.esSettings
 * (built from esSettings.js by vite.islands.config.js). This file
 * registers the same API as an Angular service so existing directive
 * shims that inject 'esSettingsSvc' keep working unchanged.
 *
 * Deleted in Phase 12 when the directive shims are removed.
 */
angular.module('splain-app').service('esSettingsSvc', [
  function () {
    var svc = globalThis.SplainerServices && globalThis.SplainerServices.esSettings;
    if (!svc) {
      throw new Error(
        'esSettingsSvc: SplainerServices.esSettings global is missing — ' +
          'check that scripts/services/dist/esSettings.js is loaded before this script.',
      );
    }
    this.fromStartUrl = svc.fromStartUrl;
    this.fromTweakedSettings = svc.fromTweakedSettings;
  },
]);
