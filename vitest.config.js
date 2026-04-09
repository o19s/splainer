// Vitest config for new (post-Angular) code only.
// The legacy Karma suite under test/spec/** continues to run via `npm test`
// (grunt test) against the Angular code for as long as Angular exists.
// See MIGRATION_OPTIONS.md for the rationale.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.js',
      'src/**/*.spec.js',
      // Islands live under app/scripts/islands/ during the migration so
      // Grunt's existing connect middleware can serve them via <script>
      // tags without infra changes. They move to src/ in PR 10.5 once
      // Vite owns the build.
      'app/scripts/islands/**/*.spec.js',
    ],
    environment: 'jsdom',
  },
});
