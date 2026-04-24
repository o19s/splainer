/**
 * splainer-search is installed from Git and ships library source (including
 * `wired.js`) in the package root. The Splainer app imports
 * `splainer-search/wired` and Vite bundles it — no `dist/*.js` build is
 * required for local dev, CI, or Docker.
 *
 * This script fails fast if the dependency is missing or incomplete after
 * `yarn install`.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const searchRoot = join(root, 'node_modules', 'splainer-search');
const wiredEntry = join(searchRoot, 'wired.js');
const pkgJson = join(searchRoot, 'package.json');

if (!existsSync(pkgJson)) {
  console.error(
    'ensure-splainer-search: node_modules/splainer-search missing; run yarn install first.',
  );
  process.exit(1);
}

if (!existsSync(wiredEntry)) {
  console.error(
    'ensure-splainer-search: splainer-search/wired.js missing — incomplete package checkout.',
  );
  process.exit(1);
}
