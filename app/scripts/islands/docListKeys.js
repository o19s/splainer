/**
 * Stable Preact list keys for search hits.
 *
 * When {@link https://github.com/o19s/splainer-search | splainer-search} cannot
 * resolve `doc.id` from the field spec (and has no ES `_id` fallback), the UI
 * uses `searchListEpoch` plus row index so rows do not collapse. Epoch bumps
 * when `currSearch.searcher` changes so keys do not collide across searches.
 *
 * @param {{ id?: unknown, idResolutionSource?: string }} doc — normalized hit from createNormalDoc
 * @param {number} index — zero-based row index within the current result list
 * @param {number} searchListEpoch — incremented when a new search completes (searcher identity changes)
 * @returns {string}
 */
export function docRowListKey(doc, index, searchListEpoch) {
  const id = doc && doc.id;
  if (id !== null && id !== undefined && String(id).trim().length > 0) {
    return String(id);
  }
  return `spl-${searchListEpoch}-i-${index}`;
}
