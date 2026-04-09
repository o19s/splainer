// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { DetailedDoc, renderInto, unmount } from './detailedDoc.jsx';

// Polyfill jsdom HTMLDialogElement.showModal/close so the hook exercises
// the real branch.
function installDialogPolyfill() {
  const proto = window.HTMLDialogElement && window.HTMLDialogElement.prototype;
  if (!proto) return;
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function () {
      this.setAttribute('open', '');
      this.open = true;
    };
  }
  if (typeof proto.close !== 'function') {
    proto.close = function () {
      this.removeAttribute('open');
      this.open = false;
    };
  }
}
installDialogPolyfill();

function makeRoot() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function makeDoc(overrides) {
  return Object.assign(
    {
      id: 'doc-42',
      title: 'A canned title',
      subs: { director: 'Someone', release_year: 1999 },
    },
    overrides || {},
  );
}

describe('detailedDoc island', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the heading with the doc id interpolated', () => {
    const el = makeRoot();
    render(<DetailedDoc doc={makeDoc()} onClose={() => {}} />, el);
    expect(el.textContent).toContain('Detailed Document View of doc: doc-42');
  });

  it('renders one row per doc.subs entry', () => {
    const el = makeRoot();
    render(<DetailedDoc doc={makeDoc()} onClose={() => {}} />, el);
    expect(el.textContent).toContain('director');
    expect(el.textContent).toContain('Someone');
    expect(el.textContent).toContain('release_year');
    expect(el.textContent).toContain('1999');
  });

  it('ESC (cancel event) fires onClose', () => {
    const el = makeRoot();
    const onClose = vi.fn();
    render(<DetailedDoc doc={makeDoc()} onClose={onClose} />, el);
    const dlg = el.querySelector('dialog');
    dlg.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not crash on a doc with no subs', () => {
    const el = makeRoot();
    expect(() =>
      render(<DetailedDoc doc={{ id: 'doc-1', title: 't' }} onClose={() => {}} />, el),
    ).not.toThrow();
    expect(el.textContent).toContain('doc-1');
  });

  it('renderInto / unmount mount and tear down the island', () => {
    const el = makeRoot();
    renderInto(el, makeDoc(), { onClose: () => {} });
    expect(el.querySelector('dialog')).not.toBeNull();
    unmount(el);
    expect(el.querySelector('dialog')).toBeNull();
  });
});
