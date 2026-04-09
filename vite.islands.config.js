// Vite library-mode build for the post-Angular Preact islands.
//
// Each .jsx file under app/scripts/islands/ is compiled to an IIFE bundle
// at app/scripts/islands/dist/<name>.js. Preact is externalized — the
// build references `window.preact.*` (and `window.preactHooks.*`), which
// are loaded by app/index.html before any island script.
//
// Multi-entry note (PR 7): Vite library mode does not support multiple
// entries with IIFE format ("Multiple entry points are not supported when
// output formats include 'umd' or 'iife'"). Each IIFE needs its own scope,
// so we run one build per island. The package.json scripts orchestrate
// this via scripts/build-islands.mjs, which loops over the entries below
// and invokes Vite's programmatic build() API once per island.
//
// To add a new island in PRs 9–10: append to the `islands` array, write
// the .jsx file, copy the directive shim pattern. No other config change.
//
// TODO(PR9): with PR 9 adding multiple entries (DocRow, DetailedDoc,
// DocExplain), revisit whether a glob-based entry discovery
// (`fs.readdirSync(islandsDir).filter(f => f.endsWith('.jsx'))`) is worth
// it. At three entries the explicit list is still clearer than the glob;
// at five-plus it probably isn't. DX/Tooling's PR 8 ask, noted here so PR
// 9 doesn't re-derive the reasoning.
//
// Run `yarn build:islands` once before serving (grunt serve) or testing
// (npm test). For dev iteration, run `yarn build:islands:watch` in a
// separate terminal alongside `grunt serve` or `yarn dev:vite`.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const islandsDir = resolve(here, 'app/scripts/islands');

// Each island is built as its own IIFE bundle. Add new islands here.
export const islands = [
  { name: 'customHeaders', entry: resolve(islandsDir, 'customHeaders.jsx') },
  { name: 'settings', entry: resolve(islandsDir, 'settings.jsx') },
  { name: 'docSelector', entry: resolve(islandsDir, 'docSelector.jsx') },
  { name: 'solrSettingsWarning', entry: resolve(islandsDir, 'solrSettingsWarning.jsx') },
  { name: 'startUrl', entry: resolve(islandsDir, 'startUrl.jsx') },
  { name: 'docRow', entry: resolve(islandsDir, 'docRow.jsx') },
];

export const distDir = resolve(islandsDir, 'dist');

// Returns a Vite config object for a single island. Consumed by
// scripts/build-islands.mjs (one call per island).
export function configFor({ name, entry }, { watch = false } = {}) {
  return {
    esbuild: {
      jsx: 'automatic',
      jsxImportSource: 'preact',
    },
    build: {
      outDir: distDir,
      // Don't wipe the dist between islands — we'd lose the previous one.
      // The build script empties the dir once before the loop.
      emptyOutDir: false,
      minify: false, // dev/test artifact; readable stack traces matter more than size
      sourcemap: true,
      watch: watch ? {} : null,
      lib: {
        entry,
        formats: ['iife'],
        // Each IIFE needs a unique global name; we don't read it (the
        // island attaches to window.SplainerIslands.* as a side effect)
        // but Vite/Rollup require it for IIFE output.
        name: `SplainerIsland_${name}`,
        fileName: () => `${name}.js`,
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
  };
}
