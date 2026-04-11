#!/usr/bin/env node
/**
 * Production build script — replaces Grunt's build pipeline.
 *
 * Produces a self-contained dist/ directory with:
 *   - HTML pages (index.html, help.html)
 *   - CSS (app styles + Bootstrap vendor CSS)
 *   - JS (app scripts, pre-built island/service IIFEs, vendor libs)
 *   - Static assets (images, docs, fonts, favicon, etc.)
 *
 * The app uses plain <script> tags (IIFE globals), not ES modules, so
 * Vite's module-aware build can't process it directly. This script does
 * a straightforward copy + selective vendor extraction — the same job
 * Grunt's copy/concat/usemin pipeline did, minus the complexity.
 *
 * Usage:
 *   node scripts/build.mjs          # full build (islands + dist)
 *   node scripts/build.mjs --quick  # skip island rebuild (assume already built)
 */
import { execSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appDir = resolve(root, 'app');
const dist = resolve(root, 'dist');
const nodeModules = resolve(root, 'node_modules');

const quick = process.argv.includes('--quick');

// --- Step 1: Build island/service IIFEs ---
if (!quick) {
  console.log('Building islands and services...');
  execSync('yarn build:islands', { cwd: root, stdio: 'inherit' });
}

// --- Step 2: Clean dist/ ---
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// --- Step 3: Copy app/ to dist/ ---
console.log('Copying app/ to dist/...');
cpSync(appDir, dist, { recursive: true });

// --- Step 4: Copy vendor files from node_modules/ ---
// Only the files actually referenced by <script> and <link> tags in the HTML.
console.log('Copying vendor files...');

const vendorFiles = [
  // Ace editor
  'ace-builds/src-min-noconflict/ace.js',
  'ace-builds/src-min-noconflict/ext-language_tools.js',
  'ace-builds/src-min-noconflict/worker-json.js',
  'ace-builds/src-min-noconflict/mode-json.js',
  // Bootstrap CSS (JS removed — all components now use native DOM/Preact)
  'bootstrap/dist/css/bootstrap.css',
  // URI.js (must load before splainer-search)
  'urijs/src/URI.js',
  // splainer-search 3.0.0 wired IIFE
  'splainer-search/dist/splainer-search-wired.js',
  // Preact UMD (islands reference window.preact / window.preactHooks)
  'preact/dist/preact.umd.js',
  'preact/hooks/dist/hooks.umd.js',
];

// Bootstrap fonts (directory copy)
const vendorDirs = [
  'bootstrap/dist/fonts',
];

for (const file of vendorFiles) {
  const src = resolve(nodeModules, file);
  const dest = resolve(dist, 'node_modules', file);
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(src)) {
    cpSync(src, dest);
  } else {
    console.warn(`  Warning: vendor file not found: ${file}`);
  }
}

for (const dir of vendorDirs) {
  const src = resolve(nodeModules, dir);
  const dest = resolve(dist, 'node_modules', dir);
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true });
  } else {
    console.warn(`  Warning: vendor directory not found: ${dir}`);
  }
}

console.log('Build complete → dist/');
