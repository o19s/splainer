// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the island modules that modalRegistry imports statically.
// This lets us spy on renderInto/unmount without rendering real Preact trees.
vi.mock('@app/islands/detailedDoc.jsx', () => ({
  renderInto: vi.fn((root) => {
    const marker = document.createElement('div');
    marker.dataset.kind = 'detailedDoc';
    root.appendChild(marker);
  }),
  unmount: vi.fn((root) => {
    while (root.firstChild) root.removeChild(root.firstChild);
  }),
}));

vi.mock('@app/islands/docExplain.jsx', () => ({
  renderInto: vi.fn((root) => {
    const marker = document.createElement('div');
    marker.dataset.kind = 'detailedExplain';
    root.appendChild(marker);
  }),
  unmount: vi.fn((root) => {
    while (root.firstChild) root.removeChild(root.firstChild);
  }),
}));

import { openDocModal } from '@app/islands/modalRegistry.js';
import * as detailedDoc from '@app/islands/detailedDoc.jsx';
import * as docExplain from '@app/islands/docExplain.jsx';

// modalRegistry keeps a module-level `current` handle. To avoid state leaking
// between tests, each test that opens a modal should close it, or we account
// for the carryover. We clean up by closing any lingering modal in beforeEach.
let lastHandle = null;

describe('modalRegistry', () => {
  beforeEach(() => {
    // Close any modal left open by the previous test so `current` is null.
    if (lastHandle) {
      lastHandle.close();
      lastHandle = null;
    }
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('throws on an unknown kind', () => {
    expect(() => openDocModal('nope', {}, {})).toThrow(/unknown modal kind/);
  });

  it('auto-creates #splainer-modal-root and calls renderInto on the island', () => {
    expect(document.getElementById('splainer-modal-root')).toBeNull();
    lastHandle = openDocModal('detailedDoc', { id: 'd1' }, {});

    const root = document.getElementById('splainer-modal-root');
    expect(root).not.toBeNull();
    expect(detailedDoc.renderInto).toHaveBeenCalledTimes(1);
    const [calledRoot, calledDoc, calledOpts] = detailedDoc.renderInto.mock.calls[0];
    expect(calledRoot).toBe(root);
    expect(calledDoc).toEqual({ id: 'd1' });
    expect(typeof calledOpts.onClose).toBe('function');
  });

  it('opening a second modal unmounts the first', () => {
    openDocModal('detailedDoc', { id: 'a' }, {});
    expect(detailedDoc.unmount).not.toHaveBeenCalled();
    lastHandle = openDocModal('detailedDoc', { id: 'b' }, {});
    expect(detailedDoc.unmount).toHaveBeenCalledTimes(1);
    expect(detailedDoc.renderInto).toHaveBeenCalledTimes(2);
  });

  it('opening a second modal fires the first modal user onClose', () => {
    const onCloseA = vi.fn();
    openDocModal('detailedDoc', { id: 'a' }, { onClose: onCloseA });
    expect(onCloseA).not.toHaveBeenCalled();
    lastHandle = openDocModal('detailedDoc', { id: 'b' }, {});
    expect(onCloseA).toHaveBeenCalledTimes(1);
  });

  it('the returned close() unmounts and fires the user onClose', () => {
    const userOnClose = vi.fn();
    const handle = openDocModal('detailedDoc', { id: 'a' }, { onClose: userOnClose });
    handle.close();
    expect(detailedDoc.unmount).toHaveBeenCalledTimes(1);
    expect(userOnClose).toHaveBeenCalledTimes(1);
    // Idempotent: second close() is a no-op.
    handle.close();
    expect(detailedDoc.unmount).toHaveBeenCalledTimes(1);
    expect(userOnClose).toHaveBeenCalledTimes(1);
    lastHandle = null; // already closed
  });

  it('forwards opts (other than onClose) to renderInto', () => {
    lastHandle = openDocModal('detailedDoc', { id: 'a' }, { canExplainOther: true, foo: 'bar' });
    const opts = detailedDoc.renderInto.mock.calls[0][2];
    expect(opts.canExplainOther).toBe(true);
    expect(opts.foo).toBe('bar');
  });

  it('supports detailedExplain kind', () => {
    lastHandle = openDocModal('detailedExplain', { id: 'x' }, {});
    expect(docExplain.renderInto).toHaveBeenCalledTimes(1);
    expect(docExplain.renderInto.mock.calls[0][1]).toEqual({ id: 'x' });
  });
});
