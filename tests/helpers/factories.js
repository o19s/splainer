/**
 * Shared test factories for splainer-search object shapes.
 * Lives under `tests/helpers/`; import from specs as `@test/factories.js` (see `vitest.config.js` aliases).
 *
 * These match the doc interface that splainer-search 3.0.0 exposes:
 * score(), getHighlightedTitle(), subSnippets(), hasThumb(), hasImage(),
 * explain(), hotMatches(). Individual specs can override any method via
 * the overrides parameter.
 */

/**
 * Create a DOM element appended to document.body for mounting islands.
 * Callers are responsible for cleanup (beforeEach body.innerHTML = '' or
 * afterEach el.remove()).
 */
export function makeRoot() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

/**
 * Create a minimal splainer-search doc fake. Covers the full interface
 * that DocRow, DocExplain, and SearchResults depend on.
 *
 * Config keys (explainToStr, explainRaw, hotStr, score) are consumed as
 * scalar values to build the default method implementations — they are
 * NOT spread onto the result object. To override a method directly
 * (e.g. pass your own score function), include the method in overrides
 * and it will win via spread.
 */
export function makeSearchDoc(overrides = {}) {
  // Extract config keys so they don't leak onto the result object.
  // `score` is extracted here because the component calls doc.score()
  // as a function — a bare numeric override would crash at call sites.
  const {
    explainToStr = '1.0 weight(title:canned in 0)',
    explainRaw = { description: 'weight(title:canned in 0)', value: 1.0 },
    hotStr = '1.0 hot: title:canned',
    score: scoreCfg,
    ...rest
  } = overrides;

  const id = rest.id || 'doc-1';
  const title = rest.title || 'canned title';
  const scoreFn = typeof scoreCfg === 'function' ? scoreCfg : () => scoreCfg ?? 1.0;

  const defaults = {
    id,
    title,
    score: scoreFn,
    getHighlightedTitle: (open, close) =>
      open !== undefined ? `${open}canned${close} title` : title,
    subSnippets: () => ({}),
    hasThumb: () => false,
    hasImage: () => false,
    thumb: null,
    image: null,
    explain: () => ({
      toStr: () => explainToStr,
      rawStr: () => JSON.stringify(explainRaw),
    }),
    hotMatches: () => ({ toStr: () => hotStr }),
  };

  return { ...defaults, ...rest };
}
