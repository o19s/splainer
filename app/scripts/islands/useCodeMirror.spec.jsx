// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { useCodeMirror } from './useCodeMirror.js';

// CodeMirror 6 runs in jsdom well enough for doc-state operations (value
// sync, onChange, readOnly, unmount cleanup). Operations that need layout
// (text measurement, scroll positioning) are not exercised here.
//
// @testing-library/preact's render() handles Preact's effect scheduling
// so we don't have to chase microtask/macrotask flushing by hand.

function Editor({ value, onChange, readOnly }) {
  const ref = useCodeMirror(value, onChange, { readOnly });
  return <div ref={ref} data-testid="cm-root" style={{ height: '150px' }} />;
}

afterEach(() => {
  cleanup();
});

describe('useCodeMirror', () => {
  it('mounts a CodeMirror view into the container and exposes it as __cmView', () => {
    const { getByTestId } = render(<Editor value="hello" onChange={() => {}} />);
    const container = getByTestId('cm-root');
    expect(container.__cmView).toBeTruthy();
    expect(container.__cmView.state.doc.toString()).toBe('hello');
  });

  it('renders with the initial value from props', () => {
    const { getByTestId } = render(<Editor value={'{ "k": 1 }'} onChange={() => {}} />);
    const container = getByTestId('cm-root');
    expect(container.__cmView.state.doc.toString()).toBe('{ "k": 1 }');
  });

  it('syncs external value prop changes into the view without tearing it down', () => {
    const { getByTestId, rerender } = render(<Editor value="first" onChange={() => {}} />);
    const container = getByTestId('cm-root');
    const firstView = container.__cmView;
    expect(firstView.state.doc.toString()).toBe('first');

    rerender(<Editor value="second" onChange={() => {}} />);

    // Same view instance — not destroyed and recreated.
    expect(container.__cmView).toBe(firstView);
    expect(container.__cmView.state.doc.toString()).toBe('second');
  });

  it('does not echo the onChange callback during external value sync', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Editor value="initial" onChange={onChange} />);
    onChange.mockClear();

    rerender(<Editor value="updated" onChange={onChange} />);

    // The suppressRef echo-loop guard means an external value change
    // must NOT fire onChange.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fires onChange when the view document is edited via dispatch', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Editor value="abc" onChange={onChange} />);

    const view = getByTestId('cm-root').__cmView;
    // Simulate a user edit via a direct dispatch (keystroke-level input
    // requires layout which jsdom lacks).
    view.dispatch({ changes: { from: 3, to: 3, insert: 'def' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('abcdef');
  });

  it('always receives the latest onChange prop (no stale-closure bug)', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { getByTestId, rerender } = render(<Editor value="x" onChange={first} />);
    rerender(<Editor value="x" onChange={second} />);

    const view = getByTestId('cm-root').__cmView;
    view.dispatch({ changes: { from: 1, to: 1, insert: 'y' } });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('xy');
  });

  it('respects readOnly and blocks user edits when true', () => {
    const { getByTestId } = render(<Editor value="locked" onChange={() => {}} readOnly />);
    const view = getByTestId('cm-root').__cmView;
    expect(view.state.readOnly).toBe(true);
  });

  it('toggles readOnly at runtime via Compartment reconfigure', () => {
    const { getByTestId, rerender } = render(
      <Editor value="x" onChange={() => {}} readOnly={false} />,
    );
    const view = getByTestId('cm-root').__cmView;
    expect(view.state.readOnly).toBe(false);

    rerender(<Editor value="x" onChange={() => {}} readOnly={true} />);

    // Same view instance — compartment reconfigure, not a remount.
    const after = getByTestId('cm-root').__cmView;
    expect(after).toBe(view);
    expect(after.state.readOnly).toBe(true);
  });

  it('destroys the view on unmount (no error, view removed from container)', () => {
    const { getByTestId, unmount } = render(<Editor value="x" onChange={() => {}} />);
    const container = getByTestId('cm-root');
    expect(container.__cmView).toBeTruthy();

    unmount();

    // After unmount, cleanup returns the view to a destroyed state.
    // The container may still be reachable via the closed-over ref, but
    // its __cmView property should have been stripped by the effect cleanup.
    expect(container.__cmView).toBeUndefined();
  });

  describe('defaults and empty values', () => {
    // These pin the `readOnly = false` default (via destructuring at L28),
    // the `value || ''` empty fallback on mount (L71), and the same
    // fallback on external value sync (L91). Without these, the defaults
    // get rewritten as "true" / the `|| ''` gets rewritten away and
    // no other test notices.

    function PlainEditor({ value, onChange }) {
      // No readOnly prop at all — hook must default it to false.
      const ref = useCodeMirror(value, onChange);
      return <div ref={ref} data-testid="cm-root" style={{ height: '150px' }} />;
    }

    it('defaults readOnly to false when options are omitted', () => {
      const { getByTestId } = render(<PlainEditor value="x" onChange={() => {}} />);
      const view = getByTestId('cm-root').__cmView;
      expect(view.state.readOnly).toBe(false);
    });

    it('mounts with an empty document when value is undefined', () => {
      const { getByTestId } = render(<Editor value={undefined} onChange={() => {}} />);
      const view = getByTestId('cm-root').__cmView;
      expect(view.state.doc.toString()).toBe('');
    });

    it('syncs to an empty document when value is cleared to undefined', () => {
      const { getByTestId, rerender } = render(<Editor value="hello" onChange={() => {}} />);
      expect(getByTestId('cm-root').__cmView.state.doc.toString()).toBe('hello');
      rerender(<Editor value={undefined} onChange={() => {}} />);
      expect(getByTestId('cm-root').__cmView.state.doc.toString()).toBe('');
    });
  });
});
