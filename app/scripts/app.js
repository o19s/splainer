'use strict';

/**
 * @ngdoc overview
 * @name frontendApp
 * @description
 * # frontendApp
 *
 * Main module of the application.
 */
angular
  .module('splain-app', [
    'ngSanitize',
    'LocalStorageModule',
    'ui.bootstrap',
    'ngJsonExplorer',
    'ui.ace',
    // splainer-search 3.0.0 is framework-agnostic and no longer registers
    // an Angular module. See app/scripts/services/splainerSearchShim.js for
    // the Angular compatibility layer that re-exposes its services as
    // Angular factories under splain-app.
  ])
  .config([
    '$locationProvider',
    function ($locationProvider) {
      $locationProvider.hashPrefix('');
    },
  ]);
