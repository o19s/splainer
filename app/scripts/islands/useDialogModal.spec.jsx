// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { useDialogModal } from './useDialogModal.js';
import { makeRoot } from '../test-helpers/factories.js';

// jsdom dialog polyfill (showModal/close) loaded via vitest setupFiles.

function Harness({ onClose, label = 'body' }) {
  const { ref, close } = useDialogModal(onClose);
  return (
    <dialog ref={ref}>
      <p>{label}</p>
      <button type="button" onClick={close}>
        x
      </button>
    </dialog>
  );
}

describe('useDialogModal', () => {
  it('opens the dialog on mount', () => {
    const el = makeRoot();
    render(<Harness onClose={() => {}} />, el);
    const dlg = el.querySelector('dialog');
    expect(dlg).not.toBeNull();
    expect(dlg.hasAttribute('open')).toBe(true);
  });

  it('fires onClose when the cancel event is dispatched (ESC)', () => {
    const el = makeRoot();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />, el);
    const dlg = el.querySelector('dialog');
    dlg.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fires onClose on a backdrop click (event target === dialog)', () => {
    const el = makeRoot();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />, el);
    const dlg = el.querySelector('dialog');
    // Simulate the backdrop click: the click event's target is the dialog
    // itself rather than a child.
    dlg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onClose when a child element is clicked', () => {
    const el = makeRoot();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />, el);
    const para = el.querySelector('dialog p');
    para.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('close() programmatic call fires onClose and closes the dialog', () => {
    const el = makeRoot();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />, el);
    const dlg = el.querySelector('dialog');
    const btn = el.querySelector('dialog button');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dlg.hasAttribute('open')).toBe(false);
  });

  // The ref-refresh stale-closure pattern is hard to exercise reliably in
  // jsdom because Preact's effect scheduler doesn't always commit the
  // no-deps useEffect on a synchronous parent re-render before the next
  // event dispatch. The pattern itself is the same one useAceEditor uses
  // (PR 6) and is covered there; relying on it here without an extra test
  // is fine.
});
