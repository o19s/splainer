// Vite dev + build config.
//   yarn dev     — dev server (port 5173)
//   yarn build   — production build (scripts/build.js)
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createReadStream, existsSync, statSync } from 'node:fs';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const nodeModulesDir = resolve(repoRoot, 'node_modules');

// Bridge /node_modules → repo-root node_modules for dev-server requests.
// index.html links Bootstrap (and similar) as `node_modules/...` relative to
// the Vite root (app/), but dependencies live at the repo root.
function nodeModulesMiddleware() {
  return {
    name: 'splainer-node-modules-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/node_modules/')) return next();
        const rel = req.url.slice('/node_modules/'.length).split('?')[0];
        const filePath = resolve(nodeModulesDir, rel);
        if (!filePath.startsWith(nodeModulesDir)) return next(); // path traversal guard
        if (!existsSync(filePath) || !statSync(filePath).isFile()) return next();
        const ext = filePath.split('.').pop();
        const types = { js: 'application/javascript', css: 'text/css', map: 'application/json' };
        if (types[ext]) res.setHeader('Content-Type', types[ext]);
        createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig({
  root: 'app',
  base: './',
  // Preact JSX transform — Vite's esbuild handles .jsx files automatically.
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
  // Redirect react/jsx-*-runtime → preact equivalents. Vite's dependency
  // scanner doesn't read esbuild's jsxImportSource, so it tries to resolve
  // the default react runtime. Same aliases as vitest.config.js.
  resolve: {
    alias: {
      'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
  server: {
    port: 5173,
    fs: {
      // Allow Vite to serve files from the repo root (parent of app/)
      // so imports like '../vitest.config.js' and node_modules resolve.
      allow: [repoRoot],
    },
  },
  build: {
    // Build output goes to dist/ at repo root.
    outDir: resolve(repoRoot, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(repoRoot, 'app/index.html'),
        help: resolve(repoRoot, 'app/help.html'),
      },
    },
  },
  plugins: [nodeModulesMiddleware()],
});
