/** OpenSearch settings — delegates to jsonEngineSettings with engine='os'. */

import { createJsonEngineSettings } from './jsonEngineSettings.js';

export const { fromStartUrl, fromTweakedSettings } = createJsonEngineSettings('os');
