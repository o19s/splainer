"use strict";

/**
 * @ngdoc function
 * @name splain-app.filters:solrparams
 * @description
 * # solrparams
 *
 * Takes a string of URL encoded search params and
 * splits each parameter into a new line (for easier
 * visualization).
 * For example:
 * ```
 * q=name:apple&fq=inStock:true
 * ```
 * becomes:
 * ```
 * q=name:apple
 * fq=inStock:true
 * ```
 */
angular.module("splain-app").filter("solrparams", [
  "solrSettingsSvc",
  function(solrSettingsSvc) {
    return function(input) {
      return solrSettingsSvc.denormalizeArgs(input);
    };
  }
]);
