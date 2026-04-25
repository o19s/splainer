/**
 * `splainer-search` is a normal dependency (see `package.json`); the published
 * package includes `wired.js` at the package root. The Splainer app imports
 * `splainer-search/wired` and Vite bundles it — no separate library `dist/`
 * build step is required in this repo for local dev, CI, or Docker.
 *
 * Fails fast if the dependency is missing or incomplete after `yarn install`
 * (including when using `splainer-search@file:../splainer-search` for local
 * development).
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
    'ensure-splainer-search: splainer-search/wired.js missing — incomplete install.',
  );
  process.exit(1);
}
