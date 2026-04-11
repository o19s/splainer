'use strict';

/**
 * Pure-JS Elasticsearch settings logic — no Angular dependency.
 *
 * Delegates to the shared JSON-engine factory (jsonEngineSettings.js)
 * with engine = 'es'. See that module for the actual URL parsing and
 * settings mutation logic.
 */

import { createJsonEngineSettings } from './jsonEngineSettings.js';

export const { fromStartUrl, fromTweakedSettings } = createJsonEngineSettings('es');

if (typeof globalThis !== 'undefined') {
  globalThis.SplainerServices = globalThis.SplainerServices || {};
  globalThis.SplainerServices.esSettings = { fromStartUrl, fromTweakedSettings };
}
