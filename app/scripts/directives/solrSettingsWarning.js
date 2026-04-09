'use strict';

/**
 * Angular shim around the Preact `solrSettingsWarning` island
 * (app/scripts/islands/solrSettingsWarning.jsx, built to
 * dist/solrSettingsWarning.js). Replaces
 * app/scripts/controllers/solrSettingsWarning.js (PR 8).
 *
 * Element: <solr-settings-warning curr-search="currSearch"></solr-settings-warning>
 *
 * This shim intentionally uses a *shallow* watch on the resulting args
 * string rather than a deep watch on currSearch. The warning display only
 * depends on the string that comes out of searchArgsStr(); a deep watch
 * on currSearch would walk every doc + explain tree on every digest for
 * no benefit. See memory note "Be skeptical of deep $watch fixes" — this
 * is the inverse case, where a shallow watch is the correct fix.
 */
angular.module('splain-app').directive('solrSettingsWarning', [
  'solrUrlSvc',
  function (solrUrlSvc) {
    return {
      restrict: 'E',
      scope: {
        currSearch: '=',
      },
      link: function (scope, element) {
        var rootEl = element[0];
        var island = window.SplainerIslands && window.SplainerIslands.solrSettingsWarning;
        if (!island) {
          throw new Error(
            'solrSettingsWarning directive: SplainerIslands.solrSettingsWarning global is ' +
              'missing — check that app/scripts/islands/dist/solrSettingsWarning.js is loaded.',
          );
        }

        function currentArgsStr() {
          var cs = scope.currSearch;
          if (!cs || !cs.settings || typeof cs.settings.searchArgsStr !== 'function') {
            return '';
          }
          try {
            return cs.settings.searchArgsStr();
          } catch (_e) {
            return '';
          }
        }

        function rerender() {
          island.mount(rootEl, {
            argsStr: currentArgsStr(),
            solrUrlSvc: solrUrlSvc,
          });
        }

        scope.$watch(currentArgsStr, rerender);

        scope.$on('$destroy', function () {
          island.unmount(rootEl);
        });

        rerender();
      },
    };
  },
]);
