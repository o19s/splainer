/**
 * Whether CodeMirror 6 can run in the current environment.
 *
 * jsdom (Vitest) does not implement enough layout APIs for CM6; islands fall back to
 * `<textarea>`. Real browsers and Playwright get CM6 via `useCodeMirror`.
 *
 * Export a single boolean so `settings`, `startUrl`, and `customHeaders` stay aligned
 * if the heuristic changes (e.g. another test runner UA).
 */

// Stryker disable all: jsdom path; e2e covers real browser.
export const CM6_AVAILABLE =
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  !/jsdom/i.test(navigator.userAgent || '');
// Stryker restore all
