/** Elasticsearch settings — delegates to jsonEngineSettings with engine='es'. */

import { createJsonEngineSettings } from './jsonEngineSettings.js';

export const { fromStartUrl, fromTweakedSettings } = createJsonEngineSettings('es');
