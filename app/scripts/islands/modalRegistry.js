/**
 * modalRegistry — single entry point for opening island-backed modals.
 *
 *   window.SplainerIslands.openDocModal(kind, doc, opts) -> { close }
 *
 * SECURITY: `kind` must come from a hardcoded call site. Routing a
 * user-influenced string through here would let an attacker mount any
 * registered island.
 */
'use strict';

(function () {
  var ROOT_ID = 'splainer-modal-root';
  var current = null; // { close }

  function ensureRoot() {
    var root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    return root;
  }

  function openDocModal(kind, doc, opts) {
    var registry = (typeof window !== 'undefined' && window.SplainerIslands) || {};
    var island = registry[kind];
    if (!island || typeof island.renderInto !== 'function') {
      throw new Error('modalRegistry: unknown modal kind "' + kind + '"');
    }

    // Close the previously-open modal via its own handle so the prior
    // caller's onClose fires.
    if (current) current.close();

    var root = ensureRoot();
    var userOnClose = (opts && opts.onClose) || null;
    var closed = false;
    var handle;

    function doClose() {
      if (closed) return;
      closed = true;
      island.unmount(root);
      if (current === handle) current = null;
      if (userOnClose) userOnClose();
    }

    var mergedOpts = Object.assign({}, opts, { onClose: doClose });
    island.renderInto(root, doc, mergedOpts);

    handle = { close: doClose };
    current = handle;
    return handle;
  }

  if (typeof window !== 'undefined') {
    window.SplainerIslands = window.SplainerIslands || {};
    window.SplainerIslands.openDocModal = openDocModal;
  }
})();
