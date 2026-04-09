'use strict';

/**
 * Angular shim around the Preact `customHeaders` island
 * (app/scripts/islands/customHeaders.jsx, built to dist/customHeaders.js).
 *
 * The element <custom-headers settings="..."></custom-headers> is used in
 * 3 places (startUrl.html for ES + OS, index.html dev sidebar). The shim
 * mounts the island into the directive's element and proxies parent-scope
 * mutations into the island via $watch — this is the integration boundary
 * pattern that PRs 7–10 will copy for every other view.
 *
 * The CustomHeadersCtrl Angular controller (app/scripts/controllers/customHeaders.js)
 * is now dead code and can be deleted in PR 11 alongside the rest of Angular.
 */
angular.module('splain-app').directive('customHeaders', [
  function () {
    return {
      scope: {
        settings: '=',
      },
      restrict: 'E',
      link: function (scope, element) {
        var rootEl = element[0];
        var island = window.SplainerIslands && window.SplainerIslands.customHeaders;
        if (!island) {
          throw new Error(
            'customHeaders directive: SplainerIslands.customHeaders global is missing — ' +
              'check that app/scripts/islands/customHeaders.js is loaded.',
          );
        }

        function rerender() {
          // Preact's reconciler diffs the new tree against the existing one,
          // so calling mount on every $watch tick is cheap and idempotent.
          // No defensive `|| {}` on scope.settings: the directive declares
          // `scope: { settings: '=' }` so Angular guarantees the binding;
          // a missing one is a caller bug we want to surface, not paper over.
          island.mount(rootEl, scope.settings, function (next) {
            // Apply the island's change inside the digest so other parts of
            // the app see the mutation. The settings object is passed by
            // reference; we mutate it in place to preserve identity for any
            // other $watch on the parent scope.
            scope.$apply(function () {
              scope.settings.headerType = next.headerType;
              scope.settings.customHeaders = next.customHeaders;
            });
          });
        }

        // Re-render whenever the parent scope mutates the settings object.
        // deep watch ($watch with true) is necessary because settings is an
        // object whose properties (headerType, customHeaders) change.
        scope.$watch('settings', rerender, true);

        scope.$on('$destroy', function () {
          island.unmount(rootEl);
        });

        // First render. The $watch above will fire on the next digest, but
        // we mount immediately so the DOM is populated before any user
        // interaction.
        rerender();
      },
    };
  },
]);
