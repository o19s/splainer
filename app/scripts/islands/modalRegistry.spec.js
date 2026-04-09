// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// modalRegistry attaches to window.SplainerIslands.openDocModal as a side
// effect of import — load it once here.
import './modalRegistry.js';

describe('modalRegistry', () => {
  let savedRegistry;

  beforeEach(() => {
    savedRegistry = { ...window.SplainerIslands };
    document.body.innerHTML = '';
    // Re-attach openDocModal in case a prior test cleared it.
    window.SplainerIslands = window.SplainerIslands || {};
    window.SplainerIslands.openDocModal = savedRegistry.openDocModal;
  });

  afterEach(() => {
    window.SplainerIslands = savedRegistry;
  });

  function registerStubIsland(kind) {
    const renderInto = vi.fn((root /* , doc, opts */) => {
      const marker = document.createElement('div');
      marker.dataset.kind = kind;
      root.appendChild(marker);
    });
    const unmount = vi.fn((root) => {
      while (root.firstChild) root.removeChild(root.firstChild);
    });
    window.SplainerIslands[kind] = { renderInto, unmount };
    return { renderInto, unmount };
  }

  it('throws on an unknown kind', () => {
    expect(() => window.SplainerIslands.openDocModal('nope', {}, {})).toThrow(
      /unknown modal kind/,
    );
  });

  it('auto-creates #splainer-modal-root and calls renderInto on the island', () => {
    const island = registerStubIsland('detailedDoc');
    expect(document.getElementById('splainer-modal-root')).toBeNull();

    window.SplainerIslands.openDocModal('detailedDoc', { id: 'd1' }, {});

    const root = document.getElementById('splainer-modal-root');
    expect(root).not.toBeNull();
    expect(island.renderInto).toHaveBeenCalledTimes(1);
    const [calledRoot, calledDoc, calledOpts] = island.renderInto.mock.calls[0];
    expect(calledRoot).toBe(root);
    expect(calledDoc).toEqual({ id: 'd1' });
    expect(typeof calledOpts.onClose).toBe('function');
  });

  it('opening a second modal unmounts the first', () => {
    const island = registerStubIsland('detailedDoc');
    window.SplainerIslands.openDocModal('detailedDoc', { id: 'a' }, {});
    expect(island.unmount).not.toHaveBeenCalled();
    window.SplainerIslands.openDocModal('detailedDoc', { id: 'b' }, {});
    expect(island.unmount).toHaveBeenCalledTimes(1);
    expect(island.renderInto).toHaveBeenCalledTimes(2);
  });

  it('opening a second modal fires the first modal user onClose', () => {
    // Regression for the round-1 fix: previously the unmount-previous
    // path called island.unmount(root) directly and dropped the prior
    // caller's onClose. Now it routes through the previous handle's
    // doClose so userOnClose fires.
    registerStubIsland('detailedDoc');
    const onCloseA = vi.fn();
    window.SplainerIslands.openDocModal('detailedDoc', { id: 'a' }, { onClose: onCloseA });
    expect(onCloseA).not.toHaveBeenCalled();
    window.SplainerIslands.openDocModal('detailedDoc', { id: 'b' }, {});
    expect(onCloseA).toHaveBeenCalledTimes(1);
  });

  it('the returned close() unmounts and fires the user onClose', () => {
    const island = registerStubIsland('detailedDoc');
    const userOnClose = vi.fn();
    const handle = window.SplainerIslands.openDocModal(
      'detailedDoc',
      { id: 'a' },
      { onClose: userOnClose },
    );
    handle.close();
    expect(island.unmount).toHaveBeenCalledTimes(1);
    expect(userOnClose).toHaveBeenCalledTimes(1);
    // Idempotent: second close() is a no-op.
    handle.close();
    expect(island.unmount).toHaveBeenCalledTimes(1);
    expect(userOnClose).toHaveBeenCalledTimes(1);
  });

  it('forwards opts (other than onClose) to renderInto', () => {
    const island = registerStubIsland('detailedDoc');
    window.SplainerIslands.openDocModal(
      'detailedDoc',
      { id: 'a' },
      { canExplainOther: true, foo: 'bar' },
    );
    const opts = island.renderInto.mock.calls[0][2];
    expect(opts.canExplainOther).toBe(true);
    expect(opts.foo).toBe('bar');
  });
});
