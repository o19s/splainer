// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mount, unmount } from './solrSettingsWarning.jsx';
import { makeRoot } from '../test-helpers/factories.js';

// Fake solrUrlSvc: mirrors the real splainer-search API surface the
// island touches. parseSolrArgs returns an object; removeUnsupported
// returns an { argument: warning } map of what it *would* strip.
// This lets the spec drive the visual output without pulling in the
// real splainer-search wired build (which has no clean jsdom path).
function fakeSvc(warningsByArg) {
  return {
    parseSolrArgs: (s) => ({ _raw: s }),
    removeUnsupported: () => warningsByArg,
  };
}

describe('solrSettingsWarning island', () => {
  it('renders nothing when the svc reports no removed args', () => {
    const el = makeRoot();
    mount(el, { argsStr: 'q=*:*', solrUrlSvc: fakeSvc({}) });
    expect(el.querySelector('[data-role="solr-settings-warning"]')).toBeNull();
  });

  it('renders nothing when argsStr is empty', () => {
    const el = makeRoot();
    mount(el, { argsStr: '', solrUrlSvc: fakeSvc({ foo: 'nope' }) });
    expect(el.querySelector('[data-role="solr-settings-warning"]')).toBeNull();
  });

  it('condenses multiple arguments that share a reason into one <li>', () => {
    const el = makeRoot();
    mount(el, {
      argsStr: 'group=true&group.main=true',
      solrUrlSvc: fakeSvc({
        group: 'grouping unsupported',
        'group.main': 'grouping unsupported',
      }),
    });
    const alert = el.querySelector('[data-role="solr-settings-warning"]');
    expect(alert).not.toBeNull();
    // One <ul> per distinct reason; both args share a reason so exactly one.
    const uls = alert.querySelectorAll('ul');
    expect(uls.length).toBe(1);
    const text = alert.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('Arguments Removed:');
    expect(text).toContain('group');
    expect(text).toContain('group.main');
    expect(text).toContain('grouping unsupported');
  });

  it('renders one group per distinct reason', () => {
    const el = makeRoot();
    mount(el, {
      argsStr: 'a=1&b=2',
      solrUrlSvc: fakeSvc({ a: 'reason A', b: 'reason B' }),
    });
    const uls = el.querySelectorAll('[data-role="solr-settings-warning"] ul');
    expect(uls.length).toBe(2);
  });

  it('unmount clears the DOM', () => {
    const el = makeRoot();
    mount(el, { argsStr: 'a=1', solrUrlSvc: fakeSvc({ a: 'nope' }) });
    expect(el.querySelector('[data-role="solr-settings-warning"]')).not.toBeNull();
    unmount(el);
    expect(el.querySelector('[data-role="solr-settings-warning"]')).toBeNull();
  });
});
