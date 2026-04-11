// Vitest config — the sole unit/component test runner (Angular + Karma
// removed in Phase 12). Covers Preact islands and pure ESM service modules.
//
// Mutation testing (Stryker + this file): `yarn stryker` (incremental),
// `yarn stryker:full` (--force, refresh reports/stryker-incremental.json), `yarn stryker:dry`.
// See stryker.config.json. @stryker-mutator/core currently requires Node 20+.
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
      'src/**/*.test.js',
      'src/**/*.spec.js',
      // Islands live under app/scripts/islands/ during the migration so
      // Grunt's existing connect middleware can serve them via <script>
      // tags without infra changes. They move to src/ in PR 10.5 once
      // Vite owns the build.
      'app/scripts/islands/**/*.spec.{js,jsx}',
      // Phase 11a: pure service modules extracted from Angular
      'app/scripts/services/**/*.spec.js',
    ],
    environment: 'jsdom',
  },
});
