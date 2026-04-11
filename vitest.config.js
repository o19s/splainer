// Vitest config — covers Preact islands and service modules.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // JSX → preact for spec files. Vitest 4 uses oxc (not esbuild) under
  // the hood and emits `react/jsx-dev-runtime` imports regardless of any
  // esbuild jsxImportSource hint. The resolve aliases below redirect those
  // imports to Preact's runtime — same end result, more reliable mechanism.
  resolve: {
    alias: {
      'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
  test: {
    include: [
      'app/scripts/islands/**/*.spec.{js,jsx}',
      'app/scripts/services/**/*.spec.js',
    ],
    environment: 'jsdom',
    setupFiles: ['./app/scripts/test-helpers/jsdom-dialog-polyfill.js'],
  },
});
