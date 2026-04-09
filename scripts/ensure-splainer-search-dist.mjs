/**
 * splainer-search from Git does not ship `dist/` (build runs on publish).
 * After `yarn install`, produce wired IIFE + ESM bundles if they are missing.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const searchRoot = join(root, 'node_modules', 'splainer-search');
const marker = join(searchRoot, 'dist', 'splainer-search-wired.js');

if (existsSync(marker)) {
  process.exit(0);
}

if (!existsSync(join(searchRoot, 'package.json'))) {
  console.error(
    'ensure-splainer-search-dist: node_modules/splainer-search missing; run yarn install first.',
  );
  process.exit(1);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: searchRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

const lockfile = join(searchRoot, 'package-lock.json');
run('npm', existsSync(lockfile) ? ['ci'] : ['install']);
run('npm', ['run', 'build']);
