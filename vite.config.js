// Vite dev server config.
//
// Serves the app from app/ on http://localhost:5173. The app uses plain
// <script> tags (IIFE globals, not ES modules), so appType is 'mpa' to
// prevent Vite from injecting HMR or transforming script tags.
//
//   yarn dev             # start dev server
//   yarn build           # production build (see scripts/build.mjs)
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createReadStream, existsSync, statSync } from 'node:fs';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const nodeModulesDir = resolve(repoRoot, 'node_modules');

// Bridge /node_modules → ./node_modules. The index.html references
// vendor scripts as `node_modules/...` paths relative to app/, but
// node_modules actually lives at the repo root (one level up from
// the Vite root). This middleware bridges that gap.
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
        // Vite's built-in static serve will set content-type for known
        // extensions; we let it through by streaming the bytes.
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
  // The app uses plain <script src="..."> tags, not ES modules.
  // 'mpa' tells Vite not to inject HMR client into HTML and not to try
  // ESM-transforming arbitrary script tags.
  appType: 'mpa',
  server: {
    port: 5173,
    fs: {
      // Allow Vite to serve files from the repo root (parent of `app/`)
      // so vendor source maps and the like resolve.
      allow: [repoRoot],
    },
  },
  plugins: [nodeModulesMiddleware()],
});
