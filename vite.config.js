// Vite dev server config — PR 4a of the Angular removal migration.
//
// Goal: prove the existing Angular 1 app boots under Vite's dev server
// without changing any application code, while Grunt remains the
// production build and the default `npm test` runner. Run with:
//
//   yarn dev:vite        # serves app/ on http://localhost:5173
//
// We do NOT use Vite for the production build yet. That's PR 4b.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createReadStream, existsSync, statSync } from 'node:fs';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const nodeModulesDir = resolve(repoRoot, 'node_modules');

// Mirror the Grunt connect middleware (Gruntfile.js:75) that mounts
// /node_modules → ./node_modules. The Angular index.html references
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
  // The Angular app uses plain <script src="..."> tags, not ES modules.
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
