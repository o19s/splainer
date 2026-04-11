#!/usr/bin/env node
/**
 * Production build script.
 *
 * Phase 13b: uses Vite's standard build to process index.html and main.js
 * as ESM entry points. Vite bundles all islands, services, and app scripts
 * (including CodeMirror 6) into hashed JS/CSS chunks in dist/.
 *
 * Vendor scripts loaded via plain <script> tags (urijs, splainer-search)
 * are NOT processed by Vite — they're copied into dist/node_modules/ so
 * the HTML references resolve.
 *
 * Usage:
 *   node scripts/build.mjs          # full build
 */
import { build } from 'vite';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, 'dist');
const nodeModules = resolve(root, 'node_modules');

// --- Step 1: Run Vite build (processes index.html, main.js, all imports) ---
console.log('Running Vite build...');
await build({
  configFile: resolve(root, 'vite.config.js'),
});

// --- Step 2: Copy vendor files that are loaded via plain <script> tags ---
// These are IIFEs/UMDs not processed by Vite's module graph.
console.log('Copying vendor files...');

const vendorFiles = [
  // Bootstrap CSS (loaded via <link> in HTML — Vite may inline or copy it,
  // but the node_modules reference in help.html needs this too)
  'bootstrap/dist/css/bootstrap.css',
  // URI.js (must load before splainer-search)
  'urijs/src/URI.js',
  // splainer-search 3.0.0 wired IIFE
  'splainer-search/dist/splainer-search-wired.js',
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
