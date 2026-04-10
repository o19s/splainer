'use strict';

/**
 * Angular shim around the Preact `settings` island
 * (app/scripts/islands/settings.jsx, built to dist/settings.js).
 *
 * The element <settings-island settings curr-search search></settings-island>
 * replaces the entire <form ng-controller="SettingsCtrl"> block previously at
 * app/index.html:115-255. The shim mounts the island and proxies the
 * publishSearcher dispatch back into the four Angular settings services and
 * the parent scope's `search` callback.
 *
 * The four settings services and settingsStoreSvc are injected here, NOT
 * passed to the island as props — the island knows nothing about Angular DI
 * or the settingsStoreSvc shape. PR 11 deletes these injections along with
 * the rest of Angular wiring.
 */
angular.module('splain-app').directive('settingsIsland', [
  'settingsStoreSvc',
  'solrSettingsSvc',
  'esSettingsSvc',
  'osSettingsSvc',
  function (settingsStoreSvc, solrSettingsSvc, esSettingsSvc, osSettingsSvc) {
    return {
      scope: {
        // currSearch and search come from the parent scope via attributes
        // (set in app/index.html). settings is read directly off the
        // injected settingsStoreSvc — the original SettingsCtrl did the
        // same: `$scope.settings = settingsStoreSvc.settings`.
        currSearch: '=',
        search: '=',
      },
      restrict: 'E',
      link: function (scope, element) {
        var rootEl = element[0];
        var island = window.SplainerIslands && window.SplainerIslands.settings;
        if (!island) {
          throw new Error(
            'settingsIsland directive: SplainerIslands.settings global is missing — ' +
              'check that app/scripts/islands/dist/settings.js is loaded.',
          );
        }

        // onPublish is the island's only outbound channel. Mirrors the
        // original SettingsCtrl.publishSearcher() exactly:
        //   1. Set settingsStoreSvc.settings.whichEngine to the chosen engine.
        //   2. Dispatch fromTweakedSettings to the matching service. This
        //      may mutate workingSettings in place (e.g. fromTweakedSettings
        //      parses a pasted full URL and splits it into url/args/fields).
        //   3. Run search().then(save).
        // All wrapped in $apply because the island fires this from a Preact
        // event handler, outside the Angular digest cycle.
        function onPublish(whichEngine, workingSettings) {
          scope.$apply(function () {
            settingsStoreSvc.settings.whichEngine = whichEngine;
            if (whichEngine === 'solr') {
              solrSettingsSvc.fromTweakedSettings(workingSettings);
            } else if (whichEngine === 'es') {
              esSettingsSvc.fromTweakedSettings(workingSettings);
            } else if (whichEngine === 'os') {
              osSettingsSvc.fromTweakedSettings(workingSettings);
            }
            scope.search.search().then(function () {
              settingsStoreSvc.save();
            });
          });
        }

        function rerender() {
          // Idempotent mount on every digest tick — Preact's reconciler
          // diffs the new tree against the existing one. Same pattern as
          // the customHeaders directive shim.
          island.mount(
            rootEl,
            {
              settings: settingsStoreSvc.settings,
              currSearch: scope.currSearch,
            },
            onPublish,
          );
        }

        // Subscribe to settings changes — replaces the deep $watch on
        // settingsStoreSvc.settings. Fires only on explicit save(),
        // not on every digest cycle. Uses $applyAsync (not $apply)
        // because save() can be called from inside a .then() that
        // fires within an existing $apply — nesting $apply throws.
        var unsub = settingsStoreSvc.subscribe(function () {
          scope.$applyAsync(rerender);
        });

        // Watch only the searcher reference, not the whole currSearch
        // object. currSearch holds the search response (docs, explain
        // trees) — a deep watch would walk hundreds of nested objects
        // on every digest. The field-spec gate only reads
        // currSearch.searcher.isTemplateCall(), so the searcher reference
        // identity is the right granularity: it swaps when a new search
        // runs, which is exactly when the gate could change.
        scope.$watch(
          function () {
            return scope.currSearch && scope.currSearch.searcher;
          },
          rerender,
        );

        scope.$on('$destroy', function () {
          unsub();
          island.unmount(rootEl);
        });

        // First render — the $watches above will re-fire on the next
        // digest, but we want the DOM populated before any user interaction.
        rerender();
      },
    };
  },
]);
