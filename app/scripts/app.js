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
    'o19s.splainer-search'
  ])
  .config([
    '$locationProvider',
    function($locationProvider) {
      $locationProvider.hashPrefix('');
    }
  ]);
