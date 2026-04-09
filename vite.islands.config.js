// Vite library-mode build for the post-Angular Preact islands.
//
// Each .jsx file under app/scripts/islands/ is compiled to an IIFE bundle
// at app/scripts/islands/dist/<name>.js. Preact is externalized — the
// build references `window.preact.h`, `window.preact.render`, etc., which
// are loaded by app/index.html before any island script.
//
// Run `yarn build:islands` once before serving (grunt serve) or testing
// (npm test). For dev iteration, run `yarn build:islands:watch` in a
// separate terminal alongside `grunt serve` or `yarn dev:vite`.
//
// This is intentionally a *small* build step that lives under the existing
// Grunt prod pipeline. The full Grunt → Vite swap happens in PR 10.5 once
// Angular is gone; until then, islands are pre-built ESM-to-IIFE and the
// rest of splainer goes through Grunt unchanged.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const islandsDir = resolve(here, 'app/scripts/islands');

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
  build: {
    outDir: resolve(islandsDir, 'dist'),
    emptyOutDir: true,
    minify: false, // dev/test artifact; readable stack traces matter more than size
    sourcemap: true,
    lib: {
      // One entry per island. Add new islands here in PRs 7–10.
      entry: {
        customHeaders: resolve(islandsDir, 'customHeaders.jsx'),
      },
      formats: ['iife'],
      // The IIFE name is per-entry; Vite uses `${name}` interpolation.
      // We don't actually use the global var — each island file attaches
      // to window.SplainerIslands.* as a side effect — but Vite requires
      // a name for IIFE output.
      name: 'SplainerIslandBundle',
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: ['preact', 'preact/hooks'],
      output: {
        globals: {
          preact: 'preact',
          'preact/hooks': 'preactHooks',
        },
      },
    },
  },
});
