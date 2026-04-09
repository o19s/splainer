// Builds every Preact island defined in vite.islands.config.js.
//
// Vite library mode does not allow multiple entries with IIFE format
// (each IIFE needs its own global scope), so we run one build per island.
// This script is the orchestration loop.
//
// Usage:
//   node scripts/build-islands.mjs           # one-shot build of all islands
//   node scripts/build-islands.mjs --watch   # watch mode (all islands in parallel)
//
// Wired up via package.json:
//   yarn build:islands         → node scripts/build-islands.mjs
//   yarn build:islands:watch   → node scripts/build-islands.mjs --watch
import { build } from 'vite';
import { rmSync, mkdirSync } from 'node:fs';
import { islands, distDir, configFor } from '../vite.islands.config.js';

const watch = process.argv.includes('--watch');

// Empty the dist dir once before the loop. The per-island configs set
// emptyOutDir: false so subsequent builds don't wipe each other.
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

if (watch) {
  // Watch mode: kick off all builds in parallel and let Vite hold the
  // process open. Each Rollup watcher logs its own changes.
  await Promise.all(islands.map((island) => build(configFor(island, { watch: true }))));
} else {
  // One-shot: serial loop so the per-island bundle sizes log in order.
  for (const island of islands) {
    await build(configFor(island));
  }
}
