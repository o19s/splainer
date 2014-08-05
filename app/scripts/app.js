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
  .module('splain-app', ['ngSanitize',
                         'LocalStorageModule',
                         'ui.bootstrap',
                         'ui.ace',
                         'gd.ui.jsonexplorer',
                         'o19s.splainer-search']);
