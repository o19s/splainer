// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { mount } from './docSelector.jsx';

function makeRoot() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

// Preact flushes state updates on a microtask; DOM assertions after a
// state-changing event must wait a tick first.
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('docSelector island', () => {
  it('renders the altQuery input and Find Others submit button', () => {
    const el = makeRoot();
    mount(el, {}, { onExplainOther: () => Promise.resolve() });
    expect(el.querySelector('[data-role="alt-query"]')).not.toBeNull();
    expect(el.querySelector('[data-role="find-others"]')).not.toBeNull();
  });

  it('clicking the submit button calls onExplainOther with the typed query', async () => {
    const el = makeRoot();
    const spy = vi.fn(() => Promise.resolve());
    mount(el, {}, { onExplainOther: spy });

    const input = el.querySelector('[data-role="alt-query"]');
    input.value = 'title:foo';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();

    // Click the actual submit button (not a raw submit dispatch) so the
    // test path matches what a real user does, including honoring the
    // button's disabled attribute.
    el.querySelector('[data-role="find-others"]').click();
    await flush();

    expect(spy).toHaveBeenCalledWith('title:foo');
  });

  it('renders the rejection message when onExplainOther rejects', async () => {
    const el = makeRoot();
    mount(el, {}, { onExplainOther: () => Promise.reject(new Error('solr exploded')) });

    el.querySelector('[data-role="find-others"]').click();
    // Two ticks: one for the rejected promise, one for the setState flush.
    await flush();
    await flush();

    const errEl = el.querySelector('[data-role="alt-query-error"]');
    expect(errEl).not.toBeNull();
    expect(errEl.textContent).toContain('solr exploded');
  });

  it('clears a previous error on a successful re-submit', async () => {
    const el = makeRoot();
    let shouldFail = true;
    const onExplainOther = vi.fn(() =>
      shouldFail ? Promise.reject(new Error('boom')) : Promise.resolve(),
    );
    mount(el, {}, { onExplainOther });

    el.querySelector('[data-role="find-others"]').click();
    await flush();
    await flush();
    expect(el.querySelector('[data-role="alt-query-error"]')).not.toBeNull();

    shouldFail = false;
    el.querySelector('[data-role="find-others"]').click();
    await flush();
    await flush();
    expect(el.querySelector('[data-role="alt-query-error"]')).toBeNull();
  });

  it('disables the submit button while onExplainOther is pending', async () => {
    const el = makeRoot();
    let resolveIt;
    const onExplainOther = () =>
      new Promise((resolve) => {
        resolveIt = resolve;
      });
    mount(el, {}, { onExplainOther });

    el.querySelector('[data-role="find-others"]').click();
    await flush();

    const btn = el.querySelector('[data-role="find-others"]');
    expect(btn.disabled).toBe(true);

    resolveIt();
    await flush();
    await flush();
    expect(btn.disabled).toBe(false);
  });

  it('escapes HTML in error messages (renders as text, not parsed markup)', async () => {
    // error.message could contain arbitrary server-controlled content under
    // HTTP-error rejections. Preact's text interpolation must render it as
    // literal text, never as parsed HTML. jsdom doesn't execute scripts
    // inserted via innerHTML regardless, so the meaningful assertion is
    // that no <script> element exists as a child of the error div — that
    // would only happen if Preact switched to dangerouslySetInnerHTML.
    const el = makeRoot();
    const evilMsg = '<script>document.title = "pwned"</script>';
    mount(el, {}, { onExplainOther: () => Promise.reject(new Error(evilMsg)) });

    el.querySelector('[data-role="find-others"]').click();
    await flush();
    await flush();

    const errEl = el.querySelector('[data-role="alt-query-error"]');
    expect(errEl.textContent).toContain('<script>');
    expect(errEl.querySelector('script')).toBeNull();
  });
});
