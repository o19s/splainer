// Vitest config — covers Preact islands and service modules.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // JSX → preact for spec files. Vitest 4 uses oxc (not esbuild) under
  // the hood and emits `react/jsx-dev-runtime` imports regardless of any
  // esbuild jsxImportSource hint. The resolve aliases below redirect those
  // imports to Preact's runtime — same end result, more reliable mechanism.
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, 'app/scripts'),
      '@test': path.resolve(__dirname, 'tests/helpers'),
      'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
  test: {
    include: ['tests/islands/**/*.spec.{js,jsx}', 'tests/services/**/*.spec.js'],
    environment: 'jsdom',
    setupFiles: ['./tests/helpers/jsdom-dialog-polyfill.js'],
  },
});
