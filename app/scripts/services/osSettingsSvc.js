'use strict';

/**
 * Angular shim for the pure osSettings module (osSettings.js).
 *
 * Phase 11a: the real logic lives in globalThis.SplainerServices.osSettings.
 * See esSettingsSvc.js for the pattern rationale.
 *
 * Deleted in Phase 12 when the directive shims are removed.
 */
angular.module('splain-app').service('osSettingsSvc', [
  function () {
    var svc = globalThis.SplainerServices && globalThis.SplainerServices.osSettings;
    if (!svc) {
      throw new Error(
        'osSettingsSvc: SplainerServices.osSettings global is missing — ' +
          'check that scripts/services/dist/osSettings.js is loaded before this script.',
      );
    }
    this.fromStartUrl = svc.fromStartUrl;
    this.fromTweakedSettings = svc.fromTweakedSettings;
  },
]);
