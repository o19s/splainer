// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { mount, unmount } from '@app/islands/customHeaders.jsx';
import { makeRoot } from '@test/factories.js';

// jsdom does not load Ace, so the island falls back to the textarea
// renderer (see TextareaFallback in customHeaders.jsx). The fallback uses
// the same data-role attribute as the Ace path so this spec exercises the
// same locators that Playwright + browser code will see.

describe('customHeaders island', () => {
  it('renders the three header-type options', () => {
    const el = makeRoot();
    mount(el, { headerType: 'None', customHeaders: '' }, () => {});
    const options = Array.from(el.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toEqual(['None', 'API Key', 'Custom']);
  });

  // Three call sites pass three different initial settings shapes:
  // settingsStoreSvc defaults Solr+OS to 'None' and ES to 'Custom'. Each
  // call site uses the same Preact island, so the only thing that differs
  // is the initial render. Parameterized so a regression in any one of
  // the three doesn't sneak through under the cover of "the ES path
  // works."
  it.each([
    { headerType: 'None', body: '' },
    { headerType: 'Custom', body: '{\n "KEY": "VALUE"\n}' },
    { headerType: 'API Key', body: '{\n  "Authorization": "ApiKey XXX"\n}' },
  ])('reflects initial headerType $headerType', ({ headerType, body }) => {
    const el = makeRoot();
    mount(el, { headerType, customHeaders: body }, () => {});
    expect(el.querySelector('[data-role="header-type"]').value).toBe(headerType);
    expect(el.querySelector('[data-role="header-editor"]').value).toBe(body);
  });

  it('reflects current settings into the select and editor', () => {
    const el = makeRoot();
    mount(
      el,
      { headerType: 'API Key', customHeaders: '{"Authorization": "ApiKey XYZ"}' },
      () => {},
    );
    expect(el.querySelector('[data-role="header-type"]').value).toBe('API Key');
    expect(el.querySelector('[data-role="header-editor"]').value).toBe(
      '{"Authorization": "ApiKey XYZ"}',
    );
  });

  it('marks the editor read-only when headerType is None', () => {
    const el = makeRoot();
    mount(el, { headerType: 'None', customHeaders: '' }, () => {});
    expect(el.querySelector('[data-role="header-editor"]').readOnly).toBe(true);
  });

  it('calls onChange with a template body when headerType changes', () => {
    const el = makeRoot();
    const onChange = vi.fn();
    mount(el, { headerType: 'None', customHeaders: '' }, onChange);
    const select = el.querySelector('[data-role="header-type"]');
    select.value = 'API Key';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual({
      headerType: 'API Key',
      customHeaders: '{\n  "Authorization": "ApiKey XXX"\n}',
    });
  });

  it('calls onChange when the editor body is edited', () => {
    const el = makeRoot();
    const onChange = vi.fn();
    mount(el, { headerType: 'Custom', customHeaders: '' }, onChange);
    const ta = el.querySelector('[data-role="header-editor"]');
    ta.value = '{"X-Foo": "bar"}';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual({
      headerType: 'Custom',
      customHeaders: '{"X-Foo": "bar"}',
    });
  });

  it('unmount tears down the rendered DOM', () => {
    const el = makeRoot();
    mount(el, { headerType: 'None', customHeaders: '' }, () => {});
    expect(el.querySelector('select')).not.toBeNull();
    unmount(el);
    expect(el.querySelector('select')).toBeNull();
  });

  it('mount throws when rootEl is missing', () => {
    // Pins the `if (!rootEl) throw new Error(...)` input guard in mount().
    expect(() => mount(null, { headerType: 'None', customHeaders: '' }, () => {})).toThrow(
      /rootEl is required/,
    );
  });

  it('omits the in-well title when showHeading is false (mount options)', () => {
    const el = makeRoot();
    mount(el, { headerType: 'None', customHeaders: '' }, () => {}, { showHeading: false });
    expect(el.querySelector('[data-role="custom-headers-heading"]')).toBeNull();
    expect(el.querySelector('fieldset[aria-label="Custom HTTP headers"]')).not.toBeNull();
  });

  it('defaults headerType to None when settings.headerType is undefined', () => {
    // Pins `const headerType = settings.headerType || 'None'`. Without this,
    // a mutation to '' survives because every other test passes an explicit
    // headerType.
    const el = makeRoot();
    mount(el, { customHeaders: '' }, () => {});
    expect(el.querySelector('[data-role="header-type"]').value).toBe('None');
    // And the editor is read-only in that default state.
    expect(el.querySelector('[data-role="header-editor"]').readOnly).toBe(true);
  });

  it('roundtrips a typed header value back via onChange (data that leaves the browser)', () => {
    // Strengthens the value-propagation contract: what the user types must
    // be the exact string passed to onChange and sent to the backend.
    // A regression here silently mangles the Authorization header.
    const el = makeRoot();
    const onChange = vi.fn();
    mount(el, { headerType: 'API Key', customHeaders: '' }, onChange);
    const ta = el.querySelector('[data-role="header-editor"]');
    const typed = '{"Authorization": "ApiKey super-secret-token-12345"}';
    ta.value = typed;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const payload = onChange.mock.calls[0][0];
    expect(payload.headerType).toBe('API Key');
    // Byte-exact round-trip — no quoting, escaping, or whitespace munging.
    expect(payload.customHeaders).toBe(typed);
  });
});
