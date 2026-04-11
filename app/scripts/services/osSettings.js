'use strict';

/**
 * Pure-JS OpenSearch settings logic — no Angular dependency.
 *
 * Delegates to the shared JSON-engine factory (jsonEngineSettings.js)
 * with engine = 'os'. See that module for the actual URL parsing and
 * settings mutation logic.
 */

import { createJsonEngineSettings } from './jsonEngineSettings.js';

export const { fromStartUrl, fromTweakedSettings } = createJsonEngineSettings('os');

if (typeof globalThis !== 'undefined') {
  globalThis.SplainerServices = globalThis.SplainerServices || {};
  globalThis.SplainerServices.osSettings = { fromStartUrl, fromTweakedSettings };
}
