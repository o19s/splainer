'use strict';

/**
 * Angular shim for the pure solrSettings module (solrSettings.js).
 *
 * Phase 11b: the real logic lives in globalThis.SplainerServices.solrSettings
 * (built from solrSettings.js by vite.islands.config.js). This wrapper
 * injects `solrUrlSvc` and `fieldSpecSvc` from Angular DI and passes
 * them through — the pure module accepts them as leading parameters
 * (same pattern as splSearchSvc passing the Search factory).
 *
 * Deleted in Phase 12 when the directive shims are removed.
 */
angular.module('splain-app').service('solrSettingsSvc', [
  'solrUrlSvc',
  'fieldSpecSvc',
  function (solrUrlSvc, fieldSpecSvc) {
    var svc = globalThis.SplainerServices && globalThis.SplainerServices.solrSettings;
    if (!svc) {
      throw new Error(
        'solrSettingsSvc: SplainerServices.solrSettings global is missing — ' +
          'check that scripts/services/dist/solrSettings.js is loaded before this script.',
      );
    }

    this.fromStartUrl = function (newStartUrl, searchSettings, overrideFieldSpec) {
      return svc.fromStartUrl(solrUrlSvc, fieldSpecSvc, newStartUrl, searchSettings, overrideFieldSpec);
    };

    this.fromTweakedSettings = function (searchSettings) {
      return svc.fromTweakedSettings(solrUrlSvc, fieldSpecSvc, searchSettings);
    };
  },
]);
