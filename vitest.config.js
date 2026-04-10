// Vitest config for new (post-Angular) code only.
// The legacy Karma suite under test/spec/** continues to run via `npm test`
// (grunt test) against the Angular code for as long as Angular exists.
// See MIGRATION_OPTIONS.md for the rationale.
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
    ],
    environment: 'jsdom',
  },
});
