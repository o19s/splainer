'use strict';

/**
 * Angular shim around the Preact `startUrl` island
 * (app/scripts/islands/startUrl.jsx, built to dist/startUrl.js). Replaces
 * app/scripts/controllers/startUrl.js and app/views/startUrl.html (PR 8).
 *
 * Element: <start-url-island search="search"></start-url-island>
 *
 * The shim owns three Angular-only concerns and hands the rest to the island:
 *
 *   1. Service injection: settingsStoreSvc + the three engine settings
 *      services. The island knows nothing about these; it only calls the
 *      `onSearch(engine)` callback, which dispatches here.
 *
 *   2. Hash-URL bookmark load ($location.search): this runs *synchronously*
 *      before the first mount, because a shared `?solr=...` link fires a
 *      real search which transitions currSearch out of NO_SEARCH, and the
 *      parent ng-show then swallows this entire island before the user
 *      sees the form. Matches the original StartUrlCtrl's precedence:
 *      solr > esUrl > osUrl, with a shared `fieldSpec` override.
 *
 *   3. The legacy `dispatch-on-click="openEast"` side effect on each Splain
 *      button. The directive that implemented it triggered a jQuery custom
 *      event on the clicked element, which panes.js listens for to slide
 *      the east (Search Controls) pane open. The island's submit handler
 *      routes through onSearch here, so we fire the same event on the
 *      directive root — any panes.js handler bound to the document/window
 *      (or bubbling from a descendant) still catches it.
 */
angular.module('splain-app').directive('startUrlIsland', [
  '$location',
  'settingsStoreSvc',
  'solrSettingsSvc',
  'esSettingsSvc',
  'osSettingsSvc',
  function ($location, settingsStoreSvc, solrSettingsSvc, esSettingsSvc, osSettingsSvc) {
    return {
      restrict: 'E',
      scope: {
        // The parent scope's `search` object comes from SearchResultsCtrl.
        // We call scope.search.search() after applying settings.
        search: '=',
      },
      link: function (scope, element) {
        var rootEl = element[0];
        var island = window.SplainerIslands && window.SplainerIslands.startUrl;
        if (!island) {
          throw new Error(
            'startUrlIsland directive: SplainerIslands.startUrl global is missing — ' +
              'check that app/scripts/islands/dist/startUrl.js is loaded.',
          );
        }

        function runSearchAndSave() {
          return scope.search.search().then(function () {
            settingsStoreSvc.save();
          });
        }

        function runSolr(overridingFieldSpec) {
          settingsStoreSvc.settings.whichEngine = 'solr';
          var solr = settingsStoreSvc.settings.solr;
          solrSettingsSvc.fromStartUrl(solr.startUrl, solr, overridingFieldSpec);
          return runSearchAndSave();
        }

        // For ES / OS, `extra` is only set on the hash-URL bootstrap path,
        // where the URL params carry searchUrl/searchArgsStr/fieldSpecStr.
        //
        // IMPORTANT bug-for-bug parity with the legacy StartUrlCtrl: on a
        // user-driven submit, the legacy `setEsSettings` wrote
        // `esSettings.fieldSpecStr = settings.fieldSpecStr` where
        // `settings.fieldSpecStr` was **undefined** (submitEs didn't carry
        // it through). esSettingsSvc.fromStartUrl then re-derives
        // fieldSpecStr from the URL's `stored_fields` param (or defaults
        // to 'title, *') whenever it's falsy. That means every manual
        // ES/OS submit from the landing form refreshes fieldSpecStr from
        // the URL — not a migration concern to fix, but MUST be preserved
        // or shared-link workflows that depend on "edit URL, resubmit"
        // silently stop following stored_fields changes. Explicitly set
        // to undefined on the manual path to reproduce exactly.
        function applyExtra(target, extra) {
          if (extra && extra.searchUrl !== undefined) target.startUrl = extra.searchUrl;
          if (extra && extra.searchArgsStr !== undefined) target.searchArgsStr = extra.searchArgsStr;
          // Note the asymmetry with the two above: fieldSpecStr is *always*
          // written (to extra.fieldSpecStr on bootstrap, undefined on
          // manual). Matches legacy setEsSettings / setOsSettings exactly.
          target.fieldSpecStr = extra ? extra.fieldSpecStr : undefined;
        }

        function runEs(extra) {
          settingsStoreSvc.settings.whichEngine = 'es';
          var es = settingsStoreSvc.settings.es;
          applyExtra(es, extra);
          esSettingsSvc.fromStartUrl(es);
          return runSearchAndSave();
        }

        function runOs(extra) {
          settingsStoreSvc.settings.whichEngine = 'os';
          var os = settingsStoreSvc.settings.os;
          applyExtra(os, extra);
          osSettingsSvc.fromStartUrl(os);
          return runSearchAndSave();
        }

        // The island's only outbound channel. Wrapped in $apply because
        // the island fires this from a Preact submit handler, outside the
        // Angular digest cycle.
        function onSearch(engine) {
          scope.$apply(function () {
            // Legacy dispatch-on-click="openEast" side effect on the old
            // Splain button — keep the east pane auto-open behavior.
            if (window.jQuery) {
              window.jQuery(element).trigger('openEast');
            }
            if (engine === 'solr') runSolr();
            else if (engine === 'es') runEs();
            else if (engine === 'os') runOs();
          });
        }

        function rerender() {
          island.mount(
            rootEl,
            { settings: settingsStoreSvc.settings },
            { onSearch: onSearch },
          );
        }

        // --- Hash-URL bootstrap (runs once, before the first mount) ---
        var searchParams = $location.search();
        var overridingFieldSpec;
        if (Object.prototype.hasOwnProperty.call(searchParams, 'fieldSpec')) {
          overridingFieldSpec = searchParams.fieldSpec;
        }
        if (Object.prototype.hasOwnProperty.call(searchParams, 'solr')) {
          settingsStoreSvc.settings.solr.startUrl = searchParams.solr;
          runSolr(overridingFieldSpec);
        } else if (Object.prototype.hasOwnProperty.call(searchParams, 'esUrl')) {
          runEs({
            searchUrl: searchParams.esUrl,
            searchArgsStr: searchParams.esQuery,
            fieldSpecStr: overridingFieldSpec,
          });
        } else if (Object.prototype.hasOwnProperty.call(searchParams, 'osUrl')) {
          runOs({
            searchUrl: searchParams.osUrl,
            searchArgsStr: searchParams.osQuery,
            fieldSpecStr: overridingFieldSpec,
          });
        }

        // Deep watch on settings, matching the settings.jsx shim. Field
        // updates flow through the island's own rerender tick, but
        // external mutations (localStorage rehydrate on init,
        // cross-island updates to custom headers) still need to reach us.
        scope.$watch(
          function () {
            return settingsStoreSvc.settings;
          },
          rerender,
          true,
        );

        scope.$on('$destroy', function () {
          island.unmount(rootEl);
        });

        rerender();
      },
    };
  },
]);
